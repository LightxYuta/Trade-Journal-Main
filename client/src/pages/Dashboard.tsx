import { useState, useMemo, useEffect } from "react";
import { X, ZoomIn } from "lucide-react";
import { useTradeContext } from "@/contexts/TradeContext";
import { useYearFilter } from "@/contexts/YearFilterContext";
import { TradingCard } from "@/components/TradingCard";
import { StatCard } from "@/components/StatCard";
import { KpiCard } from "@/components/KpiCard";
import { FilterPills } from "@/components/FilterPills";
import { Calendar } from "@/components/Calendar";
import { EquityCurveChart } from "@/components/EquityCurveChart";
import { WinLossChart } from "@/components/WinLossChart";
import { StreakIndicator } from "@/components/StreakIndicator";
import { EdgeScoreRadar } from "@/components/EdgeScoreRadar";
import { PlanAdherenceCard } from "@/components/PlanAdherenceCard";
import { YearSelector } from "@/components/YearSelector";
import { computeStats, getFilteredTrades, formatR, formatDate, computeEdgeScore } from "@/lib/tradeUtils";

const FILTER_OPTIONS = [
  { id: "all", label: "All Time" },
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
];

function parseScreenshots(screenshots: string | null | undefined): string[] {
  if (!screenshots) return [];
  try {
    const parsed = JSON.parse(screenshots);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
  } catch {}
  return screenshots ? [screenshots] : [];
}

export default function Dashboard() {
  const { trades, settings } = useTradeContext();
  const { year } = useYearFilter();
  const [filter, setFilter] = useState(() => localStorage.getItem("tj_time_filter") || "all");
  const [name, setName] = useState(localStorage.getItem("traderName") || "Trader");
  const [editingName, setEditingName] = useState(false);
  const [quote, setQuote] = useState(localStorage.getItem("traderQuote") || "Discipline first. Profits follow.");
  const [editingQuote, setEditingQuote] = useState(false);
  const [image, setImage] = useState(localStorage.getItem("traderImage"));
  const [calendarModalOpen, setCalendarModalOpen] = useState(false);
  const [calendarModalDate, setCalendarModalDate] = useState<string | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // Calendar-driven month navigation — when the user navigates the calendar,
  // the whole dashboard reflects that month instead of only the calendar grid.
  const todayDate = new Date();
  const [calYear, setCalYear] = useState(todayDate.getFullYear());
  const [calMonth, setCalMonth] = useState(todayDate.getMonth());
  const [filterSource, setFilterSource] = useState<'pill' | 'calendar'>('pill');

  const handleFilterChange = (id: string) => {
    setFilter(id);
    setFilterSource('pill');
    const t = new Date();
    setCalYear(t.getFullYear());
    setCalMonth(t.getMonth());
  };

  const handleCalendarMonthChange = (y: number, m: number) => {
    setCalYear(y);
    setCalMonth(m);
    setFilterSource('calendar');
  };

  useEffect(() => { localStorage.setItem("traderName", name); }, [name]);
  useEffect(() => { localStorage.setItem("traderQuote", quote); }, [quote]);
  useEffect(() => { localStorage.setItem("tj_time_filter", filter); }, [filter]);

  const handleImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setImage(result);
      localStorage.setItem("traderImage", result);
    };
    reader.readAsDataURL(file);
  };

  const yearFilteredTrades = useMemo(() => {
    if (year === "all") return trades;
    return trades.filter(t => t.date && new Date(t.date).getFullYear() === year);
  }, [trades, year]);

  const filteredTrades = useMemo(() => {
    if (filterSource === 'calendar') {
      const first = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(calYear, calMonth + 1, 0).getDate();
      const last = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return getFilteredTrades(yearFilteredTrades, 'custom', first, last);
    }
    return getFilteredTrades(yearFilteredTrades, filter);
  }, [yearFilteredTrades, filter, filterSource, calYear, calMonth]);

  const stats = useMemo(() => computeStats(filteredTrades), [filteredTrades]);
  const edgeScore = useMemo(() => computeEdgeScore(filteredTrades), [filteredTrades]);

  const equitySeries = useMemo(() => {
    const sorted = [...filteredTrades].sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.createdAt || 0) - (b.createdAt || 0));
    let running = 0;
    return sorted.map(t => (running += t.realisedR || 0));
  }, [filteredTrades]);

  const tradesForCalendarDate = useMemo(() => {
    if (!calendarModalDate) return [] as typeof trades;
    return trades.filter(t => t.date === calendarModalDate).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [trades, calendarModalDate]);

  const valueColor = (val: number) => val > 0.0001 ? "positive" as const : val < -0.0001 ? "negative" as const : "default" as const;

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-wide uppercase">Dashboard</h1>
          <p className="text-xs text-[#444]">Your trading performance at a glance</p>
        </div>
        <div className="flex items-center gap-2">
          <FilterPills options={FILTER_OPTIONS} activeId={filterSource === 'pill' ? filter : '__calendar__'} onChange={handleFilterChange} />
          <YearSelector />
        </div>
      </div>

      {/* Unified grid — everything lives in one 12-col canvas, no left/right split */}
      <div className="grid grid-cols-12 gap-3 lg:gap-2">

        {/* Top section — stats left, trader card right */}
        <div className="col-span-12 lg:col-span-8">
          <div className="grid grid-cols-12 gap-2 lg:gap-3">
            <div className="col-span-12 sm:col-span-6 lg:col-span-3 h-full">
              <KpiCard label="Total R" value={formatR(stats.totalR)}
                color={stats.totalR > 0 ? "#00d28a" : stats.totalR < 0 ? "#ff4f4f" : "#fff"}
                accent={stats.totalR >= 0 ? "#00d28a" : "#ff4f4f"}
                visual={{ type: "sparkline", points: equitySeries }} />
            </div>
            <div className="col-span-12 sm:col-span-6 lg:col-span-3 h-full">
              <KpiCard label="Trade win %" value={`${stats.winrate.toFixed(1)}%`}
                accent={stats.winrate >= 50 ? "#00d28a" : "#ff4f4f"}
                visual={{ type: "donut", pct: stats.winrate }} />
            </div>
            <div className="col-span-12 sm:col-span-6 lg:col-span-3 h-full">
              <KpiCard label="Profit factor" value={stats.profitFactor === Infinity ? "∞" : stats.profitFactor.toFixed(2)}
                color={stats.profitFactor > 1 ? "#00d28a" : "#ff4f4f"}
                accent="#ffd76e"
                visual={{ type: "ring", pct: edgeScore.axes.find(a => a.key === 'profitFactor')?.score ?? 0 }} />
            </div>
            <div className="col-span-12 sm:col-span-6 lg:col-span-3 h-full">
              <KpiCard label="Avg win / loss" value={stats.winLossRatio.toFixed(2)}
                accent="#00d28a"
                visual={{ type: "splitbar", leftPct: (stats.avgWin + Math.abs(stats.avgLoss)) > 0 ? (stats.avgWin / (stats.avgWin + Math.abs(stats.avgLoss))) * 100 : 50 }} />
            </div>
            <div className="col-span-12 sm:col-span-6 lg:col-span-3 h-full">
              <StatCard label="Expectancy" value={formatR(stats.expR)} valueColor={valueColor(stats.expR)} />
            </div>
            <div className="col-span-12 sm:col-span-6 lg:col-span-3 h-full">
              <StatCard label="Max Drawdown" value={formatR(-stats.maxDrawdown)} valueColor="negative" />
            </div>
            <div className="col-span-12 sm:col-span-6 lg:col-span-3 h-full">
              <StatCard label="Trades" value={stats.n} subtext={`${stats.wins}W · ${stats.losses}L · ${stats.bes}BE`} />
            </div>
            <div className="col-span-12 sm:col-span-6 lg:col-span-3 h-full">
              <StatCard label="Active Days" value={stats.activeDays} subtext={`Avg ${formatR(stats.avgPerDay)}/day`} />
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4">
          <TradingCard className="h-full p-0">
            <div className="relative flex h-full flex-col justify-between items-center gap-3 px-4 pt-8 pb-4">
              {!editingName ? (
                <div className="absolute top-[-4px] text-sm font-semibold uppercase tracking-wider cursor-pointer" onClick={() => setEditingName(true)}>{name}</div>
              ) : (
                <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onBlur={() => setEditingName(false)}
                  className="absolute top-[-4px] bg-black text-center text-sm outline-none border border-[#222] rounded px-2" />
              )}
              <label className="cursor-pointer w-full">
                {image ? (
                  <img src={image} className="w-full rounded-xl object-contain" style={{ maxHeight: 140 }} />
                ) : (
                  <div className="w-full h-[140px] flex items-center justify-center border border-[#1a1a1a] rounded-xl text-xs text-[#444]">
                    Click to upload image / GIF
                  </div>
                )}
                <input type="file" accept="image/*,image/gif" hidden onChange={(e) => e.target.files && handleImageUpload(e.target.files[0])} />
              </label>
              {!editingQuote ? (
                <div className="text-xs italic text-[#555] text-center cursor-pointer" onClick={() => setEditingQuote(true)}>"{quote}"</div>
              ) : (
                <textarea autoFocus rows={2} value={quote} onChange={(e) => setQuote(e.target.value)} onBlur={() => setEditingQuote(false)}
                  className="w-full bg-black text-xs italic text-center resize-none outline-none border border-[#222] rounded-lg p-2" />
              )}
            </div>
          </TradingCard>
        </div>

        {/* Equity curve + Edge score */}
        <div className="col-span-12 lg:col-span-8">
          <TradingCard title="Equity Curve" subtitle="Cumulative R over time">
            <EquityCurveChart trades={filteredTrades} />
          </TradingCard>
        </div>
        <div className="col-span-12 lg:col-span-4">
          <TradingCard title="Edge Score" subtitle="Zella-style composite score">
            <EdgeScoreRadar result={edgeScore} />
          </TradingCard>
        </div>
        <div className="col-span-12 lg:col-span-8">
          <TradingCard title="Calendar" subtitle="Daily R distribution for the month">
            <Calendar trades={trades} year={calYear} month={calMonth} onMonthChange={handleCalendarMonthChange}
              onDayClick={(date) => { setCalendarModalDate(date); setCalendarModalOpen(true); }} />
          </TradingCard>
        </div>
        <div className="col-span-12 lg:col-span-4">
          <TradingCard title="Plan Adherence" subtitle="Streak and rule-following">
            <PlanAdherenceCard />
          </TradingCard>
        </div>
      </div>

      {/* Calendar modal */}
      {calendarModalOpen && calendarModalDate && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && setCalendarModalOpen(false)}>
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a]"
            style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.06) transparent" }}>
            <div className="flex justify-between items-center px-6 py-5 border-b border-[#111] sticky top-0 bg-[#0a0a0a] z-10">
              <div>
                <h2 className="text-sm font-semibold text-white">
                  {new Date(calendarModalDate + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </h2>
                <p className="text-xs text-[#444] mt-0.5">{tradesForCalendarDate.length} trade{tradesForCalendarDate.length !== 1 ? "s" : ""}</p>
              </div>
              <button onClick={() => setCalendarModalOpen(false)}
                className="w-7 h-7 rounded-lg border border-[#1e1e1e] flex items-center justify-center text-[#444] hover:text-white transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              {tradesForCalendarDate.length === 0 ? (
                <p className="text-center text-[#444] text-sm py-8">No trades for this date.</p>
              ) : tradesForCalendarDate.map((t, idx) => {
                const scrArr = parseScreenshots(t.screenshots);
                const isPositive = (t.realisedR || 0) > 0;
                const isNegative = (t.realisedR || 0) < 0;
                return (
                  <div key={t.id} className="rounded-xl border border-[#141414] bg-[#080808] p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-[#444] font-mono">{idx + 1}</span>
                        <span className="font-semibold text-white">{t.symbol}</span>
                        <span className="text-xs text-[#555]">{t.position}</span>
                        {t.session && <span className="text-xs text-[#333] px-2 py-0.5 rounded border border-[#1a1a1a]">{t.session}</span>}
                        {t.setupGrade && (
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${t.setupGrade === "A+" ? "bg-[#0a1a0a] text-[#00d28a]" : t.setupGrade === "Retard" ? "bg-[#1a0a0a] text-[#ff4f4f]" : "bg-[#111] text-[#888]"}`}>
                            {t.setupGrade}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-lg font-bold ${isPositive ? "text-[#00d28a]" : isNegative ? "text-[#ff4f4f]" : "text-[#888]"}`}>
                          {formatR(t.realisedR)}
                        </span>
                        {t.maxR && t.maxR !== t.realisedR && (
                          <span className="text-xs text-[#333]">max {formatR(t.maxR)}</span>
                        )}
                      </div>
                    </div>

                    {/* Images */}
                    {scrArr.length > 0 && (
                      <div className="flex gap-2 mb-3">
                        {scrArr.map((src, i) => {
                          const isBase64 = src.startsWith("data:");
                          const label = ["Entry", "4H", "1H"][i] || `Chart ${i + 1}`;
                          return isBase64 ? (
                            <div key={i} className="relative group rounded-lg overflow-hidden border border-[#1a1a1a] cursor-pointer"
                              style={{ width: "120px", height: "80px" }}
                              onClick={() => setLightboxSrc(src)}>
                              <img src={src} alt={label} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <ZoomIn className="w-4 h-4 text-white" />
                              </div>
                              <span className="absolute bottom-1 left-1 text-[10px] text-white/70 bg-black/50 px-1 rounded">{label}</span>
                            </div>
                          ) : (
                            <a key={i} href={src.startsWith("http") ? src : `https://${src}`} target="_blank" rel="noopener noreferrer"
                              className="flex items-center justify-center rounded-lg border border-[#1a1a1a] text-xs text-[#444] hover:text-white transition-colors"
                              style={{ width: "80px", height: "60px" }}>
                              {label} ↗
                            </a>
                          );
                        })}
                      </div>
                    )}

                    {/* Notes & mistakes */}
                    {t.notes && <p className="text-xs text-[#555] mb-2">{t.notes}</p>}
                    {t.mistakes && t.mistakes.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {t.mistakes.map((m, i) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 rounded border border-[#2e1010] bg-[#140808] text-[#ff4f4f]">{m}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxSrc && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60] p-4" onClick={() => setLightboxSrc(null)}>
          <button className="absolute top-4 right-4 w-9 h-9 rounded-xl border border-[#333] flex items-center justify-center text-[#888] hover:text-white bg-black/50" onClick={() => setLightboxSrc(null)}>
            <X className="w-4 h-4" />
          </button>
          <img src={lightboxSrc} alt="Full size" className="max-w-full max-h-[90vh] object-contain rounded-xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
