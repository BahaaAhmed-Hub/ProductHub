import { useNavigate } from 'react-router-dom';
import { TopNav } from '@/components/layout/TopNav';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';

const MODELS = [
  { key: 'rice', name: 'RICE', desc: 'Reach × Impact × Confidence ÷ Effort', icon: 'insights', to: '/backlog' },
  { key: 'wsjf', name: 'WSJF', desc: 'Weighted Shortest Job First', icon: 'trending_up', to: '/prioritize/wsjf' },
  { key: 'moscow', name: 'MoSCoW', desc: 'Must / Should / Could / Won\'t', icon: 'view_kanban', to: '/prioritize/moscow' },
  { key: 've', name: 'Value vs Effort', desc: '2×2 impact/effort matrix', icon: 'category', to: '/prioritize/value-effort' },
  { key: 'custom', name: 'Custom model', desc: 'Your own weighted formula', icon: 'tune', to: '/prioritize/custom' },
  { key: 'results', name: 'Results', desc: 'Ranked output across models', icon: 'format_list_bulleted', to: '/prioritize/results' },
];

/** Screen 50 — Prioritization hub. */
export function PrioritizationHub() {
  const navigate = useNavigate();
  return (
    <>
      <TopNav center={<span className="text-[13px] text-body">Prioritization</span>} notificationCount={4} />
      <div className="flex-1 bg-canvas overflow-y-auto scroll-thin p-6">
        <h1 className="text-lg font-semibold tracking-tight">Prioritization</h1>
        <p className="text-xs text-label mt-0.5 mb-5">Score the backlog with the model that fits the decision.</p>
        <div className="grid grid-cols-3 gap-4 max-w-4xl">
          {MODELS.map((m) => (
            <Card
              key={m.key}
              onClick={() => navigate(m.to)}
              className="p-5 cursor-pointer hover:shadow-pop transition-shadow"
            >
              <div className="w-10 h-10 rounded-[12px] bg-pm-bg flex items-center justify-center mb-3">
                <Icon name={m.icon} size={20} className="text-pm" />
              </div>
              <div className="text-[15px] font-semibold">{m.name}</div>
              <div className="text-[12px] text-body mt-1">{m.desc}</div>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
