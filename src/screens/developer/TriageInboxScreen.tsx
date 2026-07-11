import { useEffect, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { TopNav } from '@/components/layout/TopNav';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/Card';
import { TypeTag, PriorityTag } from '@/components/ui/Tag';
import { useTriageRequests, useAddToBoard } from '@/features/board/hooks';
import type { TriageRequest } from '@/features/board/types';

/** Screen 09 — Developer triage inbox (list + detail + Add to board). */
export function TriageInboxScreen() {
  const { requests, isLoading } = useTriageRequests();
  const addToBoard = useAddToBoard();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!selectedId && requests[0]) setSelectedId(requests[0].id);
    if (selectedId && !requests.some((r) => r.id === selectedId)) {
      setSelectedId(requests[0]?.id ?? null);
    }
  }, [requests, selectedId]);

  const selected = requests.find((r) => r.id === selectedId) ?? null;

  async function onAdd(t: TriageRequest) {
    setBusy(true);
    try {
      await addToBoard(t);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <TopNav
        center={
          <div className="text-[13px] text-label flex items-center gap-2">
            <span>Sprint 24</span>
            <span className="text-hairline">/</span>
            <span className="text-body font-medium">Triage Inbox</span>
          </div>
        }
        notificationCount={4}
      />

      <div className="flex-1 bg-canvas flex min-h-0">
        {/* List */}
        <div className="flex-1 flex flex-col min-w-0 border-r-[0.5px] border-hairline">
          <div className="h-12 flex items-center gap-2 px-5 border-b-[0.5px] border-hairline flex-shrink-0">
            <span className="text-sm font-semibold">Triage Inbox</span>
            <span className="text-xs text-label">{requests.length} awaiting triage</span>
          </div>
          <div className="flex-1 overflow-y-auto scroll-thin">
            {isLoading && <div className="p-5 text-sm text-body">Loading…</div>}
            {!isLoading && requests.length === 0 && (
              <div className="p-8 text-center text-sm text-body">
                Nothing to triage — the inbox is clear. New customer requests land here.
              </div>
            )}
            {requests.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className={clsx(
                  'w-full text-left px-5 py-3.5 border-b-[0.5px] border-hairline flex flex-col gap-1',
                  selectedId === r.id ? 'bg-accent-bg shadow-[inset_2px_0_0_#378ADD]' : 'hover:bg-[#F7F7F5]',
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-label">{r.ref}</span>
                  <TypeTag type={r.type} />
                  <span className="text-[10px] text-label ml-auto">{r.createdAgo}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[13px] font-medium truncate">{r.subject}</span>
                  <span className="text-[11px] text-label flex-shrink-0">{r.customer}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Detail */}
        <div className="w-[320px] flex-shrink-0 flex flex-col bg-surface">
          {selected ? (
            <>
              <div className="flex-1 overflow-y-auto scroll-thin p-5 flex flex-col gap-5">
                <div>
                  <div className="font-mono text-[10px] text-label mb-1">TRIAGE · {selected.ref}</div>
                  <div className="text-sm font-semibold leading-snug">{selected.subject}</div>
                </div>

                <Field label="Type">
                  <TypeTag type={selected.type} />
                </Field>
                <Field label="Priority">
                  <PriorityTag priority={selected.priority} />
                </Field>
                <Field label="Product">
                  <span className="text-[13px]">{selected.product}</span>
                </Field>
                <Field label="Customer">
                  <span className="text-[13px]">{selected.customer}</span>
                </Field>

                {selected.priority === 'critical' && (
                  <div className="flex items-start gap-2 rounded-control bg-danger-bg px-3 py-2.5">
                    <Icon name="local_fire_department" size={15} className="text-danger mt-0.5" />
                    <span className="text-[12px] text-danger">
                      Critical SLA — first response due in 4h, resolution in 8h.
                    </span>
                  </div>
                )}
              </div>
              <div className="p-4 border-t-[0.5px] border-hairline">
                <Button className="w-full" icon="view_kanban" disabled={busy} onClick={() => onAdd(selected)}>
                  {busy ? 'Adding…' : 'Add to board'}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-label px-6 text-center">
              Select a request to triage
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Eyebrow>{label}</Eyebrow>
      {children}
    </div>
  );
}
