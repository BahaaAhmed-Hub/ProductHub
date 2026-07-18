import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { Logo } from '@/components/ui/Logo';
import type { Priority } from '@/types/domain';

/** Screen 03 — request received confirmation. Dark hero + centered success card. */
export function ConfirmationScreen() {
  const { state } = useLocation() as { state: { ref?: string; priority?: Priority } | null };
  const ref = state?.ref ?? 'BUG-0042';
  const priority = state?.priority ?? 'high';

  return (
    <div
      className="h-screen w-screen flex items-center justify-center p-6"
      style={{
        background:
          'radial-gradient(1000px 500px at 25% 25%, #22304f 0%, #1B2A4A 45%, #10233a 100%)',
      }}
    >
      <div className="absolute top-6 left-6 flex items-center gap-2 text-white/90">
        <Logo size={20} />
        <span className="text-sm font-semibold tracking-tight">ProductHub</span>
      </div>

      <div className="w-[400px] bg-surface rounded-frame shadow-pop p-8 flex flex-col items-center text-center">
        <div className="w-12 h-12 rounded-full bg-success-bg flex items-center justify-center">
          <Icon name="check" size={22} className="text-success" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight mt-4">Request received</h1>
        <p className="text-sm text-body mt-1">
          Our team has been notified and will respond within your SLA window.
        </p>

        <div className="w-full mt-5 rounded-control border-[0.5px] border-hairline bg-canvas divide-y divide-hairline">
          <Row label="Reference" value={<span className="font-mono text-[13px]">{ref}</span>} />
          <Row
            label="Priority"
            value={<span className="text-[#9A6410] font-medium capitalize text-[13px]">{priority}</span>}
          />
          <Row label="First response by" value={<span className="font-medium text-[13px]">Today, 2:40 PM</span>} />
        </div>

        <Link
          to={`/requests`}
          className="w-full mt-5 h-11 rounded-control bg-navy text-white text-sm font-medium flex items-center justify-center hover:bg-[#152238]"
        >
          View request
        </Link>
        <Link
          to="/submit"
          className="w-full mt-2 h-11 rounded-control border-[0.5px] border-hairline text-sm font-medium flex items-center justify-center hover:bg-[#F4F3F0]"
        >
          Submit another
        </Link>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 h-11">
      <span className="text-[13px] text-label">{label}</span>
      {value}
    </div>
  );
}
