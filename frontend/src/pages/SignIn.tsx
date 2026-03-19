import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';

type SignInPayload = {
  userId: string;
};

type SignInProps = {
  onBack: () => void;
  onSuccess: (payload: SignInPayload) => void;
  apiBaseUrl: string;
};

export default function SignIn({ onBack, onSuccess, apiBaseUrl }: SignInProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleSignIn = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      alert('Please enter a valid email address.');
      return;
    }

    if (password.length < 8) {
      alert('Password must be at least 8 characters long.');
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
      if (!response.ok) {
        throw new Error(payload?.error || payload?.detail || 'Sign in failed');
      }

      localStorage.setItem('urway_user_id', payload.userId);
      onSuccess({ userId: payload.userId });
    } catch (error) {
      console.error(error);
      alert((error as Error)?.message || 'Unable to sign in.');
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <motion.div
      key="signin"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.35 }}
      className="min-h-screen bg-white text-neutral-900 px-6 py-10"
    >
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-full border-2 border-neutral-900 px-4 py-2 text-sm font-medium hover:bg-neutral-900 hover:text-white transition"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <div className="text-sm font-semibold">Sign In</div>
        </div>

        <div className="rounded-3xl border-2 border-neutral-900 bg-amber-100 px-8 py-6 shadow-[6px_6px_0_#18181B]">
          <h2 className="font-display text-3xl font-bold tracking-tight">Welcome Back</h2>
          <p className="text-neutral-700 mt-1">Sign in to continue your roadmap journey.</p>
        </div>

        <div className="rounded-3xl border-2 border-neutral-900 p-6 space-y-5">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-2 w-full rounded-2xl border-2 border-neutral-900 bg-white px-4 py-3 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="mt-2 w-full rounded-2xl border-2 border-neutral-900 bg-white px-4 py-3 focus:outline-none"
            />
          </div>

          <button
            onClick={handleSignIn}
            disabled={isSigningIn}
            className="w-full rounded-full bg-neutral-900 text-white px-5 py-3 text-sm font-semibold disabled:opacity-60"
          >
            {isSigningIn ? 'Signing In...' : 'Sign In'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
