import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Bike, ShoppingBag, X, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { rupees, timeAgo } from '../lib/format.js';

// Soft two-tone chime for a new order. WebAudio needs a prior user gesture on
// the page — on a restaurant device that's virtually always true; if the
// browser blocks it we fail silently and the visual popup still shows.
function playChime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    [[880, 0], [1174.66, 0.18]].forEach(([freq, at]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + at);
      gain.gain.exponentialRampToValueAtTime(0.14, now + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + at);
      osc.stop(now + at + 0.55);
    });
    setTimeout(() => ctx.close().catch(() => {}), 1500);
  } catch { /* blocked / unsupported — visual popup is enough */ }
}

/**
 * Floating "unread message" alert for incoming online orders. A pending order
 * = an unread message: the popup stays until the order is accepted (status
 * leaves 'pending') or it's collapsed — collapsing shrinks it to a bell with
 * an unread badge, never loses it. Mounted in Layout so it follows the owner
 * to every page (Dashboard, Menu, Settings…), not just Orders.
 */
export default function OnlineOrderAlert({ restaurantId }) {
  const [pending, setPending] = useState([]);
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const knownIdsRef = useRef(new Set());

  const fetchPending = useCallback(async ({ chimeOnNew = false } = {}) => {
    if (!restaurantId) return;
    const { data, error } = await supabase
      .from('orders')
      .select('id, order_type, status, total_amount, customer_name, created_at')
      .eq('restaurant_id', restaurantId)
      .in('order_type', ['delivery', 'takeaway'])
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(15);
    if (error || !data) return;

    const hasNew = data.some((o) => !knownIdsRef.current.has(o.id));
    if (hasNew) {
      setCollapsed(false); // a new order always re-opens the popup
      if (chimeOnNew) playChime();
    }
    knownIdsRef.current = new Set(data.map((o) => o.id));
    setPending(data);
  }, [restaurantId]);

  // Initial load — no chime for orders that were already waiting
  useEffect(() => {
    knownIdsRef.current = new Set();
    setPending([]);
    fetchPending();
  }, [fetchPending]);

  // Realtime — distinct channel name so it can't clash with the Orders page
  useEffect(() => {
    if (!restaurantId) return;
    const channel = supabase
      .channel(`order-alert-${restaurantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` },
        (payload) => {
          const row = payload.new || payload.old;
          const isOnline = row?.order_type === 'delivery' || row?.order_type === 'takeaway';
          if (!isOnline) return;
          fetchPending({ chimeOnNew: payload.eventType === 'INSERT' });
        }
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [restaurantId, fetchPending]);

  // Poll fallback for missed realtime events — chime too, so an order that
  // arrived during a websocket drop still announces itself.
  useEffect(() => {
    if (!restaurantId) return;
    const timer = setInterval(() => {
      if (navigator.onLine) fetchPending({ chimeOnNew: true });
    }, 20000);
    return () => clearInterval(timer);
  }, [restaurantId, fetchPending]);

  if (pending.length === 0) return null;

  const goToOrders = () => {
    setCollapsed(true);
    if (location.pathname !== '/orders') navigate('/orders');
  };

  return (
    <div className="fixed bottom-safe-4 right-4 z-[70] print:hidden">
      <AnimatePresence mode="wait">
        {collapsed ? (
          /* Collapsed: bell with unread badge — like a minimized chat */
          <motion.button
            key="bell"
            type="button"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => setCollapsed(false)}
            aria-label={`${pending.length} new online order${pending.length > 1 ? 's' : ''}`}
            className="relative flex h-14 w-14 items-center justify-center rounded-full border border-gold/50 bg-navy shadow-xl transition-colors hover:bg-navy-light"
          >
            <Bell className="h-6 w-6 text-gold" />
            <span className="absolute -right-1 -top-1 flex h-6 min-w-[24px] items-center justify-center rounded-full border-2 border-navy bg-red-500 px-1.5 text-xs font-bold text-white">
              {pending.length}
            </span>
          </motion.button>
        ) : (
          /* Expanded: unread-message card */
          <motion.div
            key="card"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            className="w-[300px] overflow-hidden rounded-2xl border border-gold/50 bg-navy shadow-2xl"
          >
            <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-3">
              <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold/20">
                <Bell className="h-5 w-5 text-gold" />
                <span className="absolute inset-0 animate-ping rounded-full bg-gold/30" />
              </span>
              <p className="flex-1 text-sm font-bold text-white">
                {pending.length === 1 ? 'New online order' : `${pending.length} new online orders`}
              </p>
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                aria-label="Minimize"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <ul className="max-h-44 divide-y divide-white/5 overflow-y-auto">
              {pending.slice(0, 4).map((o) => {
                const Icon = o.order_type === 'delivery' ? Bike : ShoppingBag;
                return (
                  <li key={o.id} className="flex items-center gap-2.5 px-4 py-2.5">
                    <Icon className="h-4 w-4 shrink-0 text-gold" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-white">
                        {o.order_type === 'delivery' ? 'Delivery' : 'Takeaway'}
                        {o.customer_name ? ` · ${o.customer_name}` : ''}
                      </p>
                      <p className="text-[11px] text-white/50">{timeAgo(o.created_at)}</p>
                    </div>
                    <span className="shrink-0 text-xs font-bold text-gold-light">
                      {rupees(o.total_amount)}
                    </span>
                  </li>
                );
              })}
              {pending.length > 4 && (
                <li className="px-4 py-2 text-[11px] text-white/50">+ {pending.length - 4} more…</li>
              )}
            </ul>

            <button
              type="button"
              onClick={goToOrders}
              className="flex min-h-[44px] w-full items-center justify-center gap-1.5 bg-gold text-sm font-bold text-navy transition-colors hover:bg-gold-dark"
            >
              View orders <ArrowRight className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
