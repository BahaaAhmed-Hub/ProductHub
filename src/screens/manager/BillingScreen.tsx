import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TopNav } from '@/components/layout/TopNav';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Tag';
import { Icon } from '@/components/ui/Icon';
import { useBillingStatus, useBillingActions, type PlanTier } from '@/features/billing';

const PLANS: { tier: PlanTier; name: string; price: string; per: string; features: string[] }[] = [
  { tier: 'free', name: 'Starter', price: '$0', per: 'forever', features: ['1 workspace', 'Up to 3 developers', 'Customer request portal', 'Public roadmap'] },
  { tier: 'pro', name: 'Pro', price: '$29', per: 'per seat / mo', features: ['Everything in Starter', 'Sprints, RICE & prioritization', 'SLA tracking + automations', 'Asana & Slack sync'] },
  { tier: 'enterprise', name: 'Enterprise', price: 'Custom', per: 'talk to us', features: ['Everything in Pro', 'SSO / SAML', 'Analytics (Lens) + session replay', 'Dedicated support & SLA'] },
];

const PLAN_LABEL: Record<PlanTier, string> = { free: 'Starter', pro: 'Pro', enterprise: 'Enterprise' };

function formatDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Settings → Billing: current plan/status (read live from Stripe — see
 * stripe-status), plan selection via Checkout, and "Manage billing" for
 * everything else (payment method, invoice history + PDF downloads, plan
 * changes, cancellation) via Stripe's hosted Billing Portal. */
export function BillingScreen() {
  const { billing, isLoading } = useBillingStatus();
  const actions = useBillingActions();
  const [params, setParams] = useSearchParams();
  const [busyTier, setBusyTier] = useState<PlanTier | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkoutResult = params.get('checkout');

  useEffect(() => {
    if (!checkoutResult) return;
    if (checkoutResult === 'success') actions.refresh();
    const next = new URLSearchParams(params);
    next.delete('checkout');
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutResult]);

  async function onChoose(tier: PlanTier) {
    if (tier === 'free') return;
    setError(null);
    setBusyTier(tier);
    try {
      await actions.checkout(tier);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start checkout.');
      setBusyTier(null);
    }
  }

  async function onManage() {
    setError(null);
    setPortalBusy(true);
    try {
      await actions.openPortal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open the billing portal.');
      setPortalBusy(false);
    }
  }

  return (
    <>
      <TopNav center={<span className="text-[13px] text-body">Billing</span>} notificationCount={4} />
      <div className="flex-1 bg-canvas overflow-y-auto scroll-thin p-6">
        <h1 className="text-lg font-semibold tracking-tight">Billing & subscription</h1>
        <p className="text-xs text-label mt-0.5 mb-5">Manage your plan, payment method, and invoices.</p>

        {checkoutResult === 'success' && (
          <div className="max-w-3xl mb-4 flex items-center gap-2 px-4 py-2.5 rounded-control bg-success-bg text-success text-[13px]">
            <Icon name="check_circle" size={16} /> Subscription updated.
          </div>
        )}
        {error && <div className="max-w-3xl mb-4 text-[13px] text-danger">{error}</div>}

        <Card className="p-5 max-w-3xl mb-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-semibold">Current plan</span>
                {isLoading ? <span className="text-[12px] text-label">Loading…</span> : <Tag tone={billing.plan === 'free' ? 'neutral' : 'success'}>{PLAN_LABEL[billing.plan]}</Tag>}
              </div>
              {billing.status && (
                <p className="text-[12px] text-body mt-1">
                  {billing.cancelAtPeriodEnd ? `Cancels on ${formatDate(billing.currentPeriodEnd)}` : `Renews on ${formatDate(billing.currentPeriodEnd)}`}
                </p>
              )}
            </div>
            {billing.plan !== 'free' && (
              <Button variant="secondary" icon="tune" disabled={portalBusy} onClick={onManage}>
                {portalBusy ? 'Opening…' : 'Manage billing'}
              </Button>
            )}
          </div>
          {billing.plan !== 'free' && (
            <p className="text-[11px] text-label mt-3">
              Payment method, invoice history, and plan changes or cancellation are all handled in the billing portal.
            </p>
          )}
        </Card>

        <div className="grid grid-cols-3 gap-4 max-w-3xl">
          {PLANS.map((p) => {
            const isCurrent = billing.plan === p.tier;
            return (
              <Card key={p.tier} className={`p-5 flex flex-col ${isCurrent ? 'border-navy' : ''}`}>
                <div className="text-[14px] font-semibold">{p.name}</div>
                <div className="mt-1.5 flex items-baseline gap-1">
                  <span className="text-2xl font-semibold tracking-tight">{p.price}</span>
                  <span className="text-[11px] text-label">{p.per}</span>
                </div>
                <div className="flex flex-col gap-2 mt-4 flex-1">
                  {p.features.map((f) => (
                    <div key={f} className="flex items-start gap-1.5 text-[12px]">
                      <Icon name="check" size={14} className="text-success mt-0.5 flex-shrink-0" />
                      {f}
                    </div>
                  ))}
                </div>
                {isCurrent ? (
                  <Button variant="secondary" disabled className="mt-5">Current plan</Button>
                ) : p.tier === 'free' ? (
                  <Button variant="ghost" disabled className="mt-5">Downgrade via portal</Button>
                ) : (
                  <Button disabled={busyTier !== null} onClick={() => onChoose(p.tier)} className="mt-5">
                    {busyTier === p.tier ? 'Redirecting…' : `Choose ${p.name}`}
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </>
  );
}
