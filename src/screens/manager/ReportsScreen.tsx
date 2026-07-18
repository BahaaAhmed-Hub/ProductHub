import { useState, type FormEvent, type RefObject } from 'react';
import clsx from 'clsx';
import { GridLayout, useContainerWidth, type Layout, type LayoutItem } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import { TopNav } from '@/components/layout/TopNav';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useBoardItems } from '@/features/board/hooks';
import {
  useReportWidgets, useReportWidgetActions, WIDGET_LIBRARY, CHART_SWITCHABLE_KINDS,
  type ReportWidget, type ChartType,
} from '@/features/reports';
import { WidgetContent } from '@/features/reports/widgets';
import type { BoardItem } from '@/features/board/types';

const GRID_CONFIG = { cols: 12, rowHeight: 32, margin: [16, 16] as const };

const CHART_TYPES: { type: ChartType; icon: string; label: string }[] = [
  { type: 'bar', icon: 'bar_chart', label: 'Bar' },
  { type: 'pie', icon: 'pie_chart', label: 'Pie' },
  { type: 'list', icon: 'format_list_bulleted', label: 'Ranked list' },
  { type: 'number', icon: 'numbers', label: 'Number' },
];

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
  onChangeChartType,
}: {
  widget: ReportWidget;
  onRename: (title: string) => void;
  onRemove: () => void;
  onChangeChartType: (type: ChartType) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(widget.title);
  const [pickingChart, setPickingChart] = useState(false);
  const switchable = CHART_SWITCHABLE_KINDS.includes(widget.kind);

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
        {switchable && (
          <div className="relative flex-shrink-0">
            <button
              className="text-label hover:text-accent"
              onClick={(e) => { e.stopPropagation(); setPickingChart((p) => !p); }}
              onMouseDown={(e) => e.stopPropagation()}
              aria-label="Change chart type"
              title="Change chart type"
            >
              <Icon name={CHART_TYPES.find((c) => c.type === widget.chartType)?.icon ?? 'bar_chart'} size={15} />
            </button>
            {pickingChart && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setPickingChart(false)} onMouseDown={(e) => e.stopPropagation()} />
                <div
                  className="absolute right-0 top-6 z-50 w-[150px] bg-surface border-[0.5px] border-hairline rounded-frame shadow-pop overflow-hidden"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {CHART_TYPES.map((c) => (
                    <button
                      key={c.type}
                      className={clsx(
                        'w-full flex items-center gap-2 text-left px-3 py-2 text-[12px] hover:bg-[#F4F3F0]',
                        c.type === widget.chartType && 'text-accent font-medium',
                      )}
                      onClick={() => { onChangeChartType(c.type); setPickingChart(false); }}
                    >
                      <Icon name={c.icon} size={14} /> {c.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
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
        <WidgetContent widget={widget} />
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
  const [showCustom, setShowCustom] = useState(false);
  const [customDescription, setCustomDescription] = useState('');
  const [customChartType, setCustomChartType] = useState<ChartType>('bar');
  const [customBusy, setCustomBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { width, containerRef, mounted } = useContainerWidth();

  const addedKinds = new Set(widgets.map((w) => w.kind));

  function nextY(): number {
    return widgets.length === 0 ? 0 : Math.max(...widgets.map((w) => w.y + w.h));
  }

  async function onAdd(kind: (typeof WIDGET_LIBRARY)[number]) {
    if (addedKinds.has(kind.kind)) return;
    setPicking(false);
    setError(null);
    try {
      await actions.add(kind.kind, kind.defaultTitle, { x: 0, y: nextY(), w: 4, h: 4 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add widget.');
    }
  }

  async function onAddCustom(e: FormEvent) {
    e.preventDefault();
    const description = customDescription.trim();
    if (!description) return;
    setCustomBusy(true);
    setError(null);
    try {
      await actions.addCustom(description, customChartType, { x: 0, y: nextY(), w: 4, h: 4 });
      setShowCustom(false);
      setCustomDescription('');
      setCustomChartType('bar');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate that widget.');
    } finally {
      setCustomBusy(false);
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
                <div className="absolute right-0 top-11 z-50 w-[240px] bg-surface border-[0.5px] border-hairline rounded-frame shadow-pop overflow-hidden">
                  {WIDGET_LIBRARY.map((w) => {
                    const added = addedKinds.has(w.kind);
                    return (
                      <button
                        key={w.kind}
                        disabled={added}
                        className={clsx(
                          'w-full flex items-center justify-between text-left px-3 py-2.5 text-[13px] border-b-[0.5px] border-hairline last:border-0',
                          added ? 'text-label cursor-default' : 'hover:bg-[#F4F3F0]',
                        )}
                        onClick={() => onAdd(w)}
                      >
                        {w.label}
                        {added && <Icon name="check" size={14} className="text-label" />}
                      </button>
                    );
                  })}
                  <button
                    className="w-full flex items-center gap-2 text-left px-3 py-2.5 text-[13px] text-accent font-medium hover:bg-[#F4F3F0]"
                    onClick={() => { setPicking(false); setShowCustom(true); }}
                  >
                    <Icon name="auto_fix" size={14} /> Custom widget (AI)…
                  </button>
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
                      onChangeChartType={(type) => actions.changeChartType(w.id, type)}
                    />
                  </div>
                ))}
              </GridLayout>
            )}
          </div>
        )}
      </div>

      {showCustom && (
        <div
          className="fixed inset-0 z-[100] bg-navy/40 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => !customBusy && setShowCustom(false)}
        >
          <div
            className="w-[420px] bg-surface rounded-frame shadow-pop p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-1">
              <Icon name="auto_fix" size={16} className="text-accent" />
              <span className="text-[15px] font-semibold">Custom widget</span>
            </div>
            <p className="text-[12.5px] text-label mb-3">
              Describe what you want to see — AI picks the data, you pick how it's drawn.
            </p>
            <form onSubmit={onAddCustom} className="flex flex-col gap-3">
              <textarea
                autoFocus
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
                placeholder="e.g. Critical bugs by assignee, or average estimated hours per module"
                rows={3}
                className="w-full px-3 py-2 rounded-control border-[0.5px] border-hairline bg-canvas text-[13px] outline-none focus:border-accent resize-none"
              />
              <div className="flex items-center gap-1.5">
                {CHART_TYPES.map((c) => (
                  <button
                    key={c.type}
                    type="button"
                    onClick={() => setCustomChartType(c.type)}
                    className={clsx(
                      'flex items-center gap-1.5 px-2.5 h-8 rounded-control border-[0.5px] text-[12px]',
                      customChartType === c.type
                        ? 'border-accent bg-accent-bg text-navy font-medium'
                        : 'border-hairline text-body hover:bg-[#F4F3F0]',
                    )}
                  >
                    <Icon name={c.icon} size={14} /> {c.label}
                  </button>
                ))}
              </div>
              {error && <div className="text-[12px] text-danger">{error}</div>}
              <div className="flex items-center gap-2 mt-1">
                <Button type="submit" className="flex-1" disabled={customBusy || !customDescription.trim()}>
                  {customBusy ? 'Generating…' : 'Add widget'}
                </Button>
                <Button type="button" variant="ghost" disabled={customBusy} onClick={() => setShowCustom(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
