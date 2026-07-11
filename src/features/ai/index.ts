import { supabase, isSupabaseConfigured } from '@/lib/supabase';

const SAMPLE_FEEDBACK = `Survey (412 responses, NPS 41) + 18 churn interviews.
- "We can't roll out without SSO — security won't approve it." (x9)
- "CSV export drops the timezone column, breaks our daily report." (x14)
- "Power users want bulk actions on the backlog."
- Several enterprise accounts hit 429 rate limits under normal load.
- Positive: fast ticket search, the public roadmap builds trust.`;

/** Invoke the ai-summary Edge Function (real Claude call in real mode). */
export async function summarizeFeedback(feedback = SAMPLE_FEEDBACK): Promise<string> {
  if (!isSupabaseConfigured) {
    throw new Error('AI summaries require the deployed backend (Supabase + ANTHROPIC_API_KEY).');
  }
  const { data, error } = await supabase.functions.invoke('ai-summary', {
    body: { feedback },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data?.summary ?? '';
}
