import { useEffect, useRef, useState } from "react";
import type { Trade } from "@shared/schema";
import { getEquityCurve } from "@/lib/tradeUtils";

interface EquityCurveChartProps {
  trades: Trade[];
}

declare global {
  interface Window { Chart: any; }
}

function getCleanEquityCurve(trades: Trade[]) {
  const cleanTrades = trades.filter(t =>
    !t.mistakes?.length ||
    t.mistakes.every((m: string) => m.trim().toLowerCase() === "normal model loss")
  );
  // Rebuild with original trade indices for x axis alignment
  let cumulative = 0;
  const sorted = [...trades].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (a.createdAt || 0) - (b.createdAt || 0);
  });
  return sorted.map((t, idx) => {
    const isClean = !t.mistakes?.length || t.mistakes.every((m: string) => m.trim().toLowerCase() === "normal model loss");
    if (isClean) cumulative += t.realisedR || 0;
    return { x: idx + 1, y: parseFloat(cumulative.toFixed(2)) };
  });
}

export function EquityCurveChart({ trades }: EquityCurveChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);
  const [showClean, setShowClean] = useState(false);

  useEffect(() => {
    if (!canvasRef.current || typeof window.Chart === "undefined") return;
    const data = getEquityCurve(trades);
    const cleanData = getCleanEquityCurve(trades);
    if (chartRef.current) chartRef.current.destroy();
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const gradient = ctx.createLinearGradient(0, 0, 0, 220);
    gradient.addColorStop(0, "rgba(0,210,138,0.3)");
    gradient.addColorStop(1, "rgba(0,210,138,0.02)");

    const cleanGradient = ctx.createLinearGradient(0, 0, 0, 220);
    cleanGradient.addColorStop(0, "rgba(100,180,255,0.2)");
    cleanGradient.addColorStop(1, "rgba(100,180,255,0.01)");

    const datasets: any[] = [{
      label: "Actual",
      data: data.map(d => d.y),
      borderColor: "#00d28a",
      backgroundColor: gradient,
      fill: true,
      tension: 0.3,
      pointRadius: 0,
      pointHoverRadius: 4,
      pointHoverBackgroundColor: "#00d28a",
      borderWidth: 2,
    }];

    if (showClean) {
      datasets.push({
        label: "Clean Model",
        data: cleanData.map(d => d.y),
        borderColor: "#64b4ff",
        backgroundColor: cleanGradient,
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: "#64b4ff",
        borderWidth: 1.5,
        borderDash: [4, 3],
      });
    }

    chartRef.current = new window.Chart(ctx, {
      type: "line",
      data: { labels: data.map(d => d.x), datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: "index" },
        plugins: {
          legend: {
            display: showClean,
            position: "top",
            labels: { color: "#555", font: { size: 11 }, boxWidth: 16, padding: 12 }
          },
          tooltip: {
            backgroundColor: "rgba(5,5,5,0.97)",
            titleColor: "#fff",
            bodyColor: "#888",
            borderColor: "#1a1a1a",
            borderWidth: 1,
            padding: 10,
            cornerRadius: 8,
            displayColors: showClean,
            callbacks: {
              label: (c: any) => {
                const v = c.parsed.y;
                return `${c.dataset.label}: ${v >= 0 ? "+" : ""}${v.toFixed(2)}R`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: "rgba(255,255,255,0.03)" },
            ticks: { color: "#333", font: { size: 10 }, maxTicksLimit: 10 }
          },
          y: {
            grid: { color: "rgba(255,255,255,0.03)" },
            ticks: { color: "#333", font: { size: 10 }, callback: (v: number) => `${v}R` }
          }
        }
      }
    });

    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [trades, showClean]);

  if (trades.length === 0) {
    return <div className="h-[250px] flex items-center justify-center text-[#444] text-sm">No trades to display</div>;
  }

  return (
    <div>
      <div className="flex justify-end mb-2">
        <button
          onClick={() => setShowClean(s => !s)}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs transition-all"
          style={{
            transition: "all 0.18s ease",
            border: showClean ? "1px solid rgba(100,180,255,0.4)" : "1px solid rgba(40,40,40,0.8)",
            background: showClean ? "rgba(100,180,255,0.08)" : "transparent",
            color: showClean ? "#64b4ff" : "#444",
          }}
        >
          <span style={{ fontSize: "10px" }}>✦</span>
          {showClean ? "Hide clean model" : "Show clean model"}
        </button>
      </div>
      <div className="h-[250px]">
        <canvas ref={canvasRef} data-testid="equity-curve-chart" />
      </div>
    </div>
  );
}
