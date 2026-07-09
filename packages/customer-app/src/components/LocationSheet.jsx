import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, LocateFixed, Search, MapPin, Loader2 } from 'lucide-react';
import { detectLocation, reverseGeocode, searchPlaces, LOCATION_ERROR_MESSAGES } from '../lib/geo.js';

/**
 * Bottom sheet for choosing the delivery location — Zomato style:
 * "use my current location" (GPS + reverse geocode) or search any area/city.
 * Calls onSelect({ lat, lng, label, area, city, pincode, at }).
 */
export default function LocationSheet({ open, onClose, onSelect }) {
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null); // null = nothing searched yet
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setError('');
      setQuery('');
      setResults(null);
      setDetecting(false);
    }
  }, [open]);

  // Debounced area search
  useEffect(() => {
    if (!open) return;
    clearTimeout(debounceRef.current);
    if (query.trim().length < 3) {
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const found = await searchPlaces(query);
        setResults(found);
      } catch {
        setResults([]);
        setError('Search failed — check your connection and try again.');
      } finally {
        setSearching(false);
      }
    }, 500);
    return () => clearTimeout(debounceRef.current);
  }, [query, open]);

  const useCurrent = async () => {
    setError('');
    setDetecting(true);
    try {
      const loc = await detectLocation();
      const place = await reverseGeocode(loc.lat, loc.lng);
      onSelect({ ...loc, ...place });
      onClose();
    } catch (err) {
      setError(LOCATION_ERROR_MESSAGES[err.code] ?? 'Could not detect your location. Search your area instead.');
    } finally {
      setDetecting(false);
    }
  };

  const pick = (r) => {
    onSelect({ lat: r.lat, lng: r.lng, label: r.label, area: r.area, city: r.city, pincode: r.pincode, at: Date.now() });
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/50"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between px-5 pb-3 pt-5">
              <h2 className="text-base font-bold text-navy">Choose delivery location</h2>
              <button aria-label="Close" onClick={onClose} className="rounded-full p-1.5 hover:bg-slate-100">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto px-5 pb-8">
              {/* Current location */}
              <button
                type="button"
                onClick={useCurrent}
                disabled={detecting}
                className="flex w-full items-center gap-3 rounded-2xl border-2 border-gold/60 bg-gold/10 px-4 py-3.5 text-left transition-colors hover:bg-gold/20 disabled:opacity-60"
              >
                {detecting
                  ? <Loader2 className="h-5 w-5 shrink-0 animate-spin text-gold-dark" />
                  : <LocateFixed className="h-5 w-5 shrink-0 text-gold-dark" />}
                <span>
                  <span className="block text-sm font-bold text-navy">
                    {detecting ? 'Detecting your location…' : 'Use my current location'}
                  </span>
                  <span className="block text-xs text-slate-500">Your browser will ask for permission</span>
                </span>
              </button>

              {error && (
                <p role="alert" className="rounded-xl bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
                  {error}
                </p>
              )}

              {/* Divider */}
              <div className="flex items-center gap-3 py-1">
                <span className="h-px flex-1 bg-slate-100" />
                <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">or search</span>
                <span className="h-px flex-1 bg-slate-100" />
              </div>

              {/* Search */}
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 focus-within:border-gold">
                <Search className="h-4 w-4 shrink-0 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setError(''); }}
                  placeholder="Search your area, street or city…"
                  className="min-w-0 flex-1 py-3 text-sm text-navy outline-none placeholder:text-slate-400"
                  autoFocus
                />
                {searching && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-300" />}
              </div>

              {/* Results */}
              {results !== null && (
                results.length === 0 && !searching ? (
                  <p className="px-2 py-4 text-center text-xs text-slate-400">
                    No places found — try a broader name (area or city).
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-100">
                    {results.map((r, i) => (
                      <li key={`${r.lat}-${r.lng}-${i}`}>
                        <button
                          type="button"
                          onClick={() => pick(r)}
                          className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50"
                        >
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold-dark" />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-navy">{r.label}</span>
                            {r.display && (
                              <span className="mt-0.5 block truncate text-xs text-slate-400">{r.display}</span>
                            )}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )
              )}

              <p className="pt-1 text-center text-[10px] text-slate-300">
                Search powered by OpenStreetMap
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
