import { useState } from 'react';
import { TopNav } from '@/components/layout/TopNav';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Tag';
import { Icon } from '@/components/ui/Icon';

interface Integration {
  key: string;
  name: string;
  desc: string;
  emoji: string;
  connected: boolean;
}

const INITIAL: Integration[] = [
  { key: 'asana', name: 'Asana', desc: 'Two-way sync of tasks and projects into the backlog.', emoji: '🅰️', connected: false },
  { key: 'slack', name: 'Slack', desc: 'Push ticket updates and act on them from a channel.', emoji: '💬', connected: true },
  { key: 'github', name: 'GitHub', desc: 'Link pull requests and auto-move items on merge.', emoji: '🐙', connected: false },
  { key: 'posthog', name: 'PostHog', desc: 'Feed product analytics into the Lens module.', emoji: '📊', connected: false },
];

/** Screen 35/38 — PM integrations list (+ connected state). */
export function IntegrationsScreen() {
  const [items, setItems] = useState(INITIAL);
  const toggle = (k: string) =>
    setItems((xs) => xs.map((x) => (x.key === k ? { ...x, connected: !x.connected } : x)));

  return (
    <>
      <TopNav center={<span className="text-[13px] text-body">Integrations</span>} notificationCount={4} />
      <div className="flex-1 bg-canvas overflow-y-auto scroll-thin p-6">
        <h1 className="text-lg font-semibold tracking-tight">Integrations</h1>
        <p className="text-xs text-label mt-0.5 mb-5">Connect the tools your team already uses.</p>

        <div className="grid grid-cols-2 gap-4 max-w-3xl">
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
