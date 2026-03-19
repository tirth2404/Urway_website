import { useEffect, useRef } from 'react';

const statusClass = {
  complete: 'nodeComplete',
  'in-progress': 'nodeProgress',
  remaining: 'nodeRemaining',
  overdue: 'nodeOverdue',
};

function buildGraph(steps = []) {
  const nodes = steps
    .map((step, index) => {
      const id = `S${index + 1}`;
      const title = (step.title || `Step ${index + 1}`).replace(/"/g, "'");
      return `${id}["${title}"]`;
    })
    .join('\n');

  const links = steps
    .map((_, index) => {
      if (index === 0) return null;
      return `S${index} --> S${index + 1}`;
    })
    .filter(Boolean)
    .join('\n');

  const classes = steps
    .map((step, index) => `class S${index + 1} ${statusClass[step.status] || 'nodeRemaining'};`)
    .join('\n');

  return `flowchart LR\n${nodes}\n${links}\nclassDef nodeComplete fill:#16a34a,stroke:#86efac,color:#eafff0,stroke-width:2px;\nclassDef nodeProgress fill:#ca8a04,stroke:#facc15,color:#111827,stroke-width:2px;\nclassDef nodeRemaining fill:#c2410c,stroke:#fb923c,color:#fff7ed,stroke-width:2px;\nclassDef nodeOverdue fill:#dc2626,stroke:#f87171,color:#fff1f2,stroke-width:2px;\n${classes}`;
}

export default function RoadmapMermaid({ steps, chartId }) {
  const rootRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function renderChart() {
      if (!rootRef.current) return;

      const mermaidModule = await import('mermaid');
      const mermaid = mermaidModule.default;
      mermaid.initialize({ startOnLoad: false, securityLevel: 'loose', theme: 'dark' });

      const graph = buildGraph(steps);
      const id = `mermaid-${chartId}`;
      const { svg } = await mermaid.render(id, graph);
      if (!cancelled && rootRef.current) {
        rootRef.current.innerHTML = svg;
      }
    }

    renderChart();

    return () => {
      cancelled = true;
    };
  }, [steps, chartId]);

  return <div ref={rootRef} className="overflow-x-auto rounded-2xl border border-cyan-900/60 bg-slate-950/80 p-4" />;
}
