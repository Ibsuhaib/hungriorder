import { useState } from 'react';
import { motion } from 'framer-motion';
import { Phone, MapPin, Printer, ReceiptText, StickyNote, MessageCircle } from 'lucide-react';
import StatusBadge from './StatusBadge.jsx';
import Modal from './Modal.jsx';
import { rupees, shortId, timeAgo } from '../lib/format.js';
import { printKot, printReceipt } from '../lib/print.js';
import { callFunction } from '../lib/supabase.js';

// Customer-facing storefront origin — the tracking page lives there.
const STOREFRONT_URL =
  import.meta.env.VITE_STOREFRONT_URL ||
  `${window.location.protocol}//${window.location.host.replace('admin.', '')}`;

// Prefilled WhatsApp message with the live tracking link. Free (wa.me),
// opens WhatsApp with the text ready — the owner just hits send.
function whatsappHref(order, restaurant) {
  const phone = String(order.customer_phone || '').replace(/\D/g, '').slice(-10);
  if (phone.length !== 10) return null;
  const track = `${STOREFRONT_URL}/order/${order.id}`;
  const msg =
    `Hi${order.customer_name ? ' ' + order.customer_name : ''}! ` +
    `Your order #${shortId(order.id)} at ${restaurant?.name ?? 'our restaurant'} is being prepared. ` +
    `Track it live here: ${track}`;
  return `https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`;
}

// Next-step actions per current status. Cancel is offered separately.
function nextActions(order) {
  switch (order.status) {
    case 'pending':
      return [{ status: 'confirmed', label: 'Accept', primary: true }];
    case 'confirmed':
      return [{ status: 'preparing', label: 'Mark as Preparing', primary: true }];
    case 'preparing':
      return [{ status: 'ready', label: 'Mark as Ready', primary: true }];
    case 'ready':
      return order.order_type === 'delivery'
        ? [{ status: 'out_for_delivery', label: 'Out for Delivery', primary: true }]
        : [{ status: 'delivered', label: 'Picked Up', primary: true }];
    case 'out_for_delivery':
      return [{ status: 'delivered', label: 'Mark Delivered', primary: true }];
    default:
      return [];
  }
}

const CANCELLABLE = ['pending', 'confirmed', 'preparing', 'ready'];

export default function OrderCard({ order, restaurant, onStatusChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const addr = order.delivery_address;
  const waHref = whatsappHref(order, restaurant);

  const update = async (newStatus) => {
    setBusy(true);
    setError('');
    try {
      await callFunction('update-order-status', { order_id: order.id, new_status: newStatus });
      onStatusChange(order.id, newStatus);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.article layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold">#{shortId(order.id)}</h3>
            <StatusBadge status={order.status} />
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium capitalize text-slate-600">
              {order.order_type}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {timeAgo(order.created_at)} · {order.payment_method?.toUpperCase()}
          </p>
        </div>
        <p className="text-lg font-bold">{rupees(order.total_amount)}</p>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-sm font-semibold">{order.customer_name || 'Customer'}</p>
          <a href={`tel:${order.customer_phone}`} className="mt-0.5 flex items-center gap-1 text-xs text-navy underline">
            <Phone className="h-3 w-3" /> {order.customer_phone}
          </a>
          {addr && (
            <p className="mt-1 flex items-start gap-1 text-xs text-slate-500">
              <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
              {[addr.line1, addr.line2, addr.city, addr.pincode].filter(Boolean).join(', ')}
            </p>
          )}
          {order.notes && (
            <p className="mt-1.5 flex items-start gap-1 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-800">
              <StickyNote className="mt-0.5 h-3 w-3 shrink-0" /> {order.notes}
            </p>
          )}
        </div>
        <ul className="rounded-xl bg-slate-50 p-3 text-xs">
          {(order.order_items ?? []).map((i) => (
            <li key={i.id} className="flex justify-between py-0.5">
              <span>
                <span className="font-semibold">{i.quantity}×</span> {i.item_name}
              </span>
              <span>{rupees(i.quantity * i.unit_price)}</span>
            </li>
          ))}
        </ul>
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        {nextActions(order).map((a) => (
          <button key={a.status} disabled={busy} onClick={() => update(a.status)} className="btn-gold">
            {a.label}
          </button>
        ))}
        {CANCELLABLE.includes(order.status) && (
          <button
            disabled={busy}
            onClick={() => setConfirmCancel(true)}
            className="btn-ghost !border-red-200 !bg-red-50 !text-red-600 hover:!bg-red-100"
          >
            {order.status === 'pending' ? 'Reject' : 'Cancel'}
          </button>
        )}
        <span className="flex-1" />
        {waHref && (
          <a
            href={waHref}
            target="_blank"
            rel="noreferrer"
            className="btn-ghost flex items-center gap-1.5 !border-green-200 !bg-green-50 !text-green-700 hover:!bg-green-100"
            title="Send the live tracking link on WhatsApp"
          >
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </a>
        )}
        <button onClick={() => printKot(order)} className="btn-ghost flex items-center gap-1.5" title="Print kitchen order ticket">
          <Printer className="h-4 w-4" /> KOT
        </button>
        <button onClick={() => printReceipt(order, restaurant)} className="btn-ghost flex items-center gap-1.5" title="Print customer receipt">
          <ReceiptText className="h-4 w-4" /> Receipt
        </button>
      </div>

      {/* Themed cancel confirmation (replaces window.confirm) */}
      <Modal open={confirmCancel} onClose={() => setConfirmCancel(false)} title={order.status === 'pending' ? 'Reject this order?' : 'Cancel this order?'}>
        <p className="text-sm text-slate-600">
          Order <span className="font-semibold">#{shortId(order.id)}</span> ·{' '}
          {rupees(order.total_amount)} for {order.customer_name || 'the customer'}. This can't be
          undone, and the customer will see it as cancelled on their tracking page.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => setConfirmCancel(false)} className="btn-ghost">
            Keep order
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setConfirmCancel(false);
              update('cancelled');
            }}
            className="min-h-[44px] rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {order.status === 'pending' ? 'Reject order' : 'Cancel order'}
          </button>
        </div>
      </Modal>
    </motion.article>
  );
}
