import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Brain, LineChart, Rocket, ArrowRight } from 'lucide-react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import OnboardingFlow from './OnboardingFlow';
import Roadmap from './pages/Roadmap';
import SignIn from './pages/SignIn';

type OnboardingResponse = {
  userId?: string;
};

const slides = [
  {
    id: 1,
    title: "You'll figure it out. We'll show you how.",
    bg: 'bg-rose-100',
    icon: Brain,
    image: '/doodles/Screenshot 2026-02-14 181828.png',
  },
  {
    id: 2,
    title: 'Data-driven roadmaps, not guesswork.',
    bg: 'bg-amber-100',
    icon: LineChart,
    image: '/doodles/Screenshot 2026-02-14 182045.png',
  },
  {
    id: 3,
    title: 'Launch your tech career with confidence.',
    bg: 'bg-blue-100',
    icon: Rocket,
    image: '/doodles/Screenshot 2026-02-14 182054.png',
  },
];

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const heroTitle = slides[0].title;

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

  const Landing = () => (
    <motion.div
      key="landing"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen flex flex-col items-center justify-center px-6 py-10 gap-12"
    >
      <div className="w-full">
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-neutral-900 flex items-center justify-center font-display text-lg">
              U
            </div>
            <span className="font-display text-xl font-bold tracking-tight">U'rWay</span>
          </div>
          <button
            onClick={() => navigate('/signin')}
            className="rounded-full border-2 border-neutral-900 px-4 py-2 font-medium hover:bg-neutral-900 hover:text-white transition"
          >
            Sign In
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-center justify-center mb-12">
          {slides.map((slide, index) => (
            <div
              key={slide.id}
              className="hero-card flex flex-col items-center"
              style={{ animationDelay: `${index * 0.2}s` }}
            >
              <img
                src={slide.image}
                alt={slide.title}
                className="w-auto h-40 md:h-56 object-contain"
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                }}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="w-full max-w-3xl text-center space-y-8">
        <div>
          <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight leading-tight mb-4">
            {heroTitle}
          </h1>
          <p className="text-neutral-600 text-lg">
            Start your IT journey from scratch, online and at your own pace, with personalized mentor support,
            hands-on projects, and a clear placement-focused roadmap.
          </p>
        </div>
        <button
          onClick={() => navigate('/onboarding')}
          className="inline-flex items-center gap-3 rounded-full bg-neutral-900 text-white px-8 py-4 text-lg font-semibold shadow-[6px_6px_0_#18181B] hover:translate-x-1 hover:-translate-y-1 transition"
        >
          Get Started <ArrowRight size={20} />
        </button>
      </div>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-white text-neutral-900">
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
                  if (payload?.userId) {
                    navigate('/roadmap');
                  }
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
                    if (payload?.userId) {
                      navigate('/roadmap');
                    } else {
                      navigate('/');
                    }
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
    </div>
  );
}

export default App;
