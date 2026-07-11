import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Phone, ReceiptText, MapPin } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import StatusTimeline from '../components/StatusTimeline.jsx';
import Spinner from '../components/Spinner.jsx';
import { rupees, timeAgo } from '../lib/format.js';

export default function TrackOrder() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [state, setState] = useState('loading');

  useEffect(() => {
    let cancelled = false;

    const fetchOrder = async () => {
      const { data, error } = await supabase.rpc('get_order_tracking', { p_order_id: orderId });
      if (cancelled) return;
      if (error) return setState('error');
      if (!data) return setState('notfound');
      setOrder(data);
      setState('ready');
    };
    fetchOrder();

    // Live status updates broadcast by the update-order-status edge function.
    const channel = supabase
      .channel(`order-${orderId}`)
      .on('broadcast', { event: 'status_update' }, ({ payload }) => {
        setOrder((prev) => (prev ? { ...prev, status: payload.status } : prev));
      })
      .subscribe();

    // Safety net: refetch when the tab regains focus (missed broadcasts).
    const onFocus = () => fetchOrder();
    window.addEventListener('focus', onFocus);

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      window.removeEventListener('focus', onFocus);
    };
  }, [orderId]);

  if (state === 'loading') return <Spinner full />;
  if (state === 'notfound' || state === 'error') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <ReceiptText className="h-10 w-10 text-white/25" />
        <h1 className="text-lg font-bold text-white/90">Order not found</h1>
        <p className="text-sm text-white/40">Check the tracking link and try again.</p>
        <Link to="/" className="mt-2 btn-ember px-5 py-2 text-sm">
          Go home
        </Link>
      </div>
    );
  }

  const addr = order.delivery_address;

  return (
    <div className="min-h-screen bg-ink pb-10">
      <header className="border-b border-white/[0.07] bg-ink-raised px-4 py-6 text-white">
        <div className="mx-auto max-w-lg">
          <p className="text-xs uppercase tracking-wide text-white/30">Order status</p>
          <h1 className="mt-1 text-xl font-bold">{order.restaurant?.name}</h1>
          <p className="mt-0.5 text-xs text-white/30">
            Placed {timeAgo(order.created_at)} · #{String(order.id).slice(0, 8)}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 px-4 pt-5">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-dark p-5"
        >
          <StatusTimeline status={order.status} orderType={order.order_type} />
        </motion.section>

        <section className="card-dark p-5">
          <h2 className="mb-3 text-sm font-bold text-white/90">Items</h2>
          <ul className="space-y-1.5 text-sm">
            {(order.items ?? []).map((i, idx) => (
              <li key={idx} className="flex justify-between">
                <span className="text-white/60">
                  {i.name} × {i.quantity}
                </span>
                <span>{rupees(i.line_total)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 space-y-1 border-t border-white/[0.08] pt-3 text-sm">
            <div className="flex justify-between text-white/40">
              <span>Subtotal</span>
              <span>{rupees(order.subtotal)}</span>
            </div>
            {Number(order.delivery_fee) > 0 && (
              <div className="flex justify-between text-white/40">
                <span>Delivery fee</span>
                <span>{rupees(order.delivery_fee)}</span>
              </div>
            )}
            <div className="flex justify-between pt-1 font-bold text-white/90">
              <span>Total</span>
              <span>{rupees(order.total)}</span>
            </div>
            <p className="text-[11px] text-white/30">
              Includes {rupees(order.tax)} in taxes · Payment: {order.payment_method?.toUpperCase()}
            </p>
          </div>
        </section>

        {addr && (
          <section className="card-dark p-5">
            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-white/90">
              <MapPin className="h-4 w-4 text-ember-light" /> Delivering to
            </h2>
            <p className="text-sm text-white/60">
              {[addr.line1, addr.line2, addr.city, addr.pincode].filter(Boolean).join(', ')}
            </p>
          </section>
        )}

        {order.restaurant?.phone && (
          <a
            href={`tel:${order.restaurant.phone}`}
            className="flex items-center justify-center gap-2 rounded-2xl border-2 border-ember/50 py-3 font-semibold text-ember-light"
          >
            <Phone className="h-4 w-4" /> Call restaurant
          </a>
        )}
      </main>
    </div>
  );
}
