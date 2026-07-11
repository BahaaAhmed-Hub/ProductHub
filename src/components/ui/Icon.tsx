import clsx from 'clsx';

interface IconProps {
  /** Material Symbols Rounded ligature name, e.g. "view_kanban" */
  name: string;
  size?: number;
  className?: string;
}

/** Material Symbols Rounded icon (matches the design package's icon system). */
export function Icon({ name, size = 20, className }: IconProps) {
  return (
    <span
      className={clsx('msr select-none', className)}
      style={{ fontSize: size }}
      aria-hidden
    >
      {name}
    </span>
  );
}
