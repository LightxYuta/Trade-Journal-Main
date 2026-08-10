import { useEffect, useState } from "react";

type Variant =
  | { type: "sparkline"; points: number[] }
  | { type: "donut"; pct: number } // 0-100
  | { type: "ring"; pct: number }  // 0-100
  | { type: "splitbar"; leftPct: number }; // 0-100, left = green side

interface KpiCardProps {
  label: string;
  value: string;
  color?: string; // value text color
  visual: Variant;
  accent?: string; // mini-visual accent color
}

function useAnimatedNumber(target: number, duration = 600): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf: number;
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (target - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return value;
}

function Sparkline({ points, color }: { points: number[]; color: string }) {
  if (points.length < 2) return <div style={{ width: 56, height: 26 }} />;
  const min = Math.min(...points), max = Math.max(...points);
  const range = max - min || 1;
  const w = 56, h = 26;
  const path = points.map((p, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - ((p - min) / range) * h;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline points={path} fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Donut({ pct, color }: { pct: number; color: string }) {
  const animated = useAnimatedNumber(pct);
  const r = 13, c = 2 * Math.PI * r;
  return (
    <svg width={32} height={32} viewBox="0 0 32 32">
      <circle cx={16} cy={16} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={4} />
      <circle cx={16} cy={16} r={r} fill="none" stroke={color} strokeWidth={4}
        strokeDasharray={c} strokeDashoffset={c - (animated / 100) * c}
        strokeLinecap="round" transform="rotate(-90 16 16)" />
    </svg>
  );
}

function SplitBar({ leftPct, color }: { leftPct: number; color: string }) {
  const animated = useAnimatedNumber(leftPct);
  return (
    <div style={{ width: 56, height: 6, borderRadius: 3, overflow: "hidden", display: "flex" }}>
      <div style={{ width: `${animated}%`, background: color, transition: "width 0.3s" }} />
      <div style={{ width: `${100 - animated}%`, background: "#ff4f4f" }} />
    </div>
  );
}

export function KpiCard({ label, value, color = "#ffffff", visual, accent = "#00d28a" }: KpiCardProps) {
  return (
    <div className="stat-card-trading" style={{ minHeight: 68 }}>
      <div className="text-[0.74rem] text-[#b8b8b8]">{label}</div>
      <div className="flex items-end justify-between gap-2 mt-0.5">
        <span className="text-lg font-semibold" style={{ color }}>{value}</span>
        {visual.type === "sparkline" && <Sparkline points={visual.points} color={accent} />}
        {visual.type === "donut" && <Donut pct={visual.pct} color={accent} />}
        {visual.type === "ring" && <Donut pct={visual.pct} color={accent} />}
        {visual.type === "splitbar" && <SplitBar leftPct={visual.leftPct} color={accent} />}
      </div>
    </div>
  );
}
