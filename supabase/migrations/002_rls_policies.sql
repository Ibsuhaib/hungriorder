-- hungriOrder — Row Level Security and security-definer functions.
-- Zero-trust: RLS on every table; no policy = deny. The service role
-- (edge functions / super admin) bypasses RLS.

-- ---------------------------------------------------------------------------
-- Helper: restaurant the current auth user administers (null for customers).
-- SECURITY DEFINER so profile lookups never recurse through profiles RLS.
-- ---------------------------------------------------------------------------
create or replace function public.my_restaurant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select restaurant_id from public.profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table public.restaurants     enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items      enable row level security;
alter table public.customers       enable row level security;
alter table public.orders          enable row level security;
alter table public.order_items     enable row level security;
alter table public.subscriptions   enable row level security;
alter table public.profiles        enable row level security;
alter table public.rate_limits     enable row level security;

-- ---------------------------------------------------------------------------
-- restaurants
-- ---------------------------------------------------------------------------
create policy "Public can read active restaurants"
  on public.restaurants for select
  using (is_active or id = public.my_restaurant_id());

create policy "Admins can update own restaurant"
  on public.restaurants for update
  using (id = public.my_restaurant_id())
  with check (id = public.my_restaurant_id());

-- Column-level defence: admins must not edit their own subscription/active
-- flags. Only these columns are updatable through the API by signed-in users.
revoke update on public.restaurants from anon, authenticated;
grant update (name, slug, logo_url, cover_image_url, description, cuisine_tags,
              address, phone, delivery_enabled, delivery_radius_km,
              min_order_amount, delivery_fee, opening_hours)
  on public.restaurants to authenticated;
revoke insert, delete on public.restaurants from anon, authenticated;

-- ---------------------------------------------------------------------------
-- menu_categories
-- ---------------------------------------------------------------------------
create policy "Public can read categories of active restaurants"
  on public.menu_categories for select
  using (
    restaurant_id = public.my_restaurant_id()
    or exists (
      select 1 from public.restaurants r
      where r.id = restaurant_id and r.is_active
    )
  );

create policy "Admins manage own categories"
  on public.menu_categories for all
  using (restaurant_id = public.my_restaurant_id())
  with check (restaurant_id = public.my_restaurant_id());

-- ---------------------------------------------------------------------------
-- menu_items
-- ---------------------------------------------------------------------------
create policy "Public can read available items of active restaurants"
  on public.menu_items for select
  using (
    restaurant_id = public.my_restaurant_id()
    or (
      is_available
      and exists (
        select 1 from public.restaurants r
        where r.id = restaurant_id and r.is_active
      )
    )
  );

create policy "Admins manage own items"
  on public.menu_items for all
  using (restaurant_id = public.my_restaurant_id())
  with check (restaurant_id = public.my_restaurant_id());

-- ---------------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------------
create policy "Customers read own row"
  on public.customers for select
  using (id = auth.uid());

create policy "Customers insert own row"
  on public.customers for insert
  with check (id = auth.uid());

create policy "Customers update own row"
  on public.customers for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- orders — inserted only by the place-order edge function (service role).
-- ---------------------------------------------------------------------------
create policy "Customers read own orders, admins read restaurant orders"
  on public.orders for select
  using (
    customer_id = auth.uid()
    or restaurant_id = public.my_restaurant_id()
  );

create policy "Admins update restaurant orders"
  on public.orders for update
  using (restaurant_id = public.my_restaurant_id())
  with check (restaurant_id = public.my_restaurant_id());

-- Admins may only flip status through the API; totals are immutable.
revoke update on public.orders from anon, authenticated;
grant update (status) on public.orders to authenticated;
revoke insert, delete on public.orders from anon, authenticated;

-- ---------------------------------------------------------------------------
-- order_items — visibility inherited from the parent order
-- ---------------------------------------------------------------------------
create policy "Order items visible with parent order"
  on public.order_items for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and (o.customer_id = auth.uid() or o.restaurant_id = public.my_restaurant_id())
    )
  );

revoke insert, update, delete on public.order_items from anon, authenticated;

-- ---------------------------------------------------------------------------
-- subscriptions / rate_limits — service role only (no policies)
-- ---------------------------------------------------------------------------
revoke all on public.subscriptions from anon, authenticated;
revoke all on public.rate_limits from anon, authenticated;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy "Users read own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "Admins read restaurant staff profiles"
  on public.profiles for select
  using (restaurant_id = public.my_restaurant_id());

revoke insert, update, delete on public.profiles from anon, authenticated;

-- ---------------------------------------------------------------------------
-- create_order_with_items — atomic order insert, called by place-order edge
-- function with the service role. Not callable by clients.
-- ---------------------------------------------------------------------------
create or replace function public.create_order_with_items(p_order jsonb, p_items jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
begin
  insert into public.orders (
    restaurant_id, customer_id, order_type, delivery_address,
    customer_phone, customer_name, notes,
    subtotal, tax, total, discount, delivery_fee, payment_method
  ) values (
    (p_order->>'restaurant_id')::uuid,
    nullif(p_order->>'customer_id', '')::uuid,
    p_order->>'order_type',
    p_order->'delivery_address',
    p_order->>'customer_phone',
    p_order->>'customer_name',
    p_order->>'notes',
    (p_order->>'subtotal')::numeric,
    (p_order->>'tax')::numeric,
    (p_order->>'total')::numeric,
    coalesce((p_order->>'discount')::numeric, 0),
    (p_order->>'delivery_fee')::numeric,
    p_order->>'payment_method'
  )
  returning id into v_order_id;

  insert into public.order_items (order_id, menu_item_id, item_name, item_price, quantity, line_total)
  select
    v_order_id,
    (i->>'menu_item_id')::uuid,
    i->>'item_name',
    (i->>'item_price')::numeric,
    (i->>'quantity')::integer,
    (i->>'line_total')::numeric
  from jsonb_array_elements(p_items) as i;

  return v_order_id;
end;
$$;

revoke execute on function public.create_order_with_items(jsonb, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- check_rate_limit — sliding window counter; service role only.
-- ---------------------------------------------------------------------------
create or replace function public.check_rate_limit(p_identifier text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allowed boolean;
begin
  insert into public.rate_limits as rl (identifier, count, window_start)
  values (p_identifier, 1, now())
  on conflict (identifier) do update set
    count = case
      when rl.window_start < now() - make_interval(secs => p_window_seconds) then 1
      else rl.count + 1
    end,
    window_start = case
      when rl.window_start < now() - make_interval(secs => p_window_seconds) then now()
      else rl.window_start
    end
  returning rl.count <= p_max into v_allowed;

  return v_allowed;
end;
$$;

revoke execute on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- get_order_tracking — public order tracking by (unguessable) order UUID.
-- Returns only what the tracking page needs; never exposes other orders.
-- ---------------------------------------------------------------------------
create or replace function public.get_order_tracking(p_order_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', o.id,
    'status', o.status,
    'order_type', o.order_type,
    'created_at', o.created_at,
    'updated_at', o.updated_at,
    'subtotal', o.subtotal,
    'tax', o.tax,
    'discount', o.discount,
    'delivery_fee', o.delivery_fee,
    'total', o.total,
    'payment_method', o.payment_method,
    'delivery_address', o.delivery_address,
    'notes', o.notes,
    'customer_name', o.customer_name,
    'restaurant', jsonb_build_object(
      'name', r.name, 'phone', r.phone, 'slug', r.slug, 'logo_url', r.logo_url
    ),
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'name', oi.item_name,
        'quantity', oi.quantity,
        'price', oi.item_price,
        'line_total', oi.line_total
      ) order by oi.item_name), '[]'::jsonb)
      from public.order_items oi
      where oi.order_id = o.id
    )
  )
  from public.orders o
  join public.restaurants r on r.id = o.restaurant_id
  where o.id = p_order_id;
$$;

grant execute on function public.get_order_tracking(uuid) to anon, authenticated;
