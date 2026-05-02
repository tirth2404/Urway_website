import { motion } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Dashboard     from '../components/Dashboard';
import ProctoredExam from '../components/ProctoredExam';
import { useAuth }   from '../context/AuthContext';
import { api }       from '../utils/apiClient';

export type RoadmapStep = {
  id?: string;
  title: string;
  notes?: string;
  status?: 'complete' | 'in-progress' | 'remaining' | 'overdue' | string;
  dueDate?: string;
};

export type Target = {
  _id: string;
  targetName: string;
  timeline: string;
  description: string;
  status?: string;
  roadmap?: RoadmapStep[];
};

export type RoadmapData = {
  profile?: { virtualClusterTag?: string; lastExtensionInsight?: string; };
  targets?: Target[];
  isNewUser?: boolean;
};

type RoadmapProps = {
  onBackHome: () => void;
  onLogout:   () => void;
};

export default function Roadmap({ onBackHome, onLogout }: RoadmapProps) {
  const navigate              = useNavigate();
  const { user, isRestoring, signOut } = useAuth();
  const [roadmapData, setRoadmapData] = useState<RoadmapData | null>(null);
  const [isLoading,   setIsLoading]   = useState(true);
  const [isCreating,  setIsCreating]  = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [view, setView]               = useState<'dashboard' | 'exam'>('dashboard');

  // userId comes from the JWT via AuthContext — never from localStorage
  const userId = user?.userId ?? '';

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setDashboardError(null);
    try {
      const res  = await api.get(`/api/dashboard/${userId}`);
      if (!res) {
        setDashboardError('Your session expired. Please sign in again.');
        return;
      }
      if (res.status === 401 || res.status === 403) {
        await signOut();
        navigate('/signin', { replace: true });
        return;
      }
      const data = await res!.json();
      if (!res!.ok) throw new Error(data?.error || 'Failed to load dashboard');
      setRoadmapData(data);
    } catch (err) {
      console.error(err);
      setDashboardError('Could not load your dashboard right now. Please check your connection and retry.');
    } finally {
      setIsLoading(false);
    }
  }, [navigate, signOut, userId]);

  useEffect(() => {
    if (isRestoring) return;              // wait — session restore not done yet
    if (!userId) { navigate('/signin', { replace: true }); return; }
    loadDashboard();
  }, [isRestoring, userId, navigate, loadDashboard]);

  const handleCreateTarget = async (form: { targetName: string; timeline: string; priorKnowledge: number; description: string }) => {
    setIsCreating(true);
    try {
      const res  = await api.post(`/api/targets/${userId}`, form);
      const data = await res!.json();
      if (!res!.ok) throw new Error(data?.error || 'Failed to create target');
      await loadDashboard();
    } catch (err) {
      alert((err as Error)?.message || 'Failed to create target.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    onLogout();
  };

  return (
    <motion.div
      key="roadmap-shell"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen bg-paper text-ink"
    >
      {/* ── TOP NAV ───────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 md:px-10 py-4 border-b-2 border-ink bg-paper/90 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 overflow-hidden bg-white">
            <img src="/doodles/logo.jpeg" alt="U'rWay logo" className="w-full h-full object-cover" />
          </div>
          <span className="font-display text-xl font-bold">U'rWay</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onBackHome}    className="btn-pill text-sm">Home</button>
          <button onClick={handleLogout}  className="btn-pill-filled text-sm">Log out</button>
        </div>
      </nav>

      {/* ── MAIN CONTENT ──────────────────────────────────── */}
      <main className="max-w-5xl mx-auto px-6 md:px-10 py-10">
        {isLoading ? (
          <div className="space-y-6">
            <div className="skeleton h-24 w-full" />
            <div className="skeleton h-48 w-full" />
            <div className="skeleton h-48 w-full" />
          </div>
        ) : dashboardError ? (
          <div className="card-brutal p-8 space-y-4 text-center">
            <h2 className="font-display text-2xl font-bold">Unable to load dashboard</h2>
            <p className="text-ink-muted">{dashboardError}</p>
            <div className="flex justify-center gap-3">
              <button onClick={loadDashboard} className="btn-pill-filled text-sm">Retry</button>
              <button onClick={handleLogout} className="btn-pill text-sm">Back to Home</button>
            </div>
          </div>
        ) : view === 'exam' ? (
          <ProctoredExam
            userId={userId}
            onBack={() => setView('dashboard')}
          />
        ) : (
          <Dashboard
            data={roadmapData}
            errorMessage={dashboardError}
            loading={isCreating}
            onCreateTarget={handleCreateTarget}
            onOpenExam={() => setView('exam')}
          />
        )}
      </main>
    </motion.div>
  );
}
