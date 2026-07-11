// ProductHub — AI feedback summary (Anthropic Claude).
// Deno Edge Function. Invoked from the browser via supabase.functions.invoke('ai-summary').
// Requires the ANTHROPIC_API_KEY function secret (set in CI or the Supabase dashboard).
import { corsHeaders } from '../_shared/cors.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
// Cheap, fast tier for summarization.
const MODEL = 'claude-haiku-4-5';

interface Body {
  feedback?: string; // raw feedback / survey text to synthesize
  instruction?: string; // optional override of the analyst instruction
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!ANTHROPIC_API_KEY) {
    return json({ error: 'ANTHROPIC_API_KEY is not configured for this function.' }, 500);
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const feedback = (body.feedback ?? '').trim();
  if (!feedback) return json({ error: 'Missing "feedback" text.' }, 400);

  const instruction =
    body.instruction ??
    'You are a product analyst. Synthesize the customer feedback below into a crisp summary (3–5 short bullet points), leading with the highest-leverage theme. Use real numbers where present. No marketing language, no preamble.';

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        messages: [{ role: 'user', content: `${instruction}\n\nFeedback:\n${feedback}` }],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      return json({ error: `Anthropic API error ${res.status}`, detail }, 502);
    }

    const data = await res.json();
    // content is an array of blocks; take the first text block.
    const summary =
      Array.isArray(data.content)
        ? data.content.find((b: { type: string }) => b.type === 'text')?.text ?? ''
        : '';

    return json({ summary, model: MODEL });
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
