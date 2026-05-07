import { useEffect, useState } from 'react';
import { ArrowLeft, ShieldCheck, ShieldX, Play, AlertTriangle } from 'lucide-react';
import { api } from '../utils/apiClient';

export default function ProctoredExam({ userId, targetId, onBack }) {
  const [sourceText, setSourceText] = useState('https://youtube.com/watch?v=example');
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState('idle');
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);

  const sourceMaterial = sourceText
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  const terminateWithReason = async (reason, url = '') => {
    if (!session?._id) return;
    try {
      await api.post(`/api/exam/flag/${session._id}`, { reason, url });
    } catch {
      // Keep local termination state even if the network call fails.
    }
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
      const res = await api.post('/api/exam/start', { userId, targetId, sourceMaterial });
      if (!res) { setStatus('idle'); return; }
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

          {/* Interactive MCQ Quiz */}
          <div className="card-brutal p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-bold">Question {currentQIndex + 1} of {(session.generatedQuestions || []).length}</h3>
            </div>
            
            {session.generatedQuestions && session.generatedQuestions.length > 0 && typeof session.generatedQuestions[0] === 'object' ? (
              <div className="space-y-6">
                <div className="flex gap-4">
                  <span className="font-display text-2xl font-bold text-border shrink-0 leading-none mt-1">
                    {String(currentQIndex + 1).padStart(2, '0')}
                  </span>
                  <p className="text-lg font-medium pt-1">{session.generatedQuestions[currentQIndex].question}</p>
                </div>
                
                <div className="space-y-3 pl-12">
                  {session.generatedQuestions[currentQIndex].options.map((opt, optIdx) => {
                    const isCorrect = optIdx === session.generatedQuestions[currentQIndex].correctAnswer;
                    const isSelected = selectedOption === optIdx;
                    
                    let bgClass = "bg-surface hover:bg-surface-hover cursor-pointer border-border";
                    if (isAnswerRevealed) {
                      if (isCorrect) bgClass = "bg-teal-light border-teal font-medium cursor-default";
                      else if (isSelected) bgClass = "bg-accent-light border-accent cursor-default";
                      else bgClass = "bg-surface opacity-50 cursor-default border-border";
                    } else if (isSelected) {
                      bgClass = "bg-purple-light border-purple font-medium";
                    }

                    return (
                      <div 
                        key={optIdx} 
                        onClick={() => !isAnswerRevealed && setSelectedOption(optIdx)}
                        className={`p-4 rounded-xl border-2 transition-all ${bgClass}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-purple' : 'border-ink-muted'} ${isAnswerRevealed && isCorrect ? 'border-teal bg-teal' : ''} ${isAnswerRevealed && isSelected && !isCorrect ? 'border-accent bg-accent' : ''}`}>
                            {isSelected && !isAnswerRevealed && <div className="w-2.5 h-2.5 rounded-full bg-purple" />}
                            {isAnswerRevealed && isCorrect && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                          </div>
                          <span>{opt}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pl-12 pt-4">
                  {!isAnswerRevealed ? (
                    <button 
                      disabled={selectedOption === null}
                      onClick={() => setIsAnswerRevealed(true)}
                      className="btn-pill-accent py-2.5 px-6 disabled:opacity-50"
                    >
                      Submit Answer
                    </button>
                  ) : (
                    currentQIndex < session.generatedQuestions.length - 1 ? (
                      <button 
                        onClick={() => {
                          setCurrentQIndex(prev => prev + 1);
                          setSelectedOption(null);
                          setIsAnswerRevealed(false);
                        }}
                        className="btn-pill py-2.5 px-6"
                      >
                        Next Question
                      </button>
                    ) : (
                      <p className="font-display font-bold text-teal text-lg">Exam Complete!</p>
                    )
                  )}
                </div>
              </div>
            ) : (
              <ol className="space-y-4">
                {(session.generatedQuestions || []).map((q, idx) => (
                  <li key={idx} className="flex gap-4">
                    <span className="font-display text-2xl font-bold text-border shrink-0 leading-none mt-1">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <p className="text-sm leading-relaxed pt-1">{typeof q === 'string' ? q : JSON.stringify(q)}</p>
                  </li>
                ))}
              </ol>
            )}
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
