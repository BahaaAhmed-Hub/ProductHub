import type { BoardItem } from '@/features/board/types';

/** {groupBy, metric, filter?} returned by the widget-spec Edge Function
 * (AI-translated from a plain-English description) and computed here,
 * client-side, against board items already in cache. The AI never produces
 * numbers itself — an unrecognized field just yields an empty chart. */
export interface WidgetSpec {
  groupBy: string;
  metric: string; // 'count' | 'avg:<numeric field>' | 'sum:<numeric field>'
  filter?: { field: string; op: string; value: string | number } | null;
}

const GROUP_FIELDS = ['type', 'boardStatus', 'priority', 'assigneeName', 'customerName', 'module', 'tags'];
const NUMERIC_FIELDS = ['riceScore', 'wsjfScore', 'effort', 'estimatedHours'];

function fieldValue(item: BoardItem, field: string): unknown {
  return (item as unknown as Record<string, unknown>)[field];
}

function passesFilter(item: BoardItem, filter: WidgetSpec['filter']): boolean {
  if (!filter) return true;
  const v = fieldValue(item, filter.field);
  if (v == null) return false;
  switch (filter.op) {
    case 'eq':
      return String(v).toLowerCase() === String(filter.value).toLowerCase();
    case 'neq':
      return String(v).toLowerCase() !== String(filter.value).toLowerCase();
    case 'contains':
      return Array.isArray(v)
        ? v.some((x) => String(x).toLowerCase().includes(String(filter.value).toLowerCase()))
        : String(v).toLowerCase().includes(String(filter.value).toLowerCase());
    case 'gt':
      return Number(v) > Number(filter.value);
    case 'lt':
      return Number(v) < Number(filter.value);
    default:
      return true;
  }
}

export function computeSpecData(items: BoardItem[], spec: WidgetSpec | null | undefined): { label: string; n: number }[] {
  if (!spec || !GROUP_FIELDS.includes(spec.groupBy)) return [];
  const filtered = items.filter((i) => passesFilter(i, spec.filter));

  const groups = new Map<string, BoardItem[]>();
  for (const item of filtered) {
    const raw = fieldValue(item, spec.groupBy);
    const labels = Array.isArray(raw) ? raw : [raw];
    for (const v of labels) {
      if (v == null || v === '') continue;
      const label = String(v);
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label)!.push(item);
    }
  }

  const [kind, numField] = spec.metric.split(':');
  const validNumField = numField && NUMERIC_FIELDS.includes(numField) ? numField : null;
  const rows = [...groups.entries()].map(([label, group]) => {
    if ((kind === 'avg' || kind === 'sum') && validNumField) {
      const vals = group.map((g) => Number(fieldValue(g, validNumField))).filter((n) => !Number.isNaN(n));
      const total = vals.reduce((a, b) => a + b, 0);
      const n = kind === 'avg' ? (vals.length ? total / vals.length : 0) : total;
      return { label, n: Number(n.toFixed(1)) };
    }
    return { label, n: group.length };
  });

  return rows.sort((a, b) => b.n - a.n).slice(0, 12);
}
