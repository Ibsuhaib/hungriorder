import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  UtensilsCrossed, Search, MapPin, Bike, ImageOff, User, BadgePercent, Store, Smartphone,
} from 'lucide-react';
import { supabase, isConfigured } from '../lib/supabase.js';
import { useAuth } from '../context/AuthContext.jsx';
import { rupees, isOpenNow } from '../lib/format.js';
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
        {/* Cover */}
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
        </div>

        {/* Details */}
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

export default function Landing() {
  const { session } = useAuth();
  const [restaurants, setRestaurants] = useState(null); // null = loading
  const [loadFailed, setLoadFailed] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    document.title = 'hungriOrder — order direct from restaurants';
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('restaurants')
        .select('id, name, slug, logo_url, cover_image_url, description, cuisine_tags, address, opening_hours, delivery_radius_km, min_order_amount, delivery_fee')
        .eq('is_active', true)
        .eq('delivery_enabled', true)
        .order('name');
      if (cancelled) return;
      if (error) {
        setLoadFailed(true);
        setRestaurants([]);
        return;
      }
      setRestaurants(data ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!restaurants) return [];
    const q = query.trim().toLowerCase();
    if (!q) return restaurants;
    return restaurants.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.cuisine_tags ?? []).some((t) => t.toLowerCase().replaceAll('-', ' ').includes(q)) ||
        (r.address ?? '').toLowerCase().includes(q)
    );
  }, [restaurants, query]);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero */}
      <div className="bg-navy text-white">
        <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
          <div className="flex items-center gap-2 font-bold">
            <UtensilsCrossed className="h-6 w-6 text-gold" />
            <span>hungri<span className="text-gold">Order</span></span>
          </div>
          <Link
            to={session ? '/account' : '/login'}
            className="flex items-center gap-1.5 rounded-full border border-white/20 px-4 py-1.5 text-sm hover:bg-white/10"
          >
            <User className="h-4 w-4" /> {session ? 'Account' : 'Sign in'}
          </Link>
        </header>

        <div className="mx-auto max-w-5xl px-5 pb-12 pt-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <h1 className="text-3xl font-bold leading-tight sm:text-5xl">
              Hungry? Order direct.
              <br />
              <span className="text-gold">Zero commission.</span>
            </h1>
            <p className="mt-3 max-w-md text-sm text-slate-300 sm:text-base">
              Every restaurant here has its own storefront. You order straight from them — they keep
              every rupee, you get better prices and fresher food.
            </p>

            {/* Search */}
            <div className="mt-7 flex max-w-md items-center gap-2 rounded-2xl bg-white p-1.5 shadow-xl">
              <Search className="ml-2.5 h-4 w-4 shrink-0 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search restaurants, cuisines, areas…"
                className="min-w-0 flex-1 bg-transparent py-2 pr-3 text-sm text-navy outline-none placeholder:text-slate-400"
                aria-label="Search restaurants"
              />
            </div>
          </motion.div>
        </div>
      </div>

      {/* Restaurant list */}
      <main className="mx-auto max-w-5xl px-5 pb-16">
        <div className="-mt-0 pt-8">
          <h2 className="text-lg font-bold text-navy">
            {query.trim() ? `Results for “${query.trim()}”` : 'Restaurants near you'}
          </h2>

          {!isConfigured ? (
            <p role="alert" className="mt-4 rounded-2xl bg-amber-50 px-5 py-4 text-sm text-amber-800">
              This deployment isn't configured yet — set <code>VITE_SUPABASE_URL</code> and{' '}
              <code>VITE_SUPABASE_ANON_KEY</code> in the hosting environment and redeploy.
            </p>
          ) : restaurants === null ? (
            <div className="flex justify-center py-16"><Spinner /></div>
          ) : loadFailed ? (
            <p role="alert" className="mt-4 rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700">
              Couldn't load restaurants. Check your connection and refresh.
            </p>
          ) : filtered.length === 0 ? (
            <div className="mt-4 rounded-2xl bg-white px-5 py-12 text-center shadow-sm">
              <ImageOff className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-navy">
                {query.trim() ? 'No restaurants match your search.' : 'No restaurants are online yet.'}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {query.trim() ? 'Try a different name or cuisine.' : 'Check back soon — new restaurants are joining.'}
              </p>
            </div>
          ) : (
            <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((r, i) => (
                <RestaurantCard key={r.id} r={r} index={i} />
              ))}
            </div>
          )}
        </div>

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
    </div>
  );
}
