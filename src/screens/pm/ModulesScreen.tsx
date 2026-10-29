import { useMemo, useState } from 'react';
import { TopNav } from '@/components/layout/TopNav';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useModules, useModuleActions, type ProductModule } from '@/features/modules';
import { useBoardItems } from '@/features/board/hooks';
import { classifyItems } from '@/features/ai';

interface Editing {
  id: string | null; // null = creating
  parentId: string | null;
  name: string;
  description: string;
  aliases: string;
}

/** Platform modules — the catalog tasks are tagged with. Full CRUD, one
 * level of nesting (modules → sub-modules), plus AI-suggested modules read
 * from existing task titles/bodies. */
export function ModulesScreen() {
  const { modules, isLoading } = useModules();
  const actions = useModuleActions();
  const { items } = useBoardItems();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<{ name: string; count: number }[] | null>(null);

  const counts = useMemo(() => {
    const c = new Map<string, number>();
    for (const i of items) if (i.module) c.set(i.module, (c.get(i.module) ?? 0) + 1);
    return c;
  }, [items]);
  const roots = modules.filter((m) => !m.parentId);
  const childrenOf = (id: string) => modules.filter((m) => m.parentId === id);

  async function save() {
    if (!editing) return;
    setError(null);
    const aliases = editing.aliases.split(',').map((a) => a.trim()).filter(Boolean);
    try {
      if (editing.id) await actions.update(editing.id, { name: editing.name, description: editing.description, aliases });
      else await actions.create({ name: editing.name, description: editing.description, parentId: editing.parentId, aliases });
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save module.');
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      await actions.remove(id);
      setConfirmDelete(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete module.');
    }
  }

  async function suggest() {
    setSuggesting(true);
    setError(null);
    setSuggestions(null);
    try {
      const pool = items.filter((i) => !i.module).slice(0, 40);
      if (pool.length === 0) {
        setSuggestions([]);
        return;
      }
      const results = await classifyItems(
        pool.map((i) => ({ id: i.id, title: i.title, ...(i.description ? { body: i.description } : {}) })),
        modules.map((m) => m.name),
        true,
      );
      const known = new Set(modules.map((m) => m.name.toLowerCase()));
      const tally = new Map<string, number>();
      for (const r of results) {
        if (r.module && !known.has(r.module.toLowerCase())) tally.set(r.module, (tally.get(r.module) ?? 0) + 1);
      }
      setSuggestions([...tally].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI suggestion failed.');
    } finally {
      setSuggesting(false);
    }
  }

  async function addSuggestion(name: string) {
    setError(null);
    try {
      await actions.create({ name });
      setSuggestions((s) => (s ? s.filter((x) => x.name !== name) : s));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add module.');
    }
  }

  function row(m: ProductModule, depth: number) {
    return (
      <div key={m.id}>
        <Card className={`px-4 py-3 flex items-center gap-3 ${depth > 0 ? 'ml-8 mt-2' : ''}`}>
          <div className="w-8 h-8 rounded-[10px] bg-pm-bg flex items-center justify-center flex-shrink-0">
            <Icon name={depth > 0 ? 'subdirectory_arrow_right' : 'widgets'} size={17} className="text-pm" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-semibold truncate">{m.name}</div>
            {(m.description || m.aliases.length > 0) && (
              <div className="text-[12px] text-body truncate">
                {m.description}
                {m.aliases.length > 0 && <span className="text-label">{m.description ? ' · ' : ''}Keywords: {m.aliases.join(', ')}</span>}
              </div>
            )}
          </div>
          <span className="text-[11px] text-label font-mono flex-shrink-0">{counts.get(m.name) ?? 0} tasks</span>
          {confirmDelete === m.id ? (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-[12px] text-body">Delete{childrenOf(m.id).length > 0 ? ' with sub-modules' : ''}?</span>
              <Button variant="danger" className="h-7 text-[12px] px-2.5" onClick={() => remove(m.id)}>Delete</Button>
              <Button variant="ghost" className="h-7 text-[12px] px-2.5" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            </div>
          ) : (
            <div className="flex items-center gap-1 flex-shrink-0">
              {depth === 0 && (
                <IconBtn icon="add" label="Add sub-module" onClick={() => setEditing({ id: null, parentId: m.id, name: '', description: '', aliases: '' })} />
              )}
              <IconBtn
                icon="edit"
                label="Edit"
                onClick={() => setEditing({ id: m.id, parentId: m.parentId ?? null, name: m.name, description: m.description, aliases: m.aliases.join(', ') })}
              />
              <IconBtn icon="delete" label="Delete" onClick={() => setConfirmDelete(m.id)} />
            </div>
          )}
        </Card>
        {depth === 0 && childrenOf(m.id).map((c) => row(c, 1))}
      </div>
    );
  }

  return (
    <>
      <TopNav center={<span className="text-[13px] text-body">Modules</span>} notificationCount={4} />
      <div className="flex-1 bg-canvas overflow-y-auto scroll-thin p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Platform modules</h1>
            <p className="text-xs text-label mt-0.5">
              {modules.length} modules · tasks are tagged with these in their detail panel, and detected from titles when synced
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" icon="auto_awesome" disabled={suggesting} onClick={suggest}>
              {suggesting ? 'Reading tasks…' : 'Suggest from tasks (AI)'}
            </Button>
            <Button icon="add" onClick={() => setEditing({ id: null, parentId: null, name: '', description: '', aliases: '' })}>
              New module
            </Button>
          </div>
        </div>

        {error && <div className="text-xs text-danger mb-3">{error}</div>}

        {suggestions && (
          <Card className="px-4 py-3.5 mb-4">
            <div className="text-[13px] font-semibold mb-2">Suggested from your tasks</div>
            {suggestions.length === 0 ? (
              <div className="text-[12px] text-body">No new modules to suggest — untagged tasks fit the existing ones.</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s.name}
                    onClick={() => addSuggestion(s.name)}
                    className="h-7 px-2.5 rounded-full border border-hairline bg-surface text-[12px] font-medium hover:bg-[#F4F3F0]"
                  >
                    + {s.name} <span className="text-label">({s.count})</span>
                  </button>
                ))}
              </div>
            )}
          </Card>
        )}

        {editing && (
          <Card className="px-4 py-4 mb-4">
            <div className="text-[13px] font-semibold mb-3">
              {editing.id ? 'Edit module' : editing.parentId ? 'New sub-module' : 'New module'}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-eyebrow font-medium uppercase text-label">Name</span>
                <input
                  autoFocus
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && save()}
                  className="w-full h-9 mt-1 px-2.5 rounded-control border-[0.5px] border-hairline bg-surface text-[13px] outline-none focus:border-accent"
                />
              </label>
              <label className="block">
                <span className="text-eyebrow font-medium uppercase text-label">Keywords (comma separated)</span>
                <input
                  value={editing.aliases}
                  onChange={(e) => setEditing({ ...editing, aliases: e.target.value })}
                  placeholder="used to detect this module in task titles"
                  className="w-full h-9 mt-1 px-2.5 rounded-control border-[0.5px] border-hairline bg-surface text-[13px] outline-none focus:border-accent"
                />
              </label>
              <label className="block col-span-2">
                <span className="text-eyebrow font-medium uppercase text-label">Description</span>
                <input
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  className="w-full h-9 mt-1 px-2.5 rounded-control border-[0.5px] border-hairline bg-surface text-[13px] outline-none focus:border-accent"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <Button variant="secondary" onClick={() => { setEditing(null); setError(null); }}>Cancel</Button>
              <Button disabled={!editing.name.trim()} onClick={save}>Save</Button>
            </div>
          </Card>
        )}

        {isLoading && <div className="text-sm text-body">Loading…</div>}
        {!isLoading && modules.length === 0 && (
          <div className="max-w-md rounded-frame border border-dashed border-hairline p-8 text-center">
            <div className="text-sm font-medium">No modules yet</div>
            <p className="text-[13px] text-body mt-1">Add the areas of your platform by hand, or let AI suggest them from your existing tasks.</p>
          </div>
        )}
        <div className="flex flex-col gap-2.5">{roots.map((m) => row(m, 0))}</div>
      </div>
    </>
  );
}

function IconBtn({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} className="w-7 h-7 rounded-md flex items-center justify-center text-label hover:text-body hover:bg-[#F4F3F0]">
      <Icon name={icon} size={16} />
    </button>
  );
}
