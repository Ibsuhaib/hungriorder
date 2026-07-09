// Customer profile (phone + chosen location) stored on-device, geolocation
// with sensible fallbacks, OpenStreetMap geocoding, and distance helpers for
// nearest-restaurant sorting.

const PROFILE_KEY = 'ho-profile-v1';

export function loadProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p || typeof p !== 'object') return null;
    return p; // { phone, location: { lat, lng, label, area, city, pincode, at } | null }
  } catch {
    return null;
  }
}

export function saveProfile(patch) {
  const next = { ...(loadProfile() ?? {}), ...patch };
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — profile just won't persist */
  }
  return next;
}

// ---------------------------------------------------------------------------
// Geolocation — tries GPS-grade accuracy first, then falls back to a faster
// network-based fix. Rejects with a coded error so the UI can explain exactly
// what went wrong instead of a generic failure.
//   code: 'denied' | 'unavailable' | 'timeout' | 'unsupported'
// ---------------------------------------------------------------------------
function getPosition(options) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

export async function detectLocation() {
  if (!navigator.geolocation) {
    const e = new Error('Location is not supported on this device.');
    e.code = 'unsupported';
    throw e;
  }
  let lastErr;
  const attempts = [
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 60 * 1000 },
    { enableHighAccuracy: false, timeout: 20000, maximumAge: 10 * 60 * 1000 },
  ];
  for (const opts of attempts) {
    try {
      const pos = await getPosition(opts);
      return { lat: pos.coords.latitude, lng: pos.coords.longitude, at: Date.now() };
    } catch (err) {
      lastErr = err;
      if (err && err.code === 1) break; // PERMISSION_DENIED — retrying won't help
    }
  }
  const codes = { 1: 'denied', 2: 'unavailable', 3: 'timeout' };
  const e = new Error('Could not detect your location.');
  e.code = codes[lastErr?.code] ?? 'unavailable';
  throw e;
}

export const LOCATION_ERROR_MESSAGES = {
  denied:
    'Location is blocked for this site. Enable it in your browser settings (tap the lock icon next to the address bar), or search your area below.',
  unavailable:
    "Your device couldn't find a location fix. Make sure device location (GPS) is turned on, or search your area instead.",
  timeout: 'Locating took too long. Try again, or search your area instead.',
  unsupported: 'This browser has no location support — search your area instead.',
};

// ---------------------------------------------------------------------------
// Geocoding via OpenStreetMap Nominatim (no API key; fine for our volume).
// ---------------------------------------------------------------------------
const NOMINATIM = 'https://nominatim.openstreetmap.org';

function pickAddressParts(addr = {}) {
  const area =
    addr.suburb || addr.neighbourhood || addr.quarter || addr.residential ||
    addr.village || addr.hamlet || addr.locality || '';
  const city = addr.city || addr.town || addr.municipality || addr.county || addr.state_district || '';
  return { area, city, pincode: addr.postcode || '' };
}

function shortLabel({ area, city }, fallback) {
  const parts = [area, city].filter(Boolean);
  return parts.length ? parts.join(', ') : (fallback || 'Selected location');
}

/** lat/lng → { label, area, city, pincode } (best-effort; never throws) */
export async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `${NOMINATIM}/reverse?lat=${lat}&lon=${lng}&format=jsonv2&addressdetails=1&zoom=16`,
      { headers: { Accept: 'application/json' } }
    );
    if (!res.ok) throw new Error('geocode failed');
    const json = await res.json();
    const parts = pickAddressParts(json.address);
    return { ...parts, label: shortLabel(parts, json.name || json.display_name?.split(',')[0]) };
  } catch {
    return { area: '', city: '', pincode: '', label: 'Current location' };
  }
}

/** Free-text search → [{ lat, lng, label, area, city, pincode }] */
export async function searchPlaces(query) {
  const q = query.trim();
  if (q.length < 3) return [];
  const res = await fetch(
    `${NOMINATIM}/search?q=${encodeURIComponent(q)}&format=jsonv2&addressdetails=1&limit=6&countrycodes=in`,
    { headers: { Accept: 'application/json' } }
  );
  if (!res.ok) throw new Error('search failed');
  const json = await res.json();
  return (json ?? []).map((r) => {
    const parts = pickAddressParts(r.address);
    return {
      lat: Number(r.lat),
      lng: Number(r.lon),
      ...parts,
      label: r.name ? shortLabel({ area: r.name, city: parts.city }) : shortLabel(parts, r.display_name?.split(',')[0]),
      display: r.display_name,
    };
  });
}

// ---------------------------------------------------------------------------
// Distance helpers
// ---------------------------------------------------------------------------

// Great-circle distance in km (haversine)
export function distanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function formatKm(km) {
  if (km == null) return null;
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

export function formatCoords(lat, lng) {
  if (lat == null || lng == null) return '';
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}° ${ns}, ${Math.abs(lng).toFixed(4)}° ${ew}`;
}

/**
 * Annotate a restaurant with its distance from the user and whether the user
 * falls inside its delivery radius. Restaurants without coordinates get
 * distance null and are never excluded (we can't verify — the restaurant
 * confirms reachability when the order arrives).
 */
export function withDistance(restaurant, userLoc) {
  if (!userLoc || restaurant.latitude == null || restaurant.longitude == null) {
    return { ...restaurant, distanceKm: null, inRadius: true };
  }
  const d = distanceKm(userLoc.lat, userLoc.lng, restaurant.latitude, restaurant.longitude);
  const radius = Number(restaurant.delivery_radius_km ?? 0);
  return { ...restaurant, distanceKm: d, inRadius: radius <= 0 ? true : d <= radius };
}
