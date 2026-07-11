import { TopNav } from '@/components/layout/TopNav';
import { Icon } from '@/components/ui/Icon';

/** Temporary screen for routes whose real implementation lands in a later milestone. */
export function Placeholder({ title, milestone }: { title: string; milestone: string }) {
  return (
    <>
      <TopNav center={<span className="text-sm text-body">{title}</span>} />
      <div className="flex-1 flex items-center justify-center bg-canvas">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-frame bg-surface border-[0.5px] border-hairline shadow-frame flex items-center justify-center">
            <Icon name="construction" size={22} className="text-label" />
          </div>
          <div className="text-lg font-semibold tracking-tight">{title}</div>
          <div className="text-sm text-body max-w-sm">
            This screen is scaffolded and routed. Its full build lands in{' '}
            <span className="font-medium text-ink">{milestone}</span>.
          </div>
        </div>
      </div>
    </>
  );
}
