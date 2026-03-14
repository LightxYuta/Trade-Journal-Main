import { useState, useMemo, useEffect, useRef } from "react";
import { useTradeContext } from "@/contexts/TradeContext";
import { useYearFilter } from "@/contexts/YearFilterContext";
import {
  computeStats, formatR, getFilteredTrades,
  getPerformanceBySession, getPerformanceByDayOfWeek
} from "@/lib/tradeUtils";

declare global { interface Window { Chart: any; } }

// ── Helpers ───────────────────────────────────────────────────────────────────

function cleanModelStats(trades: any[]) {
  const clean = trades.filter(t =>
    !t.mistakes?.length || t.mistakes.every((m: string) => m.trim().toLowerCase() === "normal model loss")
  );
  return computeStats(clean);
}

function getSymbolStats(trades: any[]) {
  const map: Record<string, { totalR: number; wins: number; losses: number; trades: number }> = {};
  trades.forEach(t => {
    const k = t.symbol || "Unknown";
    if (!map[k]) map[k] = { totalR: 0, wins: 0, losses: 0, trades: 0 };
    map[k].totalR += t.realisedR || 0;
    map[k].trades++;
    if ((t.realisedR || 0) > 0.0001) map[k].wins++;
    else if ((t.realisedR || 0) < -0.0001) map[k].losses++;
  });
  return Object.entries(map)
    .map(([symbol, s]) => ({ symbol, ...s, winRate: s.trades > 0 ? (s.wins / s.trades) * 100 : 0 }))
    .sort((a, b) => b.totalR - a.totalR);
}

function getMonthlyData(trades: any[]) {
  const map: Record<string, { label: string; totalR: number; trades: number; wins: number }> = {};
  trades.forEach(t => {
    if (!t.date) return;
    const d = new Date(t.date + "T00:00:00");
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("default", { month: "short", year: "2-digit" });
    if (!map[key]) map[key] = { label, totalR: 0, trades: 0, wins: 0 };
    map[key].totalR += t.realisedR || 0;
    map[key].trades++;
    if ((t.realisedR || 0) > 0.0001) map[key].wins++;
  });
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => ({ ...v, winRate: v.trades > 0 ? (v.wins / v.trades) * 100 : 0 }));
}

function getWeeklyTradeCount(trades: any[]) {
  const map: Record<string, number> = {};
  trades.forEach(t => {
    if (!t.date) return;
    const d = new Date(t.date + "T00:00:00");
    d.setDate(d.getDate() - d.getDay());
    const key = d.toISOString().slice(0, 10);
    map[key] = (map[key] || 0) + 1;
  });
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([key, count]) => {
    const d = new Date(key + "T00:00:00");
    return { label: d.toLocaleString("default", { month: "short", day: "numeric" }), count };
  });
}

// ── Dynamic insights ──────────────────────────────────────────────────────────
function generateInsights(trades: any[], sessionPerf: any[], dayPerf: any[], symbolStats: any[], stats: any) {
  const insights: { text: string; color: string; icon: string }[] = [];
  if (trades.length < 5) return insights;

  // Best vs worst pair
  if (symbolStats.length >= 2) {
    const best = symbolStats[0];
    const worst = symbolStats[symbolStats.length - 1];
    if (best.totalR > 0)
      insights.push({ text: `${best.symbol} is your best instrument — ${formatR(best.totalR)} at ${best.winRate.toFixed(0)}% WR`, color: "#00d28a", icon: "↑" });
    if (worst.totalR < 0)
      insights.push({ text: `${worst.symbol} is costing you — ${formatR(worst.totalR)} over ${worst.trades} trades`, color: "#ff4f4f", icon: "↓" });
  }

  // Best vs worst session
  const sortedSessions = [...sessionPerf].filter(s => s.trades >= 3).sort((a, b) => b.totalR - a.totalR);
  if (sortedSessions.length >= 2) {
    const bestS = sortedSessions[0];
    const worstS = sortedSessions[sortedSessions.length - 1];
    if (bestS.totalR > 0)
      insights.push({ text: `${bestS.label} is your strongest session — ${formatR(bestS.totalR)} at ${bestS.winRate.toFixed(0)}% WR`, color: "#00d28a", icon: "→" });
    if (worstS.totalR < 0)
      insights.push({ text: `${worstS.label} is dragging your results — ${formatR(worstS.totalR)} lost`, color: "#ff4f4f", icon: "→" });
  }

  // Best day of week
  const activeDays = dayPerf.filter(d => d.trades >= 3);
  if (activeDays.length > 0) {
    const bestDay = [...activeDays].sort((a, b) => b.totalR - a.totalR)[0];
    const worstDay = [...activeDays].sort((a, b) => a.totalR - b.totalR)[0];
    if (bestDay.totalR > 0)
      insights.push({ text: `${bestDay.label} is your best trading day — ${formatR(bestDay.totalR)} across ${bestDay.trades} trades`, color: "#00d28a", icon: "★" });
    if (worstDay.totalR < 0 && worstDay.label !== bestDay.label)
      insights.push({ text: `${worstDay.label} is your worst day — ${formatR(worstDay.totalR)} lost`, color: "#ff4f4f", icon: "✕" });
  }

  // Avg win vs avg loss
  if (stats.avgWin > 0 && stats.avgLoss < 0) {
    const ratio = (stats.avgWin / Math.abs(stats.avgLoss));
    if (ratio >= 2)
      insights.push({ text: `Your winners are ${ratio.toFixed(1)}x bigger than your losers — strong payoff ratio`, color: "#00d28a", icon: "↑" });
    else if (ratio < 1.5)
      insights.push({ text: `Avg win (${formatR(stats.avgWin)}) is only ${ratio.toFixed(1)}x avg loss (${formatR(stats.avgLoss)}) — push targets harder`, color: "#ffd76e", icon: "!" });
  }

  // Overtrading signal
  const avgTradesPerMonth = trades.length > 0 ? trades.length / Math.max(1, Object.keys((() => {
    const m: Record<string, boolean> = {};
    trades.forEach((t: any) => { if (t.date) m[t.date.slice(0, 7)] = true; });
    return m;
  })()).length) : 0;
  if (avgTradesPerMonth > 25)
    insights.push({ text: `Averaging ${avgTradesPerMonth.toFixed(0)} trades/month — your best months had ~18. Consider trading less`, color: "#ffd76e", icon: "!" });

  // Profit factor context
  if (stats.profitFactor >= 2)
    insights.push({ text: `Profit factor of ${stats.profitFactor.toFixed(2)} — top 10% of retail traders are above 2.0`, color: "#00d28a", icon: "★" });

  return insights.slice(0, 5);
}

// ── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="text-xs text-[#555] uppercase tracking-[0.2em] font-medium">{children}</span>
      <div className="flex-1 h-px bg-[#161616]" />
    </div>
  );
}

// ── Stat tile ─────────────────────────────────────────────────────────────────
function Tile({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-2xl border border-[#161616] bg-[#0a0a0a] p-4">
      <p className="text-xs text-[#555] uppercase tracking-wider mb-2">{label}</p>
      <p className="text-2xl font-semibold text-white" style={{ color: color || "#ffffff" }}>{value}</p>
      {sub && <p className="text-xs text-[#444] mt-1">{sub}</p>}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Analytics() {
  const { trades } = useTradeContext();
  const { year } = useYearFilter();
  const [filter, setFilter] = useState<"all" | "month" | "week">("all");
  const [showClean, setShowClean] = useState(false);
  const [monthlyView, setMonthlyView] = useState<"chart" | "table">("chart");

  const yearFilteredTrades = useMemo(() => {
    if (year === "all") return trades;
    return trades.filter(t => t.date && new Date(t.date).getFullYear() === year);
  }, [trades, year]);

  const filteredTrades = useMemo(() => getFilteredTrades(yearFilteredTrades, filter), [yearFilteredTrades, filter]);
  const stats = useMemo(() => computeStats(filteredTrades), [filteredTrades]);
  const cleanStats = useMemo(() => cleanModelStats(filteredTrades), [filteredTrades]);
  const displayStats = showClean ? cleanStats : stats;

  const symbolStats = useMemo(() => getSymbolStats(filteredTrades), [filteredTrades]);
  const monthlyData = useMemo(() => getMonthlyData(yearFilteredTrades), [yearFilteredTrades]);
  const weeklyCount = useMemo(() => getWeeklyTradeCount(yearFilteredTrades), [yearFilteredTrades]);
  const sessionPerf = useMemo(() => getPerformanceBySession(filteredTrades), [filteredTrades]);
  const dayPerf = useMemo(() => getPerformanceByDayOfWeek(filteredTrades), [filteredTrades]);
  const insights = useMemo(() => generateInsights(filteredTrades, sessionPerf, dayPerf, symbolStats, stats), [filteredTrades, sessionPerf, dayPerf, symbolStats, stats]);

  // Chart refs
  const monthlyChartRef = useRef<HTMLCanvasElement>(null);
  const weeklyChartRef = useRef<HTMLCanvasElement>(null);
  const chartsRef = useRef<Record<string, any>>({});

  useEffect(() => {
    if (typeof window.Chart === "undefined") return;
    const darkTooltip = {
      backgroundColor: "rgba(5,5,5,0.97)",
      titleColor: "#fff",
      bodyColor: "#888",
      borderColor: "#1e1e1e",
      borderWidth: 1,
      padding: 10,
      cornerRadius: 8,
    };

    // Monthly dual-line chart
    if (monthlyChartRef.current && monthlyData.length > 0 && monthlyView === "chart") {
      chartsRef.current.monthly?.destroy();
      chartsRef.current.monthly = new window.Chart(monthlyChartRef.current.getContext("2d"), {
        type: "line",
        data: {
          labels: monthlyData.map(m => m.label),
          datasets: [
            {
              label: "Total R",
              data: monthlyData.map(m => parseFloat(m.totalR.toFixed(2))),
              borderColor: "#00d28a",
              backgroundColor: "rgba(0,210,138,0.05)",
              borderWidth: 2,
              pointRadius: 4,
              pointBackgroundColor: monthlyData.map(m => m.totalR >= 0 ? "#00d28a" : "#ff4f4f"),
              tension: 0.3,
              fill: true,
              yAxisID: "yR",
            },
            {
              label: "Win Rate %",
              data: monthlyData.map(m => parseFloat(m.winRate.toFixed(1))),
              borderColor: "#ffd76e",
              backgroundColor: "rgba(255,215,110,0.0)",
              borderWidth: 1.5,
              pointRadius: 3,
              pointBackgroundColor: "#ffd76e",
              tension: 0.3,
              fill: false,
              borderDash: [4, 3],
              yAxisID: "yWR",
            }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: {
              display: true,
              position: "top",
              labels: { color: "#666", font: { size: 11 }, boxWidth: 20, padding: 16 }
            },
            tooltip: {
              ...darkTooltip,
              callbacks: {
                label: (c: any) => c.dataset.label === "Total R"
                  ? `  R: ${c.raw >= 0 ? "+" : ""}${c.raw}R`
                  : `  WR: ${c.raw}%`
              }
            }
          },
          scales: {
            yR: {
              type: "linear", position: "left",
              grid: { color: "#0d0d0d" },
              ticks: { color: "#444", font: { size: 10 }, callback: (v: any) => `${v}R` }
            },
            yWR: {
              type: "linear", position: "right",
              min: 0, max: 100,
              grid: { display: false },
              ticks: { color: "#444", font: { size: 10 }, callback: (v: any) => `${v}%` }
            },
            x: { grid: { display: false }, ticks: { color: "#555", font: { size: 10 } } }
          }
        }
      });
    }

    // Weekly trade count
    if (weeklyChartRef.current && weeklyCount.length > 0) {
      chartsRef.current.weekly?.destroy();
      chartsRef.current.weekly = new window.Chart(weeklyChartRef.current.getContext("2d"), {
        type: "line",
        data: {
          labels: weeklyCount.map(w => w.label),
          datasets: [{
            data: weeklyCount.map(w => w.count),
            borderColor: "#ffd76e",
            backgroundColor: "rgba(255,215,110,0.04)",
            borderWidth: 1.5,
            pointRadius: 3,
            pointBackgroundColor: "#ffd76e",
            tension: 0.3,
            fill: true,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c: any) => `${c.raw} trades` }, ...darkTooltip } },
          scales: {
            y: { grid: { color: "#0d0d0d" }, ticks: { color: "#444", font: { size: 10 } }, beginAtZero: true },
            x: { grid: { display: false }, ticks: { color: "#555", font: { size: 10 } } }
          }
        }
      });
    }

    return () => { Object.values(chartsRef.current).forEach((c: any) => c?.destroy()); };
  }, [monthlyData, weeklyCount, monthlyView]);

  const maxDayR = Math.max(...dayPerf.map(d => Math.abs(d.totalR)), 1);

  // Grade stats
  const gradeStats = useMemo(() => {
    const map: Record<string, { wins: number; losses: number; totalR: number; trades: number }> = {};
    filteredTrades.forEach((t: any) => {
      const g = t.setupGrade || "Unknown";
      if (!map[g]) map[g] = { wins: 0, losses: 0, totalR: 0, trades: 0 };
      map[g].trades++;
      map[g].totalR += t.realisedR || 0;
      if ((t.realisedR || 0) > 0.0001) map[g].wins++;
      else if ((t.realisedR || 0) < -0.0001) map[g].losses++;
    });
    return Object.entries(map).map(([grade, s]) => ({
      grade, ...s, winRate: s.trades > 0 ? (s.wins / s.trades) * 100 : 0
    })).sort((a, b) => b.winRate - a.winRate);
  }, [filteredTrades]);

  return (
    <div className="min-h-screen p-6 max-w-[1300px]">
      {/* Header */}
      <div className="flex items-start justify-between mb-10">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-1 h-6 rounded-full bg-[#00d28a]" />
            <h1 className="text-2xl font-semibold text-white">Analytics</h1>
          </div>
          <p className="text-sm text-[#555] ml-4">{filteredTrades.length} trades in view</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowClean(s => !s)}
            className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${showClean ? "border-[#00d28a] text-[#00d28a] bg-[#0a1a0a]" : "border-[#1a1a1a] text-[#555] hover:text-white"}`}>
            {showClean ? "✓ Clean model" : "Clean model"}
          </button>
          <div className="flex rounded-lg border border-[#161616] overflow-hidden text-xs">
            {(["week", "month", "all"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-2 transition-colors ${filter === f ? "bg-[#161616] text-white" : "text-[#444] hover:text-white"}`}>
                {f === "all" ? "All Time" : f === "month" ? "This Month" : "This Week"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Core metrics ── */}
      <SectionLabel>Core Metrics</SectionLabel>
      <div className="grid grid-cols-4 gap-3 mb-4">
        <Tile label="Win Rate" value={`${displayStats.winrate.toFixed(1)}%`}
          color={displayStats.winrate >= 50 ? "#00d28a" : "#ff4f4f"}
          sub={showClean ? `${stats.winrate.toFixed(1)}% overall` : `${displayStats.wins}W · ${displayStats.losses}L · ${displayStats.bes}BE`} />
        <Tile label="Total R" value={formatR(displayStats.totalR)}
          color={displayStats.totalR >= 0 ? "#00d28a" : "#ff4f4f"}
          sub={`${displayStats.n} trades`} />
        <Tile label="Profit Factor" value={displayStats.profitFactor === Infinity ? "∞" : displayStats.profitFactor.toFixed(2)}
          color={displayStats.profitFactor >= 2 ? "#00d28a" : displayStats.profitFactor >= 1 ? "#ffd76e" : "#ff4f4f"}
          sub={displayStats.profitFactor >= 2 ? "Excellent" : displayStats.profitFactor >= 1 ? "Profitable" : "Needs work"} />
        <Tile label="Expectancy" value={formatR(displayStats.expR)}
          color={displayStats.expR >= 0 ? "#00d28a" : "#ff4f4f"}
          sub="per trade" />
      </div>
      <div className="grid grid-cols-4 gap-3 mb-10">
        <Tile label="Sharpe Ratio" value={displayStats.sharpeRatio.toFixed(2)}
          color={displayStats.sharpeRatio >= 2 ? "#00d28a" : displayStats.sharpeRatio >= 1 ? "#ffd76e" : "#ff4f4f"}
          sub={displayStats.sharpeRatio >= 2 ? "Very strong" : displayStats.sharpeRatio >= 1 ? "Solid" : "Below target"} />
        <Tile label="Avg Win" value={formatR(displayStats.avgWin)} color="#00d28a" sub="per winning trade" />
        <Tile label="Avg Loss" value={formatR(displayStats.avgLoss)} color="#ff4f4f" sub="per losing trade" />
        <Tile label="Max Drawdown" value={formatR(-displayStats.maxDrawdown)} color="#ff4f4f"
          sub={`${displayStats.worstLossStreak} max consec losses`} />
      </div>

      {/* ── Clean model comparison ── */}
      {!showClean && filteredTrades.length >= 5 && (
        <>
          <SectionLabel>Clean Model vs Full</SectionLabel>
          <div className="grid grid-cols-3 gap-3 mb-10">
            {[
              { label: "Win Rate", full: `${stats.winrate.toFixed(1)}%`, clean: `${cleanStats.winrate.toFixed(1)}%`, better: cleanStats.winrate > stats.winrate },
              { label: "Profit Factor", full: stats.profitFactor === Infinity ? "∞" : stats.profitFactor.toFixed(2), clean: cleanStats.profitFactor === Infinity ? "∞" : cleanStats.profitFactor.toFixed(2), better: cleanStats.profitFactor > stats.profitFactor },
              { label: "Expectancy", full: formatR(stats.expR), clean: formatR(cleanStats.expR), better: cleanStats.expR > stats.expR },
            ].map(item => (
              <div key={item.label} className="rounded-2xl border border-[#161616] bg-[#0a0a0a] p-5">
                <p className="text-xs text-[#555] uppercase tracking-wider mb-4">{item.label}</p>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs text-[#444] mb-1">All trades</p>
                    <p className="text-xl font-semibold text-[#555]">{item.full}</p>
                  </div>
                  <div className="text-[#222] text-xl mb-1">→</div>
                  <div className="text-right">
                    <p className="text-xs text-[#00d28a] mb-1">Clean model</p>
                    <p className="text-xl font-semibold text-[#00d28a]">{item.clean}</p>
                  </div>
                </div>
                {item.better && <p className="text-xs text-[#00d28a] mt-3 pt-3 border-t border-[#111]">↑ Your edge when following rules</p>}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Monthly performance ── */}
      <SectionLabel>Monthly Performance</SectionLabel>
      <div className="rounded-2xl border border-[#161616] bg-[#0a0a0a] overflow-hidden mb-10">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#111]">
          <p className="text-sm font-medium text-white">All months</p>
          <div className="flex rounded-lg border border-[#161616] overflow-hidden text-xs">
            <button onClick={() => setMonthlyView("chart")}
              className={`px-3 py-1.5 transition-colors ${monthlyView === "chart" ? "bg-[#161616] text-white" : "text-[#444] hover:text-white"}`}>
              Chart
            </button>
            <button onClick={() => setMonthlyView("table")}
              className={`px-3 py-1.5 transition-colors ${monthlyView === "table" ? "bg-[#161616] text-white" : "text-[#444] hover:text-white"}`}>
              Table
            </button>
          </div>
        </div>

        {monthlyView === "chart" ? (
          <div className="p-5 h-56">
            <canvas ref={monthlyChartRef} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left bg-[#080808] border-b border-[#111]">
                  {["Month", "Trades", "Win Rate", "Total R", "Avg R"].map(h => (
                    <th key={h} className="px-5 py-3 text-xs text-[#444] font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthlyData.map((m, i) => (
                  <tr key={i} className="border-t border-[#0d0d0d] hover:bg-[#0d0d0d] transition-colors">
                    <td className="px-5 py-3 text-white font-medium">{m.label}</td>
                    <td className="px-5 py-3 text-[#888]">{m.trades}</td>
                    <td className="px-5 py-3">
                      <span className={`text-sm font-medium ${m.winRate >= 50 ? "text-[#00d28a]" : "text-[#ff4f4f]"}`}>
                        {m.winRate.toFixed(0)}%
                      </span>
                    </td>
                    <td className={`px-5 py-3 font-semibold ${m.totalR >= 0 ? "text-[#00d28a]" : "text-[#ff4f4f]"}`}>
                      {formatR(m.totalR)}
                    </td>
                    <td className={`px-5 py-3 ${(m.totalR / m.trades) >= 0 ? "text-[#00d28a]" : "text-[#ff4f4f]"}`}>
                      {formatR(m.trades > 0 ? m.totalR / m.trades : 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Insights ── */}
      {insights.length > 0 && (
        <>
          <SectionLabel>What Your Data Says</SectionLabel>
          <div className="grid grid-cols-1 gap-2 mb-10">
            {insights.map((insight, i) => (
              <div key={i} className="flex items-center gap-4 rounded-xl border border-[#161616] bg-[#0a0a0a] px-5 py-3.5">
                <span className="text-base flex-shrink-0" style={{ color: insight.color }}>{insight.icon}</span>
                <p className="text-sm text-[#ccc]">{insight.text}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Instruments + Sessions ── */}
      <SectionLabel>By Instrument</SectionLabel>
      <div className="grid grid-cols-2 gap-4 mb-10">
        <div className="rounded-2xl border border-[#161616] bg-[#0a0a0a] p-5">
          <p className="text-xs text-[#555] uppercase tracking-wider mb-4">Total R per pair</p>
          <div className="space-y-4">
            {symbolStats.map(s => {
              const maxAbs = Math.max(...symbolStats.map(x => Math.abs(x.totalR)), 1);
              const barW = Math.min((Math.abs(s.totalR) / maxAbs) * 100, 100);
              return (
                <div key={s.symbol}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{s.symbol}</span>
                      <span className="text-xs text-[#444]">{s.winRate.toFixed(0)}% WR · {s.trades}t</span>
                    </div>
                    <span className={`text-sm font-semibold ${s.totalR >= 0 ? "text-[#00d28a]" : "text-[#ff4f4f]"}`}>
                      {formatR(s.totalR)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#111] overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${barW}%`, backgroundColor: s.totalR >= 0 ? "#00d28a" : "#ff4f4f", opacity: 0.6 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-[#161616] bg-[#0a0a0a] p-5">
          <p className="text-xs text-[#555] uppercase tracking-wider mb-4">Session breakdown</p>
          <div className="space-y-3">
            {sessionPerf.map(s => (
              <div key={s.label} className="rounded-xl border border-[#111] p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-white">{s.label}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.winRate >= 50 ? "bg-[#0a1a0a] text-[#00d28a]" : "bg-[#1a0a0a] text-[#ff4f4f]"}`}>
                    {s.winRate.toFixed(0)}% WR
                  </span>
                </div>
                <div className="flex gap-4 text-xs text-[#444]">
                  <span className="text-[#666]">{s.trades} trades</span>
                  <span className={s.totalR >= 0 ? "text-[#00d28a]" : "text-[#ff4f4f]"}>{formatR(s.totalR)}</span>
                  <span className="text-[#555]">avg {formatR(s.avgR)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Day of week + Weekly volume ── */}
      <SectionLabel>Timing & Volume</SectionLabel>
      <div className="grid grid-cols-2 gap-4 mb-10">
        <div className="rounded-2xl border border-[#161616] bg-[#0a0a0a] p-5">
          <p className="text-xs text-[#555] uppercase tracking-wider mb-4">By day of week</p>
          <div className="space-y-2">
            {dayPerf.filter(d => d.trades > 0).map(d => {
              const barW = Math.min((Math.abs(d.totalR) / maxDayR) * 100, 100);
              return (
                <div key={d.label} className="flex items-center gap-3">
                  <span className="text-xs text-[#555] w-8 flex-shrink-0">{d.label.slice(0, 3)}</span>
                  <div className="flex-1 h-6 rounded-lg bg-[#0d0d0d] overflow-hidden relative">
                    <div className="h-full rounded-lg absolute left-0 top-0" style={{
                      width: `${barW}%`,
                      backgroundColor: d.totalR >= 0 ? "rgba(0,210,138,0.25)" : "rgba(255,79,79,0.25)",
                    }} />
                    <span className="absolute left-2.5 top-0 h-full flex items-center text-xs text-[#555]">
                      {d.trades}t
                    </span>
                  </div>
                  <span className={`text-xs font-medium w-14 text-right flex-shrink-0 ${d.totalR >= 0 ? "text-[#00d28a]" : "text-[#ff4f4f]"}`}>
                    {formatR(d.totalR)}
                  </span>
                  <span className="text-xs text-[#444] w-10 text-right flex-shrink-0">{d.winRate.toFixed(0)}%</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-[#161616] bg-[#0a0a0a] p-5">
          <p className="text-xs text-[#555] uppercase tracking-wider mb-4">Weekly volume (last 12 weeks)</p>
          <div className="h-44">
            <canvas ref={weeklyChartRef} />
          </div>
        </div>
      </div>

      {/* ── Edge metrics ── */}
      <SectionLabel>Edge Quality</SectionLabel>
      <div className="grid grid-cols-4 gap-3 mb-10">
        <Tile label="Payoff Ratio" value={`${displayStats.winLossRatio.toFixed(2)}x`}
          color={displayStats.winLossRatio >= 2 ? "#00d28a" : "#ffd76e"}
          sub="avg win ÷ avg loss" />
        <Tile label="Best Win Streak" value={String(displayStats.bestWinStreak)} color="#00d28a" sub="consecutive wins" />
        <Tile label="Worst Loss Streak" value={String(displayStats.worstLossStreak)} color="#ff4f4f" sub="consecutive losses" />
        <Tile label="Active Days" value={String(displayStats.activeDays)} color="#ffffff" sub={`avg ${formatR(displayStats.avgPerDay)}/day`} />
      </div>

      {/* ── Setup grade ── */}
      <SectionLabel>Setup Quality</SectionLabel>
      <div className="grid grid-cols-4 gap-3">
        {gradeStats.map(g => (
          <div key={g.grade} className="rounded-2xl border border-[#161616] bg-[#0a0a0a] p-4">
            <div className="flex items-center justify-between mb-3">
              <span className={`text-sm font-bold ${g.grade === "A+" ? "text-[#00d28a]" : g.grade === "A" ? "text-[#4dba77]" : g.grade === "Retard" ? "text-[#ff4f4f]" : "text-white"}`}>
                {g.grade}
              </span>
              <span className="text-xs text-[#444]">{g.trades} trades</span>
            </div>
            <p className={`text-2xl font-semibold mb-1 ${g.winRate >= 50 ? "text-[#00d28a]" : "text-[#ff4f4f]"}`}>{g.winRate.toFixed(0)}%</p>
            <p className={`text-xs ${g.totalR >= 0 ? "text-[#00d28a]" : "text-[#ff4f4f]"}`}>{formatR(g.totalR)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
