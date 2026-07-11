import clsx from 'clsx';
import { Card, Eyebrow } from './Card';
import { Icon } from './Icon';

interface KPITileProps {
  label: string;
  value: string | number;
  /** signed delta; positive renders as up/green, negative as down/red */
  delta?: number;
  deltaLabel?: string;
  invertDelta?: boolean; // e.g. fewer rage-clicks is good
  sub?: string; // plain descriptive sub-line under the value
}

export function KPITile({ label, value, delta, deltaLabel, invertDelta, sub }: KPITileProps) {
  const positive = delta === undefined ? undefined : invertDelta ? delta < 0 : delta > 0;
  return (
    <Card className="p-4 flex flex-col gap-1">
      <Eyebrow>{label}</Eyebrow>
      <div className="text-[26px] font-semibold leading-tight tracking-tight">{value}</div>
      {sub && <div className="text-[12px] text-label">{sub}</div>}
      {delta !== undefined && (
        <div
          className={clsx(
            'inline-flex items-center gap-1 text-xs',
            positive ? 'text-success' : 'text-danger',
          )}
        >
          <Icon name={positive ? 'trending_up' : 'trending_down'} size={14} />
          <span>
            {delta > 0 ? '+' : ''}
            {delta}
            {deltaLabel ? ` ${deltaLabel}` : ''}
          </span>
        </div>
      )}
    </Card>
  );
}
