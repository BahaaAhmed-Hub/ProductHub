import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

/** Calls a Supabase Edge Function and unwraps its real error message.
 * On a non-2xx response, supabase-js discards the function's own JSON body
 * and replaces error.message with a generic "non-2xx status code" string —
 * the real { error: "..." } payload is only reachable via error.context
 * (the raw Response). Without this, every server-side error message
 * (missing secrets, permission checks, upstream API errors) gets flattened
 * into that one useless string. Shared by every Edge-Function-backed
 * feature (Asana, billing, ...) rather than duplicated per feature. */
export async function invoke<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const bodyMessage = await error.context
        .clone()
        .json()
        .then((b: { error?: string }) => b?.error)
        .catch(() => undefined);
      if (bodyMessage) throw new Error(bodyMessage);
    }
    throw error;
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}
