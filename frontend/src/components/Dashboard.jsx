import { useState } from 'react';
import TargetModal from './TargetModal';
import RoadmapMermaid from './RoadmapMermaid';

const statusToStyle = {
  complete: 'border-emerald-500 text-emerald-300',
  'in-progress': 'border-amber-400 text-amber-200',
  remaining: 'border-orange-500 text-orange-200',
  overdue: 'border-red-500 text-red-200',
};

export default function Dashboard({ data, onCreateTarget, loading, onOpenExam }) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-cyan-200">Adaptive Home</h2>
          <p className="text-slate-300">{data?.profile?.virtualClusterTag || 'Unclustered'} | {data?.profile?.lastExtensionInsight || 'No extension insight yet.'}</p>
        </div>

        <div className="flex gap-3">
          <button onClick={onOpenExam} className="rounded-xl border border-fuchsia-500 px-4 py-2 text-fuchsia-200">Proctored Exam</button>
          <button onClick={() => setModalOpen(true)} className="rounded-xl bg-cyan-500 px-4 py-2 font-semibold text-slate-950">
            {data?.isNewUser ? 'Add Target' : 'New Target'}
          </button>
        </div>
      </div>

      {!data?.targets?.length ? (
        <div className="rounded-3xl border border-cyan-900/70 bg-slate-900/70 p-8 text-center text-slate-300">
          No targets yet. Add your first target to generate an adaptive roadmap.
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {data.targets.map((target) => (
            <article key={target._id} className="rounded-3xl border border-slate-700 bg-slate-900/70 p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold text-slate-100">{target.targetName}</h3>
                  <p className="text-sm text-slate-400">Timeline: {target.timeline}</p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusToStyle[target.status] || statusToStyle.remaining}`}>
                  {target.status}
                </span>
              </div>

              <p className="text-slate-300 text-sm">{target.description}</p>
              <RoadmapMermaid steps={target.roadmap || []} chartId={target._id} />
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
