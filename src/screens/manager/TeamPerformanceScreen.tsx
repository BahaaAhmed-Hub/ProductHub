import { useState, type FormEvent } from 'react';
import { TopNav } from '@/components/layout/TopNav';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Tag';
import { Icon } from '@/components/ui/Icon';
import {
  usePendingMembers, useMemberReview, useTeamMembers, useChangeMemberRole,
  useInvites, useInviteActions, useInviteMemberActions,
  type PendingMember, type Member, type Invite,
} from '@/features/team';
import type { Role } from '@/types/domain';

const ROLE_LABEL: Record<string, string> = {
  customer: 'Customer', developer: 'Developer', pm: 'Product Manager', manager: 'Manager', stakeholder: 'Stakeholder',
};
const ROLES: Role[] = ['customer', 'developer', 'pm', 'manager', 'stakeholder'];
const INVITABLE_ROLES: Role[] = ['developer', 'pm', 'manager', 'stakeholder'];

function timeAgo(iso?: string): string {
  if (!iso) return 'just now';
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.round(hr / 24)}d ago`;
}

/** Team & Members content — invite by email, pending approvals, stakeholder
 * invite links, and the member roster. Split from `TeamPerformanceScreen` so
 * the Settings popup can render it without a duplicate TopNav. */
export function TeamContent() {
  const { pending } = usePendingMembers();
  const review = useMemberReview();
  const { members, isLoading } = useTeamMembers();
  const changeRole = useChangeMemberRole();
  const { invites } = useInvites();
  const inviteActions = useInviteActions();
  const memberInvite = useInviteMemberActions();
  const [busy, setBusy] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('developer');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSent, setInviteSent] = useState<string | null>(null);

  async function act(m: PendingMember, kind: 'approve' | 'decline') {
    setBusy(m.id);
    try {
      if (kind === 'approve') await review.approve(m);
      else await review.decline(m);
    } finally {
      setBusy(null);
    }
  }

  async function onCreateInvite() {
    setBusy('new-invite');
    try {
      // Manager/PM/Developer come in purely via company-domain signup +
      // approval, and Customer via the join code/link (Settings → Customers).
      // The only role left for a manual invite link is Stakeholder.
      await inviteActions.create('stakeholder');
    } finally {
      setBusy(null);
    }
  }

  function inviteUrl(inv: Invite): string {
    return `${window.location.origin}${window.location.pathname}#/signin?invite=${inv.code}`;
  }

  async function copyInvite(inv: Invite) {
    await navigator.clipboard.writeText(inviteUrl(inv));
    setCopiedId(inv.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  async function onRoleChange(m: Member, role: Role) {
    setBusy(m.id);
    try {
      await changeRole(m.id, role);
    } finally {
      setBusy(null);
    }
  }

  async function onInviteSubmit(e: FormEvent) {
    e.preventDefault();
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;
    setInviteBusy(true);
    setInviteError(null);
    setInviteSent(null);
    try {
      await memberInvite.invite(email, inviteRole);
      setInviteSent(email);
      setInviteEmail('');
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Could not send the invite.');
    } finally {
      setInviteBusy(false);
    }
  }

  async function onResend(m: Member) {
    setBusy(m.id);
    try {
      await memberInvite.invite(m.email, m.role);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
        <h1 className="text-lg font-semibold tracking-tight mb-4">Team & members</h1>

        {/* Direct email invite — the primary way to add Developer/PM/Manager/
            Stakeholder teammates: they get a "set your password" email and
            show up below immediately as Invited, then Active once they
            follow it and sign in. */}
        <Card className="p-5 max-w-3xl mb-4">
          <div className="text-sm font-semibold mb-1">Invite a team member</div>
          <p className="text-[12.5px] text-label mb-3">
            They'll get an email to sign in and choose a password.
          </p>
          <form onSubmit={onInviteSubmit} className="flex items-center gap-2">
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="name@company.com"
              className="flex-1 h-9 px-3 rounded-control border-[0.5px] border-hairline bg-surface text-[13px] outline-none focus:border-accent"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as Role)}
              className="h-9 px-2.5 rounded-control border-[0.5px] border-hairline bg-surface text-[12px] outline-none"
            >
              {INVITABLE_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
            <Button type="submit" icon="send" disabled={inviteBusy}>
              {inviteBusy ? 'Sending…' : 'Invite'}
            </Button>
          </form>
          {inviteError && <div className="text-[12px] text-danger mt-2">{inviteError}</div>}
          {inviteSent && <div className="text-[12px] text-success mt-2">Invite sent to {inviteSent}.</div>}
        </Card>

        {pending.length > 0 && (
          <Card className="p-5 max-w-3xl mb-4 border-[#E7CE9B]">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-semibold">Pending approvals</span>
              <Tag tone="accent">{pending.length}</Tag>
            </div>
            {pending.map((m) => (
              <div key={m.id} className="flex items-center gap-3 py-2.5 border-b-[0.5px] border-hairline last:border-0">
                <Avatar initials={m.name.slice(0, 2).toUpperCase()} size={28} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium">{m.name}</div>
                  <div className="text-[11px] text-label truncate">{m.email}</div>
                </div>
                <span className="text-[12px] text-body">wants <b>{ROLE_LABEL[m.requestedRole]}</b></span>
                <Button variant="secondary" disabled={busy === m.id} onClick={() => act(m, 'decline')}>Decline</Button>
                <Button disabled={busy === m.id} onClick={() => act(m, 'approve')}>Approve</Button>
              </div>
            ))}
          </Card>
        )}

        {/* Stakeholder invite link — an alternative to the email invite
            above for handing out read-only access without collecting an
            address up front. */}
        <Card className="p-5 max-w-3xl mb-4">
          <div className="text-sm font-semibold mb-1">Invite a stakeholder via link</div>
          <p className="text-[12.5px] text-label mb-3">Read-only access to the published roadmap — no approval needed.</p>
          <Button icon="add" disabled={busy === 'new-invite'} onClick={onCreateInvite} className="mb-4">
            {busy === 'new-invite' ? 'Creating…' : 'Create invite link'}
          </Button>
          {invites.length === 0 ? (
            <p className="text-[13px] text-body">No active invite links.</p>
          ) : (
            invites.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 py-2 border-b-[0.5px] border-hairline last:border-0">
                <Tag tone="pm">{ROLE_LABEL[inv.role]}</Tag>
                <span className="text-[12px] font-mono text-body truncate flex-1">{inviteUrl(inv)}</span>
                <button className="text-[12px] text-accent inline-flex items-center gap-1" onClick={() => copyInvite(inv)}>
                  <Icon name={copiedId === inv.id ? 'check' : 'content_copy'} size={14} />
                  {copiedId === inv.id ? 'Copied' : 'Copy'}
                </button>
                <button className="text-[12px] text-danger" onClick={() => inviteActions.revoke(inv.id)}>Revoke</button>
              </div>
            ))
          )}
        </Card>

        {/* Roster */}
        <Card className="p-5 max-w-3xl">
          <div className="text-sm font-semibold mb-3">Members</div>
          {isLoading && <div className="text-[13px] text-body">Loading…</div>}
          {!isLoading && members.length === 0 && <p className="text-[13px] text-body">No members yet.</p>}
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 py-2.5 border-b-[0.5px] border-hairline last:border-0">
              <Avatar initials={m.name.slice(0, 2).toUpperCase()} size={28} />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium truncate">
                  {m.name} {m.isSelf && <span className="text-label font-normal">(you)</span>}
                </div>
                <div className="text-[11px] text-label truncate">{m.email}</div>
              </div>
              {m.status === 'invited' && (
                <>
                  <span className="text-[11px] text-label">invited {timeAgo(m.invitedAt)}</span>
                  <Tag tone="accent">Invited</Tag>
                  <button
                    className="text-[12px] text-accent disabled:opacity-50"
                    disabled={busy === m.id}
                    onClick={() => onResend(m)}
                  >
                    {busy === m.id ? 'Resending…' : 'Resend'}
                  </button>
                </>
              )}
              {m.status === 'pending' && <Tag tone="accent">Pending</Tag>}
              <select
                value={m.role}
                disabled={m.isSelf || busy === m.id || m.status === 'invited'}
                onChange={(e) => onRoleChange(m, e.target.value as Role)}
                className="h-8 px-2.5 rounded-control border-[0.5px] border-hairline bg-surface text-[12px] outline-none disabled:opacity-50"
              >
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            </div>
          ))}
        </Card>
    </>
  );
}

/** Routed page (/team): TeamContent plus its own TopNav. */
export function TeamPerformanceScreen() {
  return (
    <>
      <TopNav center={<span className="text-[13px] text-body">Team</span>} notificationCount={4} />
      <div className="flex-1 bg-canvas overflow-y-auto scroll-thin p-6">
        <TeamContent />
      </div>
    </>
  );
}
