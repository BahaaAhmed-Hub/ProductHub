import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { useUpdateRice } from '@/features/board/hooks';
import type { BoardItem } from '@/features/board/types';

const IMPACT = { Minimal: 0.5, Moderate: 1, Massive: 2 } as const;
type ImpactKey = keyof typeof IMPACT;

/** RICE score editor — a positioned popover, shared by the Backlog list
 * view (click the score cell) and the item detail panel (click the RICE
 * field). Caller positions it via a wrapping `relative`/`absolute` parent
 * and passes `align` to pick which corner it hangs from. */
export function RicePopover({
  item,
  onClose,
  align = 'right',
}: {
  item: BoardItem;
  onClose: () => void;
  align?: 'left' | 'right';
}) {
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
    <div className={`absolute top-11 z-40 w-[300px] bg-surface border-[0.5px] border-hairline rounded-frame shadow-pop p-4 ${align === 'right' ? 'right-2' : 'left-2'}`}>
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
