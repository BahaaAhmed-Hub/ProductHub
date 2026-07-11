import { useNavigate } from 'react-router-dom';
import { TopNav } from '@/components/layout/TopNav';
import { Icon } from '@/components/ui/Icon';
import { useBoardItems } from '@/features/board/hooks';

// Illustrative effort per ref (real effort comes from estimates/RICE effort).
const EFFORT: Record<string, number> = {
  'BUG-0042': 0.35, 'FEAT-0024': 0.7, 'BUG-0038': 0.25, 'QRY-0017': 0.2,
  'BUG-0051': 0.55, 'FEAT-0031': 0.8,
};
const COLORS = ['#2FA869', '#46B6C9', '#7E78DD', '#E0644E', '#C49A3C', '#D97706'];

/** Screen 54 — Value vs Effort 2×2 matrix. */
export function ValueEffortScreen() {
  const navigate = useNavigate();
  const { items } = useBoardItems();
  const maxRice = Math.max(1, ...items.map((i) => i.riceScore ?? 0));

  return (
    <>
      <TopNav
        center={<span className="text-[13px] text-body">Value vs Effort</span>}
        notificationCount={4}
      />
      <div className="flex-1 bg-canvas overflow-y-auto scroll-thin p-6">
        <button onClick={() => navigate('/prioritize')} className="text-[13px] text-accent mb-3 inline-flex items-center gap-1">
          <Icon name="expand_more" size={16} className="rotate-90" /> Prioritization
        </button>
        <div className="bg-surface border-[0.5px] border-hairline rounded-frame shadow-frame p-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-[15px] font-semibold">Value vs Effort · Q4 2026 candidates</h1>
            <span className="text-[11px] text-label">Bubble size = Reach</span>
          </div>

          <div className="relative w-full" style={{ aspectRatio: '16 / 9' }}>
            {/* quadrant grid */}
            <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
              {['QUICK WINS', 'MAJOR PROJECTS', 'FILL-INS', 'THANKLESS TASKS'].map((q, i) => (
                <div
                  key={q}
                  className={`border-hairline flex items-start justify-${i % 2 ? 'end' : 'start'} p-2 ${
                    i < 2 ? 'border-b-[0.5px]' : ''
                  } ${i % 2 === 0 ? 'border-r-[0.5px]' : ''}`}
                >
                  <span className="text-[10px] font-semibold tracking-wide text-accent/70">{q}</span>
                </div>
              ))}
            </div>
            {/* axis labels */}
            <span className="absolute -left-1 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] text-label origin-center">
              Value → (low to high)
            </span>
            <span className="absolute left-1/2 -bottom-5 -translate-x-1/2 text-[10px] text-label">
              Effort → (low to high)
            </span>

            {/* bubbles */}
            {items.map((item, i) => {
              const value = (item.riceScore ?? 0) / maxRice; // 0..1 → y
              const effort = EFFORT[item.ref] ?? 0.5; // 0..1 → x
              const size = 34 + (item.riceScore ?? 0);
              return (
                <div
                  key={item.id}
                  className="absolute rounded-full flex items-center justify-center text-center -translate-x-1/2 -translate-y-1/2 cursor-pointer"
                  style={{
                    left: `${effort * 100}%`,
                    top: `${(1 - value) * 100}%`,
                    width: size,
                    height: size,
                    background: `${COLORS[i % COLORS.length]}22`,
                    border: `1.5px solid ${COLORS[i % COLORS.length]}`,
                  }}
                  title={`${item.ref} · ${item.title}`}
                  onClick={() => navigate(`/items/${item.id}`)}
                >
                  <span className="text-[8px] font-medium leading-tight px-1 text-ink/80">
                    {item.ref.split('-')[0]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
