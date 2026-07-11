import clsx from 'clsx';
import { Icon } from './Icon';

interface Option<T extends string> {
  value: T;
  label: string;
  icon?: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex items-center gap-0.5 p-0.5 rounded-[9px] bg-[#EFEEE9] border-[0.5px] border-hairline">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            'inline-flex items-center gap-1.5 h-7 px-3 rounded-[7px] text-[13px] font-medium transition-colors',
            value === o.value ? 'bg-surface text-ink shadow-frame' : 'text-body hover:text-ink',
          )}
        >
          {o.icon && <Icon name={o.icon} size={16} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}
