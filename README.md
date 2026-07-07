# hungriOrder

Commission-free online ordering for restaurants. Every restaurant gets its own branded storefront
(`hungriorder.com/r/royal-kitchen`); customers order delivery or takeaway and track status live;
restaurants pay only a flat yearly subscription and keep 100% of every order **and** their customer data.

hungriOrder is the consumer-facing side of the platform. The **hungriAR POS** (separate repo:
`hungriar-app`) is the software restaurants use for in-house management. Both run on **one shared
Supabase project** — same restaurants, menu, and orders tables — so a menu edit in the POS is live
on the storefront instantly, and online orders appear in the POS order screen in real time.

Restaurants come in two flavours:

1. **hungriAR restaurants** (`has_hungriar = true`) — manage everything (including online orders)
   from the hungriAR admin panel. hungriOrder is just their storefront.
2. **Online-only restaurants** (`has_hungriar = false`) — use the lightweight admin dashboard in
   this repo: live orders, menu management, KOT/receipt printing, settings. No POS, tables, or AR.

## Repository layout

```
packages/
  customer-app/      Customer storefront (React 18 + Vite 5 + Tailwind, installable PWA)
  admin-app/         Standalone restaurant admin for online-only restaurants
supabase/
  README.md          Pointer — the shared backend (migrations + edge functions) lives in hungriar-app
scripts/
  gen-icons.mjs      Generates placeholder PWA icons (replace with brand icons before launch)
```

## Tech stack

React 18 · Vite 5 · Tailwind CSS 3 · Framer Motion · Lucide icons · Supabase (Postgres + Auth +
Realtime + Edge Functions + Storage) · Workbox PWA (injectManifest) · Vercel hosting.

## Backend (shared with hungriAR)

The database schema, RLS policies, and the two edge functions these apps call live in the
**hungriar-app** repo and are already deployed to the shared Supabase project:

- `place-online-order` — public order placement; recomputes all prices server-side, enforces
  `is_active`, `delivery_enabled`, subscription expiry, minimum order, and rate limits.
- `update-order-status` — validated status transitions
  (`pending → confirmed → preparing → ready → out_for_delivery → delivered`, cancellable until
  dispatch) + realtime broadcasts to the customer tracking page.
- `get_order_tracking(uuid)` RPC — public tracking by unguessable order UUID; orders can never be
  listed publicly, and online orders (which carry a phone/address) are hidden from anonymous reads.

See `ONLINE_ORDERING.md` in hungriar-app for the full backend deployment guide.

## Local development

```sh
npm install          # installs both workspaces

# configure env for each app (same Supabase project as hungriar-app)
cp packages/customer-app/.env.example packages/customer-app/.env
cp packages/admin-app/.env.example packages/admin-app/.env
# fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

npm run dev:customer   # http://localhost:5173
npm run dev:admin      # http://localhost:5174
npm run build          # production builds for both
```

## Deployment (Vercel)

Create **two** Vercel projects from this repo (Vercel supports monorepos natively):

| Project | Root directory | Framework | Suggested domain |
|---|---|---|---|
| customer storefront | `packages/customer-app` | Vite | `hungriorder.com` |
| standalone admin | `packages/admin-app` | Vite | `admin.hungriorder.com` |

- Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in each project's environment variables
  (the shared project's values). The admin app also accepts optional `VITE_STOREFRONT_URL` and
  `VITE_HUNGRIAR_ADMIN_URL`.
- Each app ships a `vercel.json` with SPA rewrites and hardened security headers (strict CSP,
  `frame-ancestors 'none'`, HSTS, nosniff, referrer and permissions policies).
- After attaching domains, add them to the `ALLOWED_ORIGINS` edge-function secret in the shared
  Supabase project (comma-separated, alongside the hungriAR domains).

## Onboarding a restaurant

Restaurants are managed from the hungriAR **Super Admin** panel (no public signup):

1. Super Admin → restaurant row → *Online Ordering*: set subscription tier + expiry; toggle
   `has_hungriar` off for online-only restaurants.
2. The restaurant admin enables online ordering and fills in the storefront profile
   (hungriAR Settings → Online Ordering, or this repo's admin app for online-only restaurants).
3. The storefront is instantly live at `/r/<slug>`.

Auth note: admin accounts are the same `restaurant_admins`-linked users as hungriAR. Customer
phone-OTP sign-in is optional (enable the Phone provider + an SMS provider in Supabase); without
it customers order as guests.
