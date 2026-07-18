import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isSupabaseConfigured } from '@/lib/supabase';
import { invoke } from '@/lib/edgeFunctions';

export type PlanTier = 'free' | 'pro' | 'enterprise';

export interface BillingStatus {
  plan: PlanTier;
  status: string | null;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
}

const FREE: BillingStatus = { plan: 'free', status: null };

/** Always asks Stripe directly rather than trusting a locally-cached
 * status — see stripe-status for why there's no webhook keeping a second
 * copy in sync. */
export function useBillingStatus(): { billing: BillingStatus; isLoading: boolean } {
  const q = useQuery({
    queryKey: ['billing', 'status'],
    enabled: isSupabaseConfigured,
    queryFn: () => invoke<BillingStatus>('stripe-status', {}),
  });
  if (!isSupabaseConfigured) return { billing: FREE, isLoading: false };
  return { billing: q.data ?? FREE, isLoading: q.isLoading };
}

const RETURN_URL = () => window.location.href.split('?')[0];

export function useBillingActions() {
  const qc = useQueryClient();

  return {
    /** Redirects to Stripe Checkout for a brand-new or upgraded subscription. */
    async checkout(tier: 'pro' | 'enterprise'): Promise<void> {
      if (!isSupabaseConfigured) {
        throw new Error('Billing requires a configured Supabase project (mock mode has no backend to check out against).');
      }
      const { url } = await invoke<{ url: string }>('stripe-checkout', { tier, returnUrl: RETURN_URL() });
      window.location.href = url;
    },
    /** Redirects to Stripe's hosted Billing Portal — payment method,
     * invoice history with PDF downloads, and plan changes/cancellation. */
    async openPortal(): Promise<void> {
      if (!isSupabaseConfigured) {
        throw new Error('Billing requires a configured Supabase project (mock mode has no backend to open a portal against).');
      }
      const { url } = await invoke<{ url: string }>('stripe-portal', { returnUrl: RETURN_URL() });
      window.location.href = url;
    },
    async refresh(): Promise<void> {
      await qc.invalidateQueries({ queryKey: ['billing', 'status'] });
    },
  };
}
