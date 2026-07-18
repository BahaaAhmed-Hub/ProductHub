// Service-role Supabase client — the only client in this codebase allowed
// to bypass RLS. Used exclusively for Admin API calls (inviteUserByEmail)
// that have no anon/authenticated-JWT equivalent. SUPABASE_SERVICE_ROLE_KEY
// is auto-populated for every Edge Function by Supabase; no secret to set.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export function adminClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
}
