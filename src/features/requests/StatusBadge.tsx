import clsx from 'clsx';
import type { CustomerStatus } from './types';

const config: Record<CustomerStatus, { label: string; dot: string; text: string }> = {
  received: { label: 'Received', dot: 'bg-label', text: 'text-body' },
  in_progress: { label: 'In progress', dot: 'bg-accent', text: 'text-accent' },
  resolved: { label: 'Resolved', dot: 'bg-success', text: 'text-success' },
};

export function StatusBadge({ status }: { status: CustomerStatus }) {
  const c = config[status];
  return (
    <span className={clsx('inline-flex items-center gap-1.5 text-xs font-medium', c.text)}>
      <span className={clsx('w-1.5 h-1.5 rounded-full', c.dot)} />
      {c.label}
    </span>
  );
}
