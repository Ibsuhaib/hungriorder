import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, LocateFixed, Search, MapPin, Loader2, Check } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { detectLocation, reverseGeocode, searchPlaces } from '../lib/geo.js';

// Swiggy-style pin-drop picker: search to jump close, then drag the ember pin
// (or tap the map) to the exact doorstep. Leaflet + OpenStreetMap tiles (no
// key); search + reverse geocoding use the app's provider chain (Ola →
// Google → OSM). Returns the same location shape as the rest of the app.

const INDIA_CENTER = [20.5937, 78.9629];

const PIN_ICON = L.divIcon({
  className: '',
  html: `<svg width="36" height="48" viewBox="0 0 24 24" fill="none" style="filter: drop-shadow(0 4px 8px rgba(212, 163, 115,0.5))">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#e6c69a" stroke="#b8865a" stroke-width="1"/>
    <circle cx="12" cy="9" r="2.6" fill="#ffffff"/>
  </svg>`,
  iconSize: [36, 48],
  iconAnchor: [18, 46],
});

export default function LocationPickerMap({ open, onClose, onSelect, initial = null }) {
  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const debounceRef = useRef(null);
  const [pos, setPos] = useState(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const placePin = (lat, lng, zoom) => {
    setPos({ lat, lng });
    if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
    if (mapRef.current) mapRef.current.setView([lat, lng], zoom ?? mapRef.current.getZoom());
  };

  // Build/destroy the map with the modal
  useEffect(() => {
    if (!open || !mapElRef.current) return;

    const hasInitial = initial?.lat != null && initial?.lng != null;
    const center = hasInitial ? [Number(initial.lat), Number(initial.lng)] : INDIA_CENTER;
    const zoom = hasInitial ? 17 : 5;

    const map = L.map(mapElRef.current, { center, zoom, zoomControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    const marker = L.marker(center, { draggable: true, icon: PIN_ICON, autoPan: true }).addTo(map);
    marker.on('dragend', () => {
      const p = marker.getLatLng();
      setPos({ lat: p.lat, lng: p.lng });
    });
    map.on('click', (e) => {
      marker.setLatLng(e.latlng);
      setPos({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    mapRef.current = map;
    markerRef.current = marker;
    if (hasInitial) setPos({ lat: Number(initial.lat), lng: Number(initial.lng) });

    // Leaflet miscalculates size inside animated modals — recalc after paint
    setTimeout(() => map.invalidateSize(), 60);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      setPos(null);
      setQuery('');
      setResults(null);
      setConfirming(false);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search via the app's geocoding provider chain
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
        setResults(await searchPlaces(query));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 500);
    return () => clearTimeout(debounceRef.current);
  }, [query, open]);

  const useMyLocation = async () => {
    setLocating(true);
    try {
      const loc = await detectLocation();
      placePin(loc.lat, loc.lng, 17);
    } catch {
      /* denied/unavailable — user can still search + drag */
    } finally {
      setLocating(false);
    }
  };

  const confirm = async () => {
    if (!pos || confirming) return;
    setConfirming(true);
    const place = await reverseGeocode(pos.lat, pos.lng);
    onSelect({ lat: pos.lat, lng: pos.lng, ...place, at: Date.now() });
    setConfirming(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-[70] mx-auto flex max-h-[94vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border-t border-white/10 bg-ink-raised shadow-2xl pb-safe"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-2 pt-4">
              <div>
                <h2 className="text-base font-bold text-white/90">Pin your exact location</h2>
                <p className="mt-0.5 text-xs text-white/40">Search to get close, then drag the pin to your door</p>
              </div>
              <button aria-label="Close" onClick={onClose} className="rounded-full p-1.5 hover:bg-white/10">
                <X className="h-5 w-5 text-white/50" />
              </button>
            </div>

            {/* Search + locate */}
            <div className="space-y-2 px-5 pb-3">
              <div className="flex gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-white/[0.12] bg-white/[0.06] px-3 focus-within:border-ember/50">
                  <Search className="h-4 w-4 shrink-0 text-white/35" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search your area, street or landmark…"
                    className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-white/90 outline-none placeholder:text-white/30"
                  />
                  {searching && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-white/30" />}
                </div>
                <button
                  type="button"
                  onClick={useMyLocation}
                  disabled={locating}
                  title="Center on my current location"
                  className="shrink-0 rounded-2xl border border-ember/40 bg-ember/10 px-3 text-ember-light hover:bg-ember/20 disabled:opacity-50"
                >
                  {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
                </button>
              </div>

              {results !== null && (
                <div className="max-h-32 divide-y divide-white/[0.06] overflow-y-auto rounded-2xl border border-white/[0.08]">
                  {results.length === 0 && !searching ? (
                    <p className="px-3 py-2 text-xs text-white/35">No places found — try a broader name.</p>
                  ) : (
                    results.map((r, i) => (
                      <button
                        key={`${r.lat}-${r.lng}-${i}`}
                        type="button"
                        onClick={() => { placePin(r.lat, r.lng, 17); setResults(null); setQuery(''); }}
                        className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-white/5"
                      >
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ember-light" />
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-semibold text-white/90">{r.label}</span>
                          {r.display && <span className="block truncate text-[11px] text-white/35">{r.display}</span>}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Map (light tiles inside dark chrome) */}
            <div ref={mapElRef} className="h-[46vh] min-h-[280px] w-full bg-white/5" />

            {/* Footer */}
            <div className="flex items-center gap-3 border-t border-white/10 px-5 py-3">
              <p className="min-w-0 flex-1 truncate font-mono text-[11px] text-white/40">
                {pos ? `${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}` : 'Tap the map or drag the pin'}
              </p>
              <button
                type="button"
                disabled={!pos || confirming}
                onClick={confirm}
                className="btn-ember shrink-0 !rounded-2xl px-6 py-3 text-sm disabled:opacity-40"
              >
                {confirming
                  ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Saving…</span>
                  : <span className="flex items-center gap-1.5"><Check className="h-4 w-4" /> Confirm Location</span>}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
