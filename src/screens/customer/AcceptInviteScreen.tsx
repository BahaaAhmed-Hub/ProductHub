import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { AuthShell, AuthField, authInputClass } from '@/components/auth/AuthShell';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { roleHome } from '@/features/auth/guards';
import type { Role } from '@/types/domain';

/** Landing screen for a Team & Members email invite link. Supabase's invite
 * flow already establishes a session before this mounts (the link carries a
 * one-time token); this screen's only job is to have the person set a
 * password, then flip their profile from 'invited' to 'active' via RPC.
 * Deliberately a top-level route (not under RequireAuth/AppShell) — it
 * manages the session itself rather than depending on AuthProvider's
 * `user`, which may still be null this early in the flow. */
export function AcceptInviteScreen() {
  const navigate = useNavigate();
  const [ready, setReady] = useState<'checking' | 'ready' | 'invalid'>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setReady('invalid');
      return;
    }
    supabase.auth.getSession().then(({ data }) => setReady(data.session ? 'ready' : 'invalid'));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setBusy(true);
    setError(null);
    try {
      const { error: updErr } = await supabase.auth.updateUser({ password });
      if (updErr) throw updErr;
      await supabase.rpc('activate_invited_profile');
      const { data: auth } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('auth_uid', auth.user?.id ?? '')
        .maybeSingle();
      navigate(roleHome((profile?.role as Role | undefined) ?? 'customer'), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not set your password.');
      setBusy(false);
    }
  }

  if (ready === 'checking') {
    return (
      <AuthShell>
        <p className="text-sm text-body">Checking your invite…</p>
      </AuthShell>
    );
  }

  if (ready === 'invalid') {
    return (
      <AuthShell>
        <h1 className="text-xl font-semibold tracking-tight">Invite link invalid or expired</h1>
        <p className="text-sm text-body mt-1.5">Ask whoever invited you to resend it from Team & Members.</p>
        <Button className="w-full h-11 mt-6" onClick={() => navigate('/signin')}>
          Go to sign in
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1 className="text-xl font-semibold tracking-tight">Set your password</h1>
      <p className="text-sm text-body mt-1">Choose a password to finish joining your team.</p>

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
        <AuthField label="Password">
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
              className={`w-full pr-10 ${authInputClass}`}
              placeholder="At least 6 characters"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-label hover:text-body"
              aria-label={show ? 'Hide password' : 'Show password'}
            >
              <Icon name={show ? 'visibility_off' : 'visibility'} size={18} />
            </button>
          </div>
        </AuthField>
        <AuthField label="Confirm password">
          <input
            type={show ? 'text' : 'password'}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={6}
            required
            className={authInputClass}
            placeholder="Re-enter your password"
          />
        </AuthField>

        {error && <div className="text-xs text-danger">{error}</div>}

        <Button type="submit" disabled={busy} className="w-full h-11">
          {busy ? 'Saving…' : 'Set password & continue'}
        </Button>
      </form>
    </AuthShell>
  );
}
