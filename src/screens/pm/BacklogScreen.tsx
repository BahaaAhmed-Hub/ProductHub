import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopNav } from '@/components/layout/TopNav';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { Tag, TypeTag, PriorityTag } from '@/components/ui/Tag';
import { useBoardItems, useUpdateRice } from '@/features/board/hooks';
import type { BoardItem } from '@/features/board/types';

const IMPACT = { Minimal: 0.5, Moderate: 1, Massive: 2 } as const;
type ImpactKey = keyof typeof IMPACT;

const PLAN_TONE: Record<string, 'neutral' | 'accent' | 'success'> = {
  backlog: 'neutral',
  planned: 'accent',
  in_cycle: 'success',
};
const PLAN_LABEL: Record<string, string> = { backlog: 'Backlog', planned: 'Planned', in_cycle: 'In Cycle' };

/** Screen 17 — PM backlog with inline RICE scoring popover. */
export function BacklogScreen() {
  const navigate = useNavigate();
  const { items } = useBoardItems();
  const [view, setView] = useState<'list' | 'board'>('list');
  const [scoring, setScoring] = useState<string | null>(null);

  return (
    <>
      <TopNav
        center={
          <div className="flex items-center gap-3">
            <span className="text-[13px] text-body">Backlog</span>
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { value: 'list', label: 'List', icon: 'format_list_bulleted' },
                { value: 'board', label: 'Board', icon: 'view_kanban' },
              ]}
            />
          </div>
        }
        notificationCount={4}
      />
      <div className="flex-1 bg-canvas overflow-y-auto scroll-thin p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-baseline gap-2">
            <h1 className="text-lg font-semibold tracking-tight">Backlog</h1>
            <span className="text-xs text-label">{items.length} items</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" icon="tune">Filter</Button>
            <Button icon="north_east">Pull to sprint · 3</Button>
          </div>
        </div>

        <div className="bg-surface border-[0.5px] border-hairline rounded-frame shadow-frame overflow-visible">
          <div className="grid grid-cols-[92px_1fr_120px_84px_90px_70px_90px] gap-3 px-4 py-2.5 text-eyebrow font-medium uppercase text-label border-b-[0.5px] border-hairline">
            <span>Ref</span><span>Title</span><span>Customers</span><span>Type</span>
            <span>Priority</span><span className="text-right">RICE</span><span className="text-right">Plan</span>
          </div>
          {items.map((item) => (
            <div
              key={item.id}
              className="relative grid grid-cols-[92px_1fr_120px_84px_90px_70px_90px] gap-3 items-center px-4 h-12 border-b-[0.5px] border-hairline last:border-0 hover:bg-[#F7F7F5]"
            >
              <span className="font-mono text-[11px] text-label">{item.ref}</span>
              <span
                className="text-[13px] font-medium truncate cursor-pointer"
                onClick={() => navigate(`/items/${item.id}`)}
              >
                {item.title}
              </span>
              <span className="text-[12px] text-body">Orion Cloud</span>
              <span><TypeTag type={item.type} /></span>
              <span><PriorityTag priority={item.priority} /></span>
              <button
                className="text-[13px] font-mono font-semibold text-right hover:text-pm"
                onClick={() => setScoring(scoring === item.id ? null : item.id)}
              >
                {item.riceScore?.toFixed(1) ?? '—'}
              </button>
              <span className="text-right">
                {item.planBucket && (
                  <Tag tone={PLAN_TONE[item.planBucket] ?? 'neutral'}>
                    {PLAN_LABEL[item.planBucket] ?? item.planBucket}
                  </Tag>
                )}
              </span>

              {scoring === item.id && (
                <RicePopover item={item} onClose={() => setScoring(null)} />
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function RicePopover({ item, onClose }: { item: BoardItem; onClose: () => void }) {
  const updateRice = useUpdateRice();
  const [reach, setReach] = useState(48);
  const [impact, setImpact] = useState<ImpactKey>('Massive');
  const [confidence, setConfidence] = useState(88);
  const [effort, setEffort] = useState(5);
  const [saving, setSaving] = useState(false);

  const score = effort > 0 ? (reach * IMPACT[impact] * (confidence / 100)) / effort : 0;

  async function save() {
    setSaving(true);
    try {
      await updateRice(item.id, Number(score.toFixed(1)));
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="absolute right-2 top-11 z-40 w-[300px] bg-surface border-[0.5px] border-hairline rounded-frame shadow-pop p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[13px] font-semibold">
          RICE Score · <span className="font-mono">{item.ref}</span>
        </span>
        <button onClick={onClose} className="text-label hover:text-body">
          <Icon name="close" size={15} />
        </button>
      </div>

      <label className="flex items-center justify-between text-[12px] mb-2.5">
        <span className="text-body">Reach /mo</span>
        <input
          type="number"
          value={reach}
          onChange={(e) => setReach(Number(e.target.value))}
          className="w-16 h-7 px-2 rounded-md border-[0.5px] border-hairline text-right outline-none focus:border-accent"
        />
      </label>

      <div className="text-[12px] text-body mb-1">Impact</div>
      <div className="mb-2.5">
        <Segmented
          value={impact}
          onChange={setImpact}
          options={(Object.keys(IMPACT) as ImpactKey[]).map((k) => ({ value: k, label: k }))}
        />
      </div>

      <label className="block text-[12px] mb-2.5">
        <div className="flex items-center justify-between text-body mb-1">
          <span>Confidence</span>
          <span className="font-mono">{confidence}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={confidence}
          onChange={(e) => setConfidence(Number(e.target.value))}
          className="w-full accent-pm"
        />
      </label>

      <label className="flex items-center justify-between text-[12px] mb-3">
        <span className="text-body">Effort /pts</span>
        <input
          type="number"
          value={effort}
          onChange={(e) => setEffort(Number(e.target.value))}
          className="w-16 h-7 px-2 rounded-md border-[0.5px] border-hairline text-right outline-none focus:border-accent"
        />
      </label>

      <div className="text-[10px] text-label mb-1">(Reach × Impact × Conf) ÷ Effort</div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-eyebrow uppercase text-label">Score</span>
        <span className="text-2xl font-semibold text-pm">{score.toFixed(1)}</span>
      </div>

      <Button className="w-full" disabled={saving} onClick={save}>
        {saving ? 'Saving…' : 'Save score'}
      </Button>
    </div>
  );
}
