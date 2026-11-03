import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ReceiptText, UtensilsCrossed } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { loadRecentOrders } from '../lib/recentOrders.js';
import { rupees, timeAgo } from '../lib/format.js';
import Spinner from '../components/Spinner.jsx';

const STATUS_LABEL = {
  pending: 'Waiting for the restaurant',
  confirmed: 'Confirmed',
  preparing: 'Being prepared',
  ready: 'Ready',
  out_for_delivery: 'On the way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const STATUS_TONE = {
  delivered: 'text-emerald-400',
  cancelled: 'text-rose-400',
  out_for_delivery: 'text-ember-light',
};

export default function MyOrders() {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    document.title = 'Your orders — hungriOrder';
    const saved = loadRecentOrders();
    if (saved.length === 0) {
      setRows([]);
      return;
    }
    let cancelled = false;
    (async () => {
      // Live status per order. The cached name/total render immediately; a
      // lookup that fails just leaves that row without a status rather than
      // dropping the order from the list.
      const settled = await Promise.all(
        saved.map(async (o) => {
          const { data } = await supabase
            .rpc('get_order_tracking', { p_order_id: o.orderId })
            .then((r) => r, () => ({ data: null }));
          return { ...o, live: data ?? null };
        }),
      );
      if (!cancelled) setRows(settled);
    })();
    return () => { cancelled = true; };
  }, []);

  if (rows === null) return <Spinner full />;

  return (
    <div className="mx-auto min-h-screen max-w-lg px-4 pb-16 pt-5">
      <div className="mb-6 flex items-center gap-3">
        <Link to="/" aria-label="Back" className="rounded-full bg-white/5 p-2 text-white/70">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-lg font-bold text-white">Your orders</h1>
      </div>

      {rows.length === 0 ? (
        <div className="card-dark flex flex-col items-center gap-3 px-6 py-12 text-center">
          <UtensilsCrossed className="h-8 w-8 text-ember-light/30" strokeWidth={1.5} />
          <p className="text-sm text-white/70">You haven&apos;t placed an order yet.</p>
          <Link to="/" className="btn-ember mt-1 px-6 py-2.5 text-sm">Browse restaurants</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((o, i) => {
            const status = o.live?.status;
            return (
              <motion.div
                key={o.orderId}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Link to={`/order/${o.orderId}`} className="card-dark block p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[0.92rem] font-bold text-white/90">
                        {o.restaurantName || 'Order'}
                      </p>
                      <p className="mt-0.5 text-[0.72rem] text-white/45">
                        {o.placedAt ? timeAgo(new Date(o.placedAt).toISOString()) : ''}
                      </p>
                    </div>
                    <p className="price-grad shrink-0 text-[0.9rem]">
                      {rupees(o.live?.total ?? o.total ?? 0)}
                    </p>
                  </div>

                  <div className="mt-3 flex items-center gap-1.5 border-t border-white/5 pt-2.5">
                    <ReceiptText className="h-3.5 w-3.5 text-white/30" />
                    <span className={`text-[0.75rem] font-semibold ${STATUS_TONE[status] ?? 'text-white/60'}`}>
                      {status ? (STATUS_LABEL[status] ?? status) : 'Tap to see status'}
                    </span>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
