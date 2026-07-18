import { Link } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { Logo } from '@/components/ui/Logo';

const PLANS = [
  {
    name: 'Starter', price: '$0', per: 'forever',
    tagline: 'For small teams getting organized.',
    features: ['1 workspace', 'Up to 3 developers', 'Customer request portal', 'Public roadmap'],
    cta: 'Get started', highlight: false,
  },
  {
    name: 'Pro', price: '$29', per: 'per seat / mo',
    tagline: 'For growing product teams.',
    features: ['Everything in Starter', 'Sprints, RICE & prioritization', 'SLA tracking + automations', 'Asana & Slack sync'],
    cta: 'Start free trial', highlight: true,
  },
  {
    name: 'Enterprise', price: 'Custom', per: 'talk to us',
    tagline: 'For orgs with scale & compliance needs.',
    features: ['Everything in Pro', 'SSO / SAML', 'Analytics (Lens) + session replay', 'Dedicated support & SLA'],
    cta: 'Contact sales', highlight: false,
  },
];

/** Screen 58 — Marketing plans / pricing page. */
export function PlansScreen() {
  return (
    <div className="min-h-screen w-screen bg-canvas flex flex-col">
      <header className="h-16 flex-shrink-0 border-b-[0.5px] border-hairline bg-surface flex items-center justify-between px-8">
        <Link to="/plans" className="flex items-center gap-2.5">
          <Logo size={24} className="text-navy" />
          <span className="text-sm font-semibold tracking-tight">ProductHub</span>
        </Link>
        <Link to="/signin" className="text-[13px] font-medium text-navy">Sign in</Link>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-8 py-14">
        <div className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight">One backlog. Every team aligned.</h1>
          <p className="text-body mt-2 max-w-xl mx-auto">
            Customers, developers, and PMs on the same source of truth — from request to release.
            Simple pricing that scales with your team.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-5 mt-10">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={`rounded-frame border p-6 flex flex-col ${
                p.highlight ? 'border-navy shadow-pop bg-surface' : 'border-hairline bg-surface shadow-frame'
              }`}
            >
              {p.highlight && (
                <span className="self-start mb-3 inline-flex items-center h-5 px-2 rounded-full text-[10px] font-semibold bg-accent-bg text-accent uppercase tracking-wide">
                  Most popular
                </span>
              )}
              <div className="text-[15px] font-semibold">{p.name}</div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-3xl font-semibold tracking-tight">{p.price}</span>
                <span className="text-[12px] text-label">{p.per}</span>
              </div>
              <p className="text-[13px] text-body mt-1">{p.tagline}</p>
              <div className="flex flex-col gap-2.5 mt-5 flex-1">
                {p.features.map((f) => (
                  <div key={f} className="flex items-start gap-2 text-[13px]">
                    <Icon name="check" size={16} className="text-success mt-0.5 flex-shrink-0" />
                    {f}
                  </div>
                ))}
              </div>
              <Link
                to="/signin"
                className={`mt-6 h-10 rounded-control flex items-center justify-center text-sm font-medium ${
                  p.highlight ? 'bg-navy text-white hover:bg-[#152238]' : 'border-[0.5px] border-hairline hover:bg-[#F4F3F0]'
                }`}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </main>

      <footer className="h-14 flex items-center justify-center text-[11px] text-label border-t-[0.5px] border-hairline">
        © ProductHub — a product of Orion Cloud
      </footer>
    </div>
  );
}
