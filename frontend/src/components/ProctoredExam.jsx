import { useEffect, useState } from 'react';
import { ArrowLeft, ShieldCheck, ShieldX, Play, AlertTriangle } from 'lucide-react';

export default function ProctoredExam({ apiBaseUrl, userId, onBack }) {
  const [sourceText, setSourceText] = useState('https://youtube.com/watch?v=example');
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState('idle');

  const sourceMaterial = sourceText
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  const terminateWithReason = async (reason, url = '') => {
    if (!session?._id) return;
    await fetch(`${apiBaseUrl}/api/exam/flag/${session._id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason, url }),
    });
    setStatus(`terminated:${reason}`);
  };

  useEffect(() => {
    if (!session?._id || status.startsWith('terminated')) return;

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') terminateWithReason('Tab switched or browser left');
    };
    const onBlur = () => terminateWithReason('Window blur detected');
    const onMessage = (e) => {
      if (e?.data?.type === 'AI_SITE_DETECTED') terminateWithReason('AI site detected from extension', e.data.url || '');
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    window.addEventListener('message', onMessage);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('message', onMessage);
    };
  }, [session, status]);

  const startExam = async () => {
    setStatus('starting');
    try {
      const res = await fetch(`${apiBaseUrl}/api/exam/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, sourceMaterial }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Failed to start exam'); setStatus('idle'); return; }
      setSession(data);
      setStatus('active');
    } catch {
      alert('Failed to start exam. Check your connection.');
      setStatus('idle');
    }
  };

  const isTerminated = status.startsWith('terminated');

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="btn-pill text-sm gap-2">
          <ArrowLeft size={15} /> Back
        </button>
        <div>
          <h2 className="font-display text-3xl font-bold">Proctored Exam</h2>
          <p className="text-ink-muted text-sm mt-0.5">AI-generated questions with integrity monitoring</p>
        </div>
      </div>

      {/* Setup phase */}
      {!session && (
        <div className="card-brutal p-6 space-y-5">
          <div className="flex items-start gap-4 p-4 rounded-2xl bg-gold-light border-2 border-gold">
            <AlertTriangle size={18} className="text-gold shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold mb-1">Before you begin</p>
              <p className="text-ink-muted leading-relaxed">
                During the exam, switching tabs, blurring the window, or visiting AI sites (ChatGPT, Gemini, Claude, etc.) will immediately terminate your session.
              </p>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-widest font-display block mb-2">
              Study Sources
            </label>
            <p className="text-sm text-ink-muted mb-3">Paste YouTube links, article URLs, or topic descriptions — one per line.</p>
            <textarea
              value={sourceText}
              onChange={e => setSourceText(e.target.value)}
              rows={5}
              className="input-field resize-none font-mono text-xs"
            />
          </div>

          <button
            onClick={startExam}
            disabled={status === 'starting'}
            className="btn-pill-accent w-full justify-center py-3.5 text-base disabled:opacity-60"
          >
            {status === 'starting' ? (
              <><span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Generating questions…</>
            ) : (
              <><Play size={16} /> Start Exam</>
            )}
          </button>
        </div>
      )}

      {/* Active / terminated */}
      {session && (
        <div className="space-y-5">
          {/* Status banner */}
          {isTerminated ? (
            <div className="flex items-start gap-4 p-5 rounded-3xl border-2 border-accent bg-accent-light">
              <ShieldX size={22} className="text-accent shrink-0 mt-0.5" />
              <div>
                <p className="font-display font-bold text-lg">Session Terminated</p>
                <p className="text-ink-muted text-sm mt-1">
                  Your exam was flagged and ended. Reason: <em>{status.replace('terminated:', '')}</em>
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-4 p-5 rounded-3xl border-2 border-teal bg-teal-light">
              <ShieldCheck size={22} className="text-teal shrink-0 mt-0.5" />
              <div>
                <p className="font-display font-bold text-lg">Proctoring Active</p>
                <p className="text-ink-muted text-sm mt-1">
                  Stay focused. Do not switch tabs, blur the window, or open AI tools.
                </p>
              </div>
            </div>
          )}

          {/* Questions */}
          <div className="card-brutal p-6 space-y-5">
            <h3 className="font-display text-xl font-bold">Generated Questions</h3>
            <ol className="space-y-4">
              {(session.generatedQuestions || []).map((q, idx) => (
                <li key={idx} className="flex gap-4">
                  <span className="font-display text-2xl font-bold text-border shrink-0 leading-none mt-1">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <p className="text-sm leading-relaxed pt-1">{q}</p>
                </li>
              ))}
            </ol>
          </div>

          {isTerminated && (
            <button onClick={onBack} className="btn-pill w-full justify-center">
              Return to dashboard
            </button>
          )}
        </div>
      )}
    </div>
  );
}