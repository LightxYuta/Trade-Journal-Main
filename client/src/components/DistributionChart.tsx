import { useEffect, useRef } from "react";
import type { Trade } from "@shared/schema";
import { getRDistribution } from "@/lib/tradeUtils";

interface DistributionChartProps {
  trades: Trade[];
}

declare global {
  interface Window {
    Chart: any;
  }
}

export function DistributionChart({ trades }: DistributionChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    if (!canvasRef.current || typeof window.Chart === "undefined") return;

    const data = getRDistribution(trades);
    
    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const colors = data.map(d => {
      if (d.range.includes("-")) {
        return "rgba(255, 79, 79, 0.7)";
      } else if (d.range.includes("0R to 1R")) {
        return "rgba(255, 215, 110, 0.7)";
      }
      return "rgba(0, 210, 138, 0.7)";
    });

    chartRef.current = new window.Chart(ctx, {
      type: "bar",
      data: {
        labels: data.map(d => d.range),
        datasets: [{
          label: "Trades",
          data: data.map(d => d.count),
          backgroundColor: colors,
          borderColor: colors.map(c => c.replace("0.7", "1")),
          borderWidth: 1,
          borderRadius: 4,
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
            borderColor: "rgba(79, 195, 247, 0.5)",
            borderWidth: 1,
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (context: any) => {
                const item = data[context.dataIndex];
                return `${item.count} trades (${item.percentage.toFixed(1)}%)`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: "#888888",
              font: { size: 9 },
              maxRotation: 45,
              minRotation: 45,
            }
          },
          y: {
            grid: { 
              color: "rgba(37, 37, 37, 0.5)",
              drawBorder: false,
            },
            ticks: {
              color: "#888888",
              font: { size: 10 },
              stepSize: 1,
            },
            beginAtZero: true,
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
      <div className="h-[200px] flex items-center justify-center text-[#b8b8b8] text-sm">
        No trades to display
      </div>
    );
  }

  return (
    <div className="h-[200px]">
      <canvas ref={canvasRef} data-testid="distribution-chart" />
    </div>
  );
}
