import { useState } from 'react';
import { motion } from 'framer-motion';
import { UtensilsCrossed, Smartphone, MapPin, LocateFixed, Check, Search } from 'lucide-react';
import { detectLocation, reverseGeocode, saveProfile, LOCATION_ERROR_MESSAGES } from '../lib/geo.js';
import LocationSheet from './LocationSheet.jsx';

/**
 * First-visit gate (Swiggy/Zomato style): asks for the customer's mobile
 * number and their location — auto-detected via GPS, or searched manually if
 * detection is blocked/unavailable. Location is optional; denying it just
 * disables nearest-first sorting.
 */
export default function EntryGate({ onDone }) {
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState(null);
  const [locState, setLocState] = useState('idle'); // idle | asking | ok | failed
  const [locError, setLocError] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [error, setError] = useState('');

  const cleanPhone = phone.replace(/\D/g, '').slice(0, 10);
  const phoneValid = /^[6-9]\d{9}$/.test(cleanPhone);

  const askLocation = async () => {
    setLocState('asking');
    setLocError('');
    try {
      const loc = await detectLocation();
      const place = await reverseGeocode(loc.lat, loc.lng);
      setLocation({ ...loc, ...place });
      setLocState('ok');
    } catch (err) {
      setLocState('failed');
      setLocError(LOCATION_ERROR_MESSAGES[err.code] ?? 'Could not detect your location.');
    }
  };

  const submit = (e) => {
    e.preventDefault();
    if (!phoneValid) return setError('Enter a valid 10-digit mobile number.');
    const profile = saveProfile({ phone: cleanPhone, location: location ?? null });
    onDone(profile);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-navy">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 text-lg font-bold text-white">
            <UtensilsCrossed className="h-7 w-7 text-gold" />
            <span>hungri<span className="text-gold">Order</span></span>
          </div>
          <h1 className="mt-6 text-2xl font-bold leading-snug text-white">
            Great food, direct from
            <br />
            restaurants near you
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Tell us your number and location to see the nearest restaurants and dishes.
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            {/* Phone */}
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                <Smartphone className="h-3.5 w-3.5 text-gold" /> Mobile number
              </label>
              <div className="flex overflow-hidden rounded-2xl bg-white focus-within:ring-2 focus-within:ring-gold">
                <span className="flex items-center bg-slate-100 px-3 text-sm text-slate-500">+91</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  autoFocus
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); setError(''); }}
                  placeholder="10-digit mobile number"
                  className="min-w-0 flex-1 px-3 py-3.5 text-sm text-navy outline-none"
                />
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                <MapPin className="h-3.5 w-3.5 text-gold" /> Your location
              </label>

              <button
                type="button"
                onClick={askLocation}
                disabled={locState === 'asking'}
                className={`flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed py-3.5 text-sm font-semibold transition-colors ${
                  locState === 'ok'
                    ? 'border-green-400 bg-green-400/10 text-green-300'
                    : 'border-white/25 text-slate-300 hover:border-gold hover:text-gold'
                }`}
              >
                {locState === 'asking' ? (
                  <><span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-white" /> Detecting…</>
                ) : locState === 'ok' ? (
                  <><Check className="h-4 w-4 shrink-0" /> <span className="truncate">{location?.label || 'Location detected'}</span></>
                ) : (
                  <><LocateFixed className="h-4 w-4" /> Use my current location</>
                )}
              </button>

              {locState === 'failed' && locError && (
                <p className="mt-1.5 text-xs leading-relaxed text-amber-400">{locError}</p>
              )}

              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                className="mt-2 flex w-full items-center justify-center gap-1.5 text-xs font-medium text-slate-400 underline underline-offset-4 hover:text-gold"
              >
                <Search className="h-3 w-3" />
                {locState === 'ok' ? 'Deliver somewhere else? Search your area' : 'Or search your area manually'}
              </button>
            </div>

            {error && (
              <p role="alert" className="rounded-xl bg-red-500/15 px-4 py-3 text-sm text-red-300">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!phoneValid}
              className="w-full rounded-2xl bg-gold py-4 font-bold text-navy shadow-lg disabled:opacity-40"
            >
              Start Ordering
            </button>
          </form>

          <p className="mt-4 text-center text-[11px] text-slate-500">
            Your number is used for order updates only. No spam, no sharing.
          </p>
        </motion.div>
      </div>

      <LocationSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSelect={(loc) => { setLocation(loc); setLocState('ok'); setLocError(''); }}
      />
    </div>
  );
}
