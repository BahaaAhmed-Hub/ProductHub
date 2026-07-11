import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopNav } from '@/components/layout/TopNav';
import { Icon } from '@/components/ui/Icon';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useBoardItems } from '@/features/board/hooks';
import { useModels, usePlanningActions, type Criterion } from '@/features/planning';
import type { BoardItem } from '@/features/board/types';

const PRIORITY_W: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
const METRICS: { key: string; label: string; get: (i: BoardItem) => number }[] = [
  { key: 'rice', label: 'RICE', get: (i) => i.riceScore ?? 0 },
  { key: 'wsjf', label: 'WSJF', get: (i) => i.wsjfScore ?? 0 },
  { key: 'priority', label: 'Priority', get: (i) => PRIORITY_W[i.priority] ?? 0 },
  { key: 'invEffort', label: 'Low effort', get: (i) => 1 / (i.effort || 3) },
];

function normalize(items: BoardItem[]) {
  const max: Record<string, number> = {};
  for (const m of METRICS) max[m.key] = Math.max(1e-6, ...items.map((i) => m.get(i)));
  return (item: BoardItem, weights: Record<string, number>) => {
    const total = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
    return (
      METRICS.reduce((sum, m) => sum + (weights[m.key] ?? 0) * (m.get(item) / max[m.key]!), 0) /
      total
    ) * 100;
  };
}

/** Screen 55 — Custom weighted model builder (real, persisted). */
export function CustomModelScreen() {
  const navigate = useNavigate();
  const { items } = useBoardItems();
  const { models } = useModels();
  const actions = usePlanningActions();
  const [name, setName] = useState('My model');
  const [weights, setWeights] = useState<Record<string, number>>({ rice: 40, wsjf: 20, priority: 30, invEffort: 10 });
  const [saving, setSaving] = useState(false);

  const score = normalize(items);
  const ranked = [...items].sort((a, b) => score(b, weights) - score(a, weights));

  async function save() {
    setSaving(true);
    try {
      const criteria: Criterion[] = METRICS.map((m) => ({ key: m.key, label: m.label, weight: weights[m.key] ?? 0 }));
      await actions.addModel(name, criteria);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <TopNav center={<span className="text-[13px] text-body">Custom model</span>} notificationCount={4} />
      <div className="flex-1 bg-canvas overflow-y-auto scroll-thin p-6">
        <button onClick={() => navigate('/prioritize')} className="text-[13px] text-accent mb-3 inline-flex items-center gap-1">
          <Icon name="expand_more" size={16} className="rotate-90" /> Prioritization
        </button>
        <h1 className="text-lg font-semibold tracking-tight mb-4">Custom weighted model</h1>

        <div className="grid grid-cols-[320px_1fr] gap-5 max-w-5xl">
          <Card className="p-5 h-fit">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-9 px-3 rounded-control border-[0.5px] border-hairline text-sm mb-4 outline-none focus:border-accent"
            />
            {METRICS.map((m) => (
              <label key={m.key} className="block mb-3">
                <div className="flex justify-between text-[12px] text-body mb-1">
                  <span>{m.label}</span>
                  <span className="font-mono">{weights[m.key] ?? 0}</span>
                </div>
                <input
                  type="range" min={0} max={100}
                  value={weights[m.key] ?? 0}
                  onChange={(e) => setWeights((w) => ({ ...w, [m.key]: Number(e.target.value) }))}
                  className="w-full accent-pm"
                />
              </label>
            ))}
            <Button className="w-full mt-2" disabled={saving} onClick={save}>
              {saving ? 'Saving…' : 'Save model'}
            </Button>

            {models.length > 0 && (
              <div className="mt-5 pt-4 border-t-[0.5px] border-hairline">
                <div className="text-eyebrow uppercase text-label mb-2">Saved models</div>
                {models.map((m) => (
                  <div key={m.id} className="flex items-center justify-between py-1.5">
                    <button
                      className="text-[13px] text-accent"
                      onClick={() => setWeights(Object.fromEntries(m.criteria.map((c) => [c.key, c.weight])))}
                    >
                      {m.name}
                    </button>
                    <button className="text-label hover:text-danger" onClick={() => actions.removeModel(m.id)}>
                      <Icon name="close" size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <div className="text-sm font-semibold mb-3">Ranked results</div>
            {ranked.length === 0 ? (
              <p className="text-[13px] text-body">No backlog items to rank yet.</p>
            ) : (
              ranked.map((item, idx) => (
                <div key={item.id} className="flex items-center gap-3 py-2 border-b-[0.5px] border-hairline last:border-0">
                  <span className="w-6 text-[13px] font-mono text-label text-right">{idx + 1}</span>
                  <span className="font-mono text-[11px] text-label w-20">{item.ref}</span>
                  <span className="text-[13px] flex-1 truncate">{item.title}</span>
                  <span className="text-[13px] font-mono font-semibold text-pm">{score(item, weights).toFixed(0)}</span>
                </div>
              ))
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
