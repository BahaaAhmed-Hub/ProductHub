import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { AuthShell, AuthField, authInputClass } from '@/components/auth/AuthShell';
import { useAuth } from '@/features/auth/AuthProvider';
import { checkSignupDomain, type SignupBranch } from '@/features/auth/domainCheck';
import type { Role } from '@/types/domain';

type Step = 'method' | 'details' | 'role' | 'outcome';

/** Staff signup wizard — Screens 01a–01f of the FlowDesk spec.
 * Domain-based branching decides the outcome before the account exists:
 * personal domain / first-from-domain both auto-assign Manager; a domain
 * with an existing Manager routes through a PM/Developer choice + approval. */
export function SignupScreen() {
  const { signUp, signInWithGoogle, updateRequestedRole, mockMode } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('method');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [branch, setBranch] = useState<SignupBranch | null>(null);
  const [orgName, setOrgName] = useState<string | undefined>();
  const [managerName, setManagerName] = useState<string | undefined>();
  const [role, setRole] = useState<Role>('pm');
  const [corrected, setCorrected] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  async function onDetailsSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const check = await checkSignupDomain(email);
      setBranch(check.branch);
      setOrgName(check.orgName);
      setManagerName(check.managerName);
      if (check.branch === 'subsequent') {
        setStep('role');
        return;
      }
      const result = await signUp(email, password, { name });
      setNeedsConfirmation(result.needsConfirmation);
      setStep('outcome');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  async function onRoleConfirm() {
    setBusy(true);
    setError(null);
    try {
      const result = await signUp(email, password, { name, role });
      setNeedsConfirmation(result.needsConfirmation);
      setStep('outcome');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  async function onCorrectRole(next: Role) {
    setRole(next);
    setCorrected(true);
    try {
      await updateRequestedRole(next);
    } catch {
      // Non-fatal — the manager can still set it manually on approval.
    }
  }

  if (step === 'method') {
    return (
      <AuthShell>
        <h1 className="text-xl font-semibold tracking-tight">Create your account</h1>
        <p className="text-sm text-body mt-1">Set up ProductHub for your team.</p>

        <div className="mt-6 flex flex-col gap-3">
          <Button
            type="button"
            variant="secondary"
            icon="badge"
            className="w-full h-11"
            onClick={() => signInWithGoogle()}
          >
            Continue with Google
          </Button>
          <div className="flex items-center gap-3 text-label text-xs">
            <span className="flex-1 h-px bg-hairline" />
            or
            <span className="flex-1 h-px bg-hairline" />
          </div>
          <Button type="button" className="w-full h-11" onClick={() => setStep('details')}>
            Continue with email
          </Button>
        </div>

        <p className="mt-5 text-[12px] text-body text-center">
          Already have an account?{' '}
          <button className="text-accent font-medium" onClick={() => navigate('/signin')}>
            Sign in
          </button>
        </p>
        <p className="mt-2 text-[12px] text-body text-center">
          Joining as a customer?{' '}
          <button className="text-accent font-medium" onClick={() => navigate('/join')}>
            Use a join code
          </button>
        </p>
      </AuthShell>
    );
  }

  if (step === 'details') {
    return (
      <AuthShell>
        <h1 className="text-xl font-semibold tracking-tight">Account details</h1>
        <p className="text-sm text-body mt-1">We'll figure out your workspace from your email.</p>

        <form onSubmit={onDetailsSubmit} className="mt-6 flex flex-col gap-4">
          <AuthField label="Full name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={authInputClass}
              placeholder="Jane Doe"
              required
            />
          </AuthField>
          <AuthField label="Work email">
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
            {busy ? 'Please wait…' : 'Continue'}
          </Button>
          <button type="button" className="text-[12px] text-body" onClick={() => setStep('method')}>
            ← Back
          </button>
        </form>
        {mockMode && (
          <p className="mt-2 text-[11px] text-label text-center">
            Mock mode — try a personal domain (gmail.com), flowdesk.io, or any company domain to see each branch.
          </p>
        )}
      </AuthShell>
    );
  }

  if (step === 'role') {
    return (
      <AuthShell>
        <div className="w-10 h-10 rounded-full bg-accent-bg flex items-center justify-center mb-3">
          <Icon name="apartment" size={20} className="text-accent" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">Choose your role</h1>
        <p className="text-sm text-body mt-1">
          {managerName ? `${managerName} manages ${orgName} on ProductHub.` : `${orgName} is already on ProductHub.`}{' '}
          Pick how you'll work — a manager will review and approve.
        </p>

        <div className="mt-6 flex flex-col gap-2.5">
          {(
            [
              { value: 'pm' as Role, label: 'Product Manager', hint: 'Backlog, roadmap, prioritization' },
              { value: 'developer' as Role, label: 'Developer', hint: 'Triage, board, ship' },
            ]
          ).map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRole(r.value)}
              className={`flex items-center justify-between px-4 h-14 rounded-control border-[0.5px] text-left ${
                role === r.value ? 'border-accent bg-accent-bg' : 'border-hairline hover:bg-[#F4F3F0]'
              }`}
            >
              <span className="text-[13px] font-medium">{r.label}</span>
              <span className="text-[11px] text-label">{r.hint}</span>
            </button>
          ))}
        </div>

        {error && <div className="text-xs text-danger mt-3">{error}</div>}

        <Button disabled={busy} onClick={onRoleConfirm} className="w-full h-11 mt-5">
          {busy ? 'Creating account…' : 'Create account'}
        </Button>
        <button type="button" className="text-[12px] text-body mt-3" onClick={() => setStep('details')}>
          ← Back
        </button>
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
          We sent a confirmation link to {email}. Confirm your address, then sign in to reach your workspace.
        </p>
        <Button className="w-full h-11 mt-6" onClick={() => navigate('/signin')}>
          Go to sign in
        </Button>
      </AuthShell>
    );
  }

  if (branch === 'personal') {
    return (
      <AuthShell>
        <OutcomeIcon name="rocket_launch" />
        <h1 className="text-xl font-semibold tracking-tight">Workspace ready, {displayName}</h1>
        <p className="text-sm text-body mt-1.5">
          Your own ProductHub workspace is set up and you're the Manager. Invite your team once you're in.
        </p>
        <Button className="w-full h-11 mt-6" onClick={() => navigate('/')}>
          Go to your workspace
        </Button>
      </AuthShell>
    );
  }

  if (branch === 'first') {
    return (
      <AuthShell>
        <OutcomeIcon name="apartment" />
        <h1 className="text-xl font-semibold tracking-tight">You're first from {orgName}</h1>
        <p className="text-sm text-body mt-1.5">
          No one from {orgName} has signed up yet, so you've claimed the workspace as Manager. Invite your team once you're in.
        </p>
        <Button className="w-full h-11 mt-6" onClick={() => navigate('/')}>
          Go to your workspace
        </Button>
      </AuthShell>
    );
  }

  // subsequent → pending approval
  const other: Role = role === 'pm' ? 'developer' : 'pm';
  const otherLabel = other === 'pm' ? 'Product Manager' : 'Developer';
  const roleLabel = role === 'pm' ? 'Product Manager' : 'Developer';
  return (
    <AuthShell>
      <OutcomeIcon name="hourglass_top" />
      <h1 className="text-xl font-semibold tracking-tight">Waiting for approval</h1>
      <p className="text-sm text-body mt-1.5">
        {managerName ?? 'A manager'} needs to approve your {roleLabel} access to{' '}
        {orgName}. You can use ProductHub as a Customer in the meantime.
      </p>
      {!corrected && (
        <p className="text-[12px] text-body mt-3">
          Picked the wrong role?{' '}
          <button className="text-accent font-medium" onClick={() => onCorrectRole(other)}>
            Switch to {otherLabel}
          </button>
        </p>
      )}
      {corrected && <p className="text-[12px] text-success mt-3">Updated — waiting on {roleLabel} approval instead.</p>}
      <Button className="w-full h-11 mt-6" onClick={() => navigate('/')}>
        Continue to ProductHub
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
