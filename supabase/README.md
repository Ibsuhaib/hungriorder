# Backend moved

hungriOrder shares its backend with the hungriAR POS — one Supabase project
serves both products (same restaurants, menu, and orders tables).

The canonical migrations and edge functions live in the **hungriar-app** repo:

- `supabase/migrations/32_online_ordering.sql` — online-ordering schema (additive)
- `supabase/migrations/33_online_storage.sql` — storefront image buckets
- `supabase/functions/place-online-order` — public order placement (server-side pricing)
- `supabase/functions/update-order-status` — admin status transitions + tracking broadcasts

See `ONLINE_ORDERING.md` in that repo for the full deployment guide.

The original standalone schema this repo shipped with (a separate Supabase
project) is preserved in this repo's first commit
(`Snapshot: original standalone hungriOrder scaffold`) — do not run it against
the unified project.
