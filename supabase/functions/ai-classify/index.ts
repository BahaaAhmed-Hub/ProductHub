// ProductHub — AI classification of a task (type + module) via Anthropic Claude.
// Backs the optional "Detect with AI" buttons; the rule-based detector
// (src/features/board/detect.ts) runs automatically, this is the manual,
// smarter pass. Requires the ANTHROPIC_API_KEY function secret.
import { corsHeaders } from '../_shared/cors.ts';
import { authedClient } from '../_shared/authedClient.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const MODEL = 'claude-haiku-4-5';
const TYPES = ['bug', 'feature', 'query', 'request'];

interface Body {
  items: { id: string; title: string; body?: string }[];
  modules: string[];
  suggestNew?: boolean; // allow proposing module names not in the list
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (!authedClient(req)) return json({ error: 'Missing Authorization header.' }, 401);
  if (!ANTHROPIC_API_KEY) return json({ error: 'ANTHROPIC_API_KEY is not configured for this function.' }, 500);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }
  const items = (body.items ?? []).slice(0, 40);
  if (items.length === 0) return json({ error: 'No items to classify.' }, 400);

  const prompt =
    `Classify each product-backlog task.\n` +
    `type must be one of: ${TYPES.join(', ')} (bug = something broken; feature = new capability; request = a customer/stakeholder ask; query = a question).\n` +
    `module is the product area it belongs to. ` +
    (body.suggestNew
      ? `Prefer one of the known modules, but if none fits you may propose a short new module name (1-3 words).\n`
      : `Choose only from the known modules, or null if none fits.\n`) +
    `Known modules: ${JSON.stringify(body.modules ?? [])}\n\n` +
    `Tasks:\n${JSON.stringify(items.map((i) => ({ id: i.id, title: i.title, body: (i.body ?? '').slice(0, 500) })))}\n\n` +
    `Reply with ONLY a JSON array: [{"id": "...", "type": "...", "module": "..." | null}]`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 2048, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!res.ok) return json({ error: `Anthropic API error ${res.status}`, detail: await res.text() }, 502);
    const data = await res.json();
    const text: string = data.content?.find((b: { type: string }) => b.type === 'text')?.text ?? '';
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return json({ error: 'Could not parse the model response.' }, 502);
    const parsed = JSON.parse(match[0]) as { id: string; type: string; module: string | null }[];
    const results = parsed
      .filter((r) => r && typeof r.id === 'string')
      .map((r) => ({
        id: r.id,
        type: TYPES.includes(r.type) ? r.type : null,
        module: typeof r.module === 'string' && r.module.trim() ? r.module.trim() : null,
      }));
    return json({ results });
  } catch (e) {
    return json({ error: 'Request failed', detail: String(e) }, 502);
  }
});

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}
