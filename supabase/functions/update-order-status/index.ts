// update-order-status — restaurant admins move an order through its
// lifecycle. Requires an authenticated admin whose profile belongs to the
// order's restaurant. Broadcasts the change to the customer tracking page.

import { createClient } from "npm:@supabase/supabase-js@2";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { broadcast } from "../_shared/broadcast.ts";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Allowed transitions; cancellation is possible until food goes out.
const TRANSITIONS: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["out_for_delivery", "delivered", "cancelled"],
  out_for_delivery: ["delivered"],
  delivered: [],
  cancelled: [],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions(req);
  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse(req, { error: "Not authenticated" }, 401);
  }

  let body: { order_id?: unknown; new_status?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(req, { error: "Invalid JSON body" }, 400);
  }
  const orderId = body.order_id;
  const newStatus = body.new_status;
  if (typeof orderId !== "string" || !UUID_RE.test(orderId)) {
    return jsonResponse(req, { error: "Invalid order_id" }, 400);
  }
  if (
    typeof newStatus !== "string" ||
    !Object.values(TRANSITIONS).some((t) => t.includes(newStatus))
  ) {
    return jsonResponse(req, { error: "Invalid status" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // ---- Identify the caller and their restaurant ------------------------
  const { data: userData, error: uErr } = await admin.auth.getUser(
    authHeader.slice("Bearer ".length),
  );
  if (uErr || !userData?.user) {
    return jsonResponse(req, { error: "Not authenticated" }, 401);
  }
  const { data: profile } = await admin
    .from("profiles")
    .select("restaurant_id, role")
    .eq("id", userData.user.id)
    .single();
  if (!profile) {
    return jsonResponse(req, { error: "No admin profile for this account" }, 403);
  }

  // ---- Load and authorize the order ------------------------------------
  const { data: order, error: oErr } = await admin
    .from("orders")
    .select("id, restaurant_id, status, customer_phone")
    .eq("id", orderId)
    .single();
  if (oErr || !order) {
    return jsonResponse(req, { error: "Order not found" }, 404);
  }
  if (order.restaurant_id !== profile.restaurant_id) {
    return jsonResponse(req, { error: "Not authorized for this order" }, 403);
  }
  if (!TRANSITIONS[order.status]?.includes(newStatus)) {
    return jsonResponse(
      req,
      { error: `Cannot move an order from '${order.status}' to '${newStatus}'` },
      409,
    );
  }

  const { error: upErr } = await admin
    .from("orders")
    .update({ status: newStatus })
    .eq("id", orderId);
  if (upErr) {
    console.error("status update failed", upErr);
    return jsonResponse(req, { error: "Could not update the order" }, 500);
  }

  await broadcast(`order-${orderId}`, "status_update", {
    order_id: orderId,
    status: newStatus,
  });

  return jsonResponse(req, { order_id: orderId, status: newStatus });
});
