import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { AuthShell, AuthField, authInputClass } from '@/components/auth/AuthShell';
import { useAuth } from '@/features/auth/AuthProvider';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { Role } from '@/types/domain';

const ROLE_LABEL: Record<Role, string> = {
  customer: 'Customer', developer: 'Developer', pm: 'Product Manager', manager: 'Manager', stakeholder: 'Stakeholder',
};

interface InviteInfo {
  role: Role;
  workspaceName: string;
}

/** Screen 01 — Sign in, plus (via ?invite=) a compact invited-signup form
 * for the Stakeholder invite link generated in Team & Members. General
 * signup lives at /signup (staff) and /join (customers). */
export function SignInScreen() {
  const { signInWithPassword, signUp, signInWithGoogle, mockMode } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const inviteCode = params.get('invite') ?? undefined;
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isInvitedSignup = Boolean(inviteCode);

  useEffect(() => {
    if (!inviteCode || !isSupabaseConfigured) return;
    supabase
      .from('workspace_invites')
      .select('role, revoked, expires_at, workspaces(name)')
      .eq('code', inviteCode)
      .maybeSingle()
      .then(({ data }) => {
        const row = data as { role: Role; revoked: boolean; expires_at: string | null; workspaces: { name: string } | null } | null;
        if (!row || row.revoked || (row.expires_at && new Date(row.expires_at) < new Date())) {
          setInviteError('This invite link is invalid or has expired.');
          return;
        }
        setInvite({ role: row.role, workspaceName: row.workspaces?.name ?? 'the workspace' });
      });
  }, [inviteCode]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (isInvitedSignup) {
        const { needsConfirmation } = await signUp(email, password, {
          name: name || email.split('@')[0]!,
          role: invite?.role,
          inviteCode,
        });
        if (needsConfirmation) {
          setNotice('Check your email to confirm your account, then sign in.');
          navigate('/signin', { replace: true });
          return;
        }
      } else {
        await signInWithPassword(email, password);
      }
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <h1 className="text-xl font-semibold tracking-tight">{isInvitedSignup ? 'Create your account' : 'Sign in'}</h1>
      <p className="text-sm text-body mt-1">
        {invite
          ? `You're invited to ${invite.workspaceName}, as ${ROLE_LABEL[invite.role]}.`
          : isInvitedSignup ? 'Setting up your invited access…' : 'Access your ProductHub workspace'}
      </p>
      {inviteError && <p className="text-xs text-danger mt-1">{inviteError}</p>}

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
        {isInvitedSignup && (
          <AuthField label="Full name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={authInputClass}
              placeholder="Jane Doe"
            />
          </AuthField>
        )}

        <AuthField label="Email">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={authInputClass}
            placeholder="you@company.com"
            required
          />
        </AuthField>

        <AuthField label="Password">
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
              className={`w-full pr-10 ${authInputClass}`}
              placeholder={isInvitedSignup ? 'At least 6 characters' : '••••••••••'}
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

        {error && <div className="text-xs text-danger">{error}</div>}
        {notice && <div className="text-xs text-success">{notice}</div>}

        <Button type="submit" disabled={busy} className="w-full h-11">
          {busy ? 'Please wait…' : isInvitedSignup ? 'Create account' : 'Sign in'}
        </Button>

        <div className="flex items-center gap-3 text-label text-xs">
          <span className="flex-1 h-px bg-hairline" />
          or
          <span className="flex-1 h-px bg-hairline" />
        </div>

        <Button
          type="button"
          variant="secondary"
          icon="badge"
          className="w-full h-11"
          onClick={() => signInWithGoogle(isInvitedSignup ? { inviteCode } : undefined)}
        >
          Continue with Google
        </Button>
      </form>

      {!isInvitedSignup && (
        <p className="mt-5 text-[12px] text-body text-center">
          New to ProductHub?{' '}
          <button className="text-accent font-medium" onClick={() => navigate('/signup')}>
            Create an account
          </button>
        </p>
      )}

      {mockMode && (
        <p className="mt-2 text-[11px] text-label text-center">
          Mock mode — Supabase not configured. Any credentials work.
        </p>
      )}
    </AuthShell>
  );
}
