# hungriOrder

Commission-free online ordering for restaurants. Every restaurant gets its own branded storefront
(`hungriorder.com/r/royal-kitchen`); customers order delivery or takeaway and track status live;
restaurants pay only a flat yearly subscription and keep 100% of every order **and** their customer data.

The platform runs in two modes:

1. **hungriAR-integrated** — restaurants already on the hungriAR POS use hungriOrder as their online
   storefront while orders flow into hungriAR's own order management. The schema here intentionally
   mirrors hungriAR conventions (`restaurants`, `menu_items`, `orders`, tax-inclusive prices, `order_type`)
   to make that merge straightforward.
2. **Standalone** — restaurants without hungriAR get the lightweight admin dashboard in this repo:
   live orders, menu management, KOT/receipt printing, settings. No POS, tables, or AR features.

## Repository layout

```
packages/
  customer-app/      Customer storefront (React 18 + Vite 5 + Tailwind, installable PWA)
  admin-app/         Standalone restaurant admin dashboard (React 18 + Vite 5 + Tailwind)
supabase/
  migrations/        001 schema · 002 RLS policies & functions · 003 storage buckets
  functions/         place-order · update-order-status (Deno edge functions)
  seed.sql           Demo restaurant + menu for development
scripts/
  gen-icons.mjs      Generates placeholder PWA icons (replace with brand icons before launch)
```

## Tech stack

React 18 · Vite 5 · Tailwind CSS 3 · Framer Motion · Lucide icons · Supabase (Postgres + Auth +
Realtime + Edge Functions + Storage) · Workbox PWA (injectManifest) · Vercel hosting.

## Setup

### 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Run the migrations **in order** in the SQL editor (or `supabase db push` with the CLI):
   `supabase/migrations/001_initial_schema.sql` → `002_rls_policies.sql` → `003_storage.sql`.
3. (Dev only) run `supabase/seed.sql` for a demo restaurant at `/r/royal-kitchen`.
4. **Auth settings:**
   - Email/password: enabled by default — used by restaurant admins.
   - Phone OTP (optional, for customer accounts): enable the Phone provider and configure an SMS
     provider (Twilio/MessageBird/Vonage). Without it, customers still order as guests.
5. Deploy the edge functions with the [Supabase CLI](https://supabase.com/docs/guides/cli):

   ```sh
   supabase functions deploy place-order --no-verify-jwt
   supabase functions deploy update-order-status --no-verify-jwt
   supabase secrets set ALLOWED_ORIGINS=https://your-customer-domain.com,https://your-admin-domain.com
   ```

   (`--no-verify-jwt` because `place-order` accepts guest checkout; both functions do their own
   auth/validation internally. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.)

### 2. Onboard a restaurant (super admin, via SQL / service role)

Restaurants and admin accounts are created by you, the platform operator — there is no public signup:

```sql
-- 1. Create the restaurant row (or use the seeded one).
insert into restaurants (name, slug, subscription_tier, subscription_expiry)
values ('Royal Kitchen', 'royal-kitchen', 'starter', now() + interval '1 year');

-- 2. Create an auth user for the owner: Dashboard → Authentication → Add user (email + password).

-- 3. Link the user to the restaurant:
insert into profiles (id, restaurant_id, role, name)
values ('<auth-user-uuid>', '<restaurant-uuid>', 'owner', 'Owner name');
```

Record billing in the `subscriptions` table (service-role only). Subscription enforcement is automatic:
expired restaurants are blocked from receiving orders (`place-order`) and admins see an "expired" page.

### 3. Frontend apps

```sh
npm install          # installs both workspaces
npm run icons        # generates placeholder PWA icons

# configure env for each app
cp packages/customer-app/.env.example packages/customer-app/.env
cp packages/admin-app/.env.example packages/admin-app/.env
# fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

npm run dev:customer   # http://localhost:5173
npm run dev:admin      # http://localhost:5174
npm run build          # production builds for both
```

## Deployment (Vercel)

Create **two** Vercel projects from this repo (Vercel supports monorepos natively):

| Project | Root directory | Framework |
|---|---|---|
| customer storefront | `packages/customer-app` | Vite |
| admin dashboard | `packages/admin-app` | Vite |

- Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in each project's environment variables.
- Each app ships a `vercel.json` with SPA rewrites and hardened security headers (strict CSP,
  `frame-ancestors 'none'`, HSTS, nosniff, referrer and permissions policies).
- Point custom domains (e.g. `order.example.com` and `admin.example.com`), then update the
  `ALLOWED_ORIGINS` function secret to those exact origins.

## Security model (zero trust)

- **RLS on every table**; no policy = deny. Public reads are limited to active restaurants, their
  categories, and available menu items. Customers see only their own rows/orders; admins only their
  restaurant's data (via the `my_restaurant_id()` security-definer helper).
- **Orders are insert-only through the `place-order` edge function** (service role). Totals are always
  recomputed server-side from menu prices — the client never supplies a price. Order/`order_items`
  writes are revoked from `anon`/`authenticated`; admins hold a column-level grant on `orders.status` only.
- **Column-level grants** stop admins from editing their own `subscription_tier`/`subscription_expiry`/`is_active`.
- **Order tracking** is exposed only through `get_order_tracking(uuid)` — an unguessable order UUID
  returns a minimal snapshot; orders can never be listed publicly.
- **Rate limiting** on `place-order`: 5 orders / 10 min per phone, 15 per IP (sliding window in `rate_limits`).
- **Status transitions** are validated server-side (`pending → confirmed → preparing → ready →
  out_for_delivery → delivered`, cancellation until dispatch).
- **CORS** on edge functions is restricted to `ALLOWED_ORIGINS`; no wildcard.
- **CSP & headers** via `vercel.json`; no secrets in client code (only the anon key, by design).
- **Storage**: public-read buckets, but writes require an admin whose `restaurant_id` matches the
  object's top-level folder; 2 MB size cap and image-only MIME allowlist at the bucket level.

## Feature map

**Customer app** — landing page with slug search · restaurant profile (`/r/:slug`) with categories,
veg/non-veg badges, opening-hours awareness · cart (one restaurant at a time, persisted) · checkout
with delivery/takeaway, saved addresses, payment-method capture (COD/UPI/card — recorded, charged
offline for now) · order success + live tracking (`/order/:id`) via Realtime broadcast · optional
phone-OTP accounts with order history and one-tap reorder · installable PWA with offline menu browsing.

**Admin app** — email/password login · dashboard (today's orders/revenue, pending count, recent
orders) · live orders board with Active/Completed/Cancelled tabs, accept/reject and step-by-step
status buttons · 80 mm thermal KOT and customer-receipt printing (`window.print`) · menu management
(categories with ordering, items with photos via Supabase Storage, availability toggles) · restaurant
settings (profile, images, delivery rules, opening hours) · subscription status card · expired-plan lockout.

## Roadmap / deliberately out of scope for MVP

- Online payments (Razorpay/Stripe) — `payment_method` and totals are already modelled for it.
- Super-admin web panel — restaurants/subscriptions are managed via SQL/service role for now.
- Push notifications to customers on status change (broadcast channel already in place).
- Staff management UI (`profiles` table and roles already support it).
- Marketplace-style global restaurant listing.
