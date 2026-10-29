import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { useUpdateItem } from '@/features/board/hooks';
import type { BoardItem } from '@/features/board/types';

const IMPACT = { Minimal: 0.5, Moderate: 1, Massive: 2 } as const;
type ImpactKey = keyof typeof IMPACT;

interface RiceInputs {
  reach: number;
  impact: ImpactKey;
  confidence: number;
  effort: number;
}
const DEFAULT_INPUTS: RiceInputs = { reach: 48, impact: 'Massive', confidence: 88, effort: 5 };

/** Saved inputs live under score_inputs.rice (score_inputs is shared with
 * the WSJF / MoSCoW screens, so the other keys must be preserved). */
function savedInputs(item: BoardItem): RiceInputs {
  const r = (item.scoreInputs?.rice ?? {}) as Partial<RiceInputs>;
  return {
    reach: typeof r.reach === 'number' ? r.reach : DEFAULT_INPUTS.reach,
    impact: r.impact && r.impact in IMPACT ? r.impact : DEFAULT_INPUTS.impact,
    confidence: typeof r.confidence === 'number' ? r.confidence : DEFAULT_INPUTS.confidence,
    effort: typeof r.effort === 'number' ? r.effort : DEFAULT_INPUTS.effort,
  };
}

/** RICE score editor, shared by the Backlog list view (click the score
 * cell) and the item detail panel (click the RICE field). The default
 * `popover` variant hangs absolutely from a `relative` parent (`align`
 * picks the corner); `inline` renders in normal flow so it can't be clipped
 * by the detail panel's scroll container. Opens with the item's saved
 * inputs, not fixed defaults. */
export function RicePopover({
  item,
  onClose,
  align = 'right',
  variant = 'popover',
}: {
  item: BoardItem;
  onClose: () => void;
  align?: 'left' | 'right';
  variant?: 'popover' | 'inline';
}) {
  const updateItem = useUpdateItem();
  const initial = savedInputs(item);
  const [reach, setReach] = useState(initial.reach);
  const [impact, setImpact] = useState<ImpactKey>(initial.impact);
  const [confidence, setConfidence] = useState(initial.confidence);
  const [effort, setEffort] = useState(initial.effort);
  const [saving, setSaving] = useState(false);

  const score = effort > 0 ? (reach * IMPACT[impact] * (confidence / 100)) / effort : 0;

  async function save() {
    setSaving(true);
    try {
      await updateItem(item.id, {
        riceScore: Number(score.toFixed(1)),
        scoreInputs: { ...(item.scoreInputs ?? {}), rice: { reach, impact, confidence, effort } },
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={
        variant === 'inline'
          ? 'col-span-2 w-full bg-surface border-[0.5px] border-hairline rounded-frame p-4'
          : `absolute top-11 z-40 w-[300px] bg-surface border-[0.5px] border-hairline rounded-frame shadow-pop p-4 ${align === 'right' ? 'right-2' : 'left-2'}`
      }
    >
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
