import clsx from 'clsx';
import type { HTMLAttributes } from 'react';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        'bg-surface border-[0.5px] border-hairline rounded-frame shadow-frame',
        className,
      )}
      {...props}
    />
  );
}

export function Eyebrow({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx('text-eyebrow font-medium uppercase text-label', className)}
      {...props}
    />
  );
}
