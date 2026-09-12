import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Banknote, Smartphone, CreditCard, MapPin } from 'lucide-react';
import { supabase, callFunction } from '../lib/supabase.js';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { rupees, isOpenNow } from '../lib/format.js';
import { loadProfile } from '../lib/geo.js';
import { onlyOrderable } from '../lib/orderable.js';
import Spinner from '../components/Spinner.jsx';

const PAYMENT_OPTIONS = [
  { value: 'cash', label: 'Cash on Delivery', icon: Banknote },
  { value: 'upi', label: 'UPI (pay on delivery)', icon: Smartphone },
  { value: 'card', label: 'Card (pay on delivery)', icon: CreditCard },
];

export default function Checkout() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { cart, subtotal, clear } = useCart();
  const { customer, session } = useAuth();

  const [restaurant, setRestaurant] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [orderType, setOrderType] = useState('delivery');
  // Prefill from the entry-gate profile: the number entered on the landing
  // page, and the area/city/pincode of the chosen delivery location.
  const [profile] = useState(() => loadProfile());
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [name, setName] = useState('');
  const [address, setAddress] = useState({
    line1: '',
    line2: profile?.location?.area ?? '',
    city: profile?.location?.city ?? '',
    pincode: profile?.location?.pincode ?? '',
  });
  const [savedIdx, setSavedIdx] = useState(-1);
  const [payment, setPayment] = useState('cash');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    onlyOrderable(supabase.from('restaurants').select('*').eq('slug', slug))
      .maybeSingle()
      .then(({ data, error }) => {
        // No row comes back when the restaurant is inactive, has online
        // ordering switched off, or the slug is wrong. Without this the page
        // sat on a spinner forever, on the checkout screen of all places.
        if (error || !data) {
          setLoadFailed(true);
          return;
        }
        setRestaurant(data);
      }, () => setLoadFailed(true));
  }, [slug]);

  useEffect(() => {
    if (customer?.phone && !phone) setPhone(customer.phone);
    if (customer?.name && !name) setName(customer.name);
  }, [customer]); // eslint-disable-line react-hooks/exhaustive-deps

  const savedAddresses = useMemo(
    () => (Array.isArray(customer?.addresses) ? customer.addresses : []),
    [customer]
  );

  const pickSaved = (idx) => {
    setSavedIdx(idx);
    if (idx >= 0) {
      const a = savedAddresses[idx];
      setAddress({ line1: a.line1 ?? '', line2: a.line2 ?? '', city: a.city ?? '', pincode: a.pincode ?? '' });
    }
  };

  if (loadFailed) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-lg font-bold text-white">This restaurant isn&apos;t taking online orders</h1>
        <p className="text-sm text-slate-400">
          It may have closed online ordering, or the link may be out of date. Your cart has been kept.
        </p>
        <Link to="/" className="btn-ember px-6 py-2.5 text-sm">Browse restaurants</Link>
      </div>
    );
  }

  if (!restaurant) return <Spinner full />;

  const wrongCart = cart.restaurantId !== restaurant.id || cart.items.length === 0;
  const deliveryFee = orderType === 'delivery' ? Number(restaurant.delivery_fee ?? 0) : 0;
  const total = subtotal + deliveryFee;
  const cleanPhone = phone.replace(/\D/g, '').slice(-10);
  const phoneValid = /^[6-9]\d{9}$/.test(cleanPhone);
  const addressValid = orderType === 'takeaway' || address.line1.trim().length > 3;
  const minOrder = Number(restaurant.min_order_amount ?? 0);
  const belowMin = orderType === 'delivery' && subtotal < minOrder;
  const restaurantOpen = isOpenNow(restaurant.opening_hours);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!restaurantOpen) return setError('The restaurant is closed right now. Please order during opening hours.');
    if (!phoneValid) return setError('Enter a valid 10-digit mobile number.');
    if (!addressValid) return setError('Enter a delivery address.');
    if (belowMin) return setError(`Minimum order for delivery is ${rupees(minOrder)}.`);
    setSubmitting(true);
    try {
      const result = await callFunction('place-online-order', {
        restaurant_id: restaurant.id,
        items: cart.items.map((i) => ({ menu_item_id: i.id, quantity: i.qty })),
        order_type: orderType,
        delivery_address: orderType === 'delivery' ? address : null,
        customer_phone: cleanPhone,
        customer_name: name.trim() || null,
        notes: notes.trim() || null,
        payment_method: payment,
      });
      // Persist the address for signed-in customers who typed a new one.
      if (session?.user && orderType === 'delivery' && savedIdx === -1 && address.line1.trim()) {
        const next = [...savedAddresses, { label: 'Saved', ...address }].slice(-5);
        await supabase.from('customers').update({ addresses: next }).eq('id', session.user.id);
      }
      clear();
      navigate(`/r/${slug}/success/${result.order_id}`, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink pb-10">
      <header className="glass-top flex items-center gap-3 px-4 py-3">
        <Link to={`/r/${slug}`} aria-label="Back to menu" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-base font-bold text-white/90">Checkout</h1>
          <p className="text-xs text-white/40">{restaurant.name}</p>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pt-5">
        {wrongCart ? (
          <div className="card-dark p-6 text-center">
            <p className="text-sm text-white/50">Your cart is empty for this restaurant.</p>
            <Link
              to={`/r/${slug}`}
              className="mt-3 inline-block btn-ember px-5 py-2 text-sm"
            >
              Browse the menu
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {/* Order type */}
            {restaurant.delivery_enabled && (
              <div className="card-dark flex gap-2 p-1.5">
                {['delivery', 'takeaway'].map((t) => (
                  <button
                    type="button"
                    key={t}
                    onClick={() => setOrderType(t)}
                    className={`flex-1 rounded-xl py-2 text-sm font-semibold capitalize transition-colors ${
                      orderType === t ? "bg-ember text-white shadow-ember-glow" : "text-white/40"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}

            {/* Contact */}
            <section className="card-dark p-4">
              <h2 className="mb-3 text-sm font-bold text-white/90">Your details</h2>
              <label className="block text-xs font-medium text-white/40">
                Mobile number *
                <input
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="10-digit mobile number"
                  className="mt-1 w-full rounded-xl border border-white/[0.12] bg-white/[0.06] px-3 py-2.5 text-sm text-white/90 outline-none placeholder:text-white/25 focus:border-ember/50"
                  required
                />
              </label>
              <label className="mt-3 block text-xs font-medium text-white/40">
                Name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name (optional)"
                  maxLength={80}
                  className="mt-1 w-full rounded-xl border border-white/[0.12] bg-white/[0.06] px-3 py-2.5 text-sm text-white/90 outline-none placeholder:text-white/25 focus:border-ember/50"
                />
              </label>
            </section>

            {/* Address */}
            {orderType === 'delivery' && (
              <section className="card-dark p-4">
                <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-white/90">
                  <MapPin className="h-4 w-4 text-ember-light" /> Delivery address
                </h2>
                {profile?.location?.label && (
                  <p className="mb-3 rounded-xl bg-ember/10 px-3 py-2 text-xs text-ember-light">
                    📍 Delivering near <span className="font-semibold">{profile.location.label}</span> — add
                    your house/flat details below.
                  </p>
                )}
                {savedAddresses.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {savedAddresses.map((a, i) => (
                      <button
                        type="button"
                        key={i}
                        onClick={() => pickSaved(i)}
                        className={`rounded-full border px-3 py-1 text-xs ${
                          savedIdx === i ? 'border-ember bg-ember/15 font-semibold text-ember-light' : "border-white/15 text-white/50"
                        }`}
                      >
                        {a.label || a.line1?.slice(0, 20)}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setSavedIdx(-1);
                        setAddress({ line1: '', line2: '', city: '', pincode: '' });
                      }}
                      className={`rounded-full border px-3 py-1 text-xs ${
                        savedIdx === -1 ? 'border-ember bg-ember/15 font-semibold text-ember-light' : "border-white/15 text-white/50"
                      }`}
                    >
                      New address
                    </button>
                  </div>
                )}
                <input
                  value={address.line1}
                  onChange={(e) => setAddress({ ...address, line1: e.target.value })}
                  placeholder="Flat / house no., street *"
                  maxLength={200}
                  className="w-full rounded-xl border border-white/[0.12] bg-white/[0.06] px-3 py-2.5 text-sm text-white/90 outline-none placeholder:text-white/25 focus:border-ember/50"
                  required
                />
                <input
                  value={address.line2}
                  onChange={(e) => setAddress({ ...address, line2: e.target.value })}
                  placeholder="Area / landmark"
                  maxLength={120}
                  className="mt-2 w-full rounded-xl border border-white/[0.12] bg-white/[0.06] px-3 py-2.5 text-sm text-white/90 outline-none placeholder:text-white/25 focus:border-ember/50"
                />
                <div className="mt-2 flex gap-2">
                  <input
                    value={address.city}
                    onChange={(e) => setAddress({ ...address, city: e.target.value })}
                    placeholder="City"
                    maxLength={80}
                    className="min-w-0 flex-1 rounded-xl border border-white/[0.12] bg-white/[0.06] px-3 py-2.5 text-sm text-white/90 outline-none placeholder:text-white/25 focus:border-ember/50"
                  />
                  <input
                    value={address.pincode}
                    onChange={(e) => setAddress({ ...address, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                    placeholder="Pincode"
                    inputMode="numeric"
                    className="w-28 rounded-xl border border-white/[0.12] bg-white/[0.06] px-3 py-2.5 text-sm text-white/90 outline-none placeholder:text-white/25 focus:border-ember/50"
                  />
                </div>
              </section>
            )}

            {/* Payment */}
            <section className="card-dark p-4">
              <h2 className="mb-3 text-sm font-bold text-white/90">Payment</h2>
              <div className="space-y-2">
                {PAYMENT_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm ${
                      payment === opt.value ? 'border-ember bg-ember/10 text-white/90' : "border-white/15 text-white/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value={opt.value}
                      checked={payment === opt.value}
                      onChange={() => setPayment(opt.value)}
                      className="accent-[#d4a373]"
                    />
                    <opt.icon className="h-4 w-4 text-white/45" />
                    {opt.label}
                  </label>
                ))}
              </div>
            </section>

            {/* Notes */}
            <section className="card-dark p-4">
              <h2 className="mb-2 text-sm font-bold text-white/90">Special instructions</h2>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={500}
                rows={2}
                placeholder="e.g. less spicy, ring the bell twice"
                className="w-full resize-none rounded-xl border border-white/[0.12] bg-white/[0.06] px-3 py-2.5 text-sm text-white/90 outline-none placeholder:text-white/25 focus:border-ember/50"
              />
            </section>

            {/* Summary */}
            <section className="card-dark p-4">
              <h2 className="mb-3 text-sm font-bold text-white/90">Order summary</h2>
              <ul className="space-y-1.5 text-sm">
                {cart.items.map((i) => (
                  <li key={i.id} className="flex justify-between">
                    <span className="text-white/60">
                      {i.name} × {i.qty}
                    </span>
                    <span>{rupees(i.price * i.qty)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 space-y-1 border-t border-white/[0.08] pt-3 text-sm">
                <div className="flex justify-between text-white/40">
                  <span>Subtotal (incl. taxes)</span>
                  <span>{rupees(subtotal)}</span>
                </div>
                {deliveryFee > 0 && (
                  <div className="flex justify-between text-white/40">
                    <span>Delivery fee</span>
                    <span>{rupees(deliveryFee)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-1 text-base font-bold text-white/90">
                  <span>Total</span>
                  <span>{rupees(total)}</span>
                </div>
              </div>
              {belowMin && (
                <p className="mt-2 text-xs text-red-400">
                  Minimum order for delivery is {rupees(minOrder)}. Add {rupees(minOrder - subtotal)} more.
                </p>
              )}
            </section>

            {error && (
              <p role="alert" className="rounded-xl bg-red-500/15 px-4 py-3 text-sm text-red-300">
                {error}
              </p>
            )}

            {!restaurantOpen && (
              <p className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-center text-sm font-semibold text-amber-300">
                The restaurant is closed right now — ordering opens with their business hours.
              </p>
            )}
            <motion.button
              whileTap={{ scale: 0.97 }}
              type="submit"
              disabled={submitting || belowMin || !restaurantOpen}
              className="btn-ember-bar justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? 'Placing order…' : `Confirm Order · ${rupees(total)}`}
            </motion.button>
          </form>
        )}
      </main>
    </div>
  );
}
