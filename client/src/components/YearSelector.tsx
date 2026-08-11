import { useState, useRef, useEffect, useMemo } from "react";
import { Calendar, Check } from "lucide-react";
import { useTradeContext } from "@/contexts/TradeContext";
import { useYearFilter } from "@/contexts/YearFilterContext";

export function YearSelector() {
  const { year, setYear } = useYearFilter();
  const { trades } = useTradeContext();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const years = useMemo(() => {
    const yearSet = new Set<number>();
    trades.forEach(trade => {
      if (trade.date) {
        const parsed = new Date(trade.date.includes("T") ? trade.date : `${trade.date}T00:00:00`);
        if (!isNaN(parsed.getTime())) yearSet.add(parsed.getFullYear());
      }
    });
    return Array.from(yearSet).sort((a, b) => b - a);
  }, [trades]);

  const displayLabel = year === "all" ? "All Time" : String(year);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-[#666] hover:text-white transition-colors"
        style={{ border: "1px solid transparent" }}
        aria-label="Filter by year"
      >
        <Calendar className="w-3.5 h-3.5" />
        <span>{displayLabel}</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-1.5 w-40 rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] shadow-lg z-20 overflow-hidden">
          <button
            type="button"
            onClick={() => { setYear("all"); setOpen(false); }}
            className="w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-[#141414] transition-colors"
            style={{ color: year === "all" ? "#ffffff" : "#666" }}
          >
            All Time
            {year === "all" && <Check className="w-3 h-3" style={{ color: "#00d28a" }} />}
          </button>
          {years.map(y => {
            const isActive = year === y;
            return (
              <button
                key={y}
                type="button"
                onClick={() => { setYear(y); setOpen(false); }}
                className="w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-[#141414] transition-colors"
                style={{ color: isActive ? "#ffffff" : "#666" }}
              >
                {y}
                {isActive && <Check className="w-3 h-3" style={{ color: "#00d28a" }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
