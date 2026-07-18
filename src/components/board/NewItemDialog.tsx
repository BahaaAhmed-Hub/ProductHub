import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { useCreateItem } from '@/features/board/hooks';
import type { Priority, RequestType } from '@/types/domain';

const TYPE_OPTIONS: { value: RequestType; label: string }[] = [
  { value: 'feature', label: 'Feature' },
  { value: 'bug', label: 'Bug' },
  { value: 'request', label: 'Request' },
  { value: 'query', label: 'Task' },
];
const PRIORITY_OPTIONS: Priority[] = ['low', 'medium', 'high', 'critical'];

/** Shared "create a backlog item directly" modal — used by Backlog and Board. */
export function NewItemDialog({ onClose }: { onClose: () => void }) {
  const createItem = useCreateItem();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<RequestType>('feature');
  const [priority, setPriority] = useState<Priority>('medium');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCreate() {
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createItem({ title: title.trim(), type, priority });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create item');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-6" onClick={onClose}>
      <div className="w-[420px] bg-surface rounded-frame shadow-pop p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <span className="text-[15px] font-semibold">New backlog item</span>
          <button onClick={onClose} className="text-label hover:text-body">
            <Icon name="close" size={18} />
          </button>
        </div>

        <label className="block mb-3">
          <span className="text-eyebrow font-medium uppercase text-label">Title</span>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onCreate()}
            placeholder="What needs to get done?"
            className="w-full h-10 mt-1 px-3 rounded-control border-[0.5px] border-hairline bg-surface text-sm outline-none focus:border-accent"
          />
        </label>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <label className="block">
            <span className="text-eyebrow font-medium uppercase text-label">Type</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as RequestType)}
              className="w-full h-9 mt-1 px-2.5 rounded-control border-[0.5px] border-hairline bg-surface text-[13px] outline-none"
            >
              {TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-eyebrow font-medium uppercase text-label">Priority</span>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              className="w-full h-9 mt-1 px-2.5 rounded-control border-[0.5px] border-hairline bg-surface text-[13px] outline-none capitalize"
            >
              {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
        </div>

        {error && <div className="text-xs text-danger mb-3">{error}</div>}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={!title.trim() || saving} onClick={onCreate}>
            {saving ? 'Adding…' : 'Add item'}
          </Button>
        </div>
      </div>
    </div>
  );
}
