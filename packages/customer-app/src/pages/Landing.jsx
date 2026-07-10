import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  UtensilsCrossed, Search, MapPin, Bike, ImageOff, User, BadgePercent, Store, Smartphone,
  LocateFixed, Navigation,
} from 'lucide-react';
import { supabase, isConfigured } from '../lib/supabase.js';
import { useAuth } from '../context/AuthContext.jsx';
import { rupees, isOpenNow } from '../lib/format.js';
import { loadProfile, saveProfile, withDistance, formatKm, formatCoords } from '../lib/geo.js';
import EntryGate from '../components/EntryGate.jsx';
import LocationSheet from '../components/LocationSheet.jsx';
import { LocationMap } from '../components/ui/expand-map.jsx';
import VegBadge from '../components/VegBadge.jsx';
import Spinner from '../components/Spinner.jsx';

const PERKS = [
  { icon: BadgePercent, title: 'Zero commission', text: 'Restaurants keep 100% of every order, so you get fair prices.' },
  { icon: Store, title: 'Order direct', text: 'Straight from the restaurant — no middlemen, no markups.' },
  { icon: Smartphone, title: 'Track live', text: 'Follow your order from kitchen to doorstep in real time.' },
];

function RestaurantCard({ r, index }) {
  const open = isOpenNow(r.opening_hours);
  const fee = Number(r.delivery_fee ?? 0);
  const minOrder = Number(r.min_order_amount ?? 0);
  const dist = formatKm(r.distanceKm);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.4) }}
    >
      <Link
        to={`/r/${r.slug}`}
        className="block overflow-hidden rounded-3xl bg-white shadow-sm transition-shadow hover:shadow-lg"
      >
        <div className="relative h-36 bg-slate-200">
          {r.cover_image_url ? (
            <img src={r.cover_image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-700 to-slate-900">
              <UtensilsCrossed className="h-8 w-8 text-white/30" />
            </div>
          )}
          <span
            className={`absolute right-3 top-3 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
              open ? 'bg-green-500 text-white' : 'bg-slate-800/80 text-white'
            }`}
          >
            {open ? 'Open now' : 'Closed'}
          </span>
          {dist && (
            <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-0.5 text-[11px] font-bold text-navy">
              <Navigation className="h-3 w-3 text-gold" /> {dist}
            </span>
          )}
        </div>

        <div className="p-4">
          <div className="flex items-start gap-3">
            {r.logo_url ? (
              <img
                src={r.logo_url}
                alt=""
                className="-mt-8 h-14 w-14 shrink-0 rounded-2xl border-2 border-white bg-white object-cover shadow"
              />
            ) : (
              <div className="-mt-8 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 border-white bg-navy shadow">
                <span className="text-lg font-bold text-gold">{r.name.charAt(0)}</span>
              </div>
            )}
            <div className="min-w-0 flex-1 pt-0.5">
              <h3 className="truncate text-base font-bold text-navy">{r.name}</h3>
              {r.cuisine_tags?.length > 0 && (
                <p className="mt-0.5 truncate text-xs capitalize text-slate-500">
                  {r.cuisine_tags.slice(0, 4).join(' · ').replaceAll('-', ' ')}
                </p>
              )}
            </div>
          </div>

          {r.description && (
            <p className="mt-2 line-clamp-2 text-xs text-slate-500">{r.description}</p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <Bike className="h-3.5 w-3.5 text-gold" />
              {fee > 0 ? `${rupees(fee)} delivery` : 'Free delivery'}
            </span>
            {minOrder > 0 && <span>Min {rupees(minOrder)}</span>}
            {r.address && (
              <span className="flex min-w-0 items-center gap-1">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{r.address}</span>
              </span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function DishCard({ dish, index }) {
  const r = dish.restaurants;
  const dist = formatKm(dish.distanceKm);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
    >
      <Link
        to={`/r/${r.slug}`}
        className="flex gap-3 rounded-2xl bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
      >
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
          {dish.image_url ? (
            <img src={dish.image_url} alt={dish.name} loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <ImageOff className="h-6 w-6 text-slate-300" />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start gap-2">
            <VegBadge isVeg={dish.is_veg} className="mt-1" />
            <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-navy">{dish.name}</h3>
          </div>
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-500">
            <Store className="h-3 w-3 shrink-0 text-gold" />
            <span className="truncate">{r.name}</span>
            {dist && <span className="shrink-0 text-slate-400">· {dist}</span>}
          </p>
          {dish.description && (
            <p className="mt-1 line-clamp-1 text-xs text-slate-400">{dish.description}</p>
          )}
          <div className="mt-auto flex items-center justify-between pt-2">
            <span className="text-sm font-bold text-navy">{rupees(dish.price)}</span>
            <span className="rounded-full bg-gold px-4 py-1.5 text-xs font-bold text-navy">Order</span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export default function Landing() {
  const { session } = useAuth();
  const [profile, setProfile] = useState(() => loadProfile());
  const [restaurants, setRestaurants] = useState(null); // null = loading
  const [dishes, setDishes] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('dishes'); // dishes | restaurants
  const [locSheetOpen, setLocSheetOpen] = useState(false);

  const hasEntered = Boolean(profile?.phone);
  const userLoc = profile?.location ?? null;

  // Heal locations saved before the geocoding provider was configured: they
  // have coordinates but a missing/placeholder label. Re-geocode once so the
  // stored location picks up the accurate area name.
  useEffect(() => {
    if (!userLoc || !isConfigured) return;
    if (userLoc.label && userLoc.label !== 'Current location') return;
    let cancelled = false;
    import('../lib/geo.js').then(({ reverseGeocode }) =>
      reverseGeocode(userLoc.lat, userLoc.lng).then((place) => {
        if (cancelled || !place?.label || place.label === 'Current location') return;
        setProfile(saveProfile({ location: { ...userLoc, ...place } }));
      })
    ).catch(() => {});
    return () => { cancelled = true; };
  }, [userLoc, setProfile]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    document.title = 'hungriOrder — order direct from restaurants near you';
    if (!hasEntered || !isConfigured) return;
    let cancelled = false;
    (async () => {
      const [rRes, dRes] = await Promise.all([
        supabase
          .from('restaurants')
          .select('id, name, slug, logo_url, cover_image_url, description, cuisine_tags, address, opening_hours, delivery_radius_km, min_order_amount, delivery_fee, latitude, longitude')
          .eq('is_active', true)
          .eq('delivery_enabled', true)
          .order('name'),
        supabase
          .from('menu_items')
          .select('id, name, price, image_url, is_veg, description, restaurant_id, restaurants!inner(id, name, slug, latitude, longitude, delivery_radius_km, is_active, delivery_enabled)')
          .eq('available', true)
          .eq('online_available', true)
          .eq('restaurants.is_active', true)
          .eq('restaurants.delivery_enabled', true)
          .order('name')
          .limit(150),
      ]);
      if (cancelled) return;
      if (rRes.error) {
        setLoadFailed(true);
        setRestaurants([]);
        setDishes([]);
        return;
      }
      setRestaurants(rRes.data ?? []);
      setDishes(dRes.error ? [] : (dRes.data ?? []));
    })();
    return () => {
      cancelled = true;
    };
  }, [hasEntered]);

  const changeLocation = (loc) => setProfile(saveProfile({ location: loc }));

  // Distance-annotated, radius-filtered, nearest-first
  const nearbyRestaurants = useMemo(() => {
    if (!restaurants) return [];
    return restaurants
      .map((r) => withDistance(r, userLoc))
      .filter((r) => r.inRadius)
      .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  }, [restaurants, userLoc]);

  const nearbyDishes = useMemo(() => {
    if (!dishes) return [];
    return dishes
      .map((d) => {
        const r = withDistance(d.restaurants, userLoc);
        return { ...d, restaurants: r, distanceKm: r.distanceKm, inRadius: r.inRadius };
      })
      .filter((d) => d.inRadius)
      .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  }, [dishes, userLoc]);

  const q = query.trim().toLowerCase();
  const filteredRestaurants = useMemo(() => {
    if (!q) return nearbyRestaurants;
    return nearbyRestaurants.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.cuisine_tags ?? []).some((t) => t.toLowerCase().replaceAll('-', ' ').includes(q)) ||
        (r.address ?? '').toLowerCase().includes(q)
    );
  }, [nearbyRestaurants, q]);

  const filteredDishes = useMemo(() => {
    if (!q) return nearbyDishes;
    return nearbyDishes.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        (d.description ?? '').toLowerCase().includes(q) ||
        d.restaurants.name.toLowerCase().includes(q)
    );
  }, [nearbyDishes, q]);

  if (!hasEntered) {
    return <EntryGate onDone={setProfile} />;
  }

  const loading = restaurants === null || dishes === null;
  const activeList = tab === 'dishes' ? filteredDishes : filteredRestaurants;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero */}
      <div className="bg-navy text-white">
        <header className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-2 font-bold">
            <UtensilsCrossed className="h-6 w-6 text-gold" />
            <span>hungri<span className="text-gold">Order</span></span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLocSheetOpen(true)}
              title="Change delivery location"
              className={`flex min-w-0 max-w-[45vw] items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs sm:max-w-[240px] ${
                userLoc ? 'border-green-400/40 text-green-300' : 'border-amber-400/40 text-amber-300'
              }`}
            >
              <LocateFixed className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{userLoc ? (userLoc.label || 'Located') : 'Set location'}</span>
            </button>
            <Link
              to={session ? '/account' : '/login'}
              className="flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-xs hover:bg-white/10"
            >
              <User className="h-3.5 w-3.5" /> {session ? 'Account' : 'Sign in'}
            </Link>
          </div>
        </header>

        <div className="mx-auto max-w-5xl px-5 pb-10 pt-4">
          <div className="flex flex-col items-start gap-8 sm:flex-row sm:items-center sm:justify-between">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="min-w-0 flex-1"
            >
              <h1 className="text-2xl font-bold leading-tight sm:text-4xl">
                Hungry? Order direct.
                <span className="text-gold"> Zero commission.</span>
              </h1>

              {/* Search */}
              <div className="mt-5 flex max-w-md items-center gap-2 rounded-2xl bg-white p-1.5 shadow-xl">
                <Search className="ml-2.5 h-4 w-4 shrink-0 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search dishes, restaurants, cuisines…"
                  className="min-w-0 flex-1 bg-transparent py-2 pr-3 text-sm text-navy outline-none placeholder:text-slate-400"
                  aria-label="Search"
                />
              </div>

              {!userLoc && (
                <p className="mt-3 text-xs text-amber-300">
                  Location not set — showing all restaurants. Set it for nearest-first sorting.
                </p>
              )}
            </motion.div>

            {/* Delivery location card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="flex shrink-0 flex-col items-center gap-2 pb-2"
            >
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">
                Delivering to
              </p>
              <LocationMap
                location={userLoc?.label || 'Location not set'}
                coordinates={userLoc ? formatCoords(userLoc.lat, userLoc.lng) : ''}
              />
              <button
                type="button"
                onClick={() => setLocSheetOpen(true)}
                className="mt-4 rounded-full border border-white/20 px-4 py-1.5 text-xs font-semibold text-slate-300 hover:border-gold hover:text-gold"
              >
                {userLoc ? 'Change location' : 'Set my location'}
              </button>
            </motion.div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-5 pb-16">
        {/* Tabs */}
        <div className="sticky top-0 z-30 -mx-5 flex gap-2 bg-slate-50/95 px-5 py-3 backdrop-blur">
          {[
            { key: 'dishes', label: `Dishes${dishes ? ` (${filteredDishes.length})` : ''}` },
            { key: 'restaurants', label: `Restaurants${restaurants ? ` (${filteredRestaurants.length})` : ''}` },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                tab === t.key ? 'bg-navy text-white' : 'bg-white text-slate-600 shadow-sm'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {!isConfigured ? (
          <p role="alert" className="mt-4 rounded-2xl bg-amber-50 px-5 py-4 text-sm text-amber-800">
            This deployment isn't configured yet — set <code>VITE_SUPABASE_URL</code> and{' '}
            <code>VITE_SUPABASE_ANON_KEY</code> in the hosting environment and redeploy.
          </p>
        ) : loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : loadFailed ? (
          <p role="alert" className="mt-4 rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700">
            Couldn't load restaurants. Check your connection and refresh.
          </p>
        ) : activeList.length === 0 ? (
          <div className="mt-4 rounded-2xl bg-white px-5 py-12 text-center shadow-sm">
            <ImageOff className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-navy">
              {q
                ? `No ${tab} match your search.`
                : userLoc
                  ? `No ${tab} deliver to your location yet.`
                  : 'No restaurants are online yet.'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {q ? 'Try a different name or cuisine.' : 'Check back soon — new restaurants are joining.'}
            </p>
          </div>
        ) : tab === 'dishes' ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {filteredDishes.map((d, i) => (
              <DishCard key={d.id} dish={d} index={i} />
            ))}
          </div>
        ) : (
          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredRestaurants.map((r, i) => (
              <RestaurantCard key={r.id} r={r} index={i} />
            ))}
          </div>
        )}

        {/* Perks */}
        <div className="mt-16 grid gap-4 sm:grid-cols-3">
          {PERKS.map((perk) => (
            <div key={perk.title} className="rounded-2xl bg-white p-5 shadow-sm">
              <perk.icon className="h-6 w-6 text-gold" />
              <h3 className="mt-3 font-semibold text-navy">{perk.title}</h3>
              <p className="mt-1 text-sm text-slate-500">{perk.text}</p>
            </div>
          ))}
        </div>

        <footer className="mt-16 border-t border-slate-200 pt-6 text-xs text-slate-400">
          Restaurant owner? hungriOrder is a flat yearly subscription — no per-order fees, and your
          customer data stays yours.
        </footer>
      </main>

      <LocationSheet
        open={locSheetOpen}
        onClose={() => setLocSheetOpen(false)}
        onSelect={changeLocation}
      />
    </div>
  );
}
