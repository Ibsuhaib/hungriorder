import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ShoppingBag, Check, Search, X, UtensilsCrossed, Bike, MapPin, Phone } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { useCart } from '../context/CartContext.jsx';
import { rupees, hoursToday, isOpenNow } from '../lib/format.js';
import { onlyOrderable } from '../lib/orderable.js';
import MenuItemCard from '../components/MenuItemCard.jsx';
import CartSheet from '../components/CartSheet.jsx';

const spring = { type: 'spring', stiffness: 500, damping: 30, mass: 0.5 };

function CategoryPill({ label, active, onClick }) {
  return (
    <motion.button layout onClick={onClick} whileTap={{ scale: 0.95 }} className={`pill ${active ? 'pill-active' : ''}`}>
      {active && (
        <motion.span initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring}>
          <Check size={11} strokeWidth={3} />
        </motion.span>
      )}
      {label}
    </motion.button>
  );
}

function Skeleton() {
  return (
    <div className="min-h-screen bg-ink">
      <div className="h-[52px] border-b border-white/[0.07] bg-ink/90" />
      <div className="flex h-56 flex-col items-center justify-center gap-3">
        <div className="h-16 w-16 animate-pulse rounded-full bg-white/[0.07]" />
        <div className="h-5 w-36 animate-pulse rounded-lg bg-white/[0.06]" />
        <div className="h-3 w-20 animate-pulse rounded-md bg-white/[0.04]" />
      </div>
      <div className="mx-auto max-w-3xl px-4">
        <div className="mb-5 flex gap-2">
          {[72, 96, 80, 88].map((w, i) => (
            <div key={i} className="h-9 shrink-0 animate-pulse rounded-full bg-white/[0.06]" style={{ width: w }} />
          ))}
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="mb-3 h-24 animate-pulse rounded-[20px] bg-white/[0.04]" />
        ))}
      </div>
    </div>
  );
}

export default function Restaurant() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { cart, count, subtotal, add, setQty } = useCart();
  const [restaurant, setRestaurant] = useState(null);
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [activeCat, setActiveCat] = useState('all');
  const [cartOpen, setCartOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [state, setState] = useState('loading'); // loading | ready | notfound | error

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState('loading');
      // Mirrors place-online-order's checks, so a restaurant that can't accept
      // an order can't be browsed into a full cart either.
      const { data: r, error } = await onlyOrderable(
        supabase.from('restaurants').select('*').eq('slug', slug)
      ).maybeSingle();
      if (cancelled) return;
      if (error) return setState('error');
      if (!r) return setState('notfound');
      const [{ data: cats }, { data: menu }] = await Promise.all([
        supabase.from('categories').select('*').eq('restaurant_id', r.id).order('display_order'),
        supabase
          .from('menu_items')
          .select('*')
          .eq('restaurant_id', r.id)
          .eq('available', true)
          .eq('online_available', true) // restaurant chose to hide some dishes online
          .order('name'),
      ]);
      if (cancelled) return;
      setRestaurant(r);
      setCategories(cats ?? []);
      setItems(menu ?? []);
      setState('ready');
      document.title = `${r.name} — hungriOrder`;
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const usedCategories = useMemo(() => {
    const used = new Set(items.map((i) => i.category_id));
    return categories.filter((c) => used.has(c.id));
  }, [categories, items]);

  const filteredItems = useMemo(() => {
    let list = activeCat === 'all' ? items : items.filter((i) => i.category_id === activeCat);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((i) => i.name.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q));
    }
    return list;
  }, [items, activeCat, searchQuery]);

  const qtyOf = (id) =>
    cart.restaurantId === restaurant?.id ? (cart.items.find((i) => i.id === id)?.qty ?? 0) : 0;

  if (state === 'loading') return <Skeleton />;
  if (state === 'notfound' || state === 'error') {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center bg-ink p-6 text-center">
        <div className="ambient-ember pointer-events-none absolute inset-0" />
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="relative z-10">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/5 text-3xl">
            <UtensilsCrossed className="h-8 w-8 text-white/30" />
          </div>
          <h1 className="text-lg font-extrabold text-white/90">
            {state === 'notfound' ? 'Restaurant not found' : 'Something went wrong'}
          </h1>
          <p className="mx-auto mt-2 max-w-[260px] text-sm leading-relaxed text-white/35">
            {state === 'notfound'
              ? `We couldn't find "${slug}" — it may not be taking online orders right now.`
              : 'Please check your connection and try again.'}
          </p>
          <Link to="/" className="btn-ember mt-6 inline-flex px-6 py-2.5 text-sm">
            Browse restaurants
          </Link>
        </motion.div>
      </div>
    );
  }

  const open = isOpenNow(restaurant.opening_hours);
  const today = hoursToday(restaurant.opening_hours);
  const fee = Number(restaurant.delivery_fee ?? 0);
  const minOrder = Number(restaurant.min_order_amount ?? 0);
  const sectionLabel =
    activeCat === 'all' ? 'Full Menu' : (usedCategories.find((c) => c.id === activeCat)?.name ?? 'Items');

  return (
    <div className="min-h-screen bg-ink pb-28">
      {/* ── Sticky glass nav ─────────────────────────────────────── */}
      <header className="glass-top">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-2.5">
          <button type="button" onClick={() => navigate('/')} aria-label="Back" className="icon-btn">
            <ArrowLeft size={15} />
          </button>

          {!showSearch && (
            <p className="min-w-0 flex-1 truncate text-[0.88rem] font-bold text-white/80">{restaurant.name}</p>
          )}
          {showSearch && <div className="flex-1" />}

          <div className="flex shrink-0 items-center gap-2">
            <AnimatePresence mode="wait">
              {showSearch ? (
                <motion.div
                  key="search-open"
                  initial={{ opacity: 0, width: 36 }}
                  animate={{ opacity: 1, width: 200 }}
                  exit={{ opacity: 0, width: 36 }}
                  className="flex items-center gap-1.5 overflow-hidden"
                >
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search dishes…"
                    autoFocus
                    className="min-w-0 flex-1 rounded-full border border-white/[0.14] bg-white/[0.07] px-3.5 py-1.5 text-[0.82rem] text-white/90 outline-none placeholder:text-white/30"
                  />
                  <button type="button" onClick={() => { setShowSearch(false); setSearchQuery(''); }} className="icon-btn !h-8 !w-8">
                    <X size={14} />
                  </button>
                </motion.div>
              ) : (
                <motion.button
                  key="search-icon"
                  type="button"
                  onClick={() => setShowSearch(true)}
                  aria-label="Search"
                  className="icon-btn"
                >
                  <Search size={15} />
                </motion.button>
              )}
            </AnimatePresence>

            {/* Cart icon */}
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              aria-label="Open cart"
              className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-ember/30 ${
                count > 0 ? 'text-ink shadow-ember-glow' : 'bg-ember/10 text-ember-light'
              }`}
              style={count > 0 ? { background: 'linear-gradient(135deg, #d4a373, #e6c69a)' } : undefined}
            >
              <ShoppingBag size={17} />
              <AnimatePresence>
                {count > 0 && (
                  <motion.span
                    key="badge"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={spring}
                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-black text-ember-dark"
                  >
                    {count}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-3xl">
        {/* ── Hero banner — QR-menu style ──────────────────────────── */}
        <div className="relative overflow-hidden bg-gradient-to-b from-ink-raised to-ink pb-14 pt-10">
          <div className="hero-grid pointer-events-none absolute inset-0" />
          <div className="ambient-ember pointer-events-none absolute inset-0" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-b from-transparent to-ink" />

          <div className="relative z-10 px-5 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.65, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="mb-4"
            >
              {restaurant.logo_url ? (
                <img
                  src={restaurant.logo_url}
                  alt={restaurant.name}
                  className="mx-auto h-[76px] w-[76px] rounded-full object-cover"
                  style={{ boxShadow: '0 0 0 2px rgba(212, 163, 115,0.45), 0 0 0 6px rgba(212, 163, 115,0.1), 0 12px 40px rgba(212, 163, 115,0.3)' }}
                />
              ) : (
                <div
                  className="mx-auto flex h-[76px] w-[76px] items-center justify-center rounded-full bg-gradient-to-br from-ember to-ember-mid text-3xl font-black text-white"
                  style={{ boxShadow: '0 0 0 2px rgba(212, 163, 115,0.45), 0 0 0 6px rgba(212, 163, 115,0.1), 0 12px 40px rgba(212, 163, 115,0.35)' }}
                >
                  {restaurant.name.charAt(0).toUpperCase()}
                </div>
              )}
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="text-[clamp(1.6rem,6vw,2.4rem)] font-black leading-tight tracking-tight"
              style={{
                background: 'linear-gradient(135deg, #ffffff 20%, rgba(255,255,255,0.65) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {restaurant.name}
            </motion.h1>

            {restaurant.cuisine_tags?.length > 0 && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.18 }}
                className="mt-1.5 text-xs capitalize text-white/50"
              >
                {restaurant.cuisine_tags.slice(0, 4).join(' · ').replaceAll('-', ' ')}
              </motion.p>
            )}

            {/* Status + delivery chips */}
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.25, ...spring }}
              className="mt-4 flex flex-wrap items-center justify-center gap-2"
            >
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-[0.72rem] font-bold ${
                  open
                    ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                    : 'border-white/10 bg-white/5 text-white/45'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${open ? 'bg-emerald-400' : 'bg-white/30'}`} />
                {open ? 'Open now' : 'Closed'} {today ? `· ${today}` : ''}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[0.72rem] font-bold text-white/55">
                <Bike size={12} className="text-ember-light" />
                {fee > 0 ? `${rupees(fee)} delivery` : 'Free delivery'}
                {minOrder > 0 && ` · min ${rupees(minOrder)}`}
              </span>
            </motion.div>

            {restaurant.description && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-white/55"
              >
                {restaurant.description}
              </motion.p>
            )}

            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[0.72rem] text-white/45">
              {restaurant.address && (
                <span className="flex items-center gap-1"><MapPin size={11} />{restaurant.address}</span>
              )}
              {restaurant.phone && (
                <a href={`tel:${restaurant.phone}`} className="flex items-center gap-1 text-ember-light/80 underline underline-offset-2">
                  <Phone size={11} />{restaurant.phone}
                </a>
              )}
            </div>
          </div>
        </div>

        {/* ── Category pills ────────────────────────────────────────── */}
        {usedCategories.length > 0 && (
          <div className="sticky top-[52px] z-30 border-b border-white/[0.06] bg-ink/90 py-3 backdrop-blur">
            <div className="no-scrollbar flex gap-2 overflow-x-auto px-4">
              <CategoryPill label="All" active={activeCat === 'all'} onClick={() => setActiveCat('all')} />
              {usedCategories.map((cat) => (
                <CategoryPill key={cat.id} label={cat.name} active={activeCat === cat.id} onClick={() => setActiveCat(cat.id)} />
              ))}
            </div>
          </div>
        )}

        {/* ── Menu list ─────────────────────────────────────────────── */}
        <div className="px-4 pb-2 pt-5">
          {/* Closed banner — menu stays browsable, ordering is disabled */}
          {!open && (
            <div className="mb-4 rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-center">
              <p className="text-sm font-bold text-amber-300">Currently closed</p>
              <p className="mt-0.5 text-xs text-amber-200/70">
                {today ? `Today's hours: ${today}` : 'Ordering will open when the restaurant is back.'}
              </p>
            </div>
          )}

          <div className="section-label mb-4">
            <span>{searchQuery ? `Results for "${searchQuery}"` : sectionLabel}</span>
          </div>

          {filteredItems.length === 0 ? (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="py-16 text-center">
              <p className="mb-3 text-5xl">🍽</p>
              <p className="text-sm font-bold text-white/45">No items found</p>
              {searchQuery && <p className="mt-1.5 text-xs text-white/25">Try a different search term</p>}
            </motion.div>
          ) : (
            <motion.div layout className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <AnimatePresence>
                {filteredItems.map((item) => (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    qty={qtyOf(item.id)}
                    onAdd={() => add(restaurant, item)}
                    onSetQty={setQty}
                    closed={!open}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </main>

      {/* ── Floating cart bar — QR-menu style ─────────────────────── */}
      <AnimatePresence>
        {count > 0 && cart.restaurantId === restaurant.id && !cartOpen && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={spring}
            className="fixed inset-x-0 bottom-0 z-30 px-4 pb-5"
          >
            <div className="mx-auto max-w-md">
              <motion.button type="button" onClick={() => setCartOpen(true)} whileTap={{ scale: 0.98 }} className="btn-ember-bar">
                <span className="flex items-center gap-2.5">
                  <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-white/[0.22] text-[11px] font-black">
                    {count}
                  </span>
                  <span className="text-[0.92rem] font-bold tracking-[0.2px]">View Cart</span>
                </span>
                <span className="text-[0.95rem] font-black">{rupees(subtotal)}</span>
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <CartSheet open={cartOpen} onClose={() => setCartOpen(false)} restaurant={restaurant} />
    </div>
  );
}
