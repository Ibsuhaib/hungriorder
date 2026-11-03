import { motion } from 'framer-motion';
import { Plus, Minus, UtensilsCrossed } from 'lucide-react';
import VegBadge from './VegBadge.jsx';
import { rupees } from '../lib/format.js';

// Dark item card — same layout language as the hungriAR QR menu:
// 82px rounded image left, name + 2-line description, gradient price,
// gold "Add +" pill that becomes a quantity stepper.
// `closed` disables ordering while keeping the menu browsable.
export default function MenuItemCard({ item, qty, onAdd, onSetQty, closed = false }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className="card-dark relative overflow-hidden p-3.5"
    >
      <div className="flex items-start gap-3.5">
        {/* Image */}
        <div
          className="flex h-[82px] w-[82px] shrink-0 items-center justify-center overflow-hidden rounded-[15px] bg-white/[0.06]"
          style={item.image_url ? { boxShadow: '0 6px 20px rgba(0,0,0,0.45)' } : undefined}
        >
          {item.image_url ? (
            <img src={item.image_url} alt={item.name} loading="lazy" className="h-full w-full object-cover" />
          ) : (
            // Most dishes have no photo yet, so this fallback is what customers
            // actually see most of the time — a bare emoji on a flat square read
            // as a broken image rather than a deliberate empty state.
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-white/[0.07] to-transparent">
              <UtensilsCrossed className="h-7 w-7 text-ember-light/30" strokeWidth={1.5} aria-hidden="true" />
            </div>
          )}
        </div>

        {/* Details */}
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex items-start gap-2">
            <VegBadge isVeg={item.is_veg} className="mt-0.5" />
            <p className="min-w-0 flex-1 text-[0.9rem] font-bold leading-snug text-white/[0.92]">{item.name}</p>
          </div>
          {item.description && (
            <p className="mt-1 line-clamp-2 text-[0.78rem] leading-relaxed text-white/[0.55]">{item.description}</p>
          )}

          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="price-grad text-[0.95rem]">{rupees(item.price)}</p>

            {closed ? (
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[0.72rem] font-bold text-white/40">
                Closed
              </span>
            ) : qty > 0 ? (
              <div
                className="flex items-center gap-0.5 rounded-full px-1 py-1 text-ink shadow-ember-glow"
                style={{ background: 'linear-gradient(135deg, #d4a373 0%, #e6c69a 100%)' }}
              >
                <button
                  type="button"
                  aria-label={`Remove one ${item.name}`}
                  onClick={() => onSetQty(item.id, qty - 1)}
                  className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/10"
                >
                  <Minus size={16} strokeWidth={3} />
                </button>
                <span className="min-w-[1.1rem] text-center text-[0.85rem] font-black">{qty}</span>
                <button
                  type="button"
                  aria-label={`Add one ${item.name}`}
                  onClick={() => onSetQty(item.id, Math.min(qty + 1, 50))}
                  className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/10"
                >
                  <Plus size={16} strokeWidth={3} />
                </button>
              </div>
            ) : (
              <motion.button
                type="button"
                whileTap={{ scale: 0.91 }}
                onClick={onAdd}
                className="btn-ember px-5 py-1.5 text-[0.8rem] tracking-[0.3px]"
              >
                Add +
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
