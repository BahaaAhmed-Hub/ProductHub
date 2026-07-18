import { useState } from 'react';
import { TopNav } from '@/components/layout/TopNav';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Tag';
import { Icon } from '@/components/ui/Icon';
import {
  connectAsana, useAsanaConnection, useAsanaProjects, useAsanaActions, REDIRECT_URI,
  type AsanaProjectGroup,
} from '@/features/integrations/asana';

interface Integration {
  key: string;
  name: string;
  desc: string;
  emoji: string;
  connected: boolean;
}

const MOCK: Integration[] = [
  { key: 'slack', name: 'Slack', desc: 'Push ticket updates and act on them from a channel.', emoji: '💬', connected: true },
  { key: 'github', name: 'GitHub', desc: 'Link pull requests and auto-move items on merge.', emoji: '🐙', connected: false },
  { key: 'posthog', name: 'PostHog', desc: 'Feed product analytics into the Lens module.', emoji: '📊', connected: false },
];

function timeAgo(iso: string | null): string {
  if (!iso) return 'never';
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  return `${Math.round(hr / 24)}d ago`;
}

function AsanaCard() {
  const { connection, isLoading } = useAsanaConnection();
  const { groups, isLoading: projectsLoading, load } = useAsanaProjects();
  const actions = useAsanaActions();
  const [picking, setPicking] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onConnect() {
    setError(null);
    try {
      await connectAsana();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the Asana connection.');
    }
  }

  async function onOpenPicker() {
    setError(null);
    setPicking(true);
    await load();
  }

  async function onPick(group: AsanaProjectGroup, project: { gid: string; name: string }) {
    try {
      await actions.selectProject(group, project);
      setPicking(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that project.');
    }
  }

  async function onSync() {
    setSyncing(true);
    setError(null);
    setSyncNote(null);
    try {
      const { imported, total } = await actions.sync();
      setSyncNote(`Synced ${imported} of ${total} tasks.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed.');
    } finally {
      setSyncing(false);
    }
  }

  async function onDisconnect() {
    setError(null);
    try {
      await actions.disconnect();
      setPicking(false);
      setSyncNote(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not disconnect.');
    }
  }

  return (
    <Card className="p-5 flex flex-col gap-3 col-span-2 sm:col-span-1">
      <div className="flex items-start justify-between">
        <div className="w-11 h-11 rounded-[12px] bg-[#F2F1EE] flex items-center justify-center text-xl">🅰️</div>
        {connection.connected && <Tag tone="success">Connected</Tag>}
      </div>
      <div>
        <div className="text-[15px] font-semibold">Asana</div>
        <div className="text-[12px] text-body mt-1">
          Import tasks from a chosen Asana project into the backlog. One-way, manual sync.
        </div>
      </div>

      {error && <div className="text-[11px] text-danger">{error}</div>}

      {isLoading ? (
        <div className="text-[12px] text-label">Loading…</div>
      ) : !connection.connected ? (
        <div className="flex flex-col gap-2">
          <Button icon="add" onClick={onConnect}>Connect Asana</Button>
          <div className="text-[10px] text-label leading-relaxed">
            Asana app's OAuth redirect URL must be registered as exactly:
            <code className="block mt-0.5 px-1.5 py-1 rounded bg-[#F4F3F0] text-[10px] font-mono break-all select-all">
              {REDIRECT_URI()}
            </code>
          </div>
        </div>
      ) : !connection.externalProjectGid ? (
        <div className="flex flex-col gap-2">
          <Button variant="secondary" icon="tune" onClick={onOpenPicker} disabled={picking && projectsLoading}>
            {picking && projectsLoading ? 'Loading projects…' : 'Choose a project'}
          </Button>
          {picking && !projectsLoading && (
            <div className="border-[0.5px] border-hairline rounded-control max-h-48 overflow-y-auto scroll-thin">
              {groups.length === 0 && <div className="p-3 text-[12px] text-label">No projects found.</div>}
              {groups.map((g) => (
                <div key={g.gid}>
                  <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-label bg-[#F7F7F5]">{g.name}</div>
                  {g.projects.map((p) => (
                    <button
                      key={p.gid}
                      onClick={() => onPick(g, p)}
                      className="w-full text-left px-3 py-2 text-[13px] hover:bg-[#F4F3F0] border-t-[0.5px] border-hairline"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
          <Button variant="ghost" onClick={onDisconnect}>Disconnect</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="text-[12px] text-body">
            Syncing from <b>{connection.externalProjectName}</b>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" icon="sprint" className="flex-1" disabled={syncing} onClick={onSync}>
              {syncing ? 'Syncing…' : 'Sync now'}
            </Button>
            <Button variant="ghost" onClick={onDisconnect}>Disconnect</Button>
          </div>
          {syncNote && <div className="text-[11px] text-success">{syncNote}</div>}
          <div className="text-[11px] text-label flex items-center gap-1">
            <Icon name="schedule" size={12} /> Last synced {timeAgo(connection.lastSyncedAt)}
          </div>
        </div>
      )}
    </Card>
  );
}

/** Screen 35/38 — PM integrations list. Asana is wired to the real backend
 * (OAuth connect + manual import); the rest remain UI-only placeholders. */
export function IntegrationsScreen() {
  const [items, setItems] = useState(MOCK);
  const toggle = (k: string) =>
    setItems((xs) => xs.map((x) => (x.key === k ? { ...x, connected: !x.connected } : x)));

  return (
    <>
      <TopNav center={<span className="text-[13px] text-body">Integrations</span>} notificationCount={4} />
      <div className="flex-1 bg-canvas overflow-y-auto scroll-thin p-6">
        <h1 className="text-lg font-semibold tracking-tight">Integrations</h1>
        <p className="text-xs text-label mt-0.5 mb-5">Connect the tools your team already uses.</p>

        <div className="grid grid-cols-2 gap-4 max-w-3xl">
          <AsanaCard />
          {items.map((it) => (
            <Card key={it.key} className="p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div className="w-11 h-11 rounded-[12px] bg-[#F2F1EE] flex items-center justify-center text-xl">
                  {it.emoji}
                </div>
                {it.connected && <Tag tone="success">Connected</Tag>}
              </div>
              <div>
                <div className="text-[15px] font-semibold">{it.name}</div>
                <div className="text-[12px] text-body mt-1">{it.desc}</div>
              </div>
              {it.connected ? (
                <div className="flex items-center gap-2">
                  <Button variant="secondary" icon="tune" className="flex-1">Configure</Button>
                  <Button variant="ghost" onClick={() => toggle(it.key)}>Disconnect</Button>
                </div>
              ) : (
                <Button icon="add" onClick={() => toggle(it.key)}>Connect {it.name}</Button>
              )}
              {it.connected && (
                <div className="text-[11px] text-label flex items-center gap-1">
                  <Icon name="schedule" size={12} /> Last synced 4 min ago
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
