import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { UtensilsCrossed, ShoppingBag } from 'lucide-react';
import { supabase, isConfigured } from '../lib/supabase.js';

const STOREFRONT_URL = import.meta.env.VITE_STOREFRONT_URL || 'https://hungriorder.com';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(
    location.state?.noProfile ? 'This account is not linked to a restaurant. Contact hungriOrder support.' : ''
  );

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!isConfigured) {
      return setError(
        'This deployment is missing its Supabase configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the hosting environment (Vercel → Settings → Environment Variables) and redeploy.'
      );
    }
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (err) {
      // Only wrong credentials get the friendly message — every other failure
      // (network, config, CORS) shows its real cause so it can be fixed.
      if (err.message?.toLowerCase().includes('invalid login credentials')) {
        return setError('Invalid email or password.');
      }
      if (err.message?.toLowerCase().includes('failed to fetch')) {
        return setError('Could not reach the server. Check your connection — or, if this is a fresh deployment, its Supabase environment variables.');
      }
      return setError(err.message || 'Sign-in failed. Please try again.');
    }
    navigate('/', { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy px-5">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm rounded-3xl bg-white p-7 shadow-2xl"
      >
        <div className="flex items-center gap-2">
          <UtensilsCrossed className="h-6 w-6 text-gold" />
          <span className="font-bold">
            hungri<span className="text-gold">Order</span> <span className="font-medium text-slate-400">Admin</span>
          </span>
        </div>
        <h1 className="mt-5 text-xl font-bold">Sign in to your restaurant</h1>
        <form onSubmit={submit} className="mt-5 space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="input"
            autoComplete="email"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="input"
            autoComplete="current-password"
            required
          />
          {error && (
            <p role="alert" className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy} className="btn-primary w-full !py-3">
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-slate-400">
          New to hungriOrder? Contact support to get your restaurant onboarded.
        </p>
        <a
          href={STOREFRONT_URL}
          className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs font-medium text-navy underline underline-offset-2"
        >
          <ShoppingBag className="h-3.5 w-3.5" /> Looking to order food? Go to hungriOrder
        </a>
      </motion.div>
    </div>
  );
}
