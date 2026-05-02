import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, Eye, EyeOff, Wifi } from 'lucide-react';
import { useAuth } from './context/AuthContext';

const TOTAL_STEPS = 5;

const stepMeta = [
  { id: 1, title: 'Identity', desc: 'Tell us who you are and where you want to go.', accent: 'card-accent' },
  { id: 2, title: 'Habits', desc: 'How you study and show up every week.', accent: 'card-gold' },
  { id: 3, title: 'Profile', desc: 'Your experience and community footprint.', accent: 'card-teal' },
  { id: 4, title: 'Wellness', desc: 'Physical and mental health signals.', accent: 'card-brutal' },
  { id: 5, title: 'Account', desc: 'Secure your U\'rWay account.', accent: 'card-brutal' },
];

const techSkillOptions = ['Python', 'JavaScript', 'Java', 'C/C++', 'SQL', 'React', 'Node.js', 'HTML/CSS', 'TypeScript', 'Rust', 'Go', 'Swift', 'Kotlin', 'Docker', 'AWS', 'Git'];
const interestOptions = ['Machine Learning', 'Web Dev', 'Mobile Dev', 'Cybersecurity', 'Data Science', 'DevOps', 'UI/UX', 'Game Dev', 'Blockchain', 'Cloud'];
const clubOptions = ['Coding Club', 'Robotics', 'Debate', 'Sports', 'Music', 'Drama', 'Research', 'Entrepreneurship'];
const softSkillsList = [
  { key: 'communication_score', label: 'Communication' },
  { key: 'teamwork_score', label: 'Teamwork' },
  { key: 'leadership_score', label: 'Leadership' },
  { key: 'time_management_score', label: 'Time Management' },
];
const goalOptions = ['Software Engineer', 'Data Scientist', 'Product Manager', 'UI/UX Designer', 'DevOps Engineer', 'Cybersecurity Analyst', 'Machine Learning Engineer', 'Entrepreneur'];
const studyTimeOptions = ['< 1 hour', '1–2 hours', '2–4 hours', '4–6 hours', '6+ hours'];

const defaultFormData = {
  name: '',
  age: '',
  target_goal: '',
  cgpa: '',
  study_hours_per_day: '2–4 hours',
  preferred_study_time: 'Morning',
  learning_style: 'Visual',
  weak_areas: [],
  internet_access: true,
  internship_count: 0,
  project_count: 0,
  tech_skills: [],
  interests: [],
  club_memberships: [],
  communication_score: 3,
  teamwork_score: 3,
  leadership_score: 3,
  time_management_score: 3,
  sleep_hours: 7,
  stress_level: 3,
  physical_activity_min: 30,
  activity_frequency: 3,
  activity_type: 'Walking',
};

const defaultCredentials = {
  email: '',
  password: '',
  confirmPassword: '',
};

function ToggleButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tag text-sm py-1.5 px-4 ${active ? 'active' : ''}`}
    >
      {children}
    </button>
  );
}

function SliderField({ label, keyName, min, max, value, onChange, unit = '' }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-semibold uppercase tracking-widest font-display">{label}</label>
        <span className="font-display font-bold text-lg">{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(keyName, Number(e.target.value))}
        className="range-ink w-full"
      />
      <div className="flex justify-between text-xs text-ink-muted mt-1">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  );
}

export default function OnboardingFlow({ onBackToLanding, onComplete }) {
  const [step, setStep] = useState(1);
  const [dir, setDir] = useState(1);
  const [formData, setFormData] = useState(defaultFormData);
  const [credentials, setCredentials] = useState(defaultCredentials);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  // ── FIX Bug 1: get signIn from AuthContext so we can populate user after onboarding ──
  const { signIn } = useAuth();

  const apiBaseUrl = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:5000';

  const handleChange = (key, value) => setFormData(prev => ({ ...prev, [key]: value }));
  const handleCredentialsChange = (key, value) => setCredentials(prev => ({ ...prev, [key]: value }));

  const toggleSelection = (key, value) => {
    setFormData(prev => {
      const arr = prev[key];
      return { ...prev, [key]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] };
    });
  };

  const goNext = () => { setDir(1); setStep(s => Math.min(s + 1, TOTAL_STEPS)); };
  const goBack = () => {
    if (step === 1) { onBackToLanding(); return; }
    setDir(-1); setStep(s => s - 1);
  };

  const handleFinish = async () => {
    if (!credentials.email || !credentials.password) {
      alert('Please enter your email and password to continue.'); return;
    }
    if (credentials.password.length < 8) {
      alert('Password must be at least 8 characters.'); return;
    }
    if (credentials.password !== credentials.confirmPassword) {
      alert('Password and confirm password must match.'); return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        email: credentials.email,
        password: credentials.password,
        confirmPassword: credentials.confirmPassword,
      };
      const res = await fetch(`${apiBaseUrl}/api/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Onboarding failed.');

      // ── FIX Bug 1: removed localStorage.setItem('urway_user_id', data.userId)
      // The new auth system never reads from localStorage — it uses AuthContext.
      // Call signIn() instead so AuthContext.user is populated immediately,
      // which prevents Roadmap from redirecting back to / after onboarding.
      await signIn(credentials.email, credentials.password);

      onComplete({ userId: data.userId });
    } catch (err) {
      alert((err).message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const meta = stepMeta[step - 1];
  const progress = ((step - 1) / (TOTAL_STEPS - 1)) * 100;

  return (
    <div className="min-h-screen bg-paper text-ink flex">
      {/* ── Sidebar ─────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[300px] shrink-0 bg-ink text-paper flex-col p-10 border-r-2 border-ink">
        <button onClick={onBackToLanding} className="flex items-center gap-2 text-paper/60 hover:text-paper text-sm transition-colors mb-10">
          <ArrowLeft size={14} /> Home
        </button>

        <div className="flex items-center gap-3 mb-12">
          <div className="w-8 h-8 rounded-full border-2 border-paper overflow-hidden bg-white">
            <img src="/doodles/logo.jpeg" alt="U'rWay logo" className="w-full h-full object-cover" />
          </div>
          <span className="font-display text-lg font-bold">U'rWay</span>
        </div>

        <div className="space-y-1 flex-1">
          {stepMeta.map((s, i) => {
            const done = step > s.id;
            const current = step === s.id;
            return (
              <div key={s.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-colors ${current ? 'bg-paper/10' : ''}`}>
                <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center font-display text-xs font-bold shrink-0 transition-all ${done ? 'bg-teal border-teal text-white' : current ? 'bg-paper border-paper text-ink' : 'border-paper/30 text-paper/30'}`}>
                  {done ? '✓' : s.id}
                </div>
                <div>
                  <p className={`text-sm font-semibold font-display transition-colors ${current ? 'text-paper' : done ? 'text-paper/70' : 'text-paper/30'}`}>{s.title}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-auto">
          <div className="flex justify-between text-xs text-paper/40 mb-2">
            <span>Progress</span>
            <span>{step}/{TOTAL_STEPS}</span>
          </div>
          <div className="h-1.5 bg-paper/10 rounded-full overflow-hidden">
            <div className="h-full bg-paper/60 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      {/* ── Main form area ──────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* mobile header */}
        <div className="lg:hidden flex items-center justify-between px-6 py-4 border-b-2 border-ink bg-paper">
          <button onClick={goBack} className="btn-pill text-sm gap-2">
            <ArrowLeft size={14} /> Back
          </button>
          <span className="font-display font-bold text-sm">{step} / {TOTAL_STEPS}</span>
        </div>

        <div className="flex-1 overflow-y-auto px-6 md:px-12 lg:px-16 py-10 max-w-2xl w-full mx-auto">
          {/* step header */}
          <div className={`${meta.accent} p-6 rounded-3xl mb-8`}>
            <p className="font-display text-xs font-semibold uppercase tracking-widest text-ink-muted mb-1">
              Step {step} of {TOTAL_STEPS}
            </p>
            <h2 className="font-display text-3xl font-bold">{meta.title}</h2>
            <p className="text-ink-muted text-sm mt-1">{meta.desc}</p>
          </div>

          {/* step content */}
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              variants={{
                enter: (d) => ({ opacity: 0, x: d > 0 ? 40 : -40 }),
                center: { opacity: 1, x: 0 },
                exit: (d) => ({ opacity: 0, x: d > 0 ? -40 : 40 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-6"
            >

              {/* ── STEP 1: Identity ──────────────────────── */}
              {step === 1 && (
                <>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-widest font-display block mb-2">Full Name</label>
                      <input value={formData.name} onChange={e => handleChange('name', e.target.value)} placeholder="Your name" className="input-field" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-widest font-display block mb-2">Age</label>
                      <input type="number" min="10" max="60" value={formData.age} onChange={e => handleChange('age', e.target.value)} placeholder="e.g. 20" className="input-field" />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-widest font-display block mb-2">Target Career Goal</label>
                    <div className="flex flex-wrap gap-2">
                      {goalOptions.map(g => (
                        <ToggleButton key={g} active={formData.target_goal === g} onClick={() => handleChange('target_goal', g)}>{g}</ToggleButton>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-widest font-display block mb-2">Academic Score / GPA</label>
                    <input type="number" min="0" max="100" value={formData.cgpa} onChange={e => handleChange('cgpa', e.target.value)} placeholder="e.g. 75 (out of 100)" className="input-field" />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-widest font-display block mb-2">Weak Areas (optional)</label>
                    <input value={formData.weak_areas?.join(', ') || ''} onChange={e => handleChange('weak_areas', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} placeholder="e.g. Algorithms, DSA, System Design" className="input-field" />
                  </div>
                </>
              )}

              {/* ── STEP 2: Habits ────────────────────────── */}
              {step === 2 && (
                <>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-widest font-display block mb-2">Study Hours Per Day</label>
                    <div className="flex flex-wrap gap-2">
                      {studyTimeOptions.map(opt => (
                        <ToggleButton key={opt} active={formData.study_hours_per_day === opt} onClick={() => handleChange('study_hours_per_day', opt)}>{opt}</ToggleButton>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-widest font-display block mb-2">Preferred Study Time</label>
                    <div className="flex flex-wrap gap-2">
                      {['Morning', 'Afternoon', 'Evening', 'Night'].map(t => (
                        <ToggleButton key={t} active={formData.preferred_study_time === t} onClick={() => handleChange('preferred_study_time', t)}>{t}</ToggleButton>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-widest font-display block mb-2">Learning Style</label>
                    <div className="flex flex-wrap gap-2">
                      {['Visual', 'Auditory', 'Reading/Writing', 'Kinesthetic'].map(s => (
                        <ToggleButton key={s} active={formData.learning_style === s} onClick={() => handleChange('learning_style', s)}>{s}</ToggleButton>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-2xl border-2 border-ink bg-paper-warm">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl border-2 border-ink flex items-center justify-center bg-white">
                        <Wifi size={18} />
                      </div>
                      <div>
                        <div className="font-semibold text-sm">Internet Access</div>
                        <div className="text-xs text-ink-muted">Regular connectivity</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleChange('internet_access', !formData.internet_access)}
                      className={`btn-pill text-sm ${formData.internet_access ? 'btn-pill-filled' : ''}`}
                    >
                      {formData.internet_access ? 'Yes' : 'No'}
                    </button>
                  </div>
                </>
              )}

              {/* ── STEP 3: Profile ────────────────────────── */}
              {step === 3 && (
                <>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-widest font-display block mb-2">Internships</label>
                      <input type="number" min="0" value={formData.internship_count} onChange={e => handleChange('internship_count', Number(e.target.value))} className="input-field" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-widest font-display block mb-2">Projects</label>
                      <input type="number" min="0" value={formData.project_count} onChange={e => handleChange('project_count', Number(e.target.value))} className="input-field" />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-widest font-display block mb-2">Tech Skills</label>
                    <div className="flex flex-wrap gap-2">
                      {techSkillOptions.map(s => (
                        <ToggleButton key={s} active={formData.tech_skills.includes(s)} onClick={() => toggleSelection('tech_skills', s)}>{s}</ToggleButton>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-widest font-display block mb-2">Interests</label>
                    <div className="flex flex-wrap gap-2">
                      {interestOptions.map(s => (
                        <ToggleButton key={s} active={formData.interests.includes(s)} onClick={() => toggleSelection('interests', s)}>{s}</ToggleButton>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-widest font-display block mb-2">Club Memberships</label>
                    <div className="flex flex-wrap gap-2">
                      {clubOptions.map(s => (
                        <ToggleButton key={s} active={formData.club_memberships.includes(s)} onClick={() => toggleSelection('club_memberships', s)}>{s}</ToggleButton>
                      ))}
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    {softSkillsList.map(skill => (
                      <SliderField key={skill.key} label={skill.label} keyName={skill.key} min={1} max={5} value={formData[skill.key]} onChange={handleChange} />
                    ))}
                  </div>
                </>
              )}

              {/* ── STEP 4: Wellness ──────────────────────── */}
              {step === 4 && (
                <>
                  <SliderField label="Sleep Hours" keyName="sleep_hours" min={0} max={12} value={formData.sleep_hours} onChange={handleChange} unit="h" />
                  <SliderField label="Stress Level" keyName="stress_level" min={1} max={10} value={formData.stress_level} onChange={handleChange} />
                  <SliderField label="Physical Activity" keyName="physical_activity_min" min={0} max={180} value={formData.physical_activity_min} onChange={handleChange} unit="min" />
                  <SliderField label="Activity Frequency" keyName="activity_frequency" min={0} max={7} value={formData.activity_frequency} onChange={handleChange} unit=" days/wk" />

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-widest font-display block mb-2">Activity Type</label>
                    <div className="flex flex-wrap gap-2">
                      {['Walking', 'Running', 'Gym', 'Yoga', 'Sports', 'Dance', 'None'].map(t => (
                        <ToggleButton key={t} active={formData.activity_type === t} onClick={() => handleChange('activity_type', t)}>{t}</ToggleButton>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* ── STEP 5: Account ────────────────────────── */}
              {step === 5 && (
                <>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-widest font-display block mb-2">Email Address</label>
                    <input type="email" value={credentials.email} onChange={e => handleCredentialsChange('email', e.target.value)} placeholder="you@example.com" className="input-field" />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-widest font-display block mb-2">Password</label>
                    <div className="relative">
                      <input
                        type={showPw ? 'text' : 'password'}
                        value={credentials.password}
                        onChange={e => handleCredentialsChange('password', e.target.value)}
                        placeholder="At least 8 characters"
                        className="input-field pr-12"
                      />
                      <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink transition-colors">
                        {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-ink-muted">Use a mix of letters, numbers, and symbols for security.</p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-widest font-display block mb-2">Confirm Password</label>
                    <div className="relative">
                      <input
                        type={showConfirmPw ? 'text' : 'password'}
                        value={credentials.confirmPassword}
                        onChange={e => handleCredentialsChange('confirmPassword', e.target.value)}
                        placeholder="Re-enter your password"
                        className="input-field pr-12"
                      />
                      <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink transition-colors">
                        {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-paper-warm border-2 border-border text-sm text-ink-muted">
                    By creating an account you agree to our terms of service. Your password is stored securely using bcrypt hashing.
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>

          {/* ── Navigation ──────────────────────────────── */}
          <div className="flex items-center justify-between mt-10">
            <button onClick={goBack} className="btn-pill text-sm gap-2">
              <ChevronLeft size={15} /> {step === 1 ? 'Home' : 'Back'}
            </button>

            {step < TOTAL_STEPS ? (
              <button onClick={goNext} className="btn-pill-filled text-sm gap-2">
                Next <ChevronRight size={15} />
              </button>
            ) : (
              <button
                onClick={handleFinish}
                disabled={isSubmitting}
                className="btn-pill-accent text-sm gap-2 disabled:opacity-60 disabled:cursor-not-allowed min-w-[160px] justify-center"
              >
                {isSubmitting ? (
                  <><Loader2 size={15} className="animate-spin" /> Generating…</>
                ) : (
                  <>Complete Setup <ChevronRight size={15} /></>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
