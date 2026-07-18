// ProductHub — turn a plain-English report widget description into a small
// aggregation spec (Anthropic Claude). The AI never touches live data or
// produces numbers itself — it only picks a groupBy field, a metric, and an
// optional filter from a fixed whitelist; the browser computes the actual
// chart data client-side from board items already in cache (see
// src/features/reports/customSpec.ts). A malformed/hallucinated field name
// just yields an empty chart, never a wrong number.
import { corsHeaders } from '../_shared/cors.ts';
import { authedClient, requireManager } from '../_shared/authedClient.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const MODEL = 'claude-haiku-4-5';

const GROUP_FIELDS = ['type', 'boardStatus', 'priority', 'assigneeName', 'customerName', 'module', 'tags'];
const NUMERIC_FIELDS = ['riceScore', 'wsjfScore', 'effort', 'estimatedHours'];
const FILTER_OPS = ['eq', 'neq', 'gt', 'lt', 'contains'];

interface Body {
  description: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = authedClient(req);
  if (!supabase) return json({ error: 'Missing Authorization header.' }, 401);

  const caller = await requireManager(supabase);
  if (!caller) return json({ error: 'Only a workspace Manager can design the Reports dashboard.' }, 403);

  if (!ANTHROPIC_API_KEY) return json({ error: 'ANTHROPIC_API_KEY is not configured for this function.' }, 500);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }
  const description = (body.description ?? '').trim();
  if (!description) return json({ error: 'Missing "description".' }, 400);

  const prompt = `A product manager wants a dashboard widget. Translate their request into a JSON aggregation spec over backlog items.

Their request: "${description}"

Fields you may group by: ${GROUP_FIELDS.join(', ')}
Numeric fields you may average/sum: ${NUMERIC_FIELDS.join(', ')}
Filter operators: ${FILTER_OPS.join(', ')}

Respond with ONLY a JSON object, no prose, no markdown fences, matching exactly this shape:
{
  "title": "short widget title (<=40 chars)",
  "groupBy": "<one of the group-by fields>",
  "metric": "count" | "avg:<numeric field>" | "sum:<numeric field>",
  "filter": null | { "field": "<a group-by or numeric field>", "op": "<a filter operator>", "value": "<string or number>" }
}

Pick the groupBy field and metric that best match the request. Use "count" unless they clearly ask for an average or total of a numeric field. Only set "filter" if the request clearly restricts to a subset (e.g. "critical bugs only", "items assigned to Sara"). If nothing fits well, default groupBy to "type" and metric to "count".`;

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
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      return json({ error: `Anthropic API error ${res.status}`, detail }, 502);
    }

    const data = await res.json();
    const text: string = Array.isArray(data.content)
      ? data.content.find((b: { type: string }) => b.type === 'text')?.text ?? ''
      : '';

    let parsed: Record<string, unknown>;
    try {
      // Strip stray markdown fences in case the model adds them anyway.
      const cleaned = text.trim().replace(/^```json?\s*/i, '').replace(/```\s*$/, '');
      parsed = JSON.parse(cleaned);
    } catch {
      return json({ error: "Couldn't understand that description — try rephrasing it." }, 422);
    }

    const groupBy = GROUP_FIELDS.includes(parsed.groupBy as string) ? (parsed.groupBy as string) : 'type';
    const metric =
      parsed.metric === 'count' || /^(avg|sum):/.test(String(parsed.metric)) && NUMERIC_FIELDS.includes(String(parsed.metric).split(':')[1])
        ? (parsed.metric as string)
        : 'count';
    let filter: { field: string; op: string; value: string | number } | null = null;
    if (parsed.filter && typeof parsed.filter === 'object') {
      const f = parsed.filter as Record<string, unknown>;
      if (
        typeof f.field === 'string' &&
        [...GROUP_FIELDS, ...NUMERIC_FIELDS].includes(f.field) &&
        typeof f.op === 'string' &&
        FILTER_OPS.includes(f.op) &&
        (typeof f.value === 'string' || typeof f.value === 'number')
      ) {
        filter = { field: f.field, op: f.op, value: f.value };
      }
    }
    const title = typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim().slice(0, 40) : description.slice(0, 40);

    return json({ title, spec: { groupBy, metric, filter } });
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
