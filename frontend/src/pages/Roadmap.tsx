import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export type RoadmapStep = {
  title: string;
  notes?: string;
  status?: 'complete' | 'in-progress' | 'remaining' | 'overdue' | string;
};

export type Target = {
  _id: string;
  targetName: string;
  timeline: string;
  description: string;
  roadmap?: RoadmapStep[];
};

export type RoadmapData = {
  profile?: {
    virtualClusterTag?: string;
  };
  targets?: Target[];
};

type RoadmapProps = {
  apiBaseUrl: string;
  onBackHome: () => void;
  onLogout: () => void;
};

function stepStatusClass(status?: string) {
  if (status === 'complete') return 'bg-green-100';
  if (status === 'in-progress') return 'bg-yellow-100';
  if (status === 'overdue') return 'bg-red-100';
  return 'bg-orange-100';
}

export default function Roadmap({ apiBaseUrl, onBackHome, onLogout }: RoadmapProps) {
  const navigate = useNavigate();
  const [roadmapData, setRoadmapData] = useState<RoadmapData | null>(null);
  const [isLoadingRoadmap, setIsLoadingRoadmap] = useState(true);

  useEffect(() => {
    const userId = localStorage.getItem('urway_user_id') || '';
    if (!userId) {
      navigate('/signin', { replace: true });
      return;
    }

    const loadDashboard = async () => {
      setIsLoadingRoadmap(true);
      try {
        const response = await fetch(`${apiBaseUrl}/api/dashboard/${userId}`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || 'Failed to load roadmap');
        }
        setRoadmapData(data);
      } catch (error) {
        console.error(error);
        alert((error as Error)?.message || 'Failed to load roadmap dashboard.');
        navigate('/signin', { replace: true });
      } finally {
        setIsLoadingRoadmap(false);
      }
    };

    loadDashboard();
  }, [apiBaseUrl, navigate]);

  return (
    <motion.div
      key="roadmap"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.35 }}
      className="min-h-screen px-6 py-10"
    >
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-neutral-900 flex items-center justify-center font-display text-lg">U</div>
            <span className="font-display text-xl font-bold tracking-tight">U'rWay</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onBackHome}
              className="rounded-full border-2 border-neutral-900 px-4 py-2 font-medium hover:bg-neutral-900 hover:text-white transition"
            >
              Back Home
            </button>
            <button
              onClick={onLogout}
              className="rounded-full border-2 border-neutral-900 px-4 py-2 font-medium bg-neutral-900 text-white hover:opacity-90 transition"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="rounded-3xl border-2 border-neutral-900 bg-emerald-100 px-8 py-6 shadow-[6px_6px_0_#18181B]">
          <h2 className="font-display text-3xl font-bold tracking-tight">Your Adaptive Roadmap</h2>
          <p className="text-neutral-700 mt-1">
            {roadmapData?.profile?.virtualClusterTag
              ? `Cluster: ${roadmapData.profile.virtualClusterTag}`
              : 'Your personalized roadmap is ready.'}
          </p>
        </div>

        {isLoadingRoadmap ? (
          <div className="rounded-3xl border-2 border-neutral-900 p-6">Loading roadmap...</div>
        ) : !roadmapData?.targets?.length ? (
          <div className="rounded-3xl border-2 border-neutral-900 p-6">No roadmap targets found yet.</div>
        ) : (
          <div className="space-y-6">
            {roadmapData.targets.map((target) => (
              <article key={target._id} className="rounded-3xl border-2 border-neutral-900 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold">{target.targetName}</h3>
                  <span className="rounded-full border-2 border-neutral-900 px-3 py-1 text-sm font-semibold">{target.timeline}</span>
                </div>
                <p className="text-neutral-700">{target.description}</p>
                <ol className="space-y-3">
                  {(target.roadmap || []).map((step, idx) => (
                    <li key={`${target._id}-${idx}`} className={`rounded-2xl border-2 border-neutral-900 px-4 py-3 ${stepStatusClass(step.status)}`}>
                      <div className="font-semibold">{step.title}</div>
                      <div className="text-sm text-neutral-700">{step.notes || 'No notes available.'}</div>
                    </li>
                  ))}
                </ol>
              </article>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
