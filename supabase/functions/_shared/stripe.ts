// Minimal Stripe REST client — plain fetch against api.stripe.com rather
// than the Stripe Node/Deno SDK, since that would be one more esm.sh import
// in the bundle graph (already bit us once with a transient CDN 522 on
// asana-sync) for functionality a handful of form-encoded POSTs cover.
const STRIPE_API = 'https://api.stripe.com/v1';

function secretKey(): string {
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured.');
  return key;
}

/** Stripe's form-encoding for nested params: {a: {b: 'x'}} -> a[b]=x. Only
 * the shapes actually used here (one level of nesting) are supported. */
function toFormParams(body: Record<string, unknown>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(body)) {
    if (value == null) continue;
    if (typeof value === 'object' && !Array.isArray(value)) {
      for (const [subKey, subValue] of Object.entries(value as Record<string, unknown>)) {
        if (subValue != null) params.append(`${key}[${subKey}]`, String(subValue));
      }
    } else {
      params.append(key, String(value));
    }
  }
  return params;
}

// deno-lint-ignore no-explicit-any
async function stripeRequest(method: string, path: string, body?: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body ? toFormParams(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Stripe API error ${res.status}`);
  return data;
}

// deno-lint-ignore no-explicit-any
export function stripeGet(path: string): Promise<any> {
  return stripeRequest('GET', path);
}
// deno-lint-ignore no-explicit-any
export function stripePost(path: string, body: Record<string, unknown>): Promise<any> {
  return stripeRequest('POST', path, body);
}

export function priceIdFor(tier: 'pro' | 'enterprise'): string {
  const key = tier === 'pro' ? 'STRIPE_PRICE_PRO' : 'STRIPE_PRICE_ENTERPRISE';
  const id = Deno.env.get(key);
  if (!id) throw new Error(`${key} is not configured.`);
  return id;
}
