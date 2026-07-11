import { MOCK_PUBLIC_ROADMAP } from '@/features/requests/mockData';

/** Screen 07 — public roadmap (Now / Next / Later columns). */
export function PublicRoadmapScreen() {
  return (
    <div className="max-w-6xl mx-auto px-8 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Our roadmap</h1>
      <p className="text-sm text-body mt-1">
        What we're building at ProductHub, updated as priorities shift · last published today
      </p>

      <div className="grid grid-cols-3 gap-5 mt-8">
        {MOCK_PUBLIC_ROADMAP.map((col) => (
          <div key={col.bucket}>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full" style={{ background: col.dot }} />
              <span className="text-[13px] font-semibold">{col.label}</span>
              <span className="text-[12px] text-label">{col.sub}</span>
            </div>
            <div className="flex flex-col gap-3">
              {col.items.map((item) =>
                item.ghost ? (
                  <div
                    key={item.title}
                    className="rounded-frame border border-dashed border-hairline px-4 py-5 text-center text-[13px] text-label"
                  >
                    {item.title}
                  </div>
                ) : (
                  <div
                    key={item.title}
                    className="rounded-frame border-[0.5px] border-hairline bg-surface shadow-frame px-4 py-3.5"
                  >
                    <div className="text-[14px] font-semibold">{item.title}</div>
                    <p className="text-[12px] text-body leading-relaxed mt-1">{item.body}</p>
                  </div>
                ),
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
