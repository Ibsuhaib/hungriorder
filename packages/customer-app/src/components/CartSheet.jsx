import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, X, ShoppingBag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import VegBadge from './VegBadge.jsx';
import { rupees } from '../lib/format.js';

export default function CartSheet({ open, onClose, restaurant }) {
  const { cart, subtotal, setQty } = useCart();
  const navigate = useNavigate();
  const deliveryFee = restaurant?.delivery_enabled ? Number(restaurant.delivery_fee ?? 0) : 0;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border-t border-white/10 bg-ink-raised p-5 pb-8 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-bold text-white/90">
                <ShoppingBag className="h-5 w-5 text-ember-light" /> Your order
              </h2>
              <button aria-label="Close cart" onClick={onClose} className="rounded-full p-1.5 hover:bg-white/10">
                <X className="h-5 w-5 text-white/50" />
              </button>
            </div>

            {cart.items.length === 0 ? (
              <p className="py-8 text-center text-sm text-white/40">Your cart is empty.</p>
            ) : (
              <>
                <ul className="divide-y divide-white/[0.06]">
                  {cart.items.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 py-3">
                      <VegBadge isVeg={item.is_veg} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white/85">{item.name}</p>
                        <p className="text-xs text-white/35">{rupees(item.price)}</p>
                      </div>
                      <div className="flex items-center gap-2 rounded-full border border-ember/30 bg-ember/10 px-1.5 py-1 text-ember-light">
                        <button aria-label="Decrease quantity" onClick={() => setQty(item.id, item.qty - 1)} className="p-0.5">
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="min-w-[1.2rem] text-center text-sm font-bold text-white/90">{item.qty}</span>
                        <button aria-label="Increase quantity" onClick={() => setQty(item.id, Math.min(item.qty + 1, 50))} className="p-0.5">
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      <span className="w-16 text-right text-sm font-bold text-white/90">
                        {rupees(item.price * item.qty)}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-4 space-y-1.5 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 text-sm">
                  <div className="flex justify-between text-white/60">
                    <span className="text-white/40">Subtotal</span>
                    <span>{rupees(subtotal)}</span>
                  </div>
                  {deliveryFee > 0 && (
                    <div className="flex justify-between text-white/60">
                      <span className="text-white/40">Delivery fee</span>
                      <span>{rupees(deliveryFee)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-white/[0.08] pt-2 font-bold text-white/90">
                    <span>Total</span>
                    <span className="price-grad">{rupees(subtotal + deliveryFee)}</span>
                  </div>
                  <p className="pt-1 text-[11px] text-white/25">
                    Prices include taxes. Delivery fee applies to delivery orders only.
                  </p>
                </div>

                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    onClose();
                    navigate(`/r/${cart.slug}/checkout`);
                  }}
                  className="btn-ember-bar mt-4 justify-center gap-2 text-[0.95rem]"
                >
                  Place Order · {rupees(subtotal + deliveryFee)}
                </motion.button>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
