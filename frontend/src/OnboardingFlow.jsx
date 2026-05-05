import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, Eye, EyeOff, Wifi } from 'lucide-react';
import { useAuth } from './context/AuthContext';

const TOTAL_STEPS = 5;

const stepMeta = [
  { id: 1, title: 'Identity', desc: 'Tell us who you are and where you want to go.', accent: 'card-accent' },
  { id: 2, title: 'Wellness', desc: 'Physical and mental health signals.', accent: 'card-brutal' },
  { id: 3, title: 'Profile', desc: 'Your experience and community footprint.', accent: 'card-teal' },
  { id: 4, title: 'Habits', desc: 'How you study and show up every week.', accent: 'card-gold' },
  { id: 5, title: 'Account', desc: 'Secure your U\'rWay account.', accent: 'card-brutal' },
];

// ── Career Recommender Data ──────────────────────────────
const UG_COURSES = ['BE BTech','BCA','BSc','BCom','BA','BBA','LLB','MBBS','BPharm','BArch','BDes','BEd','BHM','Other'];

const COURSE_SPEC_MAP = {
  'BE BTech': ['computer science engineering','mechanical engineering','electrical and electronics engineering','electronics and communication engineering','civil engineering','automobile engineering','biotechnology','electronics and telecommunication engineering','electrical engineering'],
  'BCA': ['computer applications','computer science engineering'],
  'BSc': ['mathematics','physics','statistics','biotechnology','computer science engineering'],
  'BCom': ['accounting and finance','commerce','finance'],
  'BA': ['political science','mathematics','statistics'],
  'BBA': ['marketing','business administration','finance','accounting and finance'],
  'LLB': ['law','political science'],
  'MBBS': [],
  'BPharm': ['biotechnology'],
  'BArch': ['civil engineering'],
  'BDes': [],
  'BEd': [],
  'BHM': ['marketing','business administration'],
  'Other': ['computer science engineering','mechanical engineering','electrical and electronics engineering','electronics and communication engineering','civil engineering','automobile engineering','accounting and finance','mathematics','commerce','computer applications','marketing','physics','statistics','business administration','biotechnology','electronics and telecommunication engineering','political science','law','finance','electrical engineering'],
};

const ALL_SKILLS = ['communication','python','problem solving','sql','analytical thinking','leadership','active listening','critical thinking','machine learning','writing','people management','java','presentation','c','team work','gathering information','data visualization','accounting','product knowledge','editing','excel','negotiation'];

const ALL_INTERESTS = ['data analytics','research','financial analysis','data science','teaching','sales and marketing','human behavior','trading','government job','entrepreneurship','web design','web development','social justice','human biology','journalism','digital marketing','content writing','gaming','supply chain','market research','social media marketing'];

const SCORE_BANDS = ['<50','50-60','60-70','70-80','80-90','90+'];

const clubOptions = ['Coding Club', 'Robotics', 'Debate', 'Sports', 'Music', 'Drama', 'Research', 'Entrepreneurship'];
const careerPathFeaturesList = [
  { key: 'internships', label: 'Internships' },
  { key: 'projects', label: 'Projects' },
  { key: 'leadership_positions', label: 'Leadership' },
  { key: 'communication_skills', label: 'Communication' },
  { key: 'problem_solving_skills', label: 'Problem Solving' },
  { key: 'teamwork_skills', label: 'Teamwork' },
  { key: 'analytical_skills', label: 'Analytical Skills' },
  { key: 'presentation_skills', label: 'Presentation' },
  { key: 'networking_skills', label: 'Networking' },
];
const studyTimeOptions = ['< 1 hour', '1–2 hours', '2–4 hours', '4–6 hours', '6+ hours'];

const defaultFormData = {
  name: '',
  age: '',
  // Career recommender fields
  ug_course: '',
  ug_specialization: '',
  ug_specialization_other: '',
  skills: [],
  interests: [],
  ug_score: '',
  // Habits (Student Performance ML model)
  traveltime: 1,
  studytime: 2,
  failures: 0,
  schoolsup: false,
  famsup: false,
  paid: false,
  activities: false,
  internet: true,
  freetime: 3,
  goout: 3,
  // Profile (Career Path ML model)
  internships: 0,
  projects: 0,
  leadership_positions: 0,
  communication_skills: 0,
  problem_solving_skills: 0,
  teamwork_skills: 0,
  analytical_skills: 0,
  presentation_skills: 0,
  networking_skills: 0,
  club_memberships: [],
  // Wellness (Mental Wellness ML model)
  sleep_hours: 7,
  sleep_quality: 'Good',
  physical_activity_min: 30,
  diet_quality: 'Average',
  stress_level: 5,
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

function SearchableChipInput({ label, allOptions, selected, onToggle, maxItems = 5, placeholder = 'Search...' }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const filtered = allOptions.filter(
    o => !selected.includes(o) && o.toLowerCase().includes(query.toLowerCase())
  );
  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-widest font-display block mb-2">{label}</label>
      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="chip-container mb-3">
          {selected.map(s => (
            <span key={s} className="chip">
              {s}
              <button type="button" className="chip-remove" onClick={() => onToggle(s)}>✕</button>
            </span>
          ))}
        </div>
      )}
      {/* Search input */}
      {selected.length < maxItems && (
        <div className="chip-search-wrap">
          <input
            className="chip-search-input"
            placeholder={placeholder}
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
          />
          {open && filtered.length > 0 && (
            <div className="chip-dropdown">
              {filtered.slice(0, 8).map(opt => (
                <div key={opt} className="chip-dropdown-item" onMouseDown={() => { onToggle(opt); setQuery(''); }}>
                  {opt}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {selected.length >= maxItems && (
        <p className="text-xs text-ink-muted mt-1">Maximum {maxItems} items selected.</p>
      )}
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

              {/* ── STEP 1: Identity + Career Profile ─────── */}
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

                  {/* UG Course — master filter */}
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-widest font-display block mb-2">UG Course</label>
                    <select
                      value={formData.ug_course}
                      onChange={e => {
                        handleChange('ug_course', e.target.value);
                        handleChange('ug_specialization', '');
                        handleChange('ug_specialization_other', '');
                      }}
                      className="select-field"
                    >
                      <option value="">— Select your course —</option>
                      {UG_COURSES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  {/* UG Specialization — conditional on course */}
                  {formData.ug_course && (
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-widest font-display block mb-2">Specialization</label>
                      <select
                        value={formData.ug_specialization}
                        onChange={e => {
                          handleChange('ug_specialization', e.target.value);
                          if (e.target.value !== '__other__') handleChange('ug_specialization_other', '');
                        }}
                        className="select-field"
                      >
                        <option value="">— Select specialization —</option>
                        {(COURSE_SPEC_MAP[formData.ug_course] || []).map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                        <option value="__other__">Others (type below)</option>
                      </select>
                      {formData.ug_specialization === '__other__' && (
                        <input
                          value={formData.ug_specialization_other}
                          onChange={e => handleChange('ug_specialization_other', e.target.value)}
                          placeholder="Type your specialization"
                          className="input-field mt-3"
                        />
                      )}
                    </div>
                  )}

                  {/* UG Score — grade bands */}
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-widest font-display block mb-2">UG Score Band</label>
                    <select value={formData.ug_score} onChange={e => handleChange('ug_score', e.target.value)} className="select-field">
                      <option value="">— Select grade band —</option>
                      {SCORE_BANDS.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>

                  {/* Skills — searchable chips */}
                  <SearchableChipInput
                    label="Skills (select up to 5)"
                    allOptions={ALL_SKILLS}
                    selected={formData.skills}
                    onToggle={val => toggleSelection('skills', val)}
                    maxItems={5}
                    placeholder="Search skills..."
                  />

                  {/* Interests — searchable chips */}
                  <SearchableChipInput
                    label="Interests (select up to 5)"
                    allOptions={ALL_INTERESTS}
                    selected={formData.interests}
                    onToggle={val => toggleSelection('interests', val)}
                    maxItems={5}
                    placeholder="Search interests..."
                  />
                </>
              )}

              {/* ── STEP 4: Habits (Student Performance Model) ── */}
              {step === 4 && (
                <>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-widest font-display block mb-2">Travel Time to School/College</label>
                      <select value={formData.traveltime} onChange={e => handleChange('traveltime', Number(e.target.value))} className="select-field">
                        <option value={1}>&lt; 15 min</option>
                        <option value={2}>15 to 30 min</option>
                        <option value={3}>30 min to 1 hour</option>
                        <option value={4}>&gt; 1 hour</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-widest font-display block mb-2">Study Time Per Week</label>
                      <select value={formData.studytime} onChange={e => handleChange('studytime', Number(e.target.value))} className="select-field">
                        <option value={1}>&lt; 2 hours</option>
                        <option value={2}>2 to 5 hours</option>
                        <option value={3}>5 to 10 hours</option>
                        <option value={4}>&gt; 10 hours</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-widest font-display block mb-2">Past Class Failures</label>
                    <input type="number" min="0" max="4" value={formData.failures} onChange={e => handleChange('failures', Number(e.target.value))} className="input-field" placeholder="0 to 4" />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4 mt-2">
                    <div className="p-4 rounded-2xl border-2 border-ink bg-paper-warm">
                      <div className="font-semibold text-sm mb-2">Extra Educational Support</div>
                      <div className="flex gap-2">
                        <ToggleButton active={formData.schoolsup} onClick={() => handleChange('schoolsup', true)}>Yes</ToggleButton>
                        <ToggleButton active={!formData.schoolsup} onClick={() => handleChange('schoolsup', false)}>No</ToggleButton>
                      </div>
                    </div>
                    
                    <div className="p-4 rounded-2xl border-2 border-ink bg-paper-warm">
                      <div className="font-semibold text-sm mb-2">Family Educational Support</div>
                      <div className="flex gap-2">
                        <ToggleButton active={formData.famsup} onClick={() => handleChange('famsup', true)}>Yes</ToggleButton>
                        <ToggleButton active={!formData.famsup} onClick={() => handleChange('famsup', false)}>No</ToggleButton>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl border-2 border-ink bg-paper-warm">
                      <div className="font-semibold text-sm mb-2">Extra Paid Classes</div>
                      <div className="flex gap-2">
                        <ToggleButton active={formData.paid} onClick={() => handleChange('paid', true)}>Yes</ToggleButton>
                        <ToggleButton active={!formData.paid} onClick={() => handleChange('paid', false)}>No</ToggleButton>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl border-2 border-ink bg-paper-warm">
                      <div className="font-semibold text-sm mb-2">Extracurricular Activities</div>
                      <div className="flex gap-2">
                        <ToggleButton active={formData.activities} onClick={() => handleChange('activities', true)}>Yes</ToggleButton>
                        <ToggleButton active={!formData.activities} onClick={() => handleChange('activities', false)}>No</ToggleButton>
                      </div>
                    </div>
                    
                    <div className="p-4 rounded-2xl border-2 border-ink bg-paper-warm md:col-span-2">
                      <div className="font-semibold text-sm mb-2">Internet Access at Home</div>
                      <div className="flex gap-2">
                        <ToggleButton active={formData.internet} onClick={() => handleChange('internet', true)}>Yes</ToggleButton>
                        <ToggleButton active={!formData.internet} onClick={() => handleChange('internet', false)}>No</ToggleButton>
                      </div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6 mt-4">
                    <SliderField label="Free Time (1-5)" keyName="freetime" min={1} max={5} value={formData.freetime} onChange={handleChange} />
                    <SliderField label="Going Out with Friends (1-5)" keyName="goout" min={1} max={5} value={formData.goout} onChange={handleChange} />
                  </div>
                </>
              )}

              {/* ── STEP 3: Profile (Career Path Model) ──────── */}
              {step === 3 && (
                <>
                  <div className="mb-4 text-sm text-ink-muted bg-paper-warm p-3 rounded-lg border border-ink/10">
                    Rate your experience and skills on a scale of <strong>0 (Beginner/None)</strong> to <strong>4 (Expert/Many)</strong>.
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-6">
                    {careerPathFeaturesList.map(feature => (
                      <SliderField key={feature.key} label={feature.label} keyName={feature.key} min={0} max={4} value={formData[feature.key]} onChange={handleChange} />
                    ))}
                  </div>

                  <div className="mt-6">
                    <label className="text-xs font-semibold uppercase tracking-widest font-display block mb-2">Club Memberships (Optional)</label>
                    <div className="flex flex-wrap gap-2">
                      {clubOptions.map(s => (
                        <ToggleButton key={s} active={formData.club_memberships.includes(s)} onClick={() => toggleSelection('club_memberships', s)}>{s}</ToggleButton>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* ── STEP 2: Wellness (ML Model) ──────────── */}
              {step === 2 && (
                <>
                  {/* Sleep Hours — 3.0 to 10.0 */}
                  <SliderField label="Sleep Hours" keyName="sleep_hours" min={3} max={10} value={formData.sleep_hours} onChange={handleChange} unit="h" />

                  {/* Sleep Quality — dropdown */}
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-widest font-display block mb-2">Sleep Quality</label>
                    <select value={formData.sleep_quality} onChange={e => handleChange('sleep_quality', e.target.value)} className="select-field">
                      {['Excellent','Good','Fair','Poor'].map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>

                  {/* Physical Activity — 0 to 80 min */}
                  <SliderField label="Physical Activity" keyName="physical_activity_min" min={0} max={80} value={formData.physical_activity_min} onChange={handleChange} unit=" min" />

                  {/* Diet Quality — dropdown */}
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-widest font-display block mb-2">Diet Quality</label>
                    <select value={formData.diet_quality} onChange={e => handleChange('diet_quality', e.target.value)} className="select-field">
                      {['Good','Average','Poor'].map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>

                  {/* Stress Level — 1 to 10 */}
                  <SliderField label="Stress Level" keyName="stress_level" min={1} max={10} value={formData.stress_level} onChange={handleChange} />
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
