import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Compass, Zap, BarChart2, ChevronRight } from 'lucide-react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import OnboardingFlow from './OnboardingFlow';
import Roadmap from './pages/Roadmap';
import SignIn from './pages/SignIn';

type OnboardingResponse = {
  userId?: string;
};

const features = [
  {
    icon: Compass,
    color: 'card-accent',
    label: 'Personalized Path',
    desc: 'Your cluster profile shapes every step. No two roadmaps are alike.',
  },
  {
    icon: Zap,
    color: 'card-gold',
    label: 'AI-Powered',
    desc: 'Gemini reads your habits, skills, and goals to generate real action steps.',
  },
  {
    icon: BarChart2,
    color: 'card-teal',
    label: 'Adaptive Progress',
    desc: 'Browser signals and activity data keep your roadmap continuously updated.',
  },
];

const steps = [
  { n: '01', title: 'Tell us who you are', desc: 'Complete a rich 5-step onboarding covering goals, habits, skills, wellness, and account setup.' },
  { n: '02', title: 'Get clustered', desc: 'Our ML engine classifies your profile into a learner archetype that shapes your entire experience.' },
  { n: '03', title: 'Receive your roadmap', desc: 'Gemini generates a personalized, structured action plan — not generic advice.' },
  { n: '04', title: 'Track & adapt', desc: 'Your extension monitors behaviour and your roadmap evolves with you over time.' },
];

function Landing() {
  const navigate = useNavigate();

  return (
    <motion.div
      key="landing"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen bg-paper text-ink"
    >
      {/* ── NAV ──────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 md:px-12 py-4 border-b-2 border-ink bg-paper/90 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 overflow-hidden bg-white">
            <img src="/doodles/logo.jpeg" alt="U'rWay logo" className="w-full h-full object-cover" />
          </div>
          <span className="font-display text-xl font-bold">U'rWay</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/signin')}
            className="btn-pill"
          >
            Sign In
          </button>
          <button
            onClick={() => navigate('/onboarding')}
            className="btn-pill-filled"
          >
            Get Started <ArrowRight size={15} />
          </button>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────── */}
      <section className="relative px-6 md:px-12 pt-20 pb-24 overflow-hidden">
        {/* background accent blobs */}
        <div className="pointer-events-none absolute top-0 right-0 w-[420px] h-[420px] rounded-full bg-accent-light opacity-40 blur-3xl translate-x-1/3 -translate-y-1/4" />
        <div className="pointer-events-none absolute bottom-0 left-0 w-[300px] h-[300px] rounded-full bg-teal-light opacity-30 blur-3xl -translate-x-1/4 translate-y-1/4" />

        <div className="relative max-w-5xl mx-auto">
          <div className="rise rise-1 inline-flex items-center gap-2 rounded-full border-2 border-ink px-4 py-1.5 text-xs font-semibold font-display mb-8 bg-gold-light">
            <span className="w-2 h-2 rounded-full bg-accent inline-block" />
            AI-Driven Growth Platform
          </div>

          <h1 className="rise rise-2 font-display text-5xl md:text-7xl font-bold leading-[1.05] tracking-tight mb-6 max-w-4xl">
            You'll figure it out.{' '}
            <span className="font-serif-italic font-normal">We'll show</span>{' '}
            you how.
          </h1>

          <p className="rise rise-3 text-ink-muted text-lg md:text-xl max-w-2xl leading-relaxed mb-10">
            U'rWay is an AI mentor that builds personalized roadmaps from your profile, learns from your behaviour, and adapts as you grow — not a passive task tracker.
          </p>

          <div className="rise rise-4 flex flex-wrap gap-4">
            <button
              onClick={() => navigate('/onboarding')}
              className="btn-pill-accent text-base px-7 py-3 gap-3 shadow-brutal"
            >
              Start your journey <ArrowRight size={18} />
            </button>
            <button
              onClick={() => navigate('/signin')}
              className="btn-pill text-base px-7 py-3"
            >
              Already have an account
            </button>
          </div>
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────────────── */}
      <section className="px-6 md:px-12 py-20 bg-paper-warm border-y-2 border-ink">
        <div className="max-w-5xl mx-auto">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted mb-10">
            What makes U'rWay different
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div key={i} className={`${f.color} p-6 rounded-3xl border-2 border-ink shadow-brutal-sm`}>
                <div className="w-11 h-11 rounded-2xl border-2 border-ink bg-white flex items-center justify-center mb-5 shadow-brutal-sm">
                  <f.icon size={20} strokeWidth={2} />
                </div>
                <h3 className="font-display text-lg font-bold mb-2">{f.label}</h3>
                <p className="text-ink-muted text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────── */}
      <section className="px-6 md:px-12 py-24">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-14 gap-4">
            <div>
              <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted mb-2">How it works</p>
              <h2 className="font-display text-4xl font-bold">Four steps to clarity</h2>
            </div>
            <button onClick={() => navigate('/onboarding')} className="btn-pill-filled self-start md:self-auto">
              Begin now <ChevronRight size={16} />
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {steps.map((s, i) => (
              <div key={i} className="card-brutal p-7 flex gap-5">
                <div className="font-display text-4xl font-bold text-border shrink-0 leading-none">{s.n}</div>
                <div>
                  <h3 className="font-display text-lg font-bold mb-2">{s.title}</h3>
                  <p className="text-ink-muted text-sm leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ────────────────────────────────────── */}
      <section className="px-6 md:px-12 py-16 bg-ink text-paper">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-2">
              Ready to stop guessing?
            </h2>
            <p className="text-paper/60 text-base">Your roadmap is 5 minutes away.</p>
          </div>
          <button
            onClick={() => navigate('/onboarding')}
            className="shrink-0 inline-flex items-center gap-3 rounded-full border-2 border-paper bg-paper text-ink px-7 py-3 font-semibold font-display hover:bg-accent hover:text-white hover:border-accent transition-all duration-200 shadow-[5px_5px_0_rgba(255,255,255,0.15)]"
          >
            Get started free <ArrowRight size={17} />
          </button>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────── */}
      <footer className="px-6 md:px-12 py-8 border-t-2 border-ink flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 overflow-hidden bg-white">
            <img src="/doodles/logo.jpeg" alt="U'rWay logo" className="w-full h-full object-cover" />
          </div>
          <span className="font-display font-bold">U'rWay</span>
        </div>
        <p className="text-ink-muted text-sm">© 2026 U'rWay. Built for ambitious learners.</p>
      </footer>
    </motion.div>
  );
}

function App() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('urway_user_id');
    navigate('/');
  };

  useEffect(() => {
    const existingUserId = localStorage.getItem('urway_user_id') || '';
    if (!existingUserId && location.pathname === '/roadmap') {
      navigate('/signin', { replace: true });
    }
  }, [location.pathname, navigate]);

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Landing />} />
        <Route
          path="/signin"
          element={
            <SignIn
              apiBaseUrl={import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:5000'}
              onBack={() => navigate('/')}
              onSuccess={(payload) => {
                if (payload?.userId) navigate('/roadmap');
              }}
            />
          }
        />
        <Route
          path="/onboarding"
          element={
            <motion.div
              key="wizard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4 }}
            >
              <OnboardingFlow
                onBackToLanding={() => navigate('/')}
                onComplete={(payload: OnboardingResponse) => {
                  if (payload?.userId) navigate('/roadmap');
                  else navigate('/');
                }}
              />
            </motion.div>
          }
        />
        <Route
          path="/roadmap"
          element={
            <Roadmap
              apiBaseUrl={import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:5000'}
              onBackHome={() => navigate('/')}
              onLogout={handleLogout}
            />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

export default App;