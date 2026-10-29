import clsx from 'clsx';
import { Icon } from '@/components/ui/Icon';
import type { SortState } from '@/lib/useSort';

/** A column header that sorts the table when clicked (see useSort). Inherits
 * the header row's eyebrow styling; `align` matches the column's alignment. */
export function SortHeader<K extends string>({
  label,
  sortKey,
  sort,
  onSort,
  align = 'left',
}: {
  label: string;
  sortKey: K;
  sort: SortState<K> | null;
  onSort: (key: K) => void;
  align?: 'left' | 'center' | 'right';
}) {
  const active = sort?.key === sortKey;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      title={`Sort by ${label}`}
      className={clsx(
        'group inline-flex items-center gap-1 uppercase font-medium hover:text-ink min-w-0',
        align === 'right' && 'justify-end w-full',
        align === 'center' && 'justify-center w-full',
        active && 'text-ink',
      )}
    >
      <span className="truncate">{label}</span>
      <Icon
        name={active ? (sort.dir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
        size={12}
        className={clsx('flex-shrink-0', !active && 'opacity-0 group-hover:opacity-60')}
      />
    </button>
  );
}
