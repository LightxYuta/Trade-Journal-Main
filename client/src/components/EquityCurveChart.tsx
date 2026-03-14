import { useEffect, useRef } from "react";
import type { Trade } from "@shared/schema";
import { getEquityCurve } from "@/lib/tradeUtils";

interface EquityCurveChartProps {
  trades: Trade[];
}

declare global {
  interface Window {
    Chart: any;
  }
}

export function EquityCurveChart({ trades }: EquityCurveChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    if (!canvasRef.current || typeof window.Chart === "undefined") return;

    const data = getEquityCurve(trades);
    
    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
gradient.addColorStop(0, "rgba(0, 210, 138, 0.35)");
gradient.addColorStop(1, "rgba(0, 210, 138, 0.04)");

    chartRef.current = new window.Chart(ctx, {
      type: "line",
      data: {
        labels: data.map(d => d.x),
        datasets: [{
          label: "Cumulative R",
          data: data.map(d => d.y),
          borderColor: "#00d28a",
          backgroundColor: gradient,
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 0,
          borderWidth: 2,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
  padding: {
    top: 0,
    bottom: 0,
  },
},

        interaction: {
          intersect: false,
          mode: "index",
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "rgba(5, 5, 5, 0.95)",
            titleColor: "#ffffff",
            bodyColor: "#b8b8b8",
            borderColor: "rgba(0, 210, 138, 0.5)",
            borderWidth: 1,
            padding: 10,
            cornerRadius: 8,
            displayColors: false,
            callbacks: {
              label: (context: any) => {
                const value = context.parsed.y;
                return `Equity: ${value >= 0 ? "+" : ""}${value.toFixed(2)}R`;
              }
            }
          }
        },
        scales: {
          x: {
            display: true,
            grid: { 
              color: "rgba(37, 37, 37, 0.5)",
              drawBorder: false,
            },
            ticks: {
              color: "#888888",
              font: { size: 10 },
              maxTicksLimit: 10,
            }
          },
          y: {
            display: true,
            grace: 0,
            grid: { 
              color: "rgba(37, 37, 37, 0.5)",
              drawBorder: false,
            },
            ticks: {
              color: "#888888",
              font: { size: 10 },
              callback: (value: number) => `${value}R`
            }
          }
        }
      }
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [trades]);

  if (trades.length === 0) {
    return (
      <div className="h-[220px] flex items-center justify-center text-[#b8b8b8] text-sm">
        No trades to display
      </div>
    );
  }

  return (
    <div className="h-[250px]">
      <canvas ref={canvasRef} data-testid="equity-curve-chart" />
    </div>
  );
}
