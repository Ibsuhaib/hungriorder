/**
 * What makes a restaurant orderable.
 *
 * The storefront used to filter on is_active + delivery_enabled only, while
 * place-online-order additionally rejects restaurants whose subscription is
 * inactive or expired. A lapsed restaurant therefore stayed fully browsable
 * and failed only at "Confirm order" — after the customer had picked dishes,
 * typed an address and hit the final button.
 *
 * Both helpers below must mirror the checks in
 * supabase/functions/place-online-order/index.ts.
 */

const notExpired = () => `subscription_expiry.is.null,subscription_expiry.gte.${new Date().toISOString()}`;

/** For a query directly on the `restaurants` table. */
export function onlyOrderable(query) {
  return query
    .eq('is_active', true)
    .eq('delivery_enabled', true)
    .neq('subscription_status', 'inactive')
    .or(notExpired());
}

/** For a query that reaches restaurants through an embedded `restaurants!inner(...)`. */
export function onlyOrderableJoined(query) {
  return query
    .eq('restaurants.is_active', true)
    .eq('restaurants.delivery_enabled', true)
    .neq('restaurants.subscription_status', 'inactive')
    .or(notExpired(), { referencedTable: 'restaurants' });
}

/** Same rule, evaluated in JS against an already-fetched row. */
export function isOrderable(restaurant) {
  if (!restaurant?.is_active || !restaurant?.delivery_enabled) return false;
  if (restaurant.subscription_status === 'inactive') return false;
  if (restaurant.subscription_expiry && new Date(restaurant.subscription_expiry) < new Date()) return false;
  return true;
}
