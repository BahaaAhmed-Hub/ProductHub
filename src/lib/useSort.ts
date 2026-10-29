import { useMemo, useRef, useState } from 'react';

export interface SortState<K extends string> {
  key: K;
  dir: 'asc' | 'desc';
}

export type SortValue = string | number | null | undefined;

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function compare(a: SortValue, b: SortValue): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return collator.compare(String(a), String(b));
}

/**
 * Column sorting for a table. `accessors` maps each sortable column key to the
 * value to order by (return a number for ranks/dates so e.g. priority sorts
 * critical→low rather than alphabetically). Clicking a column cycles
 * ascending → descending → back to the table's own default order. Empty
 * values always sort last, whichever the direction.
 */
export function useSort<T, K extends string>(items: T[], accessors: Record<K, (item: T) => SortValue>) {
  const [sort, setSort] = useState<SortState<K> | null>(null);
  // Accessors are usually an inline object — keep the latest without re-sorting every render.
  const acc = useRef(accessors);
  acc.current = accessors;

  const sorted = useMemo(() => {
    if (!sort) return items;
    const get = acc.current[sort.key];
    const sign = sort.dir === 'asc' ? 1 : -1;
    return items
      .map((item, index) => ({ item, index, value: get(item) }))
      .sort((x, y) => {
        const xe = x.value == null || x.value === '';
        const ye = y.value == null || y.value === '';
        if (xe || ye) return xe === ye ? x.index - y.index : xe ? 1 : -1;
        return compare(x.value, y.value) * sign || x.index - y.index;
      })
      .map((r) => r.item);
  }, [items, sort]);

  function toggle(key: K) {
    setSort((cur) => {
      if (!cur || cur.key !== key) return { key, dir: 'asc' };
      return cur.dir === 'asc' ? { key, dir: 'desc' } : null;
    });
  }

  return { sorted, sort, toggle };
}
