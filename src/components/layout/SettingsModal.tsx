import clsx from 'clsx';
import { Icon } from '@/components/ui/Icon';
import { useSettingsModalStore, type SettingsTab } from '@/features/settings/store';
import { BillingContent } from '@/screens/manager/BillingScreen';
import { TeamContent } from '@/screens/manager/TeamPerformanceScreen';
import { IntegrationsContent } from '@/screens/pm/IntegrationsScreen';

const TABS: { key: SettingsTab; label: string; icon: string }[] = [
  { key: 'billing', label: 'Billing', icon: 'credit_card' },
  { key: 'team', label: 'Team & Members', icon: 'groups' },
  { key: 'integrations', label: 'Integrations', icon: 'extension' },
];

/** Billing / Team & Members / Integrations, formerly permanent sidebar nav
 * items, now live behind this popup — reached from the Sidebar footer or
 * the TopNav profile menu. Reuses each screen's *Content component so the
 * actual UI isn't duplicated between the routed page and this modal. */
export function SettingsModal() {
  const open = useSettingsModalStore((s) => s.open);
  const tab = useSettingsModalStore((s) => s.tab);
  const openModal = useSettingsModalStore((s) => s.openModal);
  const close = useSettingsModalStore((s) => s.close);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-navy/40 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={close}
    >
      <div
        className="w-[920px] max-w-full h-[640px] max-h-[85vh] bg-surface rounded-frame shadow-pop flex overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-[200px] flex-shrink-0 bg-canvas border-r-[0.5px] border-hairline p-3 flex flex-col gap-0.5">
          <div className="px-2 py-2 text-sm font-semibold">Settings</div>
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => openModal(t.key)}
              className={clsx(
                'flex items-center gap-2.5 h-[32px] px-2.5 rounded-[7px] text-sm transition-colors',
                tab === t.key ? 'text-navy bg-accent-bg font-medium' : 'text-body hover:bg-[#F4F3F0]',
              )}
            >
              <Icon name={t.icon} size={18} className={tab === t.key ? 'text-accent' : 'text-label'} />
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 min-w-0 flex flex-col">
          <div className="h-12 flex-shrink-0 flex items-center justify-between px-5 border-b-[0.5px] border-hairline">
            <span className="text-sm font-semibold">{TABS.find((t) => t.key === tab)?.label}</span>
            <button onClick={close} className="text-label hover:text-body" aria-label="Close">
              <Icon name="close" size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto scroll-thin p-6">
            {tab === 'billing' && <BillingContent />}
            {tab === 'team' && <TeamContent />}
            {tab === 'integrations' && <IntegrationsContent />}
          </div>
        </div>
      </div>
    </div>
  );
}
