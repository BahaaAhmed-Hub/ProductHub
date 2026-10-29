import { useState } from 'react';
import { TopNav } from '@/components/layout/TopNav';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Tag } from '@/components/ui/Tag';
import { useTeamRoster, useRosterActions } from '@/features/team';
import { useBoardItems } from '@/features/board/hooks';

/** Assignable team roster — everyone who can be set as a task's assignee.
 * Includes people with a login, people added here by hand, and people the
 * Asana sync created from task assignees. */
export function RosterScreen() {
  const { roster, isLoading } = useTeamRoster();
  const actions = useRosterActions();
  const { items } = useBoardItems();
  const [form, setForm] = useState<{ id: string | null; name: string; email: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const taskCount = (id: string) => items.filter((i) => i.assigneeId === id).length;

  async function run(fn: () => Promise<void>, after?: () => void) {
    setError(null);
    try {
      await fn();
      after?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed.');
    }
  }

  return (
    <>
      <TopNav center={<span className="text-[13px] text-body">Team roster</span>} notificationCount={4} />
      <div className="flex-1 bg-canvas overflow-y-auto scroll-thin p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Team roster</h1>
            <p className="text-xs text-label mt-0.5">{roster.length} people · available as task assignees; Asana assignees are added automatically on sync</p>
          </div>
          <Button icon="add" onClick={() => setForm({ id: null, name: '', email: '' })}>Add person</Button>
        </div>

        {error && <div className="text-xs text-danger mb-3">{error}</div>}

        {form && (
          <Card className="px-4 py-4 mb-4">
            <div className="text-[13px] font-semibold mb-3">{form.id ? 'Edit person' : 'Add person'}</div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-eyebrow font-medium uppercase text-label">Name</span>
                <input
                  autoFocus
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full h-9 mt-1 px-2.5 rounded-control border-[0.5px] border-hairline bg-surface text-[13px] outline-none focus:border-accent"
                />
              </label>
              <label className="block">
                <span className="text-eyebrow font-medium uppercase text-label">Email (matches Asana users)</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full h-9 mt-1 px-2.5 rounded-control border-[0.5px] border-hairline bg-surface text-[13px] outline-none focus:border-accent"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <Button variant="secondary" onClick={() => setForm(null)}>Cancel</Button>
              <Button
                disabled={!form.name.trim()}
                onClick={() =>
                  run(() => (form.id ? actions.update(form.id, form.name, form.email) : actions.add(form.name, form.email)), () => setForm(null))
                }
              >
                Save
              </Button>
            </div>
          </Card>
        )}

        {isLoading && <div className="text-sm text-body">Loading…</div>}
        <div className="flex flex-col gap-2.5">
          {roster.map((m) => (
            <Card key={m.id} className="px-4 py-3 flex items-center gap-3">
              <Avatar initials={m.initials} size={32} />
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold truncate">{m.name}</div>
                <div className="text-[12px] text-body truncate">{m.email ?? 'No email'}</div>
              </div>
              {m.profileId && <Tag tone="accent">Has login</Tag>}
              {m.source === 'asana' && <Tag tone="neutral">From Asana</Tag>}
              <span className="text-[11px] text-label font-mono flex-shrink-0">{taskCount(m.id)} tasks</span>
              {confirmDelete === m.id ? (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-[12px] text-body">Remove? Their tasks become unassigned.</span>
                  <Button variant="danger" className="h-7 text-[12px] px-2.5" onClick={() => run(() => actions.remove(m.id), () => setConfirmDelete(null))}>
                    Remove
                  </Button>
                  <Button variant="ghost" className="h-7 text-[12px] px-2.5" onClick={() => setConfirmDelete(null)}>Cancel</Button>
                </div>
              ) : (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    aria-label="Edit"
                    title="Edit"
                    onClick={() => setForm({ id: m.id, name: m.name, email: m.email ?? '' })}
                    className="w-7 h-7 rounded-md flex items-center justify-center text-label hover:text-body hover:bg-[#F4F3F0]"
                  >
                    <Icon name="edit" size={16} />
                  </button>
                  <button
                    aria-label="Remove"
                    title="Remove"
                    onClick={() => setConfirmDelete(m.id)}
                    className="w-7 h-7 rounded-md flex items-center justify-center text-label hover:text-body hover:bg-[#F4F3F0]"
                  >
                    <Icon name="delete" size={16} />
                  </button>
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
