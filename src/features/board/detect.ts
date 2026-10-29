// Rule-based detection of a task's type and module from its title/body.
// Pure and dependency-free: a copy lives at supabase/functions/_shared/detect.ts
// for asana-sync (Deno) — keep the two files identical.

export type DetectedType = 'bug' | 'feature' | 'query' | 'request';

const QUESTION_START = /^(how|what|why|when|where|which|who|can|could|should|is|are|does|do|did|will|would)\b/i;
const QUESTION_WORDS = /\b(question|clarif(y|ication)|wondering|inquir(y|e)|how (do|to|can)|is it possible)\b/i;
const BUG_WORDS =
  /\b(bug|bugs|fix|fixes|fixed|error|errors|crash|crashes|crashing|broken|break|breaks|fail|fails|failed|failing|failure|exception|regression|not working|doesn'?t work|does not work|isn'?t working|wrong|incorrect|incorrectly|missing|stuck|freez(e|es|ing)|hang|hangs|timeout|time out|500|404|unable to|cannot|can'?t|glitch|defect|issue with)\b/i;
const REQUEST_WORDS =
  /\b(request|requests|requested|requesting|please|need|needs|needed|would like|we want|wants? to|ask(s|ed|ing)? for|access to|can we get|looking for|require|requires)\b/i;
const FEATURE_WORDS =
  /\b(add|adding|implement|support|new|introduce|build|create|enable|allow|integrat(e|ion)|improve|enhance|enhancement|upgrade|redesign|refactor|migrate|extend|export|import|dashboard|feature)\b/i;

/** Best-guess type from the task title (and body as a weaker signal); null when nothing matches. */
export function detectType(title: string, body = ''): DetectedType | null {
  const t = title.trim();
  if (!t) return null;
  if (t.endsWith('?') || QUESTION_START.test(t) || QUESTION_WORDS.test(t)) {
    // "Can we get X?" asks for something; "Can you add X?" is a feature ask — only plain questions are queries.
    if (!/\b(can we get|can we have|could we get)\b/i.test(t)) return 'query';
    return 'request';
  }
  if (BUG_WORDS.test(t)) return 'bug';
  if (REQUEST_WORDS.test(t)) return 'request';
  if (FEATURE_WORDS.test(t)) return 'feature';
  // Title gave nothing — fall back to the body, bugs first as it's the costlier miss.
  const b = body.slice(0, 600);
  if (BUG_WORDS.test(b)) return 'bug';
  if (FEATURE_WORDS.test(b)) return 'feature';
  return null;
}

export interface ModuleLike {
  name: string;
  aliases?: string[];
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countMatches(text: string, term: string): number {
  const t = term.trim();
  if (t.length < 2) return 0;
  // Whole-word, tolerating a plural "s" ("report" matches "reports").
  const re = new RegExp(`(^|[^a-z0-9])${escapeRe(t)}s?($|[^a-z0-9])`, 'gi');
  return (text.match(re) ?? []).length;
}

/** Module whose name/aliases appear most in title (weight 3) and body (weight 1); longer names win ties. */
export function detectModule(title: string, body: string, modules: ModuleLike[]): string | null {
  let best: { name: string; score: number; len: number } | null = null;
  for (const m of modules) {
    let score = 0;
    for (const term of [m.name, ...(m.aliases ?? [])]) {
      score += countMatches(title, term) * 3 + Math.min(countMatches(body, term), 3);
    }
    if (score === 0) continue;
    if (!best || score > best.score || (score === best.score && m.name.length > best.len)) {
      best = { name: m.name, score, len: m.name.length };
    }
  }
  return best?.name ?? null;
}
