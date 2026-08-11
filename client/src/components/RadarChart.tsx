import { useEffect, useRef } from "react";
import type { TradeStats } from "@shared/schema";

interface RadarChartProps {
  stats: TradeStats;
}

declare global {
  interface Window {
    Chart: any;
  }
}

export function RadarChart({ stats }: RadarChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    if (!canvasRef.current || typeof window.Chart === "undefined") return;

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const winRateNorm = Math.min(stats.winrate, 100);
    const winLossNorm = Math.min(stats.winLossRatio * 33, 100);
    const pfNorm = Math.min((stats.profitFactor === Infinity ? 5 : stats.profitFactor) * 20, 100);
    const expNorm = Math.min((stats.expR + 2) * 25, 100);
    const streakNorm = Math.min(stats.bestWinStreak * 10, 100);

    chartRef.current = new window.Chart(ctx, {
      type: "radar",
      data: {
        labels: ["Win Rate", "Win/Loss R", "Profit Factor", "Expectancy", "Best Streak"],
        datasets: [{
          label: "Performance",
          data: [winRateNorm, winLossNorm, pfNorm, expNorm, streakNorm],
          backgroundColor: "rgba(255, 215, 110, 0.2)",
          borderColor: "rgba(255, 215, 110, 0.8)",
          borderWidth: 2,
          pointBackgroundColor: "#ffd76e",
          pointBorderColor: "#ffd76e",
          pointRadius: 3,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "rgba(5, 5, 5, 0.95)",
            titleColor: "#ffffff",
            bodyColor: "#b8b8b8",
            borderColor: "rgba(255, 215, 110, 0.5)",
            borderWidth: 1,
            padding: 10,
            cornerRadius: 8,
          }
        },
        scales: {
          r: {
            angleLines: {
              color: "rgba(90, 90, 90, 0.3)",
            },
            grid: {
              color: "rgba(90, 90, 90, 0.3)",
            },
            pointLabels: {
              color: "#b8b8b8",
              font: { size: 9 }
            },
            ticks: {
              display: false,
            },
            suggestedMin: 0,
            suggestedMax: 100,
          }
        }
      }
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [stats]);

  if (stats.n === 0) {
    return (
      <div className="h-[150px] flex items-center justify-center text-[#b8b8b8] text-sm">
        No data
      </div>
    );
  }

  return (
    <div className="h-[150px]">
      <canvas ref={canvasRef} data-testid="radar-chart" />
    </div>
  );
}
