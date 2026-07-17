import { useEffect, useState } from 'react';
import { useItemPanel } from '@/features/board/panelStore';
import { ItemDetailBody } from './ItemDetailBody';

/**
 * Global Asana-style slide-over: opened via useItemPanel().open(id) from any
 * list/board/swimlane row. Overlays the current screen (which stays mounted
 * and untouched underneath) rather than navigating away from it. Click the
 * backdrop, press Escape, or hit the close button to return to that screen.
 * Mounted once in AppShell so it works across every internal-role screen.
 */
export function ItemDetailPanel() {
  const openItemId = useItemPanel((s) => s.openItemId);
  const close = useItemPanel((s) => s.close);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!openItemId) {
      setVisible(false);
      return;
    }
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, [openItemId]);

  useEffect(() => {
    if (!openItemId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openItemId, close]);

  if (!openItemId) return null;

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/20 transition-opacity duration-200 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={close}
      />
      <div
        className={`fixed top-0 right-0 bottom-0 z-50 w-[35vw] min-w-[420px] max-w-[720px] bg-surface shadow-pop border-l-[0.5px] border-hairline transition-transform duration-200 ease-out ${
          visible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <ItemDetailBody itemId={openItemId} onClose={close} />
      </div>
    </>
  );
}
