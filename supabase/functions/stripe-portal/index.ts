// ProductHub — open Stripe's hosted Billing Portal: payment method, full
// invoice history with PDF downloads, and plan changes/cancellation, all
// without ProductHub needing to build any of that UI itself.
import { corsHeaders } from '../_shared/cors.ts';
import { authedClient, requireManager, getOrgForWorkspace } from '../_shared/authedClient.ts';
import { stripePost } from '../_shared/stripe.ts';

interface Body {
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
  if (!body.returnUrl) return json({ error: 'Missing "returnUrl".' }, 400);

  try {
    const org = await getOrgForWorkspace(supabase, caller.workspaceId);
    if (!org) return json({ error: 'Workspace has no organization.' }, 404);
    if (!org.stripeCustomerId) return json({ error: 'Subscribe to a plan first.' }, 400);

    const session = await stripePost('/billing_portal/sessions', {
      customer: org.stripeCustomerId,
      return_url: body.returnUrl,
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
