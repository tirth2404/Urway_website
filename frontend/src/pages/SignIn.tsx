import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';

type SignInPayload = { userId: string };
type SignInProps = {
  onBack: () => void;
  onSuccess: (payload: SignInPayload) => void;
  apiBaseUrl: string;
};

export default function SignIn({ onBack, onSuccess, apiBaseUrl }: SignInProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState('');

  const handleSignIn = async () => {
    setError('');
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setIsSigningIn(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || payload?.detail || 'Sign in failed');
      localStorage.setItem('urway_user_id', payload.userId);
      onSuccess({ userId: payload.userId });
    } catch (err) {
      setError((err as Error)?.message || 'Unable to sign in. Please try again.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSignIn();
  };

  return (
    <motion.div
      key="signin"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.35 }}
      className="min-h-screen bg-paper text-ink flex"
    >
      {/* Left decorative panel */}
      <div className="hidden lg:flex lg:w-[42%] bg-ink text-paper flex-col justify-between p-12 relative overflow-hidden">
        <div className="pointer-events-none absolute top-0 right-0 w-64 h-64 rounded-full bg-accent opacity-20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-0 w-48 h-48 rounded-full bg-teal opacity-20 blur-3xl" />

        <div className="flex items-center gap-3 relative z-10">
          <div className="w-9 h-9 rounded-full border-2 border-paper flex items-center justify-center font-display text-base font-bold">U</div>
          <span className="font-display text-xl font-bold">U'rWay</span>
        </div>

        <div className="relative z-10 space-y-6">
          <blockquote className="font-display text-3xl font-bold leading-tight">
            "The plan is nothing. Planning is{' '}
            <span className="font-serif-italic font-normal text-accent-light">everything.</span>"
          </blockquote>
          <p className="text-paper/50 text-sm">— Dwight D. Eisenhower</p>

          <div className="mt-8 space-y-3">
            {['Personalized AI roadmap', 'Cluster-based learning path', 'Browser activity insights', 'Proctored self-assessment'].map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm text-paper/80">
                <div className="w-1.5 h-1.5 rounded-full bg-accent-light shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </div>

        <p className="text-paper/30 text-xs relative z-10">© 2026 U'rWay</p>
      </div>

      {/* Right sign-in panel */}
      <div className="flex-1 flex flex-col justify-center px-6 md:px-16 py-12">
        <div className="w-full max-w-md mx-auto space-y-8">
          <button onClick={onBack} className="btn-pill text-sm gap-2 self-start">
            <ArrowLeft size={15} /> Back home
          </button>

          <div>
            <h1 className="font-display text-4xl font-bold mb-2">Welcome back</h1>
            <p className="text-ink-muted">Sign in to continue your growth journey.</p>
          </div>

          {error && (
            <div className="rounded-2xl border-2 border-accent bg-accent-light px-4 py-3 text-sm font-medium text-ink">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest font-display block mb-2">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="you@example.com"
                className="input-field"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-widest font-display block mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="At least 8 characters"
                  className="input-field pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink transition-colors"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={handleSignIn}
            disabled={isSigningIn}
            className="btn-pill-accent w-full justify-center py-3.5 text-base shadow-brutal disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSigningIn ? (
              <span className="flex items-center gap-3">
                <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Signing in…
              </span>
            ) : 'Sign In'}
          </button>

          <p className="text-center text-sm text-ink-muted">
            New here?{' '}
            <button onClick={onBack} className="font-semibold text-ink underline underline-offset-4 hover:text-accent transition-colors">
              Create your account
            </button>
          </p>
        </div>
      </div>
    </motion.div>
  );
}