import { CheckCircle2, Circle, AlertCircle, Clock } from 'lucide-react';

const STATUS_CONFIG = {
  complete: {
    icon: CheckCircle2,
    barColor: 'bg-teal',
    dotColor: 'bg-teal border-teal',
    textColor: 'text-teal',
    label: 'Complete',
  },
  'in-progress': {
    icon: Clock,
    barColor: 'bg-gold',
    dotColor: 'bg-gold border-gold',
    textColor: 'text-gold',
    label: 'In Progress',
  },
  overdue: {
    icon: AlertCircle,
    barColor: 'bg-accent',
    dotColor: 'bg-accent border-accent',
    textColor: 'text-accent',
    label: 'Overdue',
  },
  remaining: {
    icon: Circle,
    barColor: 'bg-border',
    dotColor: 'bg-paper border-border',
    textColor: 'text-ink-muted',
    label: 'Remaining',
  },
};

function getConfig(status) {
  return STATUS_CONFIG[status] || STATUS_CONFIG.remaining;
}

export default function RoadmapSteps({ steps = [] }) {
  if (!steps.length) {
    return (
      <p className="text-sm text-ink-muted italic">No roadmap steps generated yet.</p>
    );
  }

  const complete = steps.filter(s => s.status === 'complete').length;
  const pct = Math.round((complete / steps.length) * 100);

  return (
    <div className="space-y-4">
      {/* progress bar */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold font-display text-ink-muted uppercase tracking-wider">
            Progress
          </span>
          <span className="text-xs font-bold font-display">{pct}%</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill bg-teal" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* steps */}
      <ol className="relative space-y-0">
        {steps.map((step, idx) => {
          const cfg = getConfig(step.status);
          const Icon = cfg.icon;
          const isLast = idx === steps.length - 1;

          return (
            <li key={step.id || idx} className="relative flex gap-4 pb-4">
              {/* vertical line */}
              {!isLast && (
                <div className={`absolute left-[11px] top-6 w-0.5 bottom-0 ${cfg.barColor} opacity-30`} />
              )}

              {/* dot */}
              <div className={`mt-0.5 shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center z-10 ${cfg.dotColor}`}>
                <Icon size={12} strokeWidth={2.5} className="text-white" />
              </div>

              {/* content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold leading-snug">{step.title}</p>
                  {step.dueDate && (
                    <span className="text-xs text-ink-muted whitespace-nowrap shrink-0">{step.dueDate}</span>
                  )}
                </div>
                {step.notes && (
                  <p className="text-xs text-ink-muted mt-0.5 leading-relaxed line-clamp-2">{step.notes}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}