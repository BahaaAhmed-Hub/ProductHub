import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '@/features/auth/AuthProvider';
import type { Role } from '@/types/domain';

const ROLES: { value: Role; label: string; hint: string }[] = [
  { value: 'customer', label: 'Customer', hint: 'Submit and track requests' },
  { value: 'developer', label: 'Developer', hint: 'Triage, board, ship' },
  { value: 'pm', label: 'Product Manager', hint: 'Backlog, roadmap, prioritize' },
  { value: 'manager', label: 'Manager', hint: 'Oversight, SLAs, reports' },
  { value: 'stakeholder', label: 'Stakeholder', hint: 'Read-only roadmap' },
];

/** Screen 01 — Sign in / open sign up. Dark navy hero + centered card. */
export function SignInScreen() {
  const { signInWithPassword, signUp, signInWithGoogle, mockMode } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('customer');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === 'signup') {
        const { needsConfirmation } = await signUp(email, password, { name: name || email.split('@')[0]!, role });
        if (needsConfirmation) {
          setNotice('Check your email to confirm your account, then sign in.');
          setMode('signin');
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

  const isSignup = mode === 'signup';

  return (
    <div
      className="min-h-screen w-screen flex items-center justify-center p-6"
      style={{
        background:
          'radial-gradient(1200px 600px at 20% 30%, #22304f 0%, #1B2A4A 40%, #12203a 100%)',
      }}
    >
      <div className="absolute top-6 left-6 flex items-center gap-2 text-white/90">
        <div className="w-5 h-5 rounded-md bg-white/15 text-white text-xs font-bold flex items-center justify-center">
          P
        </div>
        <span className="text-sm font-semibold tracking-tight">ProductHub</span>
      </div>

      <div className="w-[400px] bg-surface rounded-frame shadow-pop p-8 my-8">
        <h1 className="text-xl font-semibold tracking-tight">{isSignup ? 'Create your account' : 'Sign in'}</h1>
        <p className="text-sm text-body mt-1">
          {isSignup ? 'Pick a role — you get your own workspace.' : 'Access your ProductHub workspace'}
        </p>

        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          {isSignup && (
            <>
              <label className="flex flex-col gap-1.5">
                <span className="text-eyebrow font-medium uppercase text-label">Full name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-11 px-3 rounded-control border-[0.5px] border-hairline bg-surface text-sm outline-none focus:border-accent"
                  placeholder="Jane Doe"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-eyebrow font-medium uppercase text-label">I am a…</span>
                <div className="grid grid-cols-1 gap-1.5">
                  {ROLES.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setRole(r.value)}
                      className={`flex items-center justify-between px-3 h-11 rounded-control border-[0.5px] text-left ${
                        role === r.value ? 'border-accent bg-accent-bg' : 'border-hairline hover:bg-[#F4F3F0]'
                      }`}
                    >
                      <span className="text-[13px] font-medium">{r.label}</span>
                      <span className="text-[11px] text-label">{r.hint}</span>
                    </button>
                  ))}
                </div>
              </label>
            </>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-eyebrow font-medium uppercase text-label">Work email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 px-3 rounded-control border-[0.5px] border-hairline bg-surface text-sm outline-none focus:border-accent"
              placeholder="you@company.com"
              required
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-eyebrow font-medium uppercase text-label">Password</span>
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
                className="w-full h-11 px-3 pr-10 rounded-control border-[0.5px] border-hairline bg-surface text-sm outline-none focus:border-accent"
                placeholder={isSignup ? 'At least 6 characters' : '••••••••••'}
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
          </label>

          {error && <div className="text-xs text-danger">{error}</div>}
          {notice && <div className="text-xs text-success">{notice}</div>}

          <Button type="submit" disabled={busy} className="w-full h-11">
            {busy ? 'Please wait…' : isSignup ? 'Create account' : 'Sign in'}
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
            onClick={() => signInWithGoogle()}
          >
            Continue with Google
          </Button>
        </form>

        <p className="mt-5 text-[12px] text-body text-center">
          {isSignup ? 'Already have an account?' : 'New to ProductHub?'}{' '}
          <button
            className="text-accent font-medium"
            onClick={() => {
              setMode(isSignup ? 'signin' : 'signup');
              setError(null);
              setNotice(null);
            }}
          >
            {isSignup ? 'Sign in' : 'Create an account'}
          </button>
        </p>

        {mockMode && (
          <p className="mt-2 text-[11px] text-label text-center">
            Mock mode — Supabase not configured. Any credentials work.
          </p>
        )}
      </div>
    </div>
  );
}
