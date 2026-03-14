import { useState, useMemo, useRef } from "react";
import { useTradeContext } from "@/contexts/TradeContext";
import { useYearFilter } from "@/contexts/YearFilterContext";
import { calculateMistakeStats } from "@/lib/mistakeAnalytics";

const CLEAN_LOSS_LABEL = "normal model loss";
function isCleanLoss(mistake: string) {
  return mistake.trim().toLowerCase() === CLEAN_LOSS_LABEL;
}

type SortMode = "impact" | "frequency";

const HARD_RULES = [
  { key: "trapped", label: "Trapped OF", match: "trapped of", description: "No trades with Trap OF present" },
  { key: "overextended", label: "Overextended", match: "overextended", description: "No trades when price is overextended" },
  { key: "reentry", label: "Re-entry", match: "re-entry", description: "No re-entries after stops" },
];

function getWeekKey(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0, 10);
}

export default function Mistakes() {
  const { trades } = useTradeContext();
  const { year } = useYearFilter();
  const [selectedSession, setSelectedSession] = useState<string>("All");
  const [selectedModel, setSelectedModel] = useState<string>("All");
  const [dateFilter, setDateFilter] = useState<"all" | "week" | "month" | "custom">("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [sortMode, setSortMode] = useState<SortMode>("impact");
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string; rate: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const yearFilteredTrades = useMemo(() => {
    if (year === "all") return trades;
    return trades.filter((t) => t.date && new Date(t.date).getFullYear() === year);
  }, [trades, year]);

  const models = ["All", ...Array.from(new Set(yearFilteredTrades.map((t) => t.model).filter((m): m is string => Boolean(m))))];
  const sessions = ["All", "Asia", "London", "New York"];

  const filteredTrades = yearFilteredTrades.filter((trade) => {
    const sessionMatch = selectedSession === "All" || trade.session === selectedSession;
    const modelMatch = selectedModel === "All" || trade.model === selectedModel;
    let dateMatch = true;
    const tradeDate = new Date(trade.date);
    const now = new Date();
    if (dateFilter === "week") {
      const weekAgo = new Date(); weekAgo.setDate(now.getDate() - 7);
      dateMatch = tradeDate >= weekAgo;
    }
    if (dateFilter === "month") {
      const monthAgo = new Date(); monthAgo.setMonth(now.getMonth() - 1);
      dateMatch = tradeDate >= monthAgo;
    }
    if (dateFilter === "custom" && fromDate && toDate) {
      dateMatch = tradeDate >= new Date(fromDate) && tradeDate <= new Date(toDate);
    }
    return sessionMatch && modelMatch && dateMatch;
  });

  const mistakeStats = useMemo(() => {
    return calculateMistakeStats(filteredTrades)
      .filter((m) => !isCleanLoss(m.mistake))
      .sort((a, b) => sortMode === "impact" ? a.totalR - b.totalR : b.trades - a.trades);
  }, [filteredTrades, sortMode]);

  // ── This week snapshot ──
  const thisWeekTrades = useMemo(() => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    return trades.filter((t) => new Date(t.date) >= weekStart);
  }, [trades]);

  const thisWeekMistakeTrades = thisWeekTrades.filter((t) => t.mistakes?.some((m) => !isCleanLoss(m)));
  const thisWeekMistakeR = thisWeekMistakeTrades.reduce((s, t) => s + (t.realisedR || 0), 0);

  // ── Summary metrics ──
  const totalMistakeR = filteredTrades
    .filter((t) => t.mistakes?.some((m) => !isCleanLoss(m)))
    .reduce((sum, t) => sum + (t.realisedR || 0), 0);
  const totalMistakenTrades = filteredTrades.filter((t) => t.mistakes?.some((m) => !isCleanLoss(m))).length;
  const cleanLossTrades = filteredTrades.filter(
    (t) => (t.realisedR || 0) < 0 && (!t.mistakes?.length || t.mistakes.every((m) => isCleanLoss(m)))
  ).length;
  const totalLosses = filteredTrades.filter((t) => (t.realisedR || 0) < 0).length;
  const avoidableRate = totalLosses > 0 ? ((totalMistakenTrades / totalLosses) * 100).toFixed(0) : "0";
  const worstByImpact = [...mistakeStats].sort((a, b) => a.totalR - b.totalR)[0];
  const worstByFreq = [...mistakeStats].sort((a, b) => b.trades - a.trades)[0];

  // ── Non-negotiables: current month trades only ──
  const currentMonthTrades = useMemo(() => {
    const now = new Date();
    return trades.filter((t) => {
      const d = new Date(t.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  }, [trades]);

  // Weekly dots: last 6 weeks, per rule
  const weeklyDots = useMemo(() => {
    const now = new Date();
    const weeks: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i * 7);
      weeks.push(getWeekKey(d));
    }
    return HARD_RULES.map((rule) => {
      const dots = weeks.map((wk) => {
        const weekTrades = trades.filter((t) => getWeekKey(new Date(t.date)) === wk);
        if (weekTrades.length === 0) return "empty";
        const violated = weekTrades.some((t) =>
          t.mistakes?.some((m) => m.toLowerCase().includes(rule.match))
        );
        return violated ? "red" : "green";
      });
      const currentMonthViolations = currentMonthTrades.filter((t) =>
        t.mistakes?.some((m) => m.toLowerCase().includes(rule.match))
      ).length;
      const currentMonthR = currentMonthTrades
        .filter((t) => t.mistakes?.some((m) => m.toLowerCase().includes(rule.match)))
        .reduce((s, t) => s + (t.realisedR || 0), 0);
      return { ...rule, dots, currentMonthViolations, currentMonthR };
    });
  }, [trades, currentMonthTrades]);

  // ── Monthly trend ──
  const monthlyTrend = useMemo(() => {
    const map: Record<string, { mistakes: number; total: number; label: string }> = {};
    filteredTrades.forEach((t) => {
      const d = new Date(t.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString("default", { month: "short", year: "2-digit" });
      if (!map[key]) map[key] = { mistakes: 0, total: 0, label };
      map[key].total++;
      if (t.mistakes?.some((m) => !isCleanLoss(m))) map[key].mistakes++;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([, v]) => ({ ...v, rate: v.total > 0 ? (v.mistakes / v.total) * 100 : 0 }));
  }, [filteredTrades]);

  // ── Best vs worst month ──
  const monthlyByMistakes = useMemo(() => {
    const map: Record<string, { label: string; mistakeR: number; mistakeTrades: number; totalTrades: number }> = {};
    filteredTrades.forEach((t) => {
      const d = new Date(t.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString("default", { month: "short", year: "numeric" });
      if (!map[key]) map[key] = { label, mistakeR: 0, mistakeTrades: 0, totalTrades: 0 };
      map[key].totalTrades++;
      if (t.mistakes?.some((m) => !isCleanLoss(m))) {
        map[key].mistakeTrades++;
        map[key].mistakeR += t.realisedR || 0;
      }
    });
    const months = Object.values(map).filter((m) => m.totalTrades >= 5);
    if (months.length < 2) return null;
    const sorted = months.sort((a, b) => (a.mistakeTrades / a.totalTrades) - (b.mistakeTrades / b.totalTrades));
    return { best: sorted[0], worst: sorted[sorted.length - 1] };
  }, [filteredTrades]);

  // ── Line chart ──
  const chartH = 80;
  const chartW = 100;
  const points = monthlyTrend.map((m, i) => ({
    x: monthlyTrend.length === 1 ? 50 : (i / (monthlyTrend.length - 1)) * chartW,
    y: chartH - (m.rate / 100) * chartH,
    rate: m.rate,
    label: m.label,
  }));
  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");
  const recentRate = monthlyTrend.length >= 2 ? monthlyTrend[monthlyTrend.length - 1].rate : null;
  const prevMonthRate = monthlyTrend.length >= 2 ? monthlyTrend[monthlyTrend.length - 2].rate : null;
  const improving = recentRate !== null && prevMonthRate !== null && recentRate < prevMonthRate;

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || points.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * chartW;
    let closest = points[0];
    let minDist = Math.abs(mouseX - points[0].x);
    for (const p of points) {
      const d = Math.abs(mouseX - p.x);
      if (d < minDist) { minDist = d; closest = p; }
    }
    setTooltip({ x: (closest.x / chartW) * 100, y: (closest.y / chartH) * 100, label: closest.label, rate: closest.rate });
  };

  return (
    <div className="p-6 max-w-6xl">
      {/* Header with period filter */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mistakes</h1>
          <p className="text-sm text-[#888] mt-1">Rule violations and their cost to your edge</p>
        </div>
        <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value as any)}
          className="bg-[#0d0d0d] border border-[#222] rounded-lg px-3 py-2 text-sm text-white">
          <option value="all">All Time</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="custom">Custom</option>
        </select>
      </div>

      {dateFilter === "custom" && (
        <div className="flex gap-3 mb-6">
          <div>
            <label className="block text-xs text-[#555] mb-1">From</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
              className="bg-[#0d0d0d] border border-[#222] rounded-lg px-3 py-2 text-sm text-white" />
          </div>
          <div>
            <label className="block text-xs text-[#555] mb-1">To</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
              className="bg-[#0d0d0d] border border-[#222] rounded-lg px-3 py-2 text-sm text-white" />
          </div>
        </div>
      )}

      {/* This week snapshot */}
      <div className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] px-5 py-4 mb-6 flex items-center gap-8">
        <div>
          <p className="text-xs text-[#555] mb-1">This week</p>
          <p className="text-xs text-[#444]">Quick snapshot</p>
        </div>
        <div className="w-px h-8 bg-[#1e1e1e]" />
        <div>
          <p className="text-xs text-[#555] mb-1">Trades taken</p>
          <p className="text-lg font-semibold text-white">{thisWeekTrades.length}</p>
        </div>
        <div className="w-px h-8 bg-[#1e1e1e]" />
        <div>
          <p className="text-xs text-[#555] mb-1">With mistakes</p>
          <p className={`text-lg font-semibold ${thisWeekMistakeTrades.length > 0 ? "text-[#ff4f4f]" : "text-[#00d28a]"}`}>
            {thisWeekMistakeTrades.length}
          </p>
        </div>
        <div className="w-px h-8 bg-[#1e1e1e]" />
        <div>
          <p className="text-xs text-[#555] mb-1">R lost to mistakes</p>
          <p className={`text-lg font-semibold ${thisWeekMistakeR < 0 ? "text-[#ff4f4f]" : "text-[#00d28a]"}`}>
            {thisWeekMistakeR.toFixed(2)}R
          </p>
        </div>
        <div className="w-px h-8 bg-[#1e1e1e]" />
        <div>
          <p className="text-xs text-[#555] mb-1">Week status</p>
          <p className={`text-sm font-semibold ${thisWeekMistakeTrades.length === 0 ? "text-[#00d28a]" : "text-[#ff4f4f]"}`}>
            {thisWeekMistakeTrades.length === 0 ? "✓ Clean week" : "Rule violations present"}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] p-4">
          <p className="text-xs text-[#666] mb-2">Total R Lost to Mistakes</p>
          <p className="text-2xl font-semibold text-[#ff4f4f]">{totalMistakeR.toFixed(2)}R</p>
        </div>
        <div className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] p-4">
          <p className="text-xs text-[#666] mb-2">Avoidable Loss Rate</p>
          <p className={`text-2xl font-semibold ${Number(avoidableRate) > 15 ? "text-[#ff4f4f]" : "text-[#00d28a]"}`}>
            {avoidableRate}%
          </p>
          <p className="text-xs text-[#555] mt-1">Target: below 15%</p>
        </div>
        <div className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] p-4">
          <p className="text-xs text-[#666] mb-2">Costliest Mistake</p>
          <p className="text-sm font-semibold text-white leading-tight mt-1">{worstByImpact?.mistake ?? "—"}</p>
          {worstByImpact && <p className="text-xs text-[#ff4f4f] mt-1">{worstByImpact.totalR.toFixed(2)}R</p>}
        </div>
        <div className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] p-4">
          <p className="text-xs text-[#666] mb-2">Most Repeated</p>
          <p className="text-sm font-semibold text-white leading-tight mt-1">{worstByFreq?.mistake ?? "—"}</p>
          {worstByFreq && <p className="text-xs text-[#888] mt-1">{worstByFreq.trades} trades</p>}
        </div>
      </div>

      {/* Non-negotiables — always current month */}
      <div className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] p-5 mb-6">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-medium">Non-Negotiables</p>
          <p className="text-xs text-[#555]">Current month · last 6 weeks</p>
        </div>
        <p className="text-xs text-[#555] mb-4">Your three hard rules. Each dot = one week.</p>
        <div className="grid grid-cols-3 gap-3">
          {weeklyDots.map((rule) => {
            const passed = rule.currentMonthViolations === 0;
            const cleanStreak = [...rule.dots].reverse().findIndex((d) => d !== "green");
            const streak = cleanStreak === -1 ? rule.dots.filter(d => d === "green").length : cleanStreak;
            return (
              <div key={rule.key} className={`rounded-lg border p-3 ${passed ? "border-[#1e2e1e] bg-[#0a140a]" : "border-[#2e1e1e] bg-[#140a0a]"}`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-white">{rule.label}</p>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${passed ? "bg-[#0f2e0f] text-[#00d28a]" : "bg-[#2e0f0f] text-[#ff4f4f]"}`}>
                    {passed ? "✓ Clean" : `${rule.currentMonthViolations} this month`}
                  </span>
                </div>
                {/* Weekly dots */}
                <div className="flex gap-1.5 mb-2">
                  {rule.dots.map((dot, i) => (
                    <div key={i} className={`w-4 h-4 rounded-full flex-shrink-0 ${dot === "green" ? "bg-[#00d28a]" : dot === "red" ? "bg-[#ff4f4f]" : "bg-[#1e1e1e]"}`} />
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-[#555]">{rule.description}</p>
                  {streak > 0 && (
                    <p className="text-xs text-[#00d28a] font-medium">{streak}w clean</p>
                  )}
                </div>
                {!passed && <p className="text-xs text-[#ff4f4f] mt-1">{rule.currentMonthR.toFixed(2)}R lost</p>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Trend + Best vs Worst */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {monthlyTrend.length > 1 && (
          <div className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-medium">Mistake Rate Trend</p>
                <p className="text-xs text-[#555] mt-0.5">% of trades with violations per month</p>
              </div>
              {recentRate !== null && (
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${improving ? "bg-[#0f2e0f] text-[#00d28a]" : "bg-[#2e0f0f] text-[#ff4f4f]"}`}>
                  {improving ? "↓ Improving" : "↑ Rising"}
                </span>
              )}
            </div>
            <div className="relative">
              <svg
                ref={svgRef}
                viewBox={`0 0 100 ${chartH + 10}`}
                className="w-full cursor-crosshair"
                style={{ height: "100px" }}
                preserveAspectRatio="none"
                onMouseMove={handleSvgMouseMove}
                onMouseLeave={() => setTooltip(null)}
              >
                {[0, 25, 50, 75, 100].map((pct) => (
                  <line key={pct} x1="0" y1={chartH - (pct / 100) * chartH} x2="100" y2={chartH - (pct / 100) * chartH}
                    stroke="#1a1a1a" strokeWidth="0.5" />
                ))}
                <polygon
                  points={`0,${chartH} ${polyline} ${points[points.length - 1].x},${chartH}`}
                  fill="rgba(255,79,79,0.08)"
                />
                <polyline points={polyline} fill="none" stroke="#ff4f4f" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
                {points.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r="2" fill="#ff4f4f" />
                ))}
                {tooltip && (
                  <>
                    <line x1={`${(points.find(p => p.label === tooltip.label)?.x ?? 0)}`} y1="0"
                      x2={`${(points.find(p => p.label === tooltip.label)?.x ?? 0)}`} y2={chartH}
                      stroke="#333" strokeWidth="0.5" strokeDasharray="2,2" />
                  </>
                )}
              </svg>
              {tooltip && (
                <div className="absolute pointer-events-none bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-xs"
                  style={{ left: `${tooltip.x}%`, top: "0%", transform: "translate(-50%, -110%)" }}>
                  <p className="text-[#888]">{tooltip.label}</p>
                  <p className="text-white font-medium">{tooltip.rate.toFixed(0)}% violation rate</p>
                </div>
              )}
            </div>
            <div className="flex justify-between mt-2">
              {monthlyTrend.map((m, i) => (
                <span key={i} className="text-[10px] text-[#555]">{m.label}</span>
              ))}
            </div>
          </div>
        )}

        {monthlyByMistakes && (
          <div className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] p-5">
            <p className="text-sm font-medium mb-1">Best vs Worst Month</p>
            <p className="text-xs text-[#555] mb-4">By mistake rate — what discipline looks like</p>
            <div className="space-y-3">
              <div className="rounded-lg border border-[#1e2e1e] bg-[#0a140a] p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-[#00d28a] font-medium">Best — {monthlyByMistakes.best.label}</p>
                  <span className="text-xs text-[#00d28a]">
                    {((monthlyByMistakes.best.mistakeTrades / monthlyByMistakes.best.totalTrades) * 100).toFixed(0)}% violation rate
                  </span>
                </div>
                <div className="flex gap-4 text-xs text-[#666]">
                  <span>{monthlyByMistakes.best.mistakeTrades} mistake trades</span>
                  <span>{monthlyByMistakes.best.totalTrades} total</span>
                  <span className="text-[#ff4f4f]">{monthlyByMistakes.best.mistakeR.toFixed(2)}R lost</span>
                </div>
              </div>
              <div className="rounded-lg border border-[#2e1e1e] bg-[#140a0a] p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-[#ff4f4f] font-medium">Worst — {monthlyByMistakes.worst.label}</p>
                  <span className="text-xs text-[#ff4f4f]">
                    {((monthlyByMistakes.worst.mistakeTrades / monthlyByMistakes.worst.totalTrades) * 100).toFixed(0)}% violation rate
                  </span>
                </div>
                <div className="flex gap-4 text-xs text-[#666]">
                  <span>{monthlyByMistakes.worst.mistakeTrades} mistake trades</span>
                  <span>{monthlyByMistakes.worst.totalTrades} total</span>
                  <span className="text-[#ff4f4f]">{monthlyByMistakes.worst.mistakeR.toFixed(2)}R lost</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filters for table */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div>
          <label className="block text-xs text-[#555] mb-1">Session</label>
          <select value={selectedSession} onChange={(e) => setSelectedSession(e.target.value)}
            className="bg-[#0d0d0d] border border-[#222] rounded-lg px-3 py-2 text-sm text-white">
            {sessions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-[#555] mb-1">Model</label>
          <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}
            className="bg-[#0d0d0d] border border-[#222] rounded-lg px-3 py-2 text-sm text-white">
            {models.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* Rule Violations Table */}
      <div className="rounded-xl border border-[#1e1e1e] overflow-hidden mb-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e1e1e] bg-[#0a0a0a]">
          <div>
            <p className="text-sm font-medium">Rule Violations</p>
            <p className="text-xs text-[#555] mt-0.5">{mistakeStats.length} mistake types tracked</p>
          </div>
          <div className="flex rounded-lg border border-[#222] overflow-hidden text-xs">
            <button onClick={() => setSortMode("impact")}
              className={`px-3 py-1.5 transition-colors ${sortMode === "impact" ? "bg-[#1e1e1e] text-white" : "text-[#666] hover:text-white"}`}>
              By R Impact
            </button>
            <button onClick={() => setSortMode("frequency")}
              className={`px-3 py-1.5 transition-colors ${sortMode === "frequency" ? "bg-[#1e1e1e] text-white" : "text-[#666] hover:text-white"}`}>
              By Frequency
            </button>
          </div>
        </div>

        {mistakeStats.length === 0 ? (
          <div className="p-12 text-center text-[#555] text-sm">No rule violations logged.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left bg-[#080808]">
                <th className="px-5 py-3 text-xs text-[#555] font-medium w-8">#</th>
                <th className="px-5 py-3 text-xs text-[#555] font-medium">Mistake</th>
                <th className="px-5 py-3 text-xs text-[#555] font-medium text-right">Trades</th>
                <th className="px-5 py-3 text-xs text-[#555] font-medium text-right">Win %</th>
                <th className="px-5 py-3 text-xs text-[#555] font-medium text-right">Total R</th>
                <th className="px-5 py-3 text-xs text-[#555] font-medium text-right">Avg R</th>
              </tr>
            </thead>
            <tbody>
              {mistakeStats.map((m, i) => {
                const winRate = m.trades > 0 ? ((m.wins / m.trades) * 100).toFixed(0) : "0";
                const maxAbsR = Math.max(...mistakeStats.map((x) => Math.abs(x.totalR)), 1);
                const barWidth = Math.min((Math.abs(m.totalR) / maxAbsR) * 100, 100);
                const maxTrades = Math.max(...mistakeStats.map((x) => x.trades), 1);
                const freqWidth = Math.min((m.trades / maxTrades) * 100, 100);
                return (
                  <tr key={m.mistake} className="border-t border-[#141414] hover:bg-[#0d0d0d] transition-colors">
                    <td className="px-5 py-4 text-xs text-[#444] font-mono">{i + 1}</td>
                    <td className="px-5 py-4">
                      <div className="font-medium text-white mb-2">{m.mistake}</div>
                      <div className="flex gap-2 items-center">
                        <div className="flex-1 h-[3px] rounded-full bg-[#1a1a1a] overflow-hidden">
                          <div className="h-full bg-[#ff4f4f] rounded-full transition-all"
                            style={{ width: `${barWidth}%`, opacity: sortMode === "impact" ? 1 : 0.2 }} />
                        </div>
                        <div className="flex-1 h-[3px] rounded-full bg-[#1a1a1a] overflow-hidden">
                          <div className="h-full bg-[#ffd76e] rounded-full transition-all"
                            style={{ width: `${freqWidth}%`, opacity: sortMode === "frequency" ? 1 : 0.2 }} />
                        </div>
                      </div>
                      <div className="flex gap-2 mt-1">
                        <span className={`text-[10px] ${sortMode === "impact" ? "text-[#555]" : "text-[#333]"}`}>R impact</span>
                        <span className={`text-[10px] ${sortMode === "frequency" ? "text-[#555]" : "text-[#333]"}`}>frequency</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right text-[#888]">{m.trades}</td>
                    <td className="px-5 py-4 text-right text-[#888]">{winRate}%</td>
                    <td className={`px-5 py-4 text-right font-medium ${m.totalR >= 0 ? "text-[#00d28a]" : "text-[#ff4f4f]"}`}>
                      {m.totalR.toFixed(2)}R
                    </td>
                    <td className={`px-5 py-4 text-right ${m.expectancy >= 0 ? "text-[#00d28a]" : "text-[#ff4f4f]"}`}>
                      {m.expectancy.toFixed(2)}R
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footnote */}
      {cleanLossTrades > 0 && (
        <p className="text-xs text-[#444] text-center mt-2">
          {cleanLossTrades} clean losses this period — rules followed, market didn't deliver. Not counted as mistakes.
        </p>
      )}
    </div>
  );
}
