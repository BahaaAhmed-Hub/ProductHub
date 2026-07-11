import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { MOCK_NOTIFICATIONS } from '@/features/requests/mockData';

/** Notification bell + dropdown (customer top nav). Screen 04 open state. */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(MOCK_NOTIFICATIONS);
  const ref = useRef<HTMLDivElement>(null);
  const unread = items.filter((n) => n.unread).length;

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative w-[30px] h-[30px] rounded-[7px] flex items-center justify-center hover:bg-[#F4F3F0]"
        aria-label="Notifications"
      >
        <Icon name="notifications" size={19} className="text-body" />
        {unread > 0 && (
          <span className="absolute top-[3px] right-[3px] min-w-3.5 h-3.5 px-1 rounded-full bg-accent text-white text-[8px] font-bold flex items-center justify-center border-[1.5px] border-surface">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[38px] w-[300px] bg-surface border-[0.5px] border-hairline rounded-frame shadow-pop overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 h-11 border-b-[0.5px] border-hairline">
            <span className="text-sm font-semibold">Notifications</span>
            <button
              className="text-xs text-accent"
              onClick={() => setItems((prev) => prev.map((n) => ({ ...n, unread: false })))}
            >
              Mark all read
            </button>
          </div>
          <div className="max-h-80 overflow-auto scroll-thin">
            {items.map((n) => (
              <div
                key={n.id}
                className="flex items-start gap-2.5 px-4 py-3 border-b-[0.5px] border-hairline last:border-0 hover:bg-[#F7F7F5]"
              >
                <span
                  className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    n.unread ? 'bg-accent' : 'bg-transparent'
                  }`}
                />
                <div className="min-w-0">
                  <div className="text-[13px] leading-snug">{n.body}</div>
                  <div className="text-[11px] text-label mt-0.5">{n.timeAgo}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
