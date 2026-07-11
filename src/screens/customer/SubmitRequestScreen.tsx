import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Eyebrow } from '@/components/ui/Card';
import type { Priority, RequestType } from '@/types/domain';
import { useRequestsStore } from '@/features/requests/store';

const TYPES: { value: RequestType; label: string; icon: string }[] = [
  { value: 'bug', label: 'Bug', icon: 'bug_report' },
  { value: 'feature', label: 'Feature', icon: 'auto_awesome' },
  { value: 'query', label: 'Query', icon: 'help' },
];

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'low', label: 'Low · Minor issue' },
  { value: 'medium', label: 'Medium · Standard' },
  { value: 'high', label: 'High · Production impact' },
  { value: 'critical', label: 'Critical · Outage' },
];

const PRODUCTS = ['API Gateway', 'Platform', 'Reports', 'Infrastructure', 'Billing'];
const SLA_BY_PRIORITY: Record<Priority, string> = {
  low: 'first response within 3 business days',
  medium: 'first response within 1 business day',
  high: 'first response within 4h',
  critical: 'first response within 1h',
};

export function SubmitRequestScreen() {
  const navigate = useNavigate();
  const addRequest = useRequestsStore((s) => s.addRequest);
  const [type, setType] = useState<RequestType>('bug');
  const [subject, setSubject] = useState('API rate limit not applying to enterprise tier');
  const [description, setDescription] = useState(
    "Seeing 429s on the enterprise plan even though we're well under quota. Started after the Tuesday deploy.",
  );
  const [priority, setPriority] = useState<Priority>('high');
  const [product, setProduct] = useState('API Gateway');
  const [attachments, setAttachments] = useState([{ name: 'rate-limit-trace.har', size: '248 KB' }]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const created = addRequest({ type, subject, description, priority, product, attachments });
    navigate('/submitted', { state: { ref: created.ref, priority: created.priority } });
  }

  const fieldLabel = 'grid grid-cols-2 gap-6';

  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Submit a request</h1>
      <p className="text-sm text-body mt-1">
        Tell us what's happening — we'll route it to the right team and respond within your SLA.
      </p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-6">
        <div>
          <Eyebrow className="mb-2">Request type</Eyebrow>
          <div className="grid grid-cols-3 gap-3">
            {TYPES.map((t) => {
              const active = type === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={clsx(
                    'flex flex-col items-center justify-center gap-1.5 h-[72px] rounded-frame border transition-colors',
                    active
                      ? t.value === 'bug'
                        ? 'border-danger bg-danger-bg'
                        : 'border-navy bg-accent-bg'
                      : 'border-hairline bg-surface hover:bg-[#F4F3F0]',
                  )}
                >
                  <Icon
                    name={t.icon}
                    size={20}
                    className={active && t.value === 'bug' ? 'text-danger' : 'text-body'}
                  />
                  <span className="text-[13px] font-medium">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <label className="flex flex-col gap-2">
          <Eyebrow>Subject</Eyebrow>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="h-11 px-3 rounded-control border-[0.5px] border-hairline bg-surface text-sm outline-none focus:border-accent"
            required
          />
        </label>

        <label className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Eyebrow>Description</Eyebrow>
            <span className="inline-flex items-center gap-1 text-[11px] text-label">
              <Icon name="mic" size={14} /> Voice to text
            </span>
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="px-3 py-2.5 rounded-control border-[0.5px] border-hairline bg-surface text-sm outline-none focus:border-accent resize-none"
          />
        </label>

        <div className={fieldLabel}>
          <label className="flex flex-col gap-2">
            <Eyebrow>Priority</Eyebrow>
            <div className="relative">
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="w-full h-11 pl-3 pr-9 rounded-control border-[0.5px] border-hairline bg-surface text-sm outline-none focus:border-accent appearance-none"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
              <Icon
                name="expand_more"
                size={18}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-label pointer-events-none"
              />
            </div>
          </label>

          <label className="flex flex-col gap-2">
            <Eyebrow>Affected product</Eyebrow>
            <div className="relative">
              <select
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                className="w-full h-11 pl-3 pr-9 rounded-control border-[0.5px] border-hairline bg-surface text-sm outline-none focus:border-accent appearance-none"
              >
                {PRODUCTS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
              <Icon
                name="expand_more"
                size={18}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-label pointer-events-none"
              />
            </div>
          </label>
        </div>

        <div>
          <Eyebrow className="mb-2">Attachments</Eyebrow>
          <div className="flex items-center gap-2 flex-wrap">
            {attachments.map((a) => (
              <div
                key={a.name}
                className="flex items-center gap-2 h-11 px-3 rounded-control border-[0.5px] border-hairline bg-surface"
              >
                <Icon name="description" size={16} className="text-label" />
                <span className="text-[13px]">{a.name}</span>
                <span className="text-[11px] text-label">{a.size}</span>
                <button
                  type="button"
                  onClick={() => setAttachments((prev) => prev.filter((x) => x.name !== a.name))}
                  className="text-label hover:text-danger"
                >
                  <Icon name="close" size={15} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="flex items-center gap-1.5 h-11 px-3.5 rounded-control border border-dashed border-hairline text-[13px] text-body hover:bg-[#F4F3F0]"
            >
              <Icon name="add" size={16} /> Add file
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between border-t-[0.5px] border-hairline pt-5">
          <span className="inline-flex items-center gap-1.5 text-[13px] text-body">
            <Icon name="schedule" size={15} className="text-label" />
            <span className="capitalize">{priority} priority</span> · {SLA_BY_PRIORITY[priority]}
          </span>
          <Button type="submit">Submit request</Button>
        </div>
      </form>
    </div>
  );
}
