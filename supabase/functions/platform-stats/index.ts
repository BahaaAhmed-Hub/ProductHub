// ProductHub — cross-tenant billing aggregate for the Platform Admin
// console (ProductHub-Admin): every org's live Stripe subscription + recent
// invoices, summed into a total MRR. Same "ask Stripe directly, no webhook"
// approach as stripe-status, just fanned out across every org instead of
// one workspace's.
import { corsHeaders } from '../_shared/cors.ts';
import { authedClient, requirePlatformAdmin } from '../_shared/authedClient.ts';
import { stripeGet } from '../_shared/stripe.ts';

interface StripePrice {
  id: string;
  unit_amount: number | null;
  recurring: { interval: string } | null;
}
interface StripeSubscription {
  id: string;
  status: string;
  cancel_at_period_end: boolean;
  current_period_end: number;
  items: { data: { price: StripePrice; quantity: number }[] };
}
interface StripeInvoice {
  id: string;
  number: string | null;
  status: string;
  amount_paid: number;
  amount_due: number;
  created: number;
  invoice_pdf: string | null;
  customer: string;
  payment_intent: { payment_method?: { card?: { brand: string; last4: string } } } | null;
}
interface OrgRow {
  id: string;
  name: string;
  plan: string;
  stripe_customer_id: string | null;
}

async function mapConcurrent<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function monthlyAmount(item: { price: StripePrice; quantity: number }): number {
  const amount = ((item.price.unit_amount ?? 0) * item.quantity) / 100;
  return item.price.recurring?.interval === 'year' ? amount / 12 : amount;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = authedClient(req);
  if (!supabase) return json({ error: 'Missing Authorization header.' }, 401);

  const caller = await requirePlatformAdmin(supabase);
  if (!caller) return json({ error: 'Platform admin access required.' }, 403);

  try {
    const { data: orgs, error } = await supabase.from('orgs').select('id, name, plan, stripe_customer_id');
    if (error) return json({ error: error.message }, 500);

    const withStripe = (orgs as OrgRow[]).filter((o) => o.stripe_customer_id);

    const perOrg = await mapConcurrent(withStripe, 5, async (org) => {
      try {
        const [subs, invoices] = await Promise.all([
          stripeGet(`/subscriptions?customer=${org.stripe_customer_id}&status=all&limit=1`),
          stripeGet(`/invoices?customer=${org.stripe_customer_id}&limit=10`),
        ]);
        const sub = (subs.data as StripeSubscription[])[0] ?? null;
        const mrr = sub && ['active', 'trialing', 'past_due'].includes(sub.status)
          ? sub.items.data.reduce((sum, item) => sum + monthlyAmount(item), 0)
          : 0;
        return {
          orgId: org.id,
          orgName: org.name,
          plan: org.plan,
          mrr,
          status: sub?.status ?? null,
          renewsOn: sub ? new Date(sub.current_period_end * 1000).toISOString() : null,
          cancelAtPeriodEnd: sub?.cancel_at_period_end ?? false,
          invoices: (invoices.data as StripeInvoice[]).map((inv) => ({
            id: inv.number ?? inv.id,
            orgName: org.name,
            date: new Date(inv.created * 1000).toISOString(),
            amount: inv.amount_paid || inv.amount_due,
            status: inv.status,
            pdfUrl: inv.invoice_pdf,
          })),
        };
      } catch {
        // One org's Stripe fetch failing (e.g. a stale customer id)
        // shouldn't blank the whole platform view — just zero it out.
        return { orgId: org.id, orgName: org.name, plan: org.plan, mrr: 0, status: null, renewsOn: null, cancelAtPeriodEnd: false, invoices: [] };
      }
    });

    const totalMrr = perOrg.reduce((s, o) => s + o.mrr, 0);
    const activeCount = perOrg.filter((o) => o.status === 'active').length;
    const trialCount = perOrg.filter((o) => o.status === 'trialing').length;
    const pastDueCount = perOrg.filter((o) => o.status === 'past_due').length;
    const invoices = perOrg.flatMap((o) => o.invoices).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return json({
      totalMrr,
      activeCount,
      trialCount,
      pastDueCount,
      totalCompanies: (orgs as OrgRow[]).length,
      companies: perOrg,
      invoices,
    });
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 502);
  }
});

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}
