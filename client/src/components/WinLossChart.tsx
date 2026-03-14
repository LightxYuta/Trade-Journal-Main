import { useEffect, useRef } from "react";
import type { TradeStats } from "@shared/schema";

interface WinLossChartProps {
  stats: TradeStats;
}

declare global {
  interface Window {
    Chart: any;
  }
}

export function WinLossChart({ stats }: WinLossChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    if (!canvasRef.current || typeof window.Chart === "undefined") return;

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    chartRef.current = new window.Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["Wins", "Losses", "Break Even"],
        datasets: [{
          data: [stats.wins, stats.losses, stats.bes],
          backgroundColor: [
            "rgba(0, 210, 138, 0.8)",
            "rgba(255, 79, 79, 0.8)",
            "rgba(255, 215, 110, 0.8)",
          ],
          borderColor: [
            "rgba(0, 210, 138, 1)",
            "rgba(255, 79, 79, 1)",
            "rgba(255, 215, 110, 1)",
          ],
          borderWidth: 1,
          hoverOffset: 8,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "60%",
        plugins: {
          legend: {
            display: true,
            position: "bottom",
            labels: {
              color: "#b8b8b8",
              font: { size: 11 },
              padding: 12,
              usePointStyle: true,
              pointStyle: "circle",
            }
          },
          tooltip: {
            backgroundColor: "rgba(5, 5, 5, 0.95)",
            titleColor: "#ffffff",
            bodyColor: "#b8b8b8",
            borderColor: "rgba(79, 195, 247, 0.5)",
            borderWidth: 1,
            padding: 10,
            cornerRadius: 8,
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
        No trades yet
      </div>
    );
  }

  return (
    <div className="h-[150px]">
      <canvas ref={canvasRef} data-testid="win-loss-chart" />
    </div>
  );
}
