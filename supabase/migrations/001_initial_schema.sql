-- hungriOrder — initial schema
-- Conventions follow hungriAR where they overlap (restaurants, menu_items,
-- orders) so the schemas can be merged later.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- restaurants
-- ---------------------------------------------------------------------------
create table public.restaurants (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  slug               text not null unique
                       check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 60),
  logo_url           text,
  cover_image_url    text,
  description        text,
  cuisine_tags       text[] not null default '{}',
  address            text,
  phone              text,
  delivery_enabled   boolean not null default true,
  delivery_radius_km integer not null default 5 check (delivery_radius_km >= 0),
  min_order_amount   numeric not null default 0 check (min_order_amount >= 0),
  delivery_fee       numeric not null default 0 check (delivery_fee >= 0),
  opening_hours      jsonb not null default '{}'::jsonb,
  subscription_tier  text not null default 'trial'
                       check (subscription_tier in ('trial', 'starter', 'growth', 'pro')),
  subscription_expiry timestamptz,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- menu_categories
-- ---------------------------------------------------------------------------
create table public.menu_categories (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 80),
  display_order integer not null default 0,
  created_at    timestamptz not null default now()
);

create index menu_categories_restaurant_idx on public.menu_categories (restaurant_id, display_order);

-- ---------------------------------------------------------------------------
-- menu_items  (price is final, tax inclusive — hungriAR convention)
-- ---------------------------------------------------------------------------
create table public.menu_items (
  id            uuid primary key default gen_random_uuid(),
  category_id   uuid not null references public.menu_categories(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 120),
  description   text,
  price         numeric not null check (price >= 0),
  image_url     text,
  is_veg        boolean not null default true,
  is_available  boolean not null default true,
  created_at    timestamptz not null default now()
);

create index menu_items_restaurant_idx on public.menu_items (restaurant_id);
create index menu_items_category_idx on public.menu_items (category_id);

-- ---------------------------------------------------------------------------
-- customers — id mirrors auth.users.id for phone-OTP customers.
-- Guest checkout stores snapshots on the order and leaves customer_id null.
-- ---------------------------------------------------------------------------
create table public.customers (
  id         uuid primary key references auth.users(id) on delete cascade,
  phone      text unique,
  name       text,
  email      text,
  addresses  jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
create table public.orders (
  id               uuid primary key default gen_random_uuid(),
  restaurant_id    uuid not null references public.restaurants(id) on delete cascade,
  customer_id      uuid references public.customers(id) on delete set null,
  order_type       text not null default 'delivery' check (order_type in ('delivery', 'takeaway')),
  status           text not null default 'pending'
                     check (status in ('pending', 'confirmed', 'preparing', 'ready',
                                       'out_for_delivery', 'delivered', 'cancelled')),
  delivery_address jsonb,
  customer_phone   text not null,
  customer_name    text,
  notes            text,
  subtotal         numeric not null check (subtotal >= 0),
  tax              numeric not null default 0 check (tax >= 0),
  total            numeric not null check (total >= 0),
  discount         numeric not null default 0 check (discount >= 0),
  delivery_fee     numeric not null default 0 check (delivery_fee >= 0),
  payment_method   text not null default 'cash' check (payment_method in ('cash', 'upi', 'card', 'other')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index orders_restaurant_created_idx on public.orders (restaurant_id, created_at desc);
create index orders_customer_idx on public.orders (customer_id) where customer_id is not null;
create index orders_status_idx on public.orders (restaurant_id, status);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- order_items (name/price snapshots survive later menu edits)
-- ---------------------------------------------------------------------------
create table public.order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id) on delete set null,
  item_name    text not null,
  item_price   numeric not null check (item_price >= 0),
  quantity     integer not null check (quantity between 1 and 50),
  line_total   numeric not null check (line_total >= 0)
);

create index order_items_order_idx on public.order_items (order_id);

-- ---------------------------------------------------------------------------
-- subscriptions — billing records, super-admin (service role) only
-- ---------------------------------------------------------------------------
create table public.subscriptions (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  plan          text not null,
  amount        numeric not null check (amount >= 0),
  start_date    date not null,
  end_date      date not null,
  status        text not null default 'active' check (status in ('active', 'expired', 'cancelled')),
  created_at    timestamptz not null default now()
);

create index subscriptions_restaurant_idx on public.subscriptions (restaurant_id);

-- ---------------------------------------------------------------------------
-- profiles — admin/staff accounts for standalone restaurants
-- ---------------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  role          text not null default 'staff' check (role in ('owner', 'manager', 'staff')),
  name          text
);

create index profiles_restaurant_idx on public.profiles (restaurant_id);

-- ---------------------------------------------------------------------------
-- rate_limits — sliding-window counters used by edge functions
-- ---------------------------------------------------------------------------
create table public.rate_limits (
  identifier   text primary key,
  count        integer not null default 1,
  window_start timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Realtime: admins subscribe to postgres_changes on orders (RLS applies)
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.orders;
