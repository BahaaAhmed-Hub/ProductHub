import { useState } from 'react';
import { TopNav } from '@/components/layout/TopNav';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface Rule {
  id: string;
  name: string;
  trigger: string;
  action: string;
  active: boolean;
  runs: number;
}

const RULES: Rule[] = [
  { id: 'a1', name: 'Auto-triage critical bugs', trigger: 'Request created · priority = Critical', action: 'Assign to on-call · notify #eng-critical', active: true, runs: 128 },
  { id: 'a2', name: 'Escalate SLA at risk', trigger: 'SLA < 1h remaining', action: 'Notify manager · raise priority', active: true, runs: 43 },
  { id: 'a3', name: 'Close stale queries', trigger: 'Query · no reply for 14 days', action: 'Mark resolved · email customer', active: false, runs: 7 },
  { id: 'a4', name: 'Sync released items to Slack', trigger: 'Item moved to Released', action: 'Post to #product-updates', active: true, runs: 214 },
];

/** Screen 24 — PM automations (trigger → action rules). */
export function AutomationsScreen() {
  const [rules, setRules] = useState(RULES);
  const toggle = (id: string) =>
    setRules((rs) => rs.map((r) => (r.id === id ? { ...r, active: !r.active } : r)));

  return (
    <>
      <TopNav center={<span className="text-[13px] text-body">Automations</span>} notificationCount={4} />
      <div className="flex-1 bg-canvas overflow-y-auto scroll-thin p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Automations</h1>
            <p className="text-xs text-label mt-0.5">{rules.filter((r) => r.active).length} active rules</p>
          </div>
          <Button icon="add">New rule</Button>
        </div>

        <div className="flex flex-col gap-2.5">
          {rules.map((r) => (
            <Card key={r.id} className="px-4 py-3.5 flex items-center gap-4">
              <div className="w-9 h-9 rounded-[10px] bg-pm-bg flex items-center justify-center flex-shrink-0">
                <Icon name="bolt" size={18} className="text-pm" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold">{r.name}</div>
                <div className="text-[12px] text-body mt-0.5 flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1">
                    <span className="text-label">When</span> {r.trigger}
                  </span>
                  <Icon name="north_east" size={12} className="text-label" />
                  <span className="inline-flex items-center gap-1">
                    <span className="text-label">then</span> {r.action}
                  </span>
                </div>
              </div>
              <span className="text-[11px] text-label font-mono flex-shrink-0">{r.runs} runs</span>
              <button
                onClick={() => toggle(r.id)}
                className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
                  r.active ? 'bg-success' : 'bg-[#D6D5CF]'
                }`}
                aria-label="Toggle rule"
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                    r.active ? 'left-[18px]' : 'left-0.5'
                  }`}
                />
              </button>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
