import clsx from 'clsx';

type AvatarTone = 'accent' | 'success' | 'pm' | 'neutral';

const tones: Record<AvatarTone, string> = {
  accent: 'bg-accent-bg text-navy',
  success: 'bg-success-bg text-[#137355]',
  pm: 'bg-pm-bg text-pm',
  neutral: 'bg-[#EFEEE9] text-[#5F5E57]',
};

export function Avatar({
  initials,
  size = 26,
  tone = 'accent',
  className,
}: {
  initials: string;
  size?: number;
  tone?: AvatarTone;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        'rounded-full flex items-center justify-center font-semibold flex-shrink-0',
        tones[tone],
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {initials}
    </div>
  );
}
