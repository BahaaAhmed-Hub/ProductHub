import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { AuthShell, AuthField, authInputClass } from '@/components/auth/AuthShell';
import { useAuth } from '@/features/auth/AuthProvider';
import { lookupWorkspaceByJoinKey } from '@/features/customers';

type Step = 'code' | 'details' | 'outcome';

/** End-user (customer) join wizard — Batch 4 of the FlowDesk spec.
 * Joining a workspace never involves a role choice or approval: a valid
 * join code or invite-link slug always resolves to role='customer',
 * status='active'. Reached via /join (manual code) or /join/:slug (link). */
export function JoinScreen() {
  const { signUp, signInWithGoogle, mockMode } = useAuth();
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();

  const [step, setStep] = useState<Step>(slug ? 'details' : 'code');
  const [code, setCode] = useState('');
  const [joinKey, setJoinKey] = useState(slug ?? '');
  const [orgName, setOrgName] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(Boolean(slug));

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  useEffect(() => {
    if (!slug) return;
    lookupWorkspaceByJoinKey(slug)
      .then((ws) => {
        if (!ws) {
          setLookupError('This invite link is invalid or has expired.');
          setStep('code');
          return;
        }
        setOrgName(ws.name);
      })
      .finally(() => setLookingUp(false));
  }, [slug]);

  async function onCodeSubmit(e: FormEvent) {
    e.preventDefault();
    setLookingUp(true);
    setLookupError(null);
    try {
      const ws = await lookupWorkspaceByJoinKey(code);
      if (!ws) {
        setLookupError("We couldn't find a workspace with that code. Check it and try again.");
        return;
      }
      setJoinKey(code);
      setOrgName(ws.name);
      setStep('details');
    } finally {
      setLookingUp(false);
    }
  }

  async function onDetailsSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await signUp(email, password, { name, joinKey });
      setNeedsConfirmation(result.needsConfirmation);
      setStep('outcome');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  if (step === 'code') {
    return (
      <AuthShell>
        <h1 className="text-xl font-semibold tracking-tight">Join a workspace</h1>
        <p className="text-sm text-body mt-1">Enter the join code your team shared with you.</p>

        <form onSubmit={onCodeSubmit} className="mt-6 flex flex-col gap-4">
          <AuthField label="Join code">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className={`${authInputClass} font-mono tracking-wide`}
              placeholder="ORION-7F2Q"
              required
            />
          </AuthField>

          {lookupError && <div className="text-xs text-danger">{lookupError}</div>}

          <Button type="submit" disabled={lookingUp} className="w-full h-11">
            {lookingUp ? 'Checking…' : 'Continue'}
          </Button>
        </form>

        <p className="mt-5 text-[12px] text-body text-center">
          Signing up as staff?{' '}
          <button className="text-accent font-medium" onClick={() => navigate('/signup')}>
            Create a company account
          </button>
        </p>
        {mockMode && (
          <p className="mt-2 text-[11px] text-label text-center">Mock mode — any non-empty code works.</p>
        )}
      </AuthShell>
    );
  }

  if (step === 'details') {
    if (lookingUp) {
      return (
        <AuthShell>
          <p className="text-sm text-body">Looking up your workspace…</p>
        </AuthShell>
      );
    }
    if (!orgName) {
      return (
        <AuthShell>
          <h1 className="text-xl font-semibold tracking-tight">Link not found</h1>
          <p className="text-sm text-body mt-1.5">{lookupError ?? 'This join link is invalid or has expired.'}</p>
          <Button className="w-full h-11 mt-6" onClick={() => setStep('code')}>
            Enter a code instead
          </Button>
        </AuthShell>
      );
    }
    return (
      <AuthShell>
        <h1 className="text-xl font-semibold tracking-tight">Join {orgName}</h1>
        <p className="text-sm text-body mt-1">Create your account to start submitting and tracking requests.</p>

        <div className="mt-5 flex flex-col gap-3">
          <Button
            type="button"
            variant="secondary"
            icon="badge"
            className="w-full h-11"
            onClick={() => signInWithGoogle({ joinKey })}
          >
            Continue with Google
          </Button>
          <div className="flex items-center gap-3 text-label text-xs">
            <span className="flex-1 h-px bg-hairline" />
            or
            <span className="flex-1 h-px bg-hairline" />
          </div>
        </div>

        <form onSubmit={onDetailsSubmit} className="mt-3 flex flex-col gap-4">
          <AuthField label="Full name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={authInputClass}
              placeholder="Jane Doe"
              required
            />
          </AuthField>
          <AuthField label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={authInputClass}
              placeholder="you@example.com"
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

          {error && <div className="text-xs text-danger">{error}</div>}

          <Button type="submit" disabled={busy} className="w-full h-11">
            {busy ? 'Please wait…' : 'Create account'}
          </Button>
        </form>
      </AuthShell>
    );
  }

  // step === 'outcome'
  const displayName = name || email.split('@')[0];

  if (needsConfirmation) {
    return (
      <AuthShell>
        <OutcomeIcon name="check_circle" />
        <h1 className="text-xl font-semibold tracking-tight">Check your email</h1>
        <p className="text-sm text-body mt-1.5">
          We sent a confirmation link to {email}. Confirm your address, then sign in to reach {orgName}.
        </p>
        <Button className="w-full h-11 mt-6" onClick={() => navigate('/signin')}>
          Go to sign in
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <OutcomeIcon name="check_circle" />
      <h1 className="text-xl font-semibold tracking-tight">You're connected, {displayName}</h1>
      <p className="text-sm text-body mt-1.5">You're all set to submit and track requests with {orgName}. Welcome aboard.</p>
      <Button className="w-full h-11 mt-6" onClick={() => navigate('/')}>
        Start using ProductHub
      </Button>
    </AuthShell>
  );
}

function OutcomeIcon({ name }: { name: string }) {
  return (
    <div className="w-11 h-11 rounded-full bg-accent-bg flex items-center justify-center mb-3">
      <Icon name={name} size={22} className="text-accent" />
    </div>
  );
}
