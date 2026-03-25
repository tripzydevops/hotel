"use client";

import { useEffect, useRef, useState } from "react";

// Hub & Spoke visualization using simple SVG + CSS animations.
// Replaces external d3/react-force-graph dependencies.

interface Node {
  id: string;
  label: string;
  type: "target" | "competitor";
  value: number; // e.g. price
}

interface Link {
  source: string;
  target: string;
  strength: number;
}

interface CompsetGraphProps {
  nodes: Node[];
  links: Link[];
  currencySymbol?: string;
}

export default function CompsetGraph({
  nodes,
  links,
  currencySymbol = "$",
}: CompsetGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 });

  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  const { width, height } = dimensions;

  // Simple circular layout calculation
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.35;

  const targetNode = nodes.find((n) => n.type === "target");
  const competitors = nodes.filter((n) => n.type === "competitor");

  // Calculate positions
  const positions = new Map<string, { x: number; y: number }>();

  if (targetNode) {
    positions.set(targetNode.id, { x: centerX, y: centerY });
  }

  competitors.forEach((comp, i) => {
    const angle = (i / competitors.length) * 2 * Math.PI - Math.PI / 2;
    positions.set(comp.id, {
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
    });
  });

  return (
    <div
      ref={containerRef}
      className="h-[400px] w-full bg-[#0f172a] rounded-xl border border-white/10 relative overflow-hidden"
    >
      <div className="absolute top-4 left-4 z-10">
        <h3 className="text-sm font-medium text-white/90">
          Competitive Network
        </h3>
        <p className="text-xs text-white/50">
          {links.length} relationships active
        </p>
      </div>

      <svg
        width={width}
        height={height}
        className="absolute inset-0 pointer-events-none"
      >
        {/* Draw Links */}
        {links.map((link, i) => {
          const start = positions.get(link.source);
          const end = positions.get(link.target);
          if (!start || !end) return null;
          return (
            <line
              key={i}
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke="rgba(255,255,255,0.1)"
              strokeWidth={1}
            />
          );
        })}
      </svg>

      {/* Draw Nodes */}
      {nodes.map((node) => {
        const pos = positions.get(node.id);
        if (!pos) return null;

        const isTarget = node.type === "target";

        return (
          <div
            key={node.id}
            className={`absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center transition-all duration-500`}
            style={{ left: pos.x, top: pos.y }}
          >
            <div
              className={`
                relative flex items-center justify-center rounded-full border shadow-xl
                ${
                  isTarget
                    ? "w-16 h-16 bg-blue-600 border-blue-400 z-20"
                    : "w-12 h-12 bg-slate-800 border-slate-600 z-10 hover:border-white hover:bg-slate-700"
                }
              `}
            >
              <div className="text-[10px] font-bold text-white">
                {isTarget ? "YOU" : "COMP"}
              </div>
              {/* Pulse Effect for Target */}
              {isTarget && (
                <div className="absolute inset-0 rounded-full bg-blue-500 animate-ping opacity-20"></div>
              )}
            </div>

            <div
              className={`mt-2 px-2 py-1 rounded bg-black/50 backdrop-blur text-xs text-white whitespace-nowrap border border-white/10 ${isTarget ? "font-bold text-blue-200" : "text-slate-300"}`}
            >
              {node.label}
            </div>
            <div className="text-[10px] text-emerald-400 font-mono mt-0.5">
              {currencySymbol}{node.value}
            </div>
          </div>
        );
      })}
    </div>
  );
}
