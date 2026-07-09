// Customer profile (phone + detected location) stored on-device, plus
// distance helpers for nearest-restaurant sorting.

const PROFILE_KEY = 'ho-profile-v1';

export function loadProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p || typeof p !== 'object') return null;
    return p; // { phone, location: { lat, lng, at } | null }
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

export function detectLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('unsupported'));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, at: Date.now() }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5 * 60 * 1000 }
    );
  });
}

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
