import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Dashboard from '../components/Dashboard';
import ProctoredExam from '../components/ProctoredExam';

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
  profile?: {
    virtualClusterTag?: string;
    lastExtensionInsight?: string;
  };
  targets?: Target[];
  isNewUser?: boolean;
};

type RoadmapProps = {
  apiBaseUrl: string;
  onBackHome: () => void;
  onLogout: () => void;
};

export default function Roadmap({ apiBaseUrl, onBackHome, onLogout }: RoadmapProps) {
  const navigate = useNavigate();
  const [roadmapData, setRoadmapData] = useState<RoadmapData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [view, setView] = useState<'dashboard' | 'exam'>('dashboard');

  const userId = localStorage.getItem('urway_user_id') || '';

  useEffect(() => {
    if (!userId) { navigate('/signin', { replace: true }); return; }
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/dashboard/${userId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load dashboard');
      setRoadmapData(data);
    } catch (err) {
      console.error(err);
      navigate('/signin', { replace: true });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTarget = async (form: { targetName: string; timeline: string; priorKnowledge: number; description: string }) => {
    setIsCreating(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/targets/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to create target');
      await loadDashboard();
    } catch (err) {
      alert((err as Error)?.message || 'Failed to create target.');
    } finally {
      setIsCreating(false);
    }
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
      {/* ── TOP NAV ────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 md:px-10 py-4 border-b-2 border-ink bg-paper/90 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full border-2 border-ink flex items-center justify-center font-display text-base font-bold bg-ink text-paper">
            U
          </div>
          <span className="font-display text-xl font-bold">U'rWay</span>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={onBackHome} className="btn-pill text-sm">Home</button>
          <button onClick={onLogout} className="btn-pill-filled text-sm">Log out</button>
        </div>
      </nav>

      {/* ── MAIN CONTENT ──────────────────────────────── */}
      <main className="max-w-5xl mx-auto px-6 md:px-10 py-10">
        {isLoading ? (
          <div className="space-y-6">
            <div className="skeleton h-24 w-full" />
            <div className="skeleton h-48 w-full" />
            <div className="skeleton h-48 w-full" />
          </div>
        ) : view === 'exam' ? (
          <ProctoredExam
            apiBaseUrl={apiBaseUrl}
            userId={userId}
            onBack={() => setView('dashboard')}
          />
        ) : (
          <Dashboard
            data={roadmapData}
            loading={isCreating}
            onCreateTarget={handleCreateTarget}
            onOpenExam={() => setView('exam')}
          />
        )}
      </main>
    </motion.div>
  );
}