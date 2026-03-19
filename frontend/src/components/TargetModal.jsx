import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';

const defaultForm = {
  targetName: '',
  timeline: '8 weeks',
  priorKnowledge: 5,
  description: '',
};

export default function TargetModal({ open, onClose, onCreate, loading }) {
  const [form, setForm] = useState(defaultForm);

  useEffect(() => {
    if (open) setForm(defaultForm);
  }, [open]);

  if (!open) return null;

  const handleChange = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.targetName.trim()) return;
    await onCreate(form);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg bg-paper rounded-4xl border-2 border-ink shadow-brutal-lg overflow-hidden">
        {/* header */}
        <div className="flex items-center justify-between px-6 py-5 border-b-2 border-ink bg-paper-warm">
          <div>
            <h2 className="font-display text-2xl font-bold">Create Target</h2>
            <p className="text-ink-muted text-sm mt-0.5">We'll generate an AI roadmap from this.</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full border-2 border-ink flex items-center justify-center hover:bg-ink hover:text-paper transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest font-display block mb-2">
              Target Name <span className="text-accent">*</span>
            </label>
            <input
              required
              value={form.targetName}
              onChange={e => handleChange('targetName', e.target.value)}
              placeholder="e.g. Learn Full-Stack Development"
              className="input-field"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-widest font-display block mb-2">
              Timeline
            </label>
            <input
              required
              value={form.timeline}
              onChange={e => handleChange('timeline', e.target.value)}
              placeholder="e.g. 8 weeks, 3 months"
              className="input-field"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-widest font-display">
                Prior Knowledge
              </label>
              <span className="font-display font-bold text-lg">{form.priorKnowledge}<span className="text-ink-muted text-sm font-normal">/10</span></span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={form.priorKnowledge}
              onChange={e => handleChange('priorKnowledge', Number(e.target.value))}
              className="range-ink w-full"
            />
            <div className="flex justify-between text-xs text-ink-muted mt-1">
              <span>Beginner</span>
              <span>Expert</span>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-widest font-display block mb-2">
              Description <span className="text-accent">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={form.description}
              onChange={e => handleChange('description', e.target.value)}
              placeholder="Describe what you want to achieve and why..."
              className="input-field resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-pill flex-1 justify-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !form.targetName.trim()}
              className="btn-pill-accent flex-1 justify-center disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <><Loader2 size={15} className="animate-spin" /> Generating…</>
              ) : 'Generate Roadmap'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}