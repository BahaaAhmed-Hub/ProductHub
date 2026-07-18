import { useState } from 'react';
import { TopNav } from '@/components/layout/TopNav';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Tag';
import { Icon } from '@/components/ui/Icon';
import {
  connectAsana, useAsanaConnection, useAsanaProjects, useAsanaAddedProjects, useAsanaActions, REDIRECT_URI,
  type AsanaProjectGroup,
} from '@/features/integrations/asana';
import { AsanaFieldMapping } from '@/features/integrations/AsanaFieldMapping';

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
  const { projects: added, isLoading: addedLoading } = useAsanaAddedProjects();
  const { groups, isLoading: projectsLoading, load } = useAsanaProjects();
  const actions = useAsanaActions();
  const [picking, setPicking] = useState(false);
  const [showMapping, setShowMapping] = useState(false);
  const [mappingProjectGid, setMappingProjectGid] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncNote, setSyncNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addedGids = new Set(added.map((p) => p.externalProjectGid));

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
    setPicking((p) => !p);
    await load();
  }

  async function onAdd(group: AsanaProjectGroup, project: { gid: string; name: string }) {
    if (addedGids.has(project.gid)) return;
    setError(null);
    try {
      await actions.addProject(group, project);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that project.');
    }
  }

  async function onRemove(id: string) {
    setError(null);
    try {
      await actions.removeProject(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove that project.');
    }
  }

  function onOpenMapping() {
    setError(null);
    setMappingProjectGid(added[0]?.externalProjectGid ?? null);
    setShowMapping(true);
  }

  async function onSync(projectId: string, projectGid: string) {
    setSyncingId(projectId);
    setError(null);
    setSyncNote(null);
    try {
      const { imported, total, commentsImported } = await actions.sync(projectGid);
      setSyncNote(`Synced ${imported} of ${total} tasks, ${commentsImported} comments.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed.');
    } finally {
      setSyncingId(null);
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
    <Card className="p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className="w-11 h-11 rounded-[12px] bg-[#F2F1EE] flex items-center justify-center text-xl">🅰️</div>
        {connection.connected && <Tag tone="success">Connected</Tag>}
      </div>
      <div>
        <div className="text-[15px] font-semibold">Asana</div>
        <div className="text-[12px] text-body mt-1">
          Import tasks from any number of Asana projects into the backlog. One-way, manual sync per project.
        </div>
      </div>

      {error && <div className="text-[11px] text-danger">{error}</div>}
      {syncNote && <div className="text-[11px] text-success">{syncNote}</div>}

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
      ) : (
        <div className="flex flex-col gap-2">
          {addedLoading ? (
            <div className="text-[12px] text-label">Loading projects…</div>
          ) : added.length === 0 ? (
            <p className="text-[13px] text-body">No projects added yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {added.map((p) => (
                <div key={p.id} className="flex items-center gap-2 border-[0.5px] border-hairline rounded-control px-2.5 py-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium truncate">{p.externalProjectName}</div>
                    <div className="text-[11px] text-label flex items-center gap-1">
                      <Icon name="schedule" size={11} /> Last synced {timeAgo(p.lastSyncedAt)}
                    </div>
                  </div>
                  <button
                    className="text-[12px] text-accent disabled:opacity-50 flex-shrink-0"
                    disabled={syncingId === p.id}
                    onClick={() => onSync(p.id, p.externalProjectGid)}
                  >
                    {syncingId === p.id ? 'Syncing…' : 'Sync'}
                  </button>
                  <button
                    className="text-label hover:text-danger flex-shrink-0"
                    onClick={() => onRemove(p.id)}
                    aria-label="Remove project"
                  >
                    <Icon name="close" size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button variant="secondary" icon="add" className="flex-1" onClick={onOpenPicker} disabled={picking && projectsLoading}>
              {picking && projectsLoading ? 'Loading…' : 'Add project'}
            </Button>
            <Button variant="secondary" icon="tune" onClick={onOpenMapping} disabled={added.length === 0}>
              Field mapping
            </Button>
          </div>

          {picking && !projectsLoading && (
            <div className="border-[0.5px] border-hairline rounded-control max-h-48 overflow-y-auto scroll-thin">
              {groups.length === 0 && <div className="p-3 text-[12px] text-label">No projects found.</div>}
              {groups.map((g) => (
                <div key={g.gid}>
                  <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-label bg-[#F7F7F5]">{g.name}</div>
                  {g.projects.map((p) => {
                    const isAdded = addedGids.has(p.gid);
                    return (
                      <button
                        key={p.gid}
                        disabled={isAdded}
                        onClick={() => onAdd(g, p)}
                        className={`w-full flex items-center justify-between text-left px-3 py-2 text-[13px] border-t-[0.5px] border-hairline ${isAdded ? 'text-label cursor-default' : 'hover:bg-[#F4F3F0]'}`}
                      >
                        {p.name}
                        {isAdded && <Icon name="check" size={14} className="text-label" />}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          <Button variant="ghost" onClick={onDisconnect}>Disconnect</Button>
        </div>
      )}

      {showMapping && mappingProjectGid && (
        <div
          className="fixed inset-0 z-50 bg-navy/40 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setShowMapping(false)}
        >
          <div
            className="w-[480px] max-h-[80vh] flex flex-col bg-surface rounded-frame shadow-pop p-5"
            onClick={(e) => e.stopPropagation()}
          >
            {added.length > 1 && (
              <label className="flex items-center gap-2 mb-3 text-[12px] flex-shrink-0">
                <span className="text-label flex-shrink-0">Project</span>
                <select
                  value={mappingProjectGid}
                  onChange={(e) => setMappingProjectGid(e.target.value)}
                  className="flex-1 h-8 px-2 rounded-control border-[0.5px] border-hairline bg-surface text-[12px] outline-none"
                >
                  {added.map((p) => (
                    <option key={p.externalProjectGid} value={p.externalProjectGid}>{p.externalProjectName}</option>
                  ))}
                </select>
              </label>
            )}
            <div className="flex-1 overflow-y-auto scroll-thin">
              <AsanaFieldMapping projectGid={mappingProjectGid} onClose={() => setShowMapping(false)} />
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

/** Integrations list content — Asana is wired to the real backend (OAuth
 * connect + manual import); the rest remain UI-only placeholders. Split
 * from `IntegrationsScreen` so the Settings popup can render it without a
 * duplicate TopNav. */
export function IntegrationsContent() {
  const [items, setItems] = useState(MOCK);
  const toggle = (k: string) =>
    setItems((xs) => xs.map((x) => (x.key === k ? { ...x, connected: !x.connected } : x)));

  return (
    <>
        <h1 className="text-lg font-semibold tracking-tight">Integrations</h1>
        <p className="text-xs text-label mt-0.5 mb-5">Connect the tools your team already uses.</p>

        <div className="flex flex-col gap-4 max-w-3xl">
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
    </>
  );
}

/** Routed page (/integrations): IntegrationsContent plus its own TopNav. */
export function IntegrationsScreen() {
  return (
    <>
      <TopNav center={<span className="text-[13px] text-body">Integrations</span>} notificationCount={4} />
      <div className="flex-1 bg-canvas overflow-y-auto scroll-thin p-6">
        <IntegrationsContent />
      </div>
    </>
  );
}
