// Orders placed on this device, remembered locally.
//
// Most customers order as guests — the entry gate collects a phone number but
// never creates an account — so there is no server-side "my orders" to query
// for them. Without this, closing the tab after checkout loses the only link
// to the order forever.
//
// Only the order id is needed to track an order: get_order_tracking() is a
// SECURITY DEFINER function granted to anon, so /order/:id works signed out.
// The rest is cached purely so the list can be rendered before any network
// call returns.

const KEY = 'ho-recent-orders-v1';
const MAX = 10;

export function loadRecentOrders() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.filter((o) => o && o.orderId) : [];
  } catch {
    return [];
  }
}

export function addRecentOrder({ orderId, slug, restaurantName, total }) {
  if (!orderId) return;
  try {
    const existing = loadRecentOrders().filter((o) => o.orderId !== orderId);
    const next = [{ orderId, slug, restaurantName, total, placedAt: Date.now() }, ...existing].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable (private mode, quota) — tracking still works via the
       success page link, the list just won't persist */
  }
}
