-- hungriOrder — demo seed data (development only).
-- Creates one demo restaurant with a small menu. To log into the admin app,
-- create an auth user (Dashboard → Authentication → Add user, email+password)
-- and link it:
--
--   insert into public.profiles (id, restaurant_id, role, name)
--   values ('<auth-user-uuid>', '11111111-1111-1111-1111-111111111111', 'owner', 'Owner');

insert into public.restaurants
  (id, name, slug, description, cuisine_tags, address, phone,
   delivery_enabled, delivery_radius_km, min_order_amount, delivery_fee,
   opening_hours, subscription_tier, subscription_expiry, is_active)
values (
  '11111111-1111-1111-1111-111111111111',
  'Royal Kitchen',
  'royal-kitchen',
  'Authentic North Indian & Chinese, straight from our tandoor to your door.',
  array['north-indian', 'chinese'],
  '12 MG Road, Bengaluru 560001',
  '+919800000000',
  true, 5, 199, 30,
  '{"mon":"09:00-22:00","tue":"09:00-22:00","wed":"09:00-22:00","thu":"09:00-22:00","fri":"09:00-23:00","sat":"09:00-23:00","sun":"10:00-22:00"}'::jsonb,
  'trial',
  now() + interval '30 days',
  true
);

insert into public.menu_categories (id, restaurant_id, name, display_order) values
  ('21111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Starters', 1),
  ('22111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Main Course', 2),
  ('23111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Breads', 3),
  ('24111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Beverages', 4);

insert into public.menu_items (category_id, restaurant_id, name, description, price, is_veg, is_available) values
  ('21111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Paneer Tikka', 'Char-grilled cottage cheese with mint chutney', 249, true, true),
  ('21111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Chicken 65', 'Spicy deep-fried chicken, curry leaves', 279, false, true),
  ('21111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Veg Spring Rolls', 'Crispy rolls with sweet chilli dip', 179, true, true),
  ('22111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Butter Chicken', 'Creamy tomato gravy, tandoori chicken', 349, false, true),
  ('22111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Paneer Butter Masala', 'Rich makhani gravy with soft paneer', 299, true, true),
  ('22111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Veg Hakka Noodles', 'Wok-tossed noodles with vegetables', 219, true, true),
  ('23111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Butter Naan', 'Tandoor-baked, brushed with butter', 55, true, true),
  ('23111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Garlic Naan', 'Topped with garlic and coriander', 65, true, true),
  ('24111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Masala Chaas', 'Spiced buttermilk', 59, true, true),
  ('24111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Fresh Lime Soda', 'Sweet, salted or mixed', 79, true, true);
