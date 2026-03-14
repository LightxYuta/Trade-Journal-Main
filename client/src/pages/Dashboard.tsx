import { useState, useMemo, useEffect } from "react";
import { X } from "lucide-react";
import { useTradeContext } from "@/contexts/TradeContext";
import { useYearFilter } from "@/contexts/YearFilterContext";
import { TradingCard } from "@/components/TradingCard";
import { StatCard } from "@/components/StatCard";
import { FilterPills } from "@/components/FilterPills";
import { Calendar } from "@/components/Calendar";
import { EquityCurveChart } from "@/components/EquityCurveChart";
import { WinLossChart } from "@/components/WinLossChart";
import { StreakIndicator } from "@/components/StreakIndicator";
import { YearSelector } from "@/components/YearSelector";
import { computeStats, getFilteredTrades, formatR, formatDate } from "@/lib/tradeUtils";

const FILTER_OPTIONS = [
  { id: "all", label: "All Time" },
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
];

export default function Dashboard() {
  const { trades, settings } = useTradeContext();
  const { year } = useYearFilter();
  const [filter, setFilter] = useState(() => {
    return localStorage.getItem("tj_time_filter") || "all";
  });

  /* ---------------- TRADER STATE ---------------- */
  const [name, setName] = useState(localStorage.getItem("traderName") || "Trader");
  const [editingName, setEditingName] = useState(false);

  const [quote, setQuote] = useState(
    localStorage.getItem("traderQuote") || "Discipline first. Profits follow."
  );
  const [editingQuote, setEditingQuote] = useState(false);

  const [image, setImage] = useState(localStorage.getItem("traderImage"));

  useEffect(() => {
    localStorage.setItem("traderName", name);
  }, [name]);

  useEffect(() => {
    localStorage.setItem("traderQuote", quote);
  }, [quote]);

  const handleImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setImage(result);
      localStorage.setItem("traderImage", result);
    };
    reader.readAsDataURL(file);
  };

  // Persist filter to localStorage
  useEffect(() => {
    localStorage.setItem("tj_time_filter", filter);
  }, [filter]);
  /* ---------------- STATS ---------------- */
  // Filter trades by year
  const yearFilteredTrades = useMemo(() => {
    if (year === "all") return trades;
    return trades.filter(t => t.date && new Date(t.date).getFullYear() === year);
  }, [trades, year]);

  // Use yearFilteredTrades for all stats and charts
  const filteredTrades = useMemo(
    () => getFilteredTrades(yearFilteredTrades, filter),
    [yearFilteredTrades, filter]
  );

  const [calendarModalOpen, setCalendarModalOpen] = useState(false);
  const [calendarModalDate, setCalendarModalDate] = useState<string | null>(null);

  const tradesForCalendarDate = useMemo(() => {
    if (!calendarModalDate) return [] as typeof trades;
    return trades.filter(t => t.date === calendarModalDate).sort((a,b) => (b.createdAt||0) - (a.createdAt||0));
  }, [trades, calendarModalDate]);

  const normalizeHref = (val?: string) => {
    if (!val) return "";
    const v = val.trim();
    if (!v) return "";
    if (/^https?:\/\//i.test(v)) return v;
    return `https://${v}`;
  };

  const getFirstScreenshot = (t: any) => {
    if (!t) return '';
    const raw = t.screenshots;
    if (!raw) return '';
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return String(parsed[0] || '');
      if (typeof parsed === 'string') return parsed;
    } catch (e) {
      return String(raw || '');
    }
    return '';
  };

  const stats = useMemo(
    () => computeStats(filteredTrades),
    [filteredTrades]
  );

  // Discipline metrics
  const discipline = useMemo(() => {
    const total = trades.length;

    // Rule violations: any trade that has at least one mistake tag, excluding 'Normal Model Loss' as the only tag
    const ruleViolations = trades.reduce((acc, t) => {
      if (!t.mistakes || t.mistakes.length === 0) return acc;
      // Exclude if the only mistake is 'Normal Model Loss'
      const filtered = t.mistakes.filter(m => m !== "Normal Model Loss");
      return acc + (filtered.length > 0 ? 1 : 0);
    }, 0);

    // Model-followed: percent of trades that have NO mistakes (i.e., followed the model)
    const modelFollowedPct = total > 0 ? Math.round(((total - ruleViolations) / total) * 100) : 100;

    // Tilt trades: for each calendar date, any trade beyond the user threshold is considered a tilt trade
    const tiltThreshold = settings.tiltThreshold ?? 2;
    const perDayCount: Record<string, number> = {};
    trades.forEach(t => {
      const d = t.date || '__no_date__';
      perDayCount[d] = (perDayCount[d] || 0) + 1;
    });
    let tiltCount = 0;
    Object.values(perDayCount).forEach(c => {
      if (c > tiltThreshold) tiltCount += (c - tiltThreshold);
    });

    return { total, ruleViolations, tiltCount, modelFollowedPct };
  }, [trades, settings.tiltThreshold]);

  const valueColor = (val: number) => {
    if (val > 0.0001) return "positive" as const;
    if (val < -0.0001) return "negative" as const;
    return "default" as const;
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">

      {/* HEADER */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-wide uppercase">
            Dashboard
          </h1>
          <p className="text-[0.82rem] text-[#b8b8b8]">
            Your trading performance at a glance
          </p>
        </div>

        <div className="flex items-center gap-2">
          <FilterPills
            options={FILTER_OPTIONS}
            activeId={filter}
            onChange={setFilter}
          />
          <YearSelector />
        </div>
      </div>

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-start">

        {/* LEFT COLUMN */}
        <div className="lg:col-span-2 space-y-4">

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            <StatCard label="Total R" value={formatR(stats.totalR)} valueColor={valueColor(stats.totalR)} />
            <StatCard label="Trades" value={stats.n} subtext={`${stats.wins}W · ${stats.losses}L · ${stats.bes}BE`} />
            <StatCard label="Win Rate" value={`${stats.winrate.toFixed(1)}%`} valueColor="default" />
            <StatCard label="Avg R" value={formatR(stats.avgR)} valueColor={valueColor(stats.avgR)} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            <StatCard label="Profit Factor" value={stats.profitFactor === Infinity ? "∞" : stats.profitFactor.toFixed(2)} valueColor={stats.profitFactor > 1 ? "positive" : "negative"} />
            <StatCard label="Expectancy" value={formatR(stats.expR)} valueColor={valueColor(stats.expR)} />
            <StatCard label="Max Drawdown" value={formatR(-stats.maxDrawdown)} valueColor="negative" />
            <StatCard label="Active Days" value={stats.activeDays} subtext={`Avg ${formatR(stats.avgPerDay)}/day`} />
          </div>

          <TradingCard title="Equity Curve" subtitle="Cumulative R over time">
            <EquityCurveChart trades={filteredTrades} />
          </TradingCard>

          <TradingCard title="Calendar" subtitle="Daily R distribution for the month">
            <Calendar trades={trades} onDayClick={(date) => { setCalendarModalDate(date); setCalendarModalOpen(true); }} />
          </TradingCard>

          {calendarModalOpen && calendarModalDate && (
              <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={(e) => e.target === e.currentTarget && setCalendarModalOpen(false)}>
                <div className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-[18px] border border-[rgba(40,40,40,0.95)] p-5 modal-scrollbar" style={{ background: "radial-gradient(circle at top left, #161616 0, #050505 45%, #020202 100%)" }}>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold uppercase tracking-wide">Trades on {calendarModalDate}</h2>
                  <button onClick={() => setCalendarModalOpen(false)} className="text-[#b8b8b8]"><X className="w-5 h-5" /></button>
                </div>
                <div className="overflow-x-auto modal-scrollbar">
                  <table className="w-full text-[0.85rem]">
                    <thead>
                      <tr className="text-left text-[0.72rem] text-[#b8b8b8] uppercase tracking-wider">
                        <th className="pb-2 pr-3">#</th>
                        <th className="pb-2 pr-3">Date</th>
                        <th className="pb-2 pr-3">Symbol</th>
                        <th className="pb-2 pr-3">Position</th>
                        <th className="pb-2 pr-3">Realised R</th>
                        <th className="pb-2 pr-3">Max R</th>
                        <th className="pb-2 pr-3">Account</th>
                        <th className="pb-2 pr-3">Model</th>
                        <th className="pb-2 pr-3">Session</th>
                        <th className="pb-2 pr-3">Grade</th>
                        <th className="pb-2 pr-3">Screenshot</th>
                        <th className="pb-2 pr-3">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tradesForCalendarDate.length === 0 ? (
                        <tr><td colSpan={12} className="py-8 text-center text-[#b8b8b8]">No trades for this date.</td></tr>
                      ) : (
                        tradesForCalendarDate.map((t, idx) => (
                          <tr key={t.id} className="border-t border-[rgba(50,50,50,0.95)]">
                            <td className="py-2 pr-3">{idx+1}</td>
                            <td className="py-2 pr-3">{formatDate(t.date)}</td>
                            <td className="py-2 pr-3 font-medium">{t.symbol}</td>
                            <td className="py-2 pr-3">{t.position}</td>
                            <td className="py-2 pr-3">{formatR(t.realisedR)}</td>
                            <td className="py-2 pr-3">{formatR(t.maxR || t.realisedR)}</td>
                            <td className="py-2 pr-3 text-[#b8b8b8]">{t.account}</td>
                            <td className="py-2 pr-3 text-[#b8b8b8]">{t.model}</td>
                            <td className="py-2 pr-3 text-[#b8b8b8]">{t.session}</td>
                            <td className="py-2 pr-3">{t.setupGrade}</td>
                            <td className="py-2 pr-3">
                              {getFirstScreenshot(t) ? (
                                <a href={normalizeHref(getFirstScreenshot(t))} target="_blank" rel="noopener noreferrer" className="text-[#7cc0ff] underline">View</a>
                              ) : (
                                <span className="text-[#6b6b6b]">—</span>
                              )}
                            </td>
                            <td className="py-2 pr-3 text-[#b8b8b8] max-w-[150px] truncate">{t.notes}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-4">

          {/* 👤 TRADER CARD */}
          <TradingCard className="p-0">
            <div className="relative flex flex-col items-center gap-3 px-4 pt-8 pb-4">

              {/* NAME — TOP ALIGNED */}
              {!editingName ? (
                <div
                  className="absolute top-[-4px] text-sm font-semibold uppercase tracking-wider cursor-pointer"
                  onClick={() => setEditingName(true)}
                >
                  {name}
                </div>
              ) : (
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => setEditingName(false)}
                  className="absolute top-[-4px] bg-black text-center text-sm outline-none border border-[#222] rounded px-2"
                />
              )}

              {/* IMAGE */}
              <label className="cursor-pointer w-full">
                {image ? (
                  <img
                    src={image}
                    className="w-full max-w-[320px] rounded-2xl object-contain"
                  />
                ) : (
                  <div className="w-[320px] h-[160px] flex items-center justify-center border border-[#222] rounded-xl text-sm text-[#777]">
                    Click to upload image / GIF
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*,image/gif"
                  hidden
                  onChange={(e) => e.target.files && handleImageUpload(e.target.files[0])}
                />
              </label>

              {/* QUOTE */}
              {!editingQuote ? (
                <div
                  className="text-sm italic text-[#b8b8b8] text-center cursor-pointer"
                  onClick={() => setEditingQuote(true)}
                >
                  “{quote}”
                </div>
              ) : (
                <textarea
                  autoFocus
                  rows={2}
                  value={quote}
                  onChange={(e) => setQuote(e.target.value)}
                  onBlur={() => setEditingQuote(false)}
                  className="w-full bg-black text-sm italic text-center resize-none outline-none border border-[#222] rounded-lg p-2"
                />
              )}
            </div>
          </TradingCard>

          <TradingCard title="Win/Loss Ratio" subtitle="Trade outcome distribution">
            <WinLossChart stats={stats} />
          </TradingCard>

          <TradingCard title="Streak Tracker" subtitle="Current and historical streaks">
            <StreakIndicator stats={stats} />
          </TradingCard>

            <TradingCard title="Discipline Score" subtitle="Rule adherence & execution quality">
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-[#b8b8b8]">Model-followed trades</span>
                <span className="text-green-400 font-medium">{discipline.modelFollowedPct}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#b8b8b8]">Rule violations</span>
                <span className="text-red-400 font-medium">{discipline.ruleViolations}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#b8b8b8]">Tilt trades</span>
                <span className="text-red-400 font-medium">{discipline.tiltCount}</span>
              </div>
              <div className="h-px bg-[#1f1f1f]" />
              <div className="text-center text-xs italic text-[#8a8a8a]">
                “Process over outcome.”
              </div>
            </div>
          </TradingCard>

        </div>
      </div>
    </div>
  );
}
