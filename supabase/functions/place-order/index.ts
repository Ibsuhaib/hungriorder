// place-order — validates and creates an order atomically.
// Public (guest checkout allowed); prices/totals are always recomputed
// server-side from the menu, never trusted from the client.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, handleOptions, jsonResponse } from "../_shared/cors.ts";
import { broadcast } from "../_shared/broadcast.ts";

const TAX_RATE = 0.05; // GST included in menu prices (hungriAR convention)
const PHONE_RE = /^[6-9]\d{9}$/; // Indian mobile numbers
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAYMENT_METHODS = ["cash", "upi", "card", "other"];
const ORDER_TYPES = ["delivery", "takeaway"];
const MAX_ITEMS = 50;
const MAX_QTY = 50;

const round2 = (n: number) => Math.round(n * 100) / 100;
const clean = (v: unknown, max: number): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions(req);
  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed" }, 405);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(req, { error: "Invalid JSON body" }, 400);
  }

  // ---- Validate input shape -------------------------------------------
  const restaurantId = body.restaurant_id;
  if (typeof restaurantId !== "string" || !UUID_RE.test(restaurantId)) {
    return jsonResponse(req, { error: "Invalid restaurant_id" }, 400);
  }

  const rawItems = body.items;
  if (!Array.isArray(rawItems) || rawItems.length === 0 || rawItems.length > MAX_ITEMS) {
    return jsonResponse(req, { error: "Order must contain 1-50 items" }, 400);
  }
  const wanted = new Map<string, number>();
  for (const it of rawItems) {
    const id = (it as Record<string, unknown>)?.menu_item_id;
    const qty = (it as Record<string, unknown>)?.quantity;
    if (
      typeof id !== "string" || !UUID_RE.test(id) ||
      typeof qty !== "number" || !Number.isInteger(qty) ||
      qty < 1 || qty > MAX_QTY
    ) {
      return jsonResponse(req, { error: "Invalid order item" }, 400);
    }
    wanted.set(id, (wanted.get(id) ?? 0) + qty);
  }

  const phone = clean(body.customer_phone, 15)?.replace(/\D/g, "").slice(-10);
  if (!phone || !PHONE_RE.test(phone)) {
    return jsonResponse(req, { error: "A valid 10-digit mobile number is required" }, 400);
  }

  const orderType = ORDER_TYPES.includes(body.order_type as string)
    ? (body.order_type as string)
    : "delivery";
  const paymentMethod = PAYMENT_METHODS.includes(body.payment_method as string)
    ? (body.payment_method as string)
    : "cash";
  const customerName = clean(body.customer_name, 80);
  const notes = clean(body.notes, 500);

  let deliveryAddress: Record<string, string> | null = null;
  if (orderType === "delivery") {
    const addr = body.delivery_address as Record<string, unknown> | undefined;
    const line1 = clean(addr?.line1, 200);
    if (!addr || typeof addr !== "object" || !line1) {
      return jsonResponse(req, { error: "Delivery address is required" }, 400);
    }
    deliveryAddress = { line1 };
    for (const k of ["label", "line2", "landmark", "city", "pincode"]) {
      const v = clean(addr[k], 120);
      if (v) deliveryAddress[k] = v;
    }
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // ---- Rate limiting: per phone and per IP ----------------------------
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  for (const [id, max] of [
    [`order:phone:${phone}`, 5],
    [`order:ip:${ip}`, 15],
  ] as const) {
    const { data: allowed, error } = await admin.rpc("check_rate_limit", {
      p_identifier: id,
      p_max: max,
      p_window_seconds: 600,
    });
    if (error) console.error("rate limit check failed", error);
    if (allowed === false) {
      return jsonResponse(req, { error: "Too many orders. Please try again in a few minutes." }, 429);
    }
  }

  // ---- Restaurant + subscription checks --------------------------------
  const { data: restaurant, error: rErr } = await admin
    .from("restaurants")
    .select("id, name, is_active, subscription_expiry, delivery_enabled, min_order_amount, delivery_fee")
    .eq("id", restaurantId)
    .single();
  if (rErr || !restaurant) {
    return jsonResponse(req, { error: "Restaurant not found" }, 404);
  }
  if (!restaurant.is_active) {
    return jsonResponse(req, { error: "This restaurant is not accepting orders right now" }, 403);
  }
  if (
    restaurant.subscription_expiry &&
    new Date(restaurant.subscription_expiry) < new Date()
  ) {
    return jsonResponse(req, { error: "This restaurant is not accepting online orders right now" }, 403);
  }
  if (orderType === "delivery" && !restaurant.delivery_enabled) {
    return jsonResponse(req, { error: "Delivery is not available for this restaurant" }, 400);
  }

  // ---- Recompute prices from the menu (never trust the client) ---------
  const { data: menuItems, error: mErr } = await admin
    .from("menu_items")
    .select("id, name, price, is_available, restaurant_id")
    .in("id", [...wanted.keys()])
    .eq("restaurant_id", restaurantId);
  if (mErr) {
    console.error(mErr);
    return jsonResponse(req, { error: "Could not load menu items" }, 500);
  }
  const byId = new Map(menuItems.map((m) => [m.id, m]));
  const orderItems: Record<string, unknown>[] = [];
  let subtotal = 0;
  for (const [itemId, qty] of wanted) {
    const item = byId.get(itemId);
    if (!item || !item.is_available) {
      return jsonResponse(req, { error: "One or more items are no longer available. Please refresh the menu." }, 409);
    }
    const lineTotal = round2(Number(item.price) * qty);
    subtotal += lineTotal;
    orderItems.push({
      menu_item_id: item.id,
      item_name: item.name,
      item_price: Number(item.price),
      quantity: qty,
      line_total: lineTotal,
    });
  }
  subtotal = round2(subtotal);

  const minOrder = Number(restaurant.min_order_amount ?? 0);
  if (orderType === "delivery" && subtotal < minOrder) {
    return jsonResponse(req, { error: `Minimum order for delivery is ₹${minOrder}` }, 400);
  }

  const deliveryFee = orderType === "delivery" ? round2(Number(restaurant.delivery_fee ?? 0)) : 0;
  const tax = round2(subtotal - subtotal / (1 + TAX_RATE)); // included in prices
  const total = round2(subtotal + deliveryFee);

  // ---- Link the signed-in customer, if any -----------------------------
  let customerId: string | null = null;
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const { data: userData } = await admin.auth.getUser(
      authHeader.slice("Bearer ".length),
    );
    if (userData?.user) {
      customerId = userData.user.id;
      await admin.from("customers").upsert(
        { id: customerId, phone, name: customerName ?? undefined },
        { onConflict: "id", ignoreDuplicates: false },
      );
    }
  }

  // ---- Create atomically ------------------------------------------------
  const { data: orderId, error: cErr } = await admin.rpc("create_order_with_items", {
    p_order: {
      restaurant_id: restaurantId,
      customer_id: customerId ?? "",
      order_type: orderType,
      delivery_address: deliveryAddress,
      customer_phone: phone,
      customer_name: customerName,
      notes,
      subtotal,
      tax,
      total,
      discount: 0,
      delivery_fee: deliveryFee,
      payment_method: paymentMethod,
    },
    p_items: orderItems,
  });
  if (cErr || !orderId) {
    console.error("create order failed", cErr);
    return jsonResponse(req, { error: "Could not place the order. Please try again." }, 500);
  }

  await broadcast(`restaurant-orders-${restaurantId}`, "new_order", {
    order_id: orderId,
    status: "pending",
    total,
  });

  return jsonResponse(req, { order_id: orderId, status: "pending", total }, 201);
});
