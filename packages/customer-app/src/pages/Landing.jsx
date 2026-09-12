import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  UtensilsCrossed, Search, MapPin, Bike, ImageOff, Navigation, LocateFixed, Store,
} from 'lucide-react';
import { supabase, isConfigured } from '../lib/supabase.js';
import { rupees, isOpenNow } from '../lib/format.js';
import { loadProfile, saveProfile, withDistance, formatKm, formatCoords } from '../lib/geo.js';
import { onlyOrderable, onlyOrderableJoined } from '../lib/orderable.js';
import EntryGate from '../components/EntryGate.jsx';
import LocationSheet from '../components/LocationSheet.jsx';
import { LocationMap } from '../components/ui/expand-map.jsx';
import VegBadge from '../components/VegBadge.jsx';

function RestaurantCard({ r, index }) {
  const open = isOpenNow(r.opening_hours);
  const fee = Number(r.delivery_fee ?? 0);
  const minOrder = Number(r.min_order_amount ?? 0);
  const dist = formatKm(r.distanceKm);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.4), duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link to={`/r/${r.slug}`} className="card-dark block overflow-hidden">
        {/* Cover */}
        <div className="relative h-32 bg-white/[0.04]">
          {r.cover_image_url ? (
            <img src={r.cover_image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-ink-raised to-ink">
              <UtensilsCrossed className="h-8 w-8 text-white/15" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-ink/90 to-transparent" />
          <span
            className={`absolute right-3 top-3 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${
              open ? 'bg-emerald-500/90 text-white' : 'bg-black/70 text-white/70'
            }`}
          >
            {open ? 'OPEN NOW' : 'CLOSED'}
          </span>
          {dist && (
            <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-0.5 text-[10px] font-bold text-ember-light">
              <Navigation className="h-3 w-3" /> {dist}
            </span>
          )}
          {/* Logo overlapping cover */}
          <div className="absolute -bottom-5 left-4">
            {r.logo_url ? (
              <img
                src={r.logo_url}
                alt=""
                className="h-12 w-12 rounded-full object-cover"
                style={{ boxShadow: '0 0 0 2px rgba(212, 163, 115,0.45), 0 6px 20px rgba(0,0,0,0.5)' }}
              />
            ) : (
              <div
                className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-ember to-ember-mid text-lg font-black text-white"
                style={{ boxShadow: '0 0 0 2px rgba(212, 163, 115,0.45), 0 6px 20px rgba(0,0,0,0.5)' }}
              >
                {r.name.charAt(0)}
              </div>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="px-4 pb-4 pt-7">
          <h3 className="truncate text-[0.95rem] font-bold text-white/90">{r.name}</h3>
          {r.cuisine_tags?.length > 0 && (
            <p className="mt-0.5 truncate text-xs capitalize text-white/35">
              {r.cuisine_tags.slice(0, 4).join(' · ').replaceAll('-', ' ')}
            </p>
          )}
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/40">
            <span className="flex items-center gap-1">
              <Bike className="h-3.5 w-3.5 text-ember-light" />
              {fee > 0 ? `${rupees(fee)} delivery` : 'Free delivery'}
            </span>
            {minOrder > 0 && <span>Min {rupees(minOrder)}</span>}
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
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3), duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link to={`/r/${r.slug}`} className="card-dark flex gap-3.5 p-3.5">
        <div
          className="flex h-[82px] w-[82px] shrink-0 items-center justify-center overflow-hidden rounded-[15px] bg-white/[0.06]"
          style={dish.image_url ? { boxShadow: '0 6px 20px rgba(0,0,0,0.45)' } : undefined}
        >
          {dish.image_url ? (
            <img src={dish.image_url} alt={dish.name} loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <span className="text-2xl">🍽</span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start gap-2">
            <VegBadge isVeg={dish.is_veg} className="mt-1" />
            <h3 className="min-w-0 flex-1 truncate text-[0.9rem] font-bold text-white/90">{dish.name}</h3>
          </div>
          <p className="mt-0.5 flex items-center gap-1 truncate text-[0.72rem] text-white/35">
            <Store className="h-3 w-3 shrink-0 text-ember-light/70" />
            <span className="truncate">{r.name}</span>
            {dist && <span className="shrink-0 text-white/25">· {dist}</span>}
          </p>
          <div className="mt-auto flex items-center justify-between pt-2">
            <span className="price-grad text-[0.95rem]">{rupees(dish.price)}</span>
            <span className="btn-ember px-5 py-1.5 text-[0.75rem]">Order</span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export default function Landing() {
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
        onlyOrderable(
          supabase
            .from('restaurants')
            .select('id, name, slug, logo_url, cover_image_url, description, cuisine_tags, address, opening_hours, delivery_radius_km, min_order_amount, delivery_fee, latitude, longitude')
        ).order('name'),
        onlyOrderableJoined(
          supabase
            .from('menu_items')
            .select('id, name, price, image_url, is_veg, description, restaurant_id, restaurants!inner(id, name, slug, latitude, longitude, delivery_radius_km, is_active, delivery_enabled, subscription_status, subscription_expiry)')
            .eq('available', true)
            .eq('online_available', true)
        )
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
    <div className="min-h-screen bg-ink">
      {/* Sticky glass header: brand + location chip */}
      <header className="glass-top">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-2 font-bold text-white/85">
            <UtensilsCrossed className="h-5 w-5 shrink-0 text-ember-light" />
            <span className="truncate text-[0.92rem]">hungri<span className="text-ember-light">Order</span></span>
          </div>
          <button
            type="button"
            onClick={() => setLocSheetOpen(true)}
            title="Change delivery location"
            className={`flex min-w-0 max-w-[55vw] items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold sm:max-w-[260px] ${
              userLoc
                ? 'border-emerald-400/30 bg-emerald-400/5 text-emerald-300'
                : 'border-amber-400/40 bg-amber-400/5 text-amber-300'
            }`}
          >
            <LocateFixed className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{userLoc ? (userLoc.label || 'Located') : 'Set location'}</span>
          </button>
        </div>
      </header>

      {/* Hero — QR-menu style: grid + ember glow + gradient headline */}
      <div className="relative overflow-hidden bg-gradient-to-b from-ink-raised to-ink">
        <div className="hero-grid pointer-events-none absolute inset-0" />
        <div className="ambient-ember pointer-events-none absolute inset-0" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-ink" />

        <div className="relative z-10 mx-auto max-w-3xl px-4 pb-12 pt-8 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="text-[clamp(1.6rem,6vw,2.5rem)] font-black leading-tight tracking-tight"
            style={{
              background: 'linear-gradient(135deg, #ffffff 20%, rgba(255,255,255,0.65) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Hungry? Order direct.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="mt-2 text-[0.68rem] uppercase tracking-[3px] text-white/30"
          >
            Zero commission · Straight from the kitchen
          </motion.p>

          {/* Search */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mx-auto mt-6 flex max-w-md items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.07] px-4 backdrop-blur"
          >
            <Search className="h-4 w-4 shrink-0 text-white/35" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search dishes, restaurants, cuisines…"
              className="min-w-0 flex-1 bg-transparent py-3 text-sm text-white/90 outline-none placeholder:text-white/30"
              aria-label="Search"
            />
          </motion.div>

          {userLoc ? (
            <div className="mt-7 flex flex-col items-center gap-2">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/25">Delivering to</p>
              <LocationMap
                location={userLoc.label || 'Current location'}
                coordinates={formatCoords(userLoc.lat, userLoc.lng)}
              />
              <button
                type="button"
                onClick={() => setLocSheetOpen(true)}
                className="mt-4 rounded-full border border-white/15 px-4 py-1.5 text-xs font-semibold text-white/40 transition-colors hover:border-ember/50 hover:text-ember-light"
              >
                Change location
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setLocSheetOpen(true)}
              className="mt-3 inline-flex items-center gap-1.5 text-xs text-amber-300 underline underline-offset-4"
            >
              <MapPin className="h-3 w-3" /> Set your location for nearest-first
            </button>
          )}
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-4 pb-24">
        {/* Tabs — category-pill style */}
        <div className="no-scrollbar sticky top-[52px] z-30 -mx-4 flex gap-2 overflow-x-auto bg-ink/90 px-4 py-3 backdrop-blur">
          {[
            { key: 'dishes', label: `Dishes${dishes ? ` (${filteredDishes.length})` : ''}` },
            { key: 'restaurants', label: `Restaurants${restaurants ? ` (${filteredRestaurants.length})` : ''}` },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`pill ${tab === t.key ? 'pill-active' : ''}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="section-label mb-4 mt-2">
          {/* Without a location the list is sorted alphabetically, so calling it
              "Nearest" told customers something untrue — the first results were
              just the ones starting with "A". */}
          <span>
            {q
              ? `Results for "${query.trim()}"`
              : tab === 'dishes'
                ? (userLoc ? 'Nearest dishes' : 'All dishes')
                : (userLoc ? 'Restaurants near you' : 'All restaurants')}
          </span>
        </div>

        {!isConfigured ? (
          <p role="alert" className="card-dark px-5 py-4 text-sm text-amber-300">
            This deployment isn't configured yet — set <code>VITE_SUPABASE_URL</code> and{' '}
            <code>VITE_SUPABASE_ANON_KEY</code> in the hosting environment and redeploy.
          </p>
        ) : loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-[20px] bg-white/[0.04]" />
            ))}
          </div>
        ) : loadFailed ? (
          <p role="alert" className="card-dark px-5 py-4 text-sm text-red-400">
            Couldn't load restaurants. Check your connection and refresh.
          </p>
        ) : activeList.length === 0 ? (
          <div className="py-16 text-center">
            <p className="mb-3 text-5xl">🍽</p>
            <p className="text-sm font-bold text-white/50">
              {q
                ? `No ${tab} match your search.`
                : userLoc
                  ? `No ${tab} deliver to your location yet.`
                  : 'No restaurants are online yet.'}
            </p>
            <p className="mt-1.5 text-xs text-white/25">
              {q ? 'Try a different name or cuisine.' : 'Check back soon — new restaurants are joining.'}
            </p>
          </div>
        ) : tab === 'dishes' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {filteredDishes.map((d, i) => (
              <DishCard key={d.id} dish={d} index={i} />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {filteredRestaurants.map((r, i) => (
              <RestaurantCard key={r.id} r={r} index={i} />
            ))}
          </div>
        )}

        <footer className="mt-16 border-t border-white/[0.06] pt-6 text-center text-[11px] text-white/25">
          Restaurants keep 100% of every order — no commission, no middlemen.
        </footer>
      </main>

      <LocationSheet
        open={locSheetOpen}
        onClose={() => setLocSheetOpen(false)}
        onSelect={changeLocation}
        initial={userLoc}
      />
    </div>
  );
}
