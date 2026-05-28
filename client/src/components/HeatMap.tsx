import { useMemo } from "react";
import type { Trade } from "@shared/schema";

interface HeatMapProps {
  trades: Trade[];
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function HeatMap({ trades }: HeatMapProps) {
  const data = useMemo(() => {
    const dayData: Record<number, { totalR: number; trades: number }> = {};
    for (let i = 0; i < 7; i++) {
      dayData[i] = { totalR: 0, trades: 0 };
    }
    
    trades.forEach(t => {
      if (t.date) {
        const d = new Date(t.date + "T00:00:00");
        const day = d.getDay();
        dayData[day].totalR += t.realisedR || 0;
        dayData[day].trades++;
      }
    });
    
    return Object.entries(dayData).map(([day, data]) => ({
      label: DAYS[parseInt(day)],
      value: data.totalR,
      trades: data.trades,
      avgR: data.trades > 0 ? data.totalR / data.trades : 0,
    }));
  }, [trades]);

  const maxAbsValue = useMemo(() => {
    const values = data.map(d => Math.abs(d.value));
    return Math.max(...values, 1);
  }, [data]);

  const getColor = (value: number) => {
    const intensity = Math.min(Math.abs(value) / maxAbsValue, 1);
    if (value > 0.0001) {
      return `rgba(0, 210, 138, ${0.2 + intensity * 0.6})`;
    } else if (value < -0.0001) {
      return `rgba(255, 79, 79, ${0.2 + intensity * 0.6})`;
    }
    return "rgba(60, 60, 60, 0.3)";
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-7 gap-1.5">
        {data.map((item, idx) => (
          <div
            key={idx}
            className="heat-cell aspect-square flex-col gap-0.5"
            style={{ background: getColor(item.value) }}
            title={`${item.label}: ${item.value >= 0 ? "+" : ""}${item.value.toFixed(2)}R (${item.trades} trades)`}
            data-testid={`heat-${item.label}`}
          >
            <div className="text-[0.65rem] font-medium text-white">{item.label}</div>
            <div className={`text-[0.7rem] font-semibold ${
              item.value > 0 ? "text-[#00d28a]" : item.value < 0 ? "text-[#ff4f4f]" : "text-[#b8b8b8]"
            }`}>
              {item.value >= 0 ? "+" : ""}{item.value.toFixed(1)}R
            </div>
            <div className="text-[0.6rem] text-[#b8b8b8]">{item.trades}t</div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-4 text-[0.65rem] text-[#b8b8b8]">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm" style={{ background: "rgba(255, 79, 79, 0.6)" }} />
          <span>Loss</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm" style={{ background: "rgba(60, 60, 60, 0.5)" }} />
          <span>Neutral</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm" style={{ background: "rgba(0, 210, 138, 0.6)" }} />
          <span>Profit</span>
        </div>
      </div>
    </div>
  );
}
