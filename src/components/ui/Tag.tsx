import clsx from 'clsx';
import type { ReactNode } from 'react';
import type { Priority, RequestType } from '@/types/domain';

type Tone = 'neutral' | 'accent' | 'success' | 'danger' | 'pm' | 'warn';

const tones: Record<Tone, string> = {
  neutral: 'bg-[#EFEEE9] text-[#5F5E57]',
  accent: 'bg-accent-soft text-accent',
  success: 'bg-success-bg text-success',
  danger: 'bg-danger-bg text-danger',
  pm: 'bg-pm-bg text-pm',
  warn: 'bg-[#FBF0DD] text-[#9A6410]',
};

export function Tag({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center h-4 px-2 rounded-full text-[10px] font-medium leading-none',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const typeTone: Record<RequestType, Tone> = {
  bug: 'danger',
  feature: 'pm',
  query: 'accent',
};
const typeLabel: Record<RequestType, string> = {
  bug: 'Bug',
  feature: 'Feature',
  query: 'Query',
};

export function TypeTag({ type }: { type: RequestType }) {
  return <Tag tone={typeTone[type]}>{typeLabel[type]}</Tag>;
}

const priorityTone: Record<Priority, Tone> = {
  low: 'neutral',
  medium: 'accent',
  high: 'warn',
  critical: 'danger',
};
const priorityLabel: Record<Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export function PriorityTag({ priority }: { priority: Priority }) {
  return <Tag tone={priorityTone[priority]}>{priorityLabel[priority]}</Tag>;
}
