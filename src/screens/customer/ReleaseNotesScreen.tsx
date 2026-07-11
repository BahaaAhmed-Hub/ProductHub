import { Tag } from '@/components/ui/Tag';
import { MOCK_RELEASE_NOTES } from '@/features/requests/mockData';

/** Screen 08 — release notes changelog. */
export function ReleaseNotesScreen() {
  return (
    <div className="max-w-2xl mx-auto px-8 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Release notes</h1>
      <p className="text-sm text-body mt-1">
        Everything we've shipped, straight from the team building it.
      </p>

      <div className="mt-8 flex flex-col gap-8">
        {MOCK_RELEASE_NOTES.map((rel) => (
          <div key={rel.version} className="border-b-[0.5px] border-hairline pb-8 last:border-0">
            <div className="flex items-center gap-2.5">
              <Tag tone="success">{rel.version}</Tag>
              <span className="text-[12px] text-label">{rel.when}</span>
            </div>
            <h2 className="text-[15px] font-semibold mt-2.5">{rel.title}</h2>
            <ul className="mt-2 flex flex-col gap-1.5">
              {rel.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px] text-body">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-label flex-shrink-0" />
                  {b}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
