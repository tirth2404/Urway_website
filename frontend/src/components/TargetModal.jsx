import { useState } from 'react';

const defaultForm = {
  targetName: '',
  timeline: '8 weeks',
  priorKnowledge: 5,
  description: '',
};

export default function TargetModal({ open, onClose, onCreate, loading }) {
  const [form, setForm] = useState(defaultForm);

  if (!open) return null;

  const handleChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    await onCreate(form);
    setForm(defaultForm);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-lg rounded-3xl border border-cyan-800 bg-slate-900 p-6 shadow-[0_0_40px_rgba(34,211,238,0.2)] space-y-4">
        <h3 className="text-2xl font-bold text-cyan-200">Create Target</h3>

        <div>
          <label className="text-sm text-slate-300">Target Name</label>
          <input required value={form.targetName} onChange={(e) => handleChange('targetName', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2" />
        </div>

        <div>
          <label className="text-sm text-slate-300">Timeline</label>
          <input required value={form.timeline} onChange={(e) => handleChange('timeline', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2" />
        </div>

        <div>
          <label className="text-sm text-slate-300">Prior Knowledge: {form.priorKnowledge}</label>
          <input type="range" min="1" max="10" value={form.priorKnowledge} onChange={(e) => handleChange('priorKnowledge', Number(e.target.value))} className="mt-2 w-full" />
        </div>

        <div>
          <label className="text-sm text-slate-300">Description</label>
          <textarea required rows={4} value={form.description} onChange={(e) => handleChange('description', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2" />
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-600 px-4 py-2">Cancel</button>
          <button disabled={loading} type="submit" className="rounded-xl bg-cyan-500 px-4 py-2 font-semibold text-slate-950 disabled:opacity-60">
            {loading ? 'Generating...' : 'Generate Roadmap'}
          </button>
        </div>
      </form>
    </div>
  );
}
