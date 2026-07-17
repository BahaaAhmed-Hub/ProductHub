import type { ReactNode } from 'react';

/** Shared dark navy hero + centered card shell for sign-in, signup, and join. */
export function AuthShell({ children, width = 400 }: { children: ReactNode; width?: number }) {
  return (
    <div
      className="min-h-screen w-screen flex items-center justify-center p-6"
      style={{
        background:
          'radial-gradient(1200px 600px at 20% 30%, #22304f 0%, #1B2A4A 40%, #12203a 100%)',
      }}
    >
      <div className="absolute top-6 left-6 flex items-center gap-2 text-white/90">
        <div className="w-5 h-5 rounded-md bg-white/15 text-white text-xs font-bold flex items-center justify-center">
          P
        </div>
        <span className="text-sm font-semibold tracking-tight">ProductHub</span>
      </div>

      <div className="bg-surface rounded-frame shadow-pop p-8 my-8" style={{ width }}>
        {children}
      </div>
    </div>
  );
}

export function AuthField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-eyebrow font-medium uppercase text-label">{label}</span>
      {children}
    </label>
  );
}

export const authInputClass =
  'h-11 px-3 rounded-control border-[0.5px] border-hairline bg-surface text-sm outline-none focus:border-accent';
