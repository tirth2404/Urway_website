import { useState } from 'react';
import TargetModal from './TargetModal';
import RoadmapSteps from './RoadmapSteps';
import { Plus, FlaskConical, Tag, Clock, BookOpen } from 'lucide-react';

const statusStyle = {
  complete: 'bg-teal-light border-teal text-teal',
  'in-progress': 'bg-gold-light border-gold text-ink',
  remaining: 'bg-paper-warm border-border text-ink-muted',
  overdue: 'bg-red-50 border-red-400 text-red-600',
};

function StatusBadge({ status }) {
  const s = statusStyle[status] || statusStyle.remaining;
  return (
    <span className={`inline-flex items-center rounded-full border-2 px-3 py-0.5 text-xs font-semibold font-display capitalize ${s}`}>
      {status}
    </span>
  );
}

export default function Dashboard({ data, onCreateTarget, loading, onOpenExam }) {
  const [modalOpen, setModalOpen] = useState(false);

  const targets = data?.targets || [];
  const clusterTag = data?.profile?.virtualClusterTag || 'Unclassified';
  const insight = data?.profile?.lastExtensionInsight;

  return (
    <div className="space-y-10">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
        <div>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted mb-1">
            Your dashboard
          </p>
          <h1 className="font-display text-4xl font-bold">Adaptive Home</h1>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="tag active">
              <Tag size={11} className="mr-1" />
              {clusterTag}
            </span>
            {insight && (
              <span className="tag text-ink-muted border-border">
                {insight}
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-3 shrink-0">
          <button
            onClick={onOpenExam}
            className="btn-pill text-sm gap-2"
          >
            <FlaskConical size={15} /> Proctored Exam
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="btn-pill-accent text-sm gap-2"
          >
            <Plus size={15} /> New Target
          </button>
        </div>
      </div>

      {/* ── Stats row ──────────────────────────────────── */}
      {targets.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Targets', value: targets.length, icon: BookOpen, color: 'card-brutal' },
            { label: 'In Progress', value: targets.filter(t => t.status === 'in-progress').length, icon: Clock, color: 'card-gold' },
            { label: 'Completed', value: targets.filter(t => t.status === 'complete').length, icon: FlaskConical, color: 'card-teal' },
            {
              label: 'Total Steps',
              value: targets.reduce((acc, t) => acc + (t.roadmap?.length || 0), 0),
              icon: Tag,
              color: 'card-accent'
            },
          ].map((stat, i) => (
            <div key={i} className={`${stat.color} p-5 rounded-3xl`}>
              <div className="flex items-center gap-2 mb-2">
                <stat.icon size={14} strokeWidth={2} className="text-ink-muted" />
                <p className="text-xs font-semibold text-ink-muted font-display uppercase tracking-wider">{stat.label}</p>
              </div>
              <p className="font-display text-3xl font-bold">{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Target cards ───────────────────────────────── */}
      {targets.length === 0 ? (
        <div className="card-brutal p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-3xl border-2 border-ink bg-paper-warm flex items-center justify-center mx-auto shadow-brutal-sm">
            <BookOpen size={28} strokeWidth={1.5} />
          </div>
          <h3 className="font-display text-2xl font-bold">No targets yet</h3>
          <p className="text-ink-muted max-w-sm mx-auto text-sm leading-relaxed">
            Add your first target and we'll generate a personalized AI roadmap to get you there.
          </p>
          <button
            onClick={() => setModalOpen(true)}
            className="btn-pill-accent mx-auto"
          >
            <Plus size={15} /> Create your first target
          </button>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {targets.map((target) => (
            <article key={target._id} className="card-brutal p-6 space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-display text-xl font-bold leading-tight truncate">{target.targetName}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Clock size={12} className="text-ink-muted shrink-0" />
                    <p className="text-sm text-ink-muted">{target.timeline}</p>
                  </div>
                </div>
                <StatusBadge status={target.status || 'remaining'} />
              </div>

              {target.description && (
                <p className="text-sm text-ink-muted leading-relaxed line-clamp-2">{target.description}</p>
              )}

              <RoadmapSteps steps={target.roadmap || []} />
            </article>
          ))}
        </div>
      )}

      <TargetModal
        open={modalOpen}
        loading={loading}
        onClose={() => setModalOpen(false)}
        onCreate={async (form) => {
          await onCreateTarget(form);
          setModalOpen(false);
        }}
      />
    </div>
  );
}