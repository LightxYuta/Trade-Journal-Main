import { useTradeContext } from "@/contexts/TradeContext";
import { useMemo } from "react";
import { useYearFilter } from "@/contexts/YearFilterContext";

export function YearSelector() {
  const { year, setYear } = useYearFilter();
  const { trades } = useTradeContext();

  // Get unique years from trades
  const years = useMemo(() => {
    const yearSet = new Set<number>();
    trades.forEach(trade => {
      if (trade.date) {
        const y = new Date(trade.date).getFullYear();
        yearSet.add(y);
      }
    });
    return Array.from(yearSet).sort((a, b) => b - a);
  }, [trades]);

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-muted-foreground font-medium">Year:</label>
      <select
        className="rounded-lg bg-[#18181b] border border-border px-3 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#a78bfa]/60 shadow"
        value={year}
        onChange={e => setYear(e.target.value === "all" ? "all" : Number(e.target.value))}
        style={{ boxShadow: year !== "all" ? "0 0 6px 1px #a78bfa33" : "none", borderColor: year !== "all" ? "#a78bfa99" : undefined, borderWidth: year !== "all" ? "1.5px" : undefined }}
      >
        <option value="all">All Time</option>
        {years.map(y => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </div>
  );
}
