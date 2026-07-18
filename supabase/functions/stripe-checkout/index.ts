// ProductHub — start a Stripe Checkout session to subscribe an org to a
// plan. No webhook in this integration (see stripe-status for why) — the
// Billing screen re-checks status with Stripe directly after the redirect
// back, rather than waiting on an async webhook event.
import { corsHeaders } from '../_shared/cors.ts';
import { authedClient, requireManager, getOrgForWorkspace } from '../_shared/authedClient.ts';
import { stripePost, priceIdFor } from '../_shared/stripe.ts';

interface Body {
  tier: 'pro' | 'enterprise';
  returnUrl: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = authedClient(req);
  if (!supabase) return json({ error: 'Missing Authorization header.' }, 401);

  const caller = await requireManager(supabase);
  if (!caller) return json({ error: 'Only a workspace Manager can manage billing.' }, 403);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }
  if (!body.tier || !body.returnUrl) return json({ error: 'Missing "tier" or "returnUrl".' }, 400);

  try {
    const org = await getOrgForWorkspace(supabase, caller.workspaceId);
    if (!org) return json({ error: 'Workspace has no organization.' }, 404);

    let customerId = org.stripeCustomerId;
    if (!customerId) {
      const { data: auth } = await supabase.auth.getUser();
      const customer = await stripePost('/customers', {
        name: org.name,
        email: auth.user?.email,
        metadata: { org_id: org.id },
      });
      customerId = customer.id;
      const { error: updateError } = await supabase.from('orgs').update({ stripe_customer_id: customerId }).eq('id', org.id);
      if (updateError) return json({ error: updateError.message }, 500);
    }

    // Stripe's array-of-objects form encoding (line_items[0][price]=...)
    // isn't one of toFormParams' supported shapes — pass the bracket keys
    // directly as top-level string entries instead.
    const session = await stripePost('/checkout/sessions', {
      mode: 'subscription',
      customer: customerId,
      success_url: `${body.returnUrl}?checkout=success`,
      cancel_url: `${body.returnUrl}?checkout=cancel`,
      'line_items[0][price]': priceIdFor(body.tier),
      'line_items[0][quantity]': '1',
    });

    return json({ url: session.url });
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
