import type { EdgeScoreResult } from "@/lib/tradeUtils";

interface EdgeScoreRadarProps {
  result: EdgeScoreResult;
}

const SIZE = 220;
const CENTER = SIZE / 2;
const MAX_R = 78;
const LABEL_RADIUS = MAX_R + 18;

function pointOnAxis(index: number, total: number, radius: number) {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
  return { x: CENTER + radius * Math.cos(angle), y: CENTER + radius * Math.sin(angle) };
}

export function EdgeScoreRadar({ result }: EdgeScoreRadarProps) {
  const { axes, overall } = result;
  const n = axes.length;

  const clampScore = (score: number) => Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0;
  const normalizedAxes = axes.map(a => ({ ...a, score: clampScore(a.score) }));

  const ringLevels = [0.25, 0.5, 0.75, 1];
  const dataPoints = normalizedAxes.map((a, i) => pointOnAxis(i, n, (a.score / 100) * MAX_R));
  const dataPath = dataPoints.map(p => `${p.x},${p.y}`).join(" ");

  const color = overall >= 70 ? "#00d28a" : overall >= 45 ? "#ffd76e" : "#ff4f4f";

  return (
    <div className="flex flex-col items-center">
      <svg viewBox={"-20 -20 260 260"} width="100%" style={{ maxWidth: 240 }}>
        {ringLevels.map((lvl, i) => {
          const pts = axes.map((_, ai) => pointOnAxis(ai, n, MAX_R * lvl));
          return (
            <polygon key={i} points={pts.map(p => `${p.x},${p.y}`).join(" ")}
              fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
          );
        })}
        {axes.map((_, i) => {
          const p = pointOnAxis(i, n, MAX_R);
          return <line key={i} x1={CENTER} y1={CENTER} x2={p.x} y2={p.y} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />;
        })}
        <polygon points={dataPath} fill={color} fillOpacity={0.14} stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
        {dataPoints.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={color} />)}
        {axes.map((a, i) => {
          const labelPt = pointOnAxis(i, n, LABEL_RADIUS);
          const anchor = Math.abs(labelPt.x - CENTER) < 6 ? "middle" : labelPt.x > CENTER ? "start" : "end";
          const lines = (() => {
            switch (a.label) {
              case "Profit factor":
                return ["Profit", "factor"];
              case "Avg win/loss":
                return ["Avg win/", "loss"];
              case "Max drawdown":
                return ["Max", "drawdown"];
              case "Recovery factor":
                return ["Recovery", "factor"];
              case "Consistency":
                return ["Consis", "tency"];
              default:
                return [a.label];
            }
          })();
          return (
            <text key={i} x={labelPt.x} y={labelPt.y} textAnchor={anchor} dominantBaseline="middle"
              fontSize={9.5} fill="#666">
              {lines.map((line, lineIndex) => (
                <tspan key={lineIndex} x={labelPt.x} dy={lineIndex === 0 ? (lines.length === 2 ? -10 : 0) : 11}>
                  {line}
                </tspan>
              ))}
            </text>
          );
        })}
      </svg>
      <div className="text-center -mt-1">
        <p className="text-2xl font-bold" style={{ color }}>{overall.toFixed(1)}</p>
        <p className="text-[10px] text-[#444] uppercase tracking-wider">Edge score</p>
      </div>
    </div>
  );
}
