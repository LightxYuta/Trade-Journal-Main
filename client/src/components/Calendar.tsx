import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Trade } from "@shared/schema";
import { getDayStats, classifyOutcome } from "@/lib/tradeUtils";

interface CalendarProps {
  trades: Trade[];
  onDayClick?: (date: string) => void;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export function Calendar({ trades, onDayClick }: CalendarProps) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const dayStats = useMemo(() => getDayStats(trades), [trades]);

  const calendarData = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    
    // Use 6-day week (Mon-Sat), skip Sundays
    let startDayOfWeek = firstDay.getDay(); // 0 = Sunday, 1 = Monday, ...
    // Adjust so Monday is 0, Saturday is 5, Sunday is skipped
    startDayOfWeek = (startDayOfWeek + 6) % 7;
    if (startDayOfWeek === 6) startDayOfWeek = 0; // If Sunday, start at 0 (no empty days)

    const weeks: Array<Array<{ day: number | null; stats: typeof dayStats[string] | null }>> = [];
    let currentWeek: Array<{ day: number | null; stats: typeof dayStats[string] | null }> = [];

    for (let i = 0; i < startDayOfWeek; i++) {
      currentWeek.push({ day: null, stats: null });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(year, month, day);
      const jsDay = dateObj.getDay();
      if (jsDay === 0) continue; // Skip Sundays
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      currentWeek.push({ day, stats: dayStats[dateStr] || null });
      if (currentWeek.length === 6) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    if (currentWeek.length > 0) {
      const hasAnyDay = currentWeek.some(d => d.day !== null);
      if (hasAnyDay) {
        while (currentWeek.length < 6) {
          currentWeek.push({ day: null, stats: null });
        }
        weeks.push(currentWeek);
      }
    }

    return weeks;
  }, [year, month, dayStats]);

  const monthSummary = useMemo(() => {
    const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
    const monthTrades = trades.filter(t => t.date?.startsWith(monthPrefix));
    const totalR = monthTrades.reduce((sum, t) => sum + (t.realisedR || 0), 0);
    const activeDays = new Set(monthTrades.map(t => t.date)).size;
    
    let bestDay = { date: "", r: -Infinity };
    let worstDay = { date: "", r: Infinity };
    
    Object.entries(dayStats).forEach(([date, stats]) => {
      if (date.startsWith(monthPrefix)) {
        if (stats.totalR > bestDay.r) bestDay = { date, r: stats.totalR };
        if (stats.totalR < worstDay.r) worstDay = { date, r: stats.totalR };
      }
    });
    
    return { totalR, activeDays, bestDay, worstDay };
  }, [trades, year, month, dayStats]);

  const goToPrevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };

  const goToNextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  const goToToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  };

  const isToday = (day: number) => {
    return year === today.getFullYear() && month === today.getMonth() && day === today.getDate();
  };

  return (
    <div>
      <div className="flex justify-between items-center gap-2 mb-3">
        <div className="text-[0.95rem] font-semibold">
          {MONTH_NAMES[month]} {year}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={goToPrevMonth}
            className="btn-ghost-trading rounded-full p-1.5 border border-[rgba(90,90,90,0.9)]"
            data-testid="cal-prev"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={goToNextMonth}
            className="btn-ghost-trading rounded-full p-1.5 border border-[rgba(90,90,90,0.9)]"
            data-testid="cal-next"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={goToToday}
            className="btn-ghost-trading rounded-full px-2.5 py-1 text-xs border border-[rgba(90,90,90,0.9)]"
            data-testid="cal-today"
          >
            Today
          </button>
        </div>
      </div>

<div className="grid grid-cols-[repeat(6,minmax(0,1fr))_minmax(0,1.3fr)] gap-1.5 mb-1">
  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Week"].map(day => (
    <div
      key={day}
      className="text-[0.7rem] text-[#b8b8b8] uppercase tracking-wide text-center"
    >
      {day}
    </div>
  ))}
</div>

      <div className="grid grid-cols-[repeat(6,minmax(0,1fr))_minmax(0,1.3fr)] gap-1.5">
    

        {calendarData.map((week, weekIdx) => {
          const weekStats = week.reduce(
            (acc, day) => {
              if (day.stats) {
                acc.totalR += day.stats.totalR;
                acc.wins += day.stats.wins;
                acc.losses += day.stats.losses;
              }
              return acc;
            },
            { totalR: 0, wins: 0, losses: 0 }
          );

          return (
            <>
              {week.map((day, dayIdx) => {
                if (day.day === null) {
                  return (
                    <div
                      key={`${weekIdx}-${dayIdx}`}
                      className="calendar-day-trading empty"
                    />
                  );
                }

                const stats = day.stats;
                const hasData = stats && stats.trades > 0;
                const r = stats?.totalR || 0;
                const rClass = r > 0.0001 ? "positive" : r < -0.0001 ? "negative" : hasData ? "flat" : "";

                // Color glow and border for positive, negative, and neutral days (50% of original, but with more visible blur)
                // Use the same extremely subtle settings as before, but increase alpha to 0.25 for a gentle but visible effect
                let boxShadow = undefined;
                let borderColor = undefined;
                let borderWidth = undefined;
                let borderStyle = undefined;
                const totalR = day.stats?.totalR ?? 0;
                const tradeCount = day.stats?.trades ?? 0;
                if (totalR > 0) {
                  boxShadow = "0 0 2px 0px #00ffb340"; // subtle green glow, alpha 0.25
                  borderColor = "#00ffb340";
                  borderWidth = "1.5px";
                  borderStyle = "solid";
                } else if (totalR < 0) {
                  boxShadow = "0 0 2px 0px #ff3b3b40"; // subtle red glow, alpha 0.25
                  borderColor = "#ff3b3b40";
                  borderWidth = "1.5px";
                  borderStyle = "solid";
                } else if (totalR === 0 && tradeCount > 0) {
                  boxShadow = "0 0 2px 0px #ffd70040"; // subtle golden glow, alpha 0.25
                  borderColor = "#ffd70040";
                  borderWidth = "1.5px";
                  borderStyle = "solid";
                }

                // If today, override border and glow to be a very subtle gold (20% of current)
                if (isToday(day.day)) {
                  boxShadow = "0 0 2px 0px #ffd70033"; // gold glow, alpha 0.2
                  borderColor = "#ffd70033";
                  borderWidth = "1.5px";
                  borderStyle = "solid";
                }

                return (
                  <div
  key={`${weekIdx}-${dayIdx}`}
  className={`calendar-day-trading ${rClass} ${isToday(day.day) ? "today" : ""}`}
  data-testid={`cal-day-${day.day}`}
  style={{
    minHeight: "72px",
    boxShadow,
    borderColor,
    borderWidth,
    borderStyle,
    background: undefined, // override any background from CSS if needed
  }}
  onClick={() => {
    if (onDayClick && day.day !== null && day.stats && day.stats.trades > 0) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day.day).padStart(2, "0")}`;
      onDayClick(dateStr);
    }
  }}
>

                    <div className="flex justify-between items-center mb-0.5">
                      <span className="text-[0.74rem] font-semibold text-[#b8b8b8]">{day.day}</span>
                      {hasData && (
                        <span className={`text-[0.76rem] font-semibold ${
                          r > 0 ? "text-[#00d28a]" : r < 0 ? "text-[#ff4f4f]" : "text-[#b8b8b8]"
                        }`}>
                          {r >= 0 ? "+" : ""}{r.toFixed(2)}R
                        </span>
                      )}
                    </div>
                    {hasData && (
                      <div className="text-[0.69rem] text-[#b8b8b8]">
                        {stats.trades} trade{stats.trades === 1 ? "" : "s"}
                      </div>
                    )}
                  </div>
                );
              })}

              <div 
                className={`calendar-day-trading ${
                  weekStats.totalR > 0.0001 ? "positive" : weekStats.totalR < -0.0001 ? "negative" : "flat"
                }`}
                style={{
                  background: "radial-gradient(circle at top left, rgba(255, 215, 110, 0.08), rgba(5, 5, 5, 0.98))",
                }}
              >
                <div className="flex justify-between items-baseline gap-1 mb-0.5">
                  <span className="text-[0.7rem] uppercase tracking-wider text-[#b8b8b8]">
                    Wk {weekIdx + 1}
                  </span>
                  <span className={`text-[0.76rem] font-semibold ${
                    weekStats.totalR > 0 ? "text-[#ffd76e]" : weekStats.totalR < 0 ? "text-[#ff4f4f]" : "text-[#b8b8b8]"
                  }`}>
                    {weekStats.totalR >= 0 ? "+" : ""}{weekStats.totalR.toFixed(2)}R
                  </span>
                </div>
                <div className="text-[0.68rem] text-[#b8b8b8]">
                  W: {weekStats.wins} · L: {weekStats.losses}
                </div>
              </div>
            </>
          );
        })}
      </div>

      <div className="mt-4 p-3 rounded-[18px] border border-[rgba(60,60,60,0.95)]" style={{ background: "rgba(10, 10, 10, 0.97)" }}>
        <div className="text-[0.78rem] uppercase tracking-wider text-[#b8b8b8] mb-2">
          Monthly Summary
        </div>
        <div className={`text-lg font-semibold ${
          monthSummary.totalR > 0 ? "text-[#00d28a]" : monthSummary.totalR < 0 ? "text-[#ff4f4f]" : "text-white"
        }`}>
          {monthSummary.totalR >= 0 ? "+" : ""}{monthSummary.totalR.toFixed(2)}R
        </div>
        <div className="text-[0.72rem] text-[#b8b8b8] mt-1">
          {monthSummary.activeDays} active day{monthSummary.activeDays === 1 ? "" : "s"}
          {monthSummary.bestDay.r > -Infinity && (
            <> · Best: {monthSummary.bestDay.r.toFixed(2)}R</>
          )}
          {monthSummary.worstDay.r < Infinity && (
            <> · Worst: {monthSummary.worstDay.r.toFixed(2)}R</>
          )}
        </div>
      </div>
    </div>
  );
}
