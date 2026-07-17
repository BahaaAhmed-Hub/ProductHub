import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export type SignupBranch = 'personal' | 'first' | 'subsequent';

export interface DomainCheckResult {
  branch: SignupBranch;
  orgName?: string;
  managerName?: string;
}

const PERSONAL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com',
  'aol.com', 'live.com', 'protonmail.com', 'me.com',
]);

/** Mirrors check_signup_domain() server-side logic against the mock roster,
 * so the wizard is fully walkable without Supabase configured. */
function mockCheckSignupDomain(email: string): DomainCheckResult {
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  if (!domain || PERSONAL_DOMAINS.has(domain)) return { branch: 'personal' };
  if (domain === 'flowdesk.io') return { branch: 'subsequent', orgName: 'Flowdesk', managerName: 'Omar F.' };
  const label = domain.split('.')[0] ?? 'workspace';
  return { branch: 'first', orgName: label.charAt(0).toUpperCase() + label.slice(1) };
}

/** Pre-signup check (public RPC, no auth) — tells the wizard which branch
 * screen to show, and whether a PM/Developer role choice is needed, BEFORE
 * the account is created. */
export async function checkSignupDomain(email: string): Promise<DomainCheckResult> {
  if (!isSupabaseConfigured) return mockCheckSignupDomain(email);
  const { data, error } = await supabase.rpc('check_signup_domain', { p_email: email });
  if (error) throw error;
  const row = data as { branch: SignupBranch; org_name?: string; manager_name?: string };
  return {
    branch: row.branch,
    ...(row.org_name ? { orgName: row.org_name } : {}),
    ...(row.manager_name ? { managerName: row.manager_name } : {}),
  };
}
