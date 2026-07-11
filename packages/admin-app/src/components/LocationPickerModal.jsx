import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { X, LocateFixed, Search, MapPin, Loader2 } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Draggable-pin map picker (Leaflet + OpenStreetMap tiles — no API key).
// Search an address to jump close, then drag the pin (or tap the map) to the
// exact spot. Returns { lat, lng } via onSave.

const INDIA_CENTER = [20.5937, 78.9629];

const PIN_ICON = L.divIcon({
  className: '',
  html: `<svg width="34" height="46" viewBox="0 0 24 24" fill="none" style="filter: drop-shadow(0 3px 6px rgba(0,0,0,0.35))">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#d4a373" stroke="#7f5030" stroke-width="1"/>
    <circle cx="12" cy="9" r="2.6" fill="#ffffff"/>
  </svg>`,
  iconSize: [34, 46],
  iconAnchor: [17, 44],
});

async function searchNominatim(q) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&limit=6&countrycodes=in`,
    { headers: { Accept: 'application/json' } }
  );
  if (!res.ok) throw new Error('search failed');
  return res.json();
}

export default function LocationPickerModal({ open, onClose, onSave, initialLat = null, initialLng = null }) {
  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const debounceRef = useRef(null);
  const [pos, setPos] = useState(null); // { lat, lng }
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);

  const placePin = (lat, lng, zoom) => {
    setPos({ lat, lng });
    if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
    if (mapRef.current) mapRef.current.setView([lat, lng], zoom ?? mapRef.current.getZoom());
  };

  // Build/destroy the map when the modal opens/closes
  useEffect(() => {
    if (!open || !mapElRef.current) return;

    const hasInitial = initialLat != null && initialLng != null;
    const center = hasInitial ? [Number(initialLat), Number(initialLng)] : INDIA_CENTER;
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
    if (hasInitial) setPos({ lat: Number(initialLat), lng: Number(initialLng) });

    // Leaflet miscalculates size inside animated modals — recalc after paint
    setTimeout(() => map.invalidateSize(), 60);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      setPos(null);
      setQuery('');
      setResults(null);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced address search
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
        setResults(await searchNominatim(query));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 500);
    return () => clearTimeout(debounceRef.current);
  }, [query, open]);

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { placePin(p.coords.latitude, p.coords.longitude, 17); setLocating(false); },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  if (!open) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-3"
      >
        <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <h3 className="text-base font-bold">Set exact restaurant location</h3>
              <p className="mt-0.5 text-xs text-slate-400">Search to get close, then drag the pin to your door</p>
            </div>
            <button type="button" onClick={onClose} className="shrink-0 rounded-full p-1.5 hover:bg-slate-100">
              <X className="h-4 w-4 text-slate-400" />
            </button>
          </div>

          {/* Search + locate */}
          <div className="space-y-2 px-4 pb-2 pt-3">
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search your address, area or landmark…"
                  className="input !pl-9 text-sm"
                />
                {searching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-300" />}
              </div>
              <button
                type="button"
                onClick={useMyLocation}
                disabled={locating}
                title="Center on my current location"
                className="shrink-0 rounded-xl border border-slate-200 px-3 text-slate-600 hover:border-gold"
              >
                {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
              </button>
            </div>

            {results !== null && (
              <div className="max-h-36 divide-y divide-slate-50 overflow-y-auto rounded-xl border border-slate-200">
                {results.length === 0 && !searching ? (
                  <p className="px-3 py-2 text-xs text-slate-400">No places found — try a broader name.</p>
                ) : (
                  results.map((r, i) => (
                    <button
                      key={`${r.lat}-${r.lon}-${i}`}
                      type="button"
                      onClick={() => { placePin(Number(r.lat), Number(r.lon), 17); setResults(null); setQuery(''); }}
                      className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-slate-50"
                    >
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
                      <span className="text-xs leading-snug text-slate-700">{r.display_name}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Map */}
          <div ref={mapElRef} className="h-[42vh] min-h-[260px] w-full bg-slate-100" />

          {/* Footer */}
          <div className="flex items-center gap-3 border-t border-slate-100 px-4 py-3">
            <p className="min-w-0 flex-1 truncate font-mono text-xs text-slate-500">
              {pos ? `${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}` : 'Tap the map or drag the pin to set the spot'}
            </p>
            <button type="button" onClick={onClose} className="btn-ghost shrink-0 text-sm">Cancel</button>
            <button
              type="button"
              disabled={!pos}
              onClick={() => { onSave({ lat: pos.lat, lng: pos.lng }); onClose(); }}
              className="btn-primary shrink-0 text-sm disabled:opacity-40"
            >
              Use This Location
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}
