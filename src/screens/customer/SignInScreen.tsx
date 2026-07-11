import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '@/features/auth/AuthProvider';

/** Screen 01 — Customer sign in. Dark navy hero + centered login card. */
export function SignInScreen() {
  const { signInWithPassword, signInWithGoogle, mockMode } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState(mockMode ? 'maya.t@orioncloud.com' : 'customer@orioncloud.com');
  const [password, setPassword] = useState(mockMode ? '' : 'producthub123');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signInWithPassword(email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="h-screen w-screen flex items-center justify-center p-6"
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

      <div className="w-[400px] bg-surface rounded-frame shadow-pop p-8">
        <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-body mt-1">Access your Orion Cloud support workspace</p>

        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
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
                className="w-full h-11 px-3 pr-10 rounded-control border-[0.5px] border-hairline bg-surface text-sm outline-none focus:border-accent"
                placeholder="••••••••••"
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
            <a href="#" className="text-xs text-accent self-end mt-0.5">
              Forgot password?
            </a>
          </label>

          {error && <div className="text-xs text-danger">{error}</div>}

          <Button type="submit" disabled={busy} className="w-full h-11">
            {busy ? 'Signing in…' : 'Sign in'}
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

        {mockMode ? (
          <p className="mt-5 text-[11px] text-label text-center">
            Mock mode — Supabase not configured. Any credentials sign you in.
          </p>
        ) : (
          <div className="mt-5 pt-4 border-t-[0.5px] border-hairline">
            <div className="text-[10px] font-medium uppercase tracking-wide text-label text-center mb-2">
              Demo accounts · password producthub123
            </div>
            <div className="flex items-center justify-center gap-2">
              {['customer', 'developer', 'pm'].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setEmail(`${r}@orioncloud.com`);
                    setPassword('producthub123');
                  }}
                  className="text-[11px] capitalize px-3 h-7 rounded-full border-[0.5px] border-hairline text-body hover:bg-[#F4F3F0]"
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
