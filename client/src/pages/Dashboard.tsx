import { useState, useMemo, useEffect } from "react";
import { X, ZoomIn } from "lucide-react";
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

const PROP_KEY = "tj_prop_firm_v1";

interface PropConfig {
  phase: string;
  accountSize: number;
  riskPercent: number;
  profitTarget: number;
  maxDrawdown: number;
  dailyLoss: number;
  startDate: string;
}

const DEFAULT_PROP: PropConfig = {
  phase: "Phase 1",
  accountSize: 10000,
  riskPercent: 2,
  profitTarget: 8,
  maxDrawdown: 10,
  dailyLoss: 5,
  startDate: new Date().toISOString().slice(0, 10),
};

function loadPropConfig(): PropConfig {
  try {
    const raw = localStorage.getItem(PROP_KEY);
    return raw ? { ...DEFAULT_PROP, ...JSON.parse(raw) } : DEFAULT_PROP;
  } catch { return DEFAULT_PROP; }
}

function savePropConfig(cfg: PropConfig) {
  try { localStorage.setItem(PROP_KEY, JSON.stringify(cfg)); } catch {}
}

function parseScreenshots(screenshots: string | null | undefined): string[] {
  if (!screenshots) return [];
  try {
    const parsed = JSON.parse(screenshots);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
  } catch {}
  return screenshots ? [screenshots] : [];
}

const PHASES = ["Phase 1", "Phase 2", "Funded"];

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

  // Prop firm
  const [propConfig, setPropConfig] = useState<PropConfig>(() => loadPropConfig());
  const [editingProp, setEditingProp] = useState(false);
  const [propDraft, setPropDraft] = useState<Record<string, string>>({});

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

  const saveProp = () => {
    const updated: PropConfig = {
      phase: propDraft.phase || propConfig.phase,
      accountSize: parseFloat(propDraft.accountSize) || propConfig.accountSize,
      riskPercent: parseFloat(propDraft.riskPercent) || propConfig.riskPercent,
      profitTarget: parseFloat(propDraft.profitTarget) || propConfig.profitTarget,
      maxDrawdown: parseFloat(propDraft.maxDrawdown) || propConfig.maxDrawdown,
      dailyLoss: parseFloat(propDraft.dailyLoss) || propConfig.dailyLoss,
      startDate: propDraft.startDate || propConfig.startDate,
    };
    setPropConfig(updated);
    savePropConfig(updated);
    setEditingProp(false);
  };

  const yearFilteredTrades = useMemo(() => {
    if (year === "all") return trades;
    return trades.filter(t => t.date && new Date(t.date).getFullYear() === year);
  }, [trades, year]);

  const filteredTrades = useMemo(() => getFilteredTrades(yearFilteredTrades, filter), [yearFilteredTrades, filter]);
  const stats = useMemo(() => computeStats(filteredTrades), [filteredTrades]);

  const tradesForCalendarDate = useMemo(() => {
    if (!calendarModalDate) return [] as typeof trades;
    return trades.filter(t => t.date === calendarModalDate).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [trades, calendarModalDate]);

  // Prop firm calculations
  const propCalc = useMemo(() => {
    const rPerDollar = propConfig.riskPercent / 100 * propConfig.accountSize;
    const profitTargetR = (propConfig.profitTarget / 100 * propConfig.accountSize) / rPerDollar;
    const maxDrawdownR = (propConfig.maxDrawdown / 100 * propConfig.accountSize) / rPerDollar;
    const dailyLossR = (propConfig.dailyLoss / 100 * propConfig.accountSize) / rPerDollar;

    // Total R since start date
    const startTrades = trades.filter(t => t.date >= propConfig.startDate);
    const totalR = startTrades.reduce((s, t) => s + (t.realisedR || 0), 0);

    // Max drawdown from equity curve
    let peak = 0, currentR = 0, maxDD = 0;
    [...startTrades].sort((a, b) => a.date.localeCompare(b.date)).forEach(t => {
      currentR += t.realisedR || 0;
      if (currentR > peak) peak = currentR;
      const dd = peak - currentR;
      if (dd > maxDD) maxDD = dd;
    });

    // Today's R
    const todayKey = new Date().toISOString().slice(0, 10);
    const todayR = trades.filter(t => t.date === todayKey).reduce((s, t) => s + (t.realisedR || 0), 0);

    const profitPct = Math.max(Math.min((totalR / profitTargetR) * 100, 100), 0);
    const ddPct = Math.max(Math.min((maxDD / maxDrawdownR) * 100, 100), 0);
    const dailyLossPct = Math.max(Math.min((Math.abs(Math.min(todayR, 0)) / dailyLossR) * 100, 100), 0);

    return {
      totalR, profitTargetR, maxDrawdownR, dailyLossR, maxDD, todayR,
      profitPct, ddPct, dailyLossPct,
      rPerDollar,
    };
  }, [trades, propConfig]);

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
          <FilterPills options={FILTER_OPTIONS} activeId={filter} onChange={setFilter} />
          <YearSelector />
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">

        {/* Left column */}
        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <StatCard label="Total R" value={formatR(stats.totalR)} valueColor={valueColor(stats.totalR)} />
            <StatCard label="Trades" value={stats.n} subtext={`${stats.wins}W · ${stats.losses}L · ${stats.bes}BE`} />
            <StatCard label="Win Rate" value={`${stats.winrate.toFixed(1)}%`} />
            <StatCard label="Avg R" value={formatR(stats.avgR)} valueColor={valueColor(stats.avgR)} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
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
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Trader card */}
          <TradingCard className="p-0">
            <div className="relative flex flex-col items-center gap-3 px-4 pt-8 pb-4">
              {!editingName ? (
                <div className="absolute top-[-4px] text-sm font-semibold uppercase tracking-wider cursor-pointer" onClick={() => setEditingName(true)}>{name}</div>
              ) : (
                <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onBlur={() => setEditingName(false)}
                  className="absolute top-[-4px] bg-black text-center text-sm outline-none border border-[#222] rounded px-2" />
              )}
              <label className="cursor-pointer w-full">
                {image ? (
                  <img src={image} className="w-full rounded-xl object-contain" />
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

          {/* Win/Loss */}
          <TradingCard title="Win/Loss Ratio" subtitle="Trade outcome distribution">
            <WinLossChart stats={stats} />
          </TradingCard>

          {/* Streak */}
          <TradingCard title="Streak Tracker" subtitle="Current and historical streaks">
            <StreakIndicator stats={stats} />
          </TradingCard>

          {/* Prop Firm Card */}
          <TradingCard>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold text-white">Prop Firm</p>
                <p className="text-xs text-[#444] mt-0.5">{propConfig.phase} · ${propConfig.accountSize.toLocaleString()} · {propConfig.riskPercent}% risk</p>
              </div>
              <div className="flex items-center gap-2">
                {/* Phase pills */}
                <div className="flex gap-1">
                  {PHASES.map(p => (
                    <button key={p} onClick={() => {
                      const updated = { ...propConfig, phase: p };
                      setPropConfig(updated);
                      savePropConfig(updated);
                    }}
                      className="text-[10px] px-2 py-0.5 rounded-full border transition-all"
                      style={{
                        borderColor: propConfig.phase === p ? "rgba(0,210,138,0.4)" : "rgba(40,40,40,0.8)",
                        background: propConfig.phase === p ? "rgba(0,210,138,0.08)" : "transparent",
                        color: propConfig.phase === p ? "#00d28a" : "#444",
                      }}>
                      {p.replace("Phase ", "P")}
                    </button>
                  ))}
                </div>
                <button onClick={() => { 
                  setPropDraft({
                    phase: propConfig.phase,
                    accountSize: String(propConfig.accountSize),
                    riskPercent: String(propConfig.riskPercent),
                    profitTarget: String(propConfig.profitTarget),
                    maxDrawdown: String(propConfig.maxDrawdown),
                    dailyLoss: String(propConfig.dailyLoss),
                    startDate: propConfig.startDate,
                  }); 
                  setEditingProp(true); 
                }}
                  className="text-xs text-[#444] hover:text-white transition-colors">Edit</button>
              </div>
            </div>

            {/* Profit target */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-[#555]">Profit Target</span>
                <span className="text-xs text-[#00d28a] font-medium">
                  {propCalc.totalR >= 0 ? "+" : ""}{propCalc.totalR.toFixed(2)}R / {propCalc.profitTargetR.toFixed(1)}R
                </span>
              </div>
              <div className="relative h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${propCalc.profitPct}%`,
                    background: propCalc.profitPct >= 100
                      ? "linear-gradient(90deg, #00d28a, #00ff9d)"
                      : "linear-gradient(90deg, #00a86b, #00d28a)",
                    boxShadow: propCalc.profitPct > 50 ? "0 0 8px rgba(0,210,138,0.4)" : "none",
                  }} />
                {propCalc.profitPct >= 100 && (
                  <span className="absolute right-1 top-0 h-full flex items-center text-[10px]">🎯</span>
                )}
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-[#333]">0%</span>
                <span className="text-[10px] text-[#333]">{propCalc.profitPct.toFixed(0)}% complete</span>
                <span className="text-[10px] text-[#333]">+{propConfig.profitTarget}%</span>
              </div>
            </div>

            {/* Drawdown used */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-[#555]">Drawdown Used</span>
                <span className={`text-xs font-medium ${propCalc.ddPct > 70 ? "text-[#ff4f4f]" : "text-[#888]"}`}>
                  {propCalc.maxDD.toFixed(2)}R / {propCalc.maxDrawdownR.toFixed(1)}R
                </span>
              </div>
              <div className="relative h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${propCalc.ddPct}%`,
                    background: propCalc.ddPct > 70
                      ? "linear-gradient(90deg, #ff4f4f, #ff2222)"
                      : propCalc.ddPct > 40
                      ? "linear-gradient(90deg, #ffd76e, #ff9f1c)"
                      : "linear-gradient(90deg, #444, #666)",
                  }} />
              </div>
              <p className="text-[10px] text-[#333] mt-1">Max {propConfig.maxDrawdown}% allowed</p>
            </div>

            {/* Daily loss */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-[#555]">Today's Loss</span>
                <span className={`text-xs font-medium ${propCalc.todayR < 0 ? "text-[#ff4f4f]" : "text-[#00d28a]"}`}>
                  {propCalc.todayR >= 0 ? "+" : ""}{propCalc.todayR.toFixed(2)}R
                </span>
              </div>
              <div className="relative h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${propCalc.dailyLossPct}%`,
                    background: propCalc.dailyLossPct > 70 ? "linear-gradient(90deg, #ff4f4f, #ff2222)" : "linear-gradient(90deg, #333, #555)",
                  }} />
              </div>
              <p className="text-[10px] text-[#333] mt-1">Daily limit: {propCalc.dailyLossR.toFixed(1)}R ({propConfig.dailyLoss}%)</p>
            </div>

            {/* 1R in $ */}
            <div className="mt-4 pt-3 border-t border-[#111] flex justify-between text-[10px] text-[#333]">
              <span>1R = ${propCalc.rPerDollar.toFixed(0)}</span>
              <span>Since {propConfig.startDate}</span>
            </div>
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

      {/* Prop firm edit modal */}
      {editingProp && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && setEditingProp(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a]">
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#111]">
              <h2 className="text-sm font-semibold text-white">Prop Firm Settings</h2>
              <button onClick={() => setEditingProp(false)} className="text-[#444] hover:text-white transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              {[
                { label: "Account Size ($)", key: "accountSize", type: "number" },
                { label: "Risk per Trade (%)", key: "riskPercent", type: "number" },
                { label: "Profit Target (%)", key: "profitTarget", type: "number" },
                { label: "Max Drawdown (%)", key: "maxDrawdown", type: "number" },
                { label: "Daily Loss Limit (%)", key: "dailyLoss", type: "number" },
                { label: "Challenge Start Date", key: "startDate", type: "date" },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs text-[#444] mb-1.5">{f.label}</label>
                  <input type={f.type} value={propDraft[f.key] ?? ""}
                    onChange={(e) => setPropDraft({ ...propDraft, [f.key]: e.target.value })}
                    className="w-full bg-[#080808] border border-[#1a1a1a] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#2a2a2a]"
                    style={{ colorScheme: "dark" }}
                    onFocus={(e) => e.target.select()} />
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <button onClick={saveProp} className="flex-1 py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-[#e8e8e8] transition-colors">Save</button>
                <button onClick={() => setEditingProp(false)} className="flex-1 py-2.5 rounded-xl border border-[#1a1a1a] text-sm text-[#555] hover:text-white transition-colors">Cancel</button>
              </div>
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
