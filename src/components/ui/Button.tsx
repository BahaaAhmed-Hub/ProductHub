import clsx from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon } from './Icon';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  icon?: string;
  children?: ReactNode;
}

const variants: Record<Variant, string> = {
  primary: 'bg-navy text-white hover:bg-[#152238] border-transparent',
  secondary: 'bg-surface text-ink border-hairline hover:bg-[#F4F3F0]',
  ghost: 'bg-transparent text-body border-transparent hover:bg-[#F4F3F0]',
  danger: 'bg-danger text-white border-transparent hover:bg-[#9c2b29]',
};

export function Button({
  variant = 'primary',
  icon,
  children,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-2 h-9 px-3.5 rounded-control border text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        className,
      )}
      {...props}
    >
      {icon && <Icon name={icon} size={18} />}
      {children}
    </button>
  );
}
