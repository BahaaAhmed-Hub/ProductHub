import { useState, type RefObject } from 'react';
import { GridLayout, useContainerWidth, type Layout, type LayoutItem } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import { TopNav } from '@/components/layout/TopNav';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useBoardItems } from '@/features/board/hooks';
import { useReportWidgets, useReportWidgetActions, WIDGET_LIBRARY, type ReportWidget } from '@/features/reports';
import { WidgetContent } from '@/features/reports/widgets';
import type { BoardItem } from '@/features/board/types';

const GRID_CONFIG = { cols: 12, rowHeight: 32, margin: [16, 16] as const };

function downloadCsv(items: BoardItem[]) {
  const header = ['ref', 'title', 'type', 'status', 'priority', 'rice', 'wsjf', 'effort'];
  const rows = items.map((i) =>
    [i.ref, `"${i.title.replace(/"/g, '""')}"`, i.type, i.boardStatus, i.priority, i.riceScore ?? '', i.wsjfScore ?? '', i.effort ?? ''].join(','),
  );
  const blob = new Blob([[header.join(','), ...rows].join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'producthub-backlog.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function WidgetCard({
  widget,
  onRename,
  onRemove,
}: {
  widget: ReportWidget;
  onRename: (title: string) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(widget.title);

  function commit() {
    setEditing(false);
    const trimmed = title.trim();
    if (trimmed && trimmed !== widget.title) onRename(trimmed);
    else setTitle(widget.title);
  }

  return (
    <div className="h-full flex flex-col bg-surface border-[0.5px] border-hairline rounded-frame shadow-frame overflow-hidden">
      <div className="widget-drag-handle flex-shrink-0 flex items-center gap-2 px-3 h-9 border-b-[0.5px] border-hairline cursor-grab active:cursor-grabbing">
        <Icon name="sprint" size={13} className="text-label flex-shrink-0" />
        {editing ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && commit()}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className="flex-1 text-[13px] font-semibold bg-transparent outline-none border-b border-accent"
          />
        ) : (
          // No onMouseDown stopPropagation here — the button fills most of
          // the drag handle bar, so blocking mousedown would leave almost
          // nowhere left to grab for dragging. A plain click (no pointer
          // movement) still opens rename mode; react-grid-layout only
          // treats it as a drag once the pointer actually moves.
          <button
            className="flex-1 text-left text-[13px] font-semibold truncate hover:text-accent"
            onClick={(e) => { e.stopPropagation(); setEditing(true); }}
            title="Click to rename"
          >
            {widget.title}
          </button>
        )}
        <button
          className="text-label hover:text-danger flex-shrink-0"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          onMouseDown={(e) => e.stopPropagation()}
          aria-label="Remove widget"
        >
          <Icon name="close" size={14} />
        </button>
      </div>
      <div className="flex-1 min-h-0 p-3 flex flex-col">
        <WidgetContent kind={widget.kind} />
      </div>
    </div>
  );
}

/** Screen 32 — Manager reports: a customizable dashboard. Managers add
 * widgets from a small library, drag to reorder, resize by dragging a
 * corner, and rename each to describe what it's for — instead of a fixed
 * 3-panel layout. */
export function ReportsScreen() {
  const { items } = useBoardItems();
  const { widgets } = useReportWidgets();
  const actions = useReportWidgetActions();
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { width, containerRef, mounted } = useContainerWidth();

  function nextY(): number {
    return widgets.length === 0 ? 0 : Math.max(...widgets.map((w) => w.y + w.h));
  }

  async function onAdd(kind: (typeof WIDGET_LIBRARY)[number]) {
    setPicking(false);
    setError(null);
    try {
      await actions.add(kind.kind, kind.defaultTitle, { x: 0, y: nextY(), w: 4, h: 4 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add widget.');
    }
  }

  async function onLayoutChange(layout: Layout) {
    const changed = layout
      .map((l: LayoutItem) => ({ id: l.i, x: l.x, y: l.y, w: l.w, h: l.h }))
      .filter((l) => {
        const w = widgets.find((x) => x.id === l.id);
        return w && (w.x !== l.x || w.y !== l.y || w.w !== l.w || w.h !== l.h);
      });
    if (changed.length === 0) return;
    try {
      await actions.saveLayout(changed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save layout.');
    }
  }

  const layout: Layout = widgets.map((w) => ({ i: w.id, x: w.x, y: w.y, w: w.w, h: w.h, minW: 2, minH: 3 }));

  return (
    <>
      <TopNav center={<span className="text-[13px] text-body">Reports</span>} notificationCount={4} />
      <div className="flex-1 bg-canvas overflow-y-auto scroll-thin p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Reports</h1>
            <p className="text-xs text-label mt-0.5">{items.length} backlog items · live from your workspace</p>
          </div>
          <div className="flex items-center gap-2 relative">
            <Button icon="summarize" variant="secondary" onClick={() => downloadCsv(items)} disabled={items.length === 0}>
              Export CSV
            </Button>
            <Button icon="add" onClick={() => setPicking((p) => !p)}>Add widget</Button>
            {picking && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setPicking(false)} />
                <div className="absolute right-0 top-11 z-50 w-[220px] bg-surface border-[0.5px] border-hairline rounded-frame shadow-pop overflow-hidden">
                  {WIDGET_LIBRARY.map((w) => (
                    <button
                      key={w.kind}
                      className="w-full text-left px-3 py-2.5 text-[13px] hover:bg-[#F4F3F0] border-b-[0.5px] border-hairline last:border-0"
                      onClick={() => onAdd(w)}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {error && <div className="text-[13px] text-danger mb-3">{error}</div>}

        {widgets.length === 0 ? (
          <div className="max-w-md rounded-frame border border-dashed border-hairline p-8 text-center">
            <div className="text-sm font-medium">No widgets yet</div>
            <p className="text-[13px] text-body mt-1">Add a widget to start building your dashboard.</p>
          </div>
        ) : (
          // useContainerWidth's ref type targets React 19's stricter RefObject<T | null>;
          // this project is on React 18, where <div ref> wants the older LegacyRef shape.
          <div ref={containerRef as RefObject<HTMLDivElement>}>
            {mounted && (
              <GridLayout
                width={width}
                layout={layout}
                gridConfig={GRID_CONFIG}
                dragConfig={{ handle: '.widget-drag-handle' }}
                onDragStop={onLayoutChange}
                onResizeStop={onLayoutChange}
              >
                {widgets.map((w) => (
                  <div key={w.id}>
                    <WidgetCard
                      widget={w}
                      onRename={(title) => actions.rename(w.id, title)}
                      onRemove={() => actions.remove(w.id)}
                    />
                  </div>
                ))}
              </GridLayout>
            )}
          </div>
        )}
      </div>
    </>
  );
}
