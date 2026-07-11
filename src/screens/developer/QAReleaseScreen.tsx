import { useState } from 'react';
import { TopNav } from '@/components/layout/TopNav';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/Card';
import { Tag } from '@/components/ui/Tag';

interface Check {
  label: string;
  detail: string;
  done: boolean;
}

const CHECKS: Check[] = [
  { label: 'Pull request #4827 merged to main', detail: 'Ahmed R. approved', done: true },
  { label: 'QA regression suite', detail: '214 / 214 passed', done: true },
  { label: 'Verified enterprise tier override on staging', detail: '', done: true },
  { label: 'Changelog entry', detail: 'Required below', done: false },
];

/** Screen 13 — Developer QA & release checklist. */
export function QAReleaseScreen() {
  const [notes, setNotes] = useState(
    'Fixed an issue where the API rate limiter ignored the enterprise tier override, causing 429 responses below quota. Enterprise limits now apply correctly.',
  );
  const ready = CHECKS.every((c) => c.done) || notes.trim().length > 0;

  return (
    <>
      <TopNav
        center={
          <div className="text-[13px] text-label flex items-center gap-2">
            <span>Board</span><span className="text-hairline">/</span>
            <span className="font-mono">BUG-0042</span><span className="text-hairline">/</span>
            <span className="text-body font-medium">Release</span>
          </div>
        }
        notificationCount={4}
      />
      <div className="flex-1 bg-canvas overflow-y-auto scroll-thin">
        <div className="max-w-2xl mx-auto px-8 py-8">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-label">BUG-0042</span>
            <Tag tone="success">QA passed</Tag>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight mt-1">Release fix to production</h1>

          <div className="mt-6 bg-surface border-[0.5px] border-hairline rounded-frame shadow-frame divide-y divide-hairline">
            {CHECKS.map((c) => (
              <div key={c.label} className="flex items-center gap-3 px-4 py-3.5">
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                    c.done ? 'bg-success-bg text-success' : 'bg-[#FBF0DD] text-[#9A6410]'
                  }`}
                >
                  <Icon name={c.done ? 'check' : 'error'} size={13} />
                </span>
                <span className="text-[13px] flex-1">{c.label}</span>
                {c.detail && (
                  <span className={`text-[12px] ${c.done ? 'text-body' : 'text-[#9A6410] font-medium'}`}>
                    {c.detail}
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between mb-2">
              <Eyebrow>Release notes (sent to Orion Cloud)</Eyebrow>
              <span className="inline-flex items-center gap-1 text-[11px] text-label">
                <Icon name="mic" size={13} /> Voice to text
              </span>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2.5 rounded-control border-[0.5px] border-hairline bg-surface text-[13px] outline-none focus:border-accent resize-none"
            />
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-control bg-success-bg px-3 py-2.5">
            <Icon name="check" size={15} className="text-success mt-0.5" />
            <span className="text-[12px] text-success">
              Resolving now keeps BUG-0042 inside its 8h SLA — <b>0h 47m</b> to spare.
            </span>
          </div>

          <div className="mt-5 flex items-center justify-end gap-2">
            <Button variant="secondary">Save draft</Button>
            <Button variant="primary" icon="bolt" disabled={!ready} className="bg-success hover:bg-[#178a63]">
              Release &amp; resolve
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
