import { useState } from 'react';
import { TopNav } from '@/components/layout/TopNav';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { useWorkspaceJoin, useRegenerateJoinCode, useConnectedCustomers, joinLinkUrl } from '@/features/customers';

/** Manager · Settings → Customers (Batch 4 of the FlowDesk onboarding spec):
 * generate/regenerate a join code and copy an invite link — both auto-connect
 * an end user as a plain ticket-filer, no approval, one workspace per person. */
export function CustomersScreen() {
  const { join, isLoading } = useWorkspaceJoin();
  const regenerate = useRegenerateJoinCode();
  const { customers } = useConnectedCustomers();
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

  async function onRegenerate() {
    setRegenerating(true);
    try {
      await regenerate();
    } finally {
      setRegenerating(false);
    }
  }

  async function copy(text: string, which: 'code' | 'link') {
    await navigator.clipboard.writeText(text);
    setCopied(which);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <>
      <TopNav center={<span className="text-[13px] text-body">Customers</span>} notificationCount={4} />
      <div className="flex-1 bg-canvas overflow-y-auto scroll-thin p-6">
        <h1 className="text-lg font-semibold tracking-tight mb-1">Invite your customers</h1>
        <p className="text-[13px] text-label mb-5 max-w-2xl">
          Anyone who signs up with your code or link is linked to your workspace automatically — no approval needed.
        </p>

        {isLoading || !join ? (
          <div className="text-sm text-body">Loading…</div>
        ) : (
          <div className="max-w-2xl flex flex-col gap-3.5">
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Icon name="key" size={18} className="text-accent" />
                <span className="text-[14px] font-semibold">Join code</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-11 rounded-control border-[0.5px] border-hairline bg-canvas flex items-center px-4 font-mono text-[15px] tracking-wide">
                  {join.code}
                </div>
                <Button variant="secondary" icon="content_copy" onClick={() => copy(join.code, 'code')}>
                  {copied === 'code' ? 'Copied' : 'Copy'}
                </Button>
                <Button variant="secondary" icon="refresh" disabled={regenerating} onClick={onRegenerate}>
                  {regenerating ? 'Regenerating…' : 'Regenerate'}
                </Button>
              </div>
              <p className="text-[11.5px] text-label mt-2">Share this with anyone who needs to file support tickets with you.</p>
            </Card>

            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Icon name="link" size={18} className="text-accent" />
                <span className="text-[14px] font-semibold">Invite link</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-11 rounded-control border-[0.5px] border-hairline bg-canvas flex items-center px-4 font-mono text-[12.5px] text-body truncate">
                  {joinLinkUrl(join.slug)}
                </div>
                <Button variant="secondary" icon="content_copy" onClick={() => copy(joinLinkUrl(join.slug), 'link')}>
                  {copied === 'link' ? 'Copied' : 'Copy link'}
                </Button>
              </div>
              <p className="text-[11.5px] text-label mt-2">Anyone who opens this is connected automatically — no code entry required.</p>
            </Card>

            <div>
              <div className="text-eyebrow font-medium uppercase text-label mb-2">Connected customers · {customers.length}</div>
              <Card className="p-0 overflow-hidden">
                {customers.length === 0 ? (
                  <div className="p-5 text-[13px] text-body">No customers connected yet.</div>
                ) : (
                  customers.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 px-4 py-3 border-b-[0.5px] border-hairline last:border-0">
                      <Avatar initials={c.name.slice(0, 2).toUpperCase()} size={28} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12.5px] font-medium truncate">{c.name}</div>
                        <div className="text-[11px] text-label truncate">{c.email}</div>
                      </div>
                      <span className="text-[11px] text-label font-mono">
                        {new Date(c.joinedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  ))
                )}
              </Card>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
