import { TopNav } from '@/components/layout/TopNav';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Tag } from '@/components/ui/Tag';

const ARTIFACTS = [
  { kind: 'Survey', title: 'Q3 NPS survey', meta: '412 responses · NPS 41', icon: 'summarize', tone: 'accent' as const },
  { kind: 'AI summary', title: 'Enterprise churn interviews', meta: 'Synthesis of 18 calls', icon: 'auto_awesome', tone: 'pm' as const },
  { kind: 'Agent run', title: 'Competitor pricing scan', meta: 'Autonomous · 6 sources', icon: 'science', tone: 'success' as const },
];

/** Screen 44 — PM research hub. */
export function ResearchHub() {
  return (
    <>
      <TopNav center={<span className="text-[13px] text-body">Research</span>} notificationCount={4} />
      <div className="flex-1 bg-canvas overflow-y-auto scroll-thin p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Research hub</h1>
            <p className="text-xs text-label mt-0.5">Surveys, AI feedback synthesis, and autonomous research — linked to roadmap evidence.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" icon="add">New survey</Button>
            <Button icon="auto_awesome">Summarize feedback</Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {ARTIFACTS.map((a) => (
            <Card key={a.title} className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-[12px] bg-pm-bg flex items-center justify-center">
                  <Icon name={a.icon} size={20} className="text-pm" />
                </div>
                <Tag tone={a.tone}>{a.kind}</Tag>
              </div>
              <div className="text-[15px] font-semibold">{a.title}</div>
              <div className="text-[12px] text-body mt-1">{a.meta}</div>
            </Card>
          ))}
        </div>

        <Card className="p-5 mt-4 bg-ai-surface border-0">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-ai-accent mb-2">
            <Icon name="auto_awesome" size={14} /> AI FEEDBACK SUMMARY
          </div>
          <p className="text-[13px] text-ink leading-relaxed max-w-3xl">
            Across 412 survey responses and 18 interviews, the top themes are: (1) enterprise SSO is a
            blocker for 3 deals, (2) CSV export gaps hurt daily reporting, (3) power users want bulk actions.
            SSO and rate-limit reliability map directly to two "Now" roadmap items.
          </p>
          <div className="mt-3">
            <Button variant="secondary" icon="north_east">Link to roadmap evidence</Button>
          </div>
        </Card>
      </div>
    </>
  );
}
