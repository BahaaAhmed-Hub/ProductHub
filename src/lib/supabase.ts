import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  // Non-fatal in dev so the UI shell still renders against mock data.
  console.warn('[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set — running in mock mode.');
}

// Untyped client for now; run `supabase gen types` later for full table typing.
export const supabase = createClient(url ?? 'http://localhost', anon ?? 'anon', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const isSupabaseConfigured = Boolean(url && anon);
