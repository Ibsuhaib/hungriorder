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
  // Always try for a FRESH high-accuracy (GPS) fix first — a cached or
  // network-based fix on desktop can be hundreds of metres off.
  const attempts = [
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    { enableHighAccuracy: false, timeout: 20000, maximumAge: 60 * 1000 },
  ];
  for (const opts of attempts) {
    try {
      const pos = await getPosition(opts);
      return {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? null, // metres, for "approximate" hints
        at: Date.now(),
      };
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
// Geocoding. Google (Geocoding API) when VITE_GOOGLE_MAPS_API_KEY is set —
// much more accurate in India — with automatic fallback to OpenStreetMap
// Nominatim (no key needed) so the app always works.
// ---------------------------------------------------------------------------
const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const NOMINATIM = 'https://nominatim.openstreetmap.org';

function shortLabel({ area, city }, fallback) {
  const parts = [area, city].filter(Boolean);
  return parts.length ? parts.join(', ') : (fallback || 'Selected location');
}

// ── Google helpers ──────────────────────────────────────────────────────────
function partsFromGoogle(components = []) {
  const get = (...types) => {
    for (const t of types) {
      const c = components.find((x) => x.types.includes(t));
      if (c) return c.long_name;
    }
    return '';
  };
  return {
    area: get('sublocality_level_1', 'sublocality', 'neighborhood', 'route'),
    city: get('locality', 'postal_town', 'administrative_area_level_3', 'administrative_area_level_2'),
    pincode: get('postal_code'),
  };
}

async function googleReverse(lat, lng) {
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_KEY}&language=en&region=in`
  );
  if (!res.ok) throw new Error('google reverse failed');
  const json = await res.json();
  if (json.status !== 'OK' || !json.results?.length) throw new Error(json.status || 'no results');
  const best = json.results[0];
  const parts = partsFromGoogle(best.address_components);
  return { ...parts, label: shortLabel(parts, best.formatted_address?.split(',')[0]) };
}

async function googleSearch(q) {
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&components=country:IN&key=${GOOGLE_KEY}&language=en&region=in`
  );
  if (!res.ok) throw new Error('google search failed');
  const json = await res.json();
  if (json.status === 'ZERO_RESULTS') return [];
  if (json.status !== 'OK') throw new Error(json.status);
  return (json.results ?? []).slice(0, 6).map((r) => {
    const parts = partsFromGoogle(r.address_components);
    return {
      lat: r.geometry.location.lat,
      lng: r.geometry.location.lng,
      ...parts,
      label: shortLabel(parts, r.formatted_address?.split(',')[0]),
      display: r.formatted_address,
    };
  });
}

// ── OpenStreetMap helpers (fallback) ────────────────────────────────────────
function pickAddressParts(addr = {}) {
  const area =
    addr.suburb || addr.neighbourhood || addr.quarter || addr.residential ||
    addr.village || addr.hamlet || addr.locality || '';
  const city = addr.city || addr.town || addr.municipality || addr.county || addr.state_district || '';
  return { area, city, pincode: addr.postcode || '' };
}

async function osmReverse(lat, lng) {
  const res = await fetch(
    `${NOMINATIM}/reverse?lat=${lat}&lon=${lng}&format=jsonv2&addressdetails=1&zoom=16`,
    { headers: { Accept: 'application/json' } }
  );
  if (!res.ok) throw new Error('geocode failed');
  const json = await res.json();
  const parts = pickAddressParts(json.address);
  return { ...parts, label: shortLabel(parts, json.name || json.display_name?.split(',')[0]) };
}

async function osmSearch(q) {
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

// ── Public API ──────────────────────────────────────────────────────────────

/** lat/lng → { label, area, city, pincode } (best-effort; never throws) */
export async function reverseGeocode(lat, lng) {
  if (GOOGLE_KEY) {
    try {
      return await googleReverse(lat, lng);
    } catch (err) {
      console.warn('Google reverse geocode failed, falling back to OSM:', err?.message);
    }
  }
  try {
    return await osmReverse(lat, lng);
  } catch {
    return { area: '', city: '', pincode: '', label: 'Current location' };
  }
}

/** Free-text search → [{ lat, lng, label, area, city, pincode, display }] */
export async function searchPlaces(query) {
  const q = query.trim();
  if (q.length < 3) return [];
  if (GOOGLE_KEY) {
    try {
      return await googleSearch(q);
    } catch (err) {
      console.warn('Google place search failed, falling back to OSM:', err?.message);
    }
  }
  return osmSearch(q);
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
