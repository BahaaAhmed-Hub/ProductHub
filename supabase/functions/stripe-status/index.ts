// ProductHub — read the org's current plan/subscription straight from
// Stripe. No webhook in this integration: rather than maintaining a second
// source of truth that a missed/delayed webhook event could desync, the
// Billing screen just asks Stripe directly on every load — a subscription
// change made either through our Checkout/Portal flows or manually in the
// Stripe dashboard is reflected immediately, and there's no endpoint to
// register or signing secret to configure.
import { corsHeaders } from '../_shared/cors.ts';
import { authedClient, requireManager, getOrgForWorkspace } from '../_shared/authedClient.ts';
import { stripeGet } from '../_shared/stripe.ts';

interface StripeSubscription {
  id: string;
  status: string;
  cancel_at_period_end: boolean;
  current_period_end: number;
  items: { data: { price: { id: string } }[] };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = authedClient(req);
  if (!supabase) return json({ error: 'Missing Authorization header.' }, 401);

  const caller = await requireManager(supabase);
  if (!caller) return json({ error: 'Only a workspace Manager can view billing.' }, 403);

  try {
    const org = await getOrgForWorkspace(supabase, caller.workspaceId);
    if (!org) return json({ error: 'Workspace has no organization.' }, 404);
    if (!org.stripeCustomerId) return json({ plan: 'free', status: null });

    const subs = await stripeGet(`/subscriptions?customer=${org.stripeCustomerId}&status=all&limit=1`);
    const sub = (subs.data as StripeSubscription[])[0];
    if (!sub || !['active', 'trialing', 'past_due'].includes(sub.status)) {
      return json({ plan: 'free', status: sub?.status ?? null });
    }

    const priceId = sub.items.data[0]?.price.id;
    const plan =
      priceId && priceId === Deno.env.get('STRIPE_PRICE_ENTERPRISE') ? 'enterprise'
      : priceId && priceId === Deno.env.get('STRIPE_PRICE_PRO') ? 'pro'
      : 'pro'; // has an active subscription but the price doesn't match either configured tier — assume Pro rather than silently reporting free

    // Opportunistic cache refresh — nothing else reads this column
    // authoritatively, but it's cheap to keep honest for anything that does.
    await supabase.from('orgs').update({ plan }).eq('id', org.id);

    return json({
      plan,
      status: sub.status,
      currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
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
