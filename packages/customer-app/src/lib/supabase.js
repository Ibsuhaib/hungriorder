import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn('Supabase env vars missing — copy .env.example to .env and fill them in.');
}

// False when the build is missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY —
// pages use this to show a clear "not configured" message instead of
// mysterious failed requests to localhost.
export const isConfigured = Boolean(url && anonKey);

// Distinct storageKey per app. All three apps share one Supabase project, so
// on the default key a customer session and an admin session would overwrite
// each other if these were ever served from the same origin.
export const supabase = createClient(url ?? 'http://localhost:54321', anonKey ?? 'anon', {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'hungriorder-customer-auth' },
});

export const FUNCTIONS_URL = `${url ?? ''}/functions/v1`;

export async function callFunction(name, body) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${FUNCTIONS_URL}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${session?.access_token ?? anonKey}`,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Something went wrong. Please try again.');
  return json;
}
