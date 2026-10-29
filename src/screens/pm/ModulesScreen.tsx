import { useState } from 'react';
import { TopNav } from '@/components/layout/TopNav';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { TypeTag } from '@/components/ui/Tag';
import { useModules, useModuleActions, type ProductModule } from '@/features/modules';
import { useBoardItems, useBulkActions } from '@/features/board/hooks';
import { useItemPanel } from '@/features/board/panelStore';
import { useAsanaConnection, pushToAsana, summarizePush } from '@/features/integrations/asana';
import type { BoardItem } from '@/features/board/types';
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
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<{ name: string; count: number }[] | null>(null);
  const openItem = useItemPanel((st) => st.open);
  const bulk = useBulkActions();
  const { connection } = useAsanaConnection();
  const [openId, setOpenId] = useState<string | null>(null); // module whose tasks are shown
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [moveTarget, setMoveTarget] = useState('');
  const [moving, setMoving] = useState(false);
  const [deleting, setDeleting] = useState<{ id: string; target: string } | null>(null);
  const [notice, setNotice] = useState<{ text: string; ok: boolean; pushIds?: string[]; rename?: { from: string; to: string } } | null>(null);

  const roots = modules.filter((m) => !m.parentId);
  const childrenOf = (id: string) => modules.filter((m) => m.parentId === id);
  /** The module plus every sub-module under it. */
  const subtree = (id: string): ProductModule[] => {
    const self = modules.find((m) => m.id === id);
    return self ? [self, ...childrenOf(id).flatMap((c) => subtree(c.id))] : [];
  };
  const tasksOf = (name: string): BoardItem[] => items.filter((i) => i.module === name);

  async function save() {
    if (!editing) return;
    setError(null);
    const aliases = editing.aliases.split(',').map((a) => a.trim()).filter(Boolean);
    try {
      if (editing.id) {
        const before = modules.find((m) => m.id === editing.id);
        const newName = editing.name.trim();
        const renamed = before && before.name !== newName ? before.name : null;
        // Synced tasks that carry the module, captured before the rename rewrites them.
        const syncedIds = renamed ? tasksOf(renamed).filter((i) => i.externalSource === 'asana').map((i) => i.id) : [];
        await actions.update(editing.id, { name: editing.name, description: editing.description, aliases });
        if (renamed && syncedIds.length > 0) await reflectRename(renamed, newName, syncedIds);
      } else await actions.create({ name: editing.name, description: editing.description, parentId: editing.parentId, aliases });
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save module.');
    }
  }

  /** Rename → Asana. Automatic when auto-sync is on; otherwise offered as a button on the notice. */
  async function reflectRename(from: string, to: string, ids: string[]) {
    if (!connection.autoPush) {
      setNotice({
        text: `Renamed here. ${ids.length} synced task${ids.length === 1 ? '' : 's'} still show "${from}" in Asana.`,
        ok: true, pushIds: ids, rename: { from, to },
      });
      return;
    }
    try {
      setNotice({ text: summarizePush(await pushToAsana(ids, { from, to })), ok: true });
    } catch (e) {
      setNotice({ text: e instanceof Error ? e.message : 'Could not update Asana.', ok: false });
    }
  }

  async function pushNotice() {
    if (!notice?.pushIds) return;
    try {
      const results = await pushToAsana(notice.pushIds, notice.rename);
      setNotice({ text: summarizePush(results), ok: results.every((r) => r.status === 'ok') });
    } catch (e) {
      setNotice({ text: e instanceof Error ? e.message : 'Could not update Asana.', ok: false });
    }
  }

  async function moveTasks(ids: string[], target: string) {
    setMoving(true);
    setError(null);
    try {
      await bulk.setModule(ids, target || null);
      setPicked(new Set());
      setMoveTarget('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not move tasks.');
    } finally {
      setMoving(false);
    }
  }

  /** Delete a module: its tasks (and its sub-modules' tasks) move first, then it goes. */
  async function deleteWithMove(m: ProductModule, target: string) {
    setError(null);
    try {
      const names = new Set(subtree(m.id).map((x) => x.name));
      const affected = items.filter((i) => i.module && names.has(i.module)).map((i) => i.id);
      if (affected.length > 0) await bulk.setModule(affected, target || null);
      await actions.remove(m.id);
      setDeleting(null);
      if (openId === m.id) setOpenId(null);
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
    const open = openId === m.id;
    const tasks = tasksOf(m.name);
    const treeNames = new Set(subtree(m.id).map((x) => x.name));
    const treeTaskCount = items.filter((i) => i.module && treeNames.has(i.module)).length;
    const targets = modules.filter((x) => !treeNames.has(x.name));
    const confirming = deleting?.id === m.id;
    return (
      <div key={m.id}>
        <Card className={`px-4 py-3 flex items-center gap-3 ${depth > 0 ? 'ml-8 mt-2' : ''}`}>
          <button
            className="flex items-center gap-3 flex-1 min-w-0 text-left"
            onClick={() => { setOpenId(open ? null : m.id); setPicked(new Set()); setMoveTarget(''); }}
            aria-expanded={open}
          >
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
            <span className="text-[11px] text-label font-mono flex-shrink-0">{tasks.length} tasks</span>
            <Icon name="expand_more" size={16} className={`text-label flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
          <div className="flex items-center gap-1 flex-shrink-0">
            {depth === 0 && (
              <IconBtn icon="add" label="Add sub-module" onClick={() => setEditing({ id: null, parentId: m.id, name: '', description: '', aliases: '' })} />
            )}
            <IconBtn
              icon="edit"
              label="Rename / edit"
              onClick={() => setEditing({ id: m.id, parentId: m.parentId ?? null, name: m.name, description: m.description, aliases: m.aliases.join(', ') })}
            />
            <IconBtn icon="delete" label="Delete module" onClick={() => setDeleting({ id: m.id, target: '' })} />
          </div>
        </Card>

        {confirming && (
          <Card className={`px-4 py-3 mt-2 border-danger ${depth > 0 ? 'ml-8' : ''}`}>
            {treeTaskCount > 0 ? (
              <>
                <div className="text-[13px] mb-2">
                  <b>{treeTaskCount}</b> task{treeTaskCount === 1 ? '' : 's'} use{treeTaskCount === 1 ? 's' : ''} {m.name}
                  {subtree(m.id).length > 1 ? ' or its sub-modules' : ''}. Move {treeTaskCount === 1 ? 'it' : 'them'} to another module before deleting:
                </div>
                <select
                  value={deleting.target}
                  onChange={(e) => setDeleting({ id: m.id, target: e.target.value })}
                  className="h-8 px-2 rounded-control border-[0.5px] border-hairline bg-surface text-[13px] outline-none mb-2"
                >
                  <option value="">Choose a module…</option>
                  <option value="__none__">No module</option>
                  {targets.map((x) => <option key={x.id} value={x.name}>{x.parentId ? '— ' : ''}{x.name}</option>)}
                </select>
              </>
            ) : (
              <div className="text-[13px] mb-2">Delete {m.name}{subtree(m.id).length > 1 ? ' and its sub-modules' : ''}? No tasks use it.</div>
            )}
            <div className="flex items-center gap-2">
              <Button
                variant="danger"
                className="h-8 text-[12px]"
                disabled={treeTaskCount > 0 && !deleting.target}
                onClick={() => deleteWithMove(m, deleting.target === '__none__' ? '' : deleting.target)}
              >
                {treeTaskCount > 0 ? 'Move tasks & delete' : 'Delete'}
              </Button>
              <Button variant="ghost" className="h-8 text-[12px]" onClick={() => setDeleting(null)}>Cancel</Button>
            </div>
          </Card>
        )}

        {open && (
          <Card className={`mt-2 ${depth > 0 ? 'ml-8' : ''}`}>
            {tasks.length === 0 ? (
              <div className="px-4 py-4 text-[13px] text-body">No tasks in this module.</div>
            ) : (
              <>
                <div className="flex items-center gap-2 px-4 py-2 border-b-[0.5px] border-hairline flex-wrap">
                  <label className="flex items-center gap-2 text-[12px] text-body">
                    <input
                      type="checkbox"
                      className="accent-navy"
                      checked={picked.size === tasks.length}
                      onChange={() => setPicked(picked.size === tasks.length ? new Set() : new Set(tasks.map((t) => t.id)))}
                    />
                    {picked.size > 0 ? `${picked.size} selected` : 'Select all'}
                  </label>
                  {picked.size > 0 && (
                    <>
                      <select
                        value={moveTarget}
                        onChange={(e) => setMoveTarget(e.target.value)}
                        className="h-7 px-2 rounded-control border-[0.5px] border-hairline bg-surface text-[12px] outline-none"
                      >
                        <option value="">Move to…</option>
                        <option value="__none__">No module</option>
                        {modules.filter((x) => x.id !== m.id).map((x) => <option key={x.id} value={x.name}>{x.parentId ? '— ' : ''}{x.name}</option>)}
                      </select>
                      <Button
                        className="h-7 text-[12px] px-2.5"
                        icon="drive_file_move"
                        disabled={!moveTarget || moving}
                        onClick={() => moveTasks([...picked], moveTarget === '__none__' ? '' : moveTarget)}
                      >
                        {moving ? 'Moving…' : 'Move'}
                      </Button>
                    </>
                  )}
                </div>
                {tasks.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 px-4 h-11 border-b-[0.5px] border-hairline last:border-0 hover:bg-[#F7F7F5]">
                    <input
                      type="checkbox"
                      className="accent-navy"
                      checked={picked.has(t.id)}
                      aria-label={`Select ${t.ref}`}
                      onChange={() => setPicked((p) => { const n = new Set(p); if (n.has(t.id)) n.delete(t.id); else n.add(t.id); return n; })}
                    />
                    <span className="font-mono text-[11px] text-label w-[92px] flex-shrink-0">{t.ref}</span>
                    <span className="flex-1 min-w-0 truncate text-[13px] font-medium cursor-pointer" onClick={() => openItem(t.id)}>{t.title}</span>
                    <TypeTag type={t.type} />
                    <span title={t.assigneeName} className="w-6 flex-shrink-0">
                      {t.assigneeInitials && <Avatar initials={t.assigneeInitials} size={24} />}
                    </span>
                  </div>
                ))}
              </>
            )}
          </Card>
        )}
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
        {notice && (
          <div className={`text-xs mb-3 flex items-center gap-3 ${notice.ok ? 'text-body' : 'text-danger'}`}>
            <span>{notice.text}</span>
            {notice.pushIds && (
              <button className="text-accent font-medium" onClick={pushNotice}>Update in Asana now</button>
            )}
            <button className="text-label" onClick={() => setNotice(null)} aria-label="Dismiss">
              <Icon name="close" size={13} />
            </button>
          </div>
        )}

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
