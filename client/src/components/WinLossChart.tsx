import { useEffect, useRef } from "react";
import type { TradeStats } from "@shared/schema";

interface WinLossChartProps {
  stats: TradeStats;
}

declare global {
  interface Window { Chart: any; }
}

export function WinLossChart({ stats }: WinLossChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    if (!canvasRef.current || typeof window.Chart === "undefined") return;
    if (chartRef.current) chartRef.current.destroy();

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    chartRef.current = new window.Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["Wins", "Losses", "Break Even"],
        datasets: [{
          data: [stats.wins, stats.losses, stats.bes],
          backgroundColor: [
            "rgba(0, 210, 138, 0.85)",
            "rgba(255, 79, 79, 0.85)",
            "rgba(60, 60, 60, 0.6)",
          ],
          borderColor: ["#001a12", "#1a0000", "#0a0a0a"],
          borderWidth: 3,
          hoverOffset: 6,
          hoverBorderWidth: 3,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "72%",
        plugins: {
          legend: {
            display: true,
            position: "bottom",
            labels: {
              color: "#555",
              font: { size: 11 },
              padding: 14,
              usePointStyle: true,
              pointStyle: "circle",
            }
          },
          tooltip: {
            backgroundColor: "rgba(5,5,5,0.97)",
            titleColor: "#fff",
            bodyColor: "#888",
            borderColor: "#1a1a1a",
            borderWidth: 1,
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (c: any) => {
                const total = stats.wins + stats.losses + stats.bes;
                const pct = total > 0 ? ((c.parsed / total) * 100).toFixed(1) : "0";
                return `  ${c.label}: ${c.parsed} (${pct}%)`;
              }
            }
          }
        }
      }
    });

    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [stats]);

  if (stats.n === 0) {
    return <div className="h-[160px] flex items-center justify-center text-[#444] text-sm">No trades yet</div>;
  }

  // Center stats
  const wr = stats.n > 0 ? ((stats.wins / stats.n) * 100).toFixed(1) : "0";

  return (
    <div className="relative h-[160px]">
      <canvas ref={canvasRef} data-testid="win-loss-chart" />
      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ paddingBottom: "28px" }}>
        <span className="text-xl font-bold text-white">{wr}%</span>
        <span className="text-xs text-[#444]">win rate</span>
      </div>
    </div>
  );
}
