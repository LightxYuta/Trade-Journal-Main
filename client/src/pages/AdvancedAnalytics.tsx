import { useState, useMemo } from "react";
import { useTradeContext } from "@/contexts/TradeContext";
import { useYearFilter } from "@/contexts/YearFilterContext";
import { TradingCard } from "@/components/TradingCard";
import { StatCard } from "@/components/StatCard";
import { FilterPills } from "@/components/FilterPills";
import { HeatMap } from "@/components/HeatMap";
import { DistributionChart } from "@/components/DistributionChart";
import { PerformanceTable } from "@/components/PerformanceTable";
import { RadarChart } from "@/components/RadarChart";
import { 
  computeStats, 
  getFilteredTrades, 
  formatR, 
  getPerformanceByDayOfWeek,
  getPerformanceByMonth,
  getPerformanceBySession,
  getStrategyPerformance
} from "@/lib/tradeUtils";

const FILTER_OPTIONS = [
  { id: "all", label: "All Time" },
  { id: "month", label: "This Month" },
  { id: "week", label: "This Week" },
];

const VIEW_OPTIONS = [
  { id: "dayOfWeek", label: "By Day" },
  { id: "month", label: "By Month" },
  { id: "session", label: "By Session" },
];

export default function AdvancedAnalytics() {
  const { trades } = useTradeContext();
  const { year } = useYearFilter();
  const [filter, setFilter] = useState("all");
  const [view, setView] = useState("dayOfWeek");

  // Filter trades by year
  const yearFilteredTrades = useMemo(() => {
    if (year === "all") return trades;
    return trades.filter(t => t.date && new Date(t.date).getFullYear() === year);
  }, [trades, year]);

  const filteredTrades = useMemo(() => getFilteredTrades(yearFilteredTrades, filter), [yearFilteredTrades, filter]);
  const stats = useMemo(() => computeStats(filteredTrades), [filteredTrades]);

  const performanceData = useMemo(() => {
    switch (view) {
      case "month":
        return getPerformanceByMonth(filteredTrades);
      case "session":
        return getPerformanceBySession(filteredTrades);
      default:
        return getPerformanceByDayOfWeek(filteredTrades);
    }
  }, [filteredTrades, view]);

  const strategyData = useMemo(() => getStrategyPerformance(filteredTrades), [filteredTrades]);

  const valueColor = (val: number) => {
    if (val > 0.0001) return "positive" as const;
    if (val < -0.0001) return "negative" as const;
    return "default" as const;
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-wide uppercase">Advanced Analytics</h1>
          <p className="text-[0.82rem] text-[#b8b8b8]">
            Deep dive into your trading performance
          </p>
        </div>
        <FilterPills options={FILTER_OPTIONS} activeId={filter} onChange={setFilter} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
        <StatCard 
          label="Sharpe Ratio" 
          value={stats.sharpeRatio.toFixed(2)}
          valueColor={stats.sharpeRatio > 1 ? "positive" : stats.sharpeRatio > 0 ? "gold" : "negative"}
        />
        <StatCard 
          label="Max Drawdown" 
          value={formatR(-stats.maxDrawdown)}
          valueColor="negative"
        />
        <StatCard 
          label="Expectancy (R)" 
          value={formatR(stats.expR)}
          valueColor={valueColor(stats.expR)}
        />
        <StatCard 
          label="Profit Factor" 
          value={stats.profitFactor === Infinity ? "∞" : stats.profitFactor.toFixed(2)}
          valueColor={stats.profitFactor > 1 ? "positive" : "negative"}
        />
        <StatCard 
          label="Avg Win" 
          value={formatR(stats.avgWin)}
          valueColor="positive"
        />
        <StatCard 
          label="Avg Loss" 
          value={formatR(stats.avgLoss)}
          valueColor="negative"
        />
        <StatCard 
          label="Win/Loss Ratio" 
          value={stats.winLossRatio.toFixed(2)}
          valueColor={stats.winLossRatio > 1 ? "positive" : "negative"}
        />
        <StatCard 
          label="Avg R/Day" 
          value={formatR(stats.avgPerDay)}
          valueColor={valueColor(stats.avgPerDay)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <TradingCard title="Performance Radar" subtitle="Multi-dimensional performance view">
          <RadarChart stats={stats} />
        </TradingCard>

        <TradingCard title="R Distribution" subtitle="Trade outcome distribution by R value" className="lg:col-span-2">
          <DistributionChart trades={filteredTrades} />
        </TradingCard>
      </div>

      <TradingCard title="Performance Heat Map" subtitle="Profit/loss by day of week">
        <HeatMap trades={filteredTrades} />
      </TradingCard>

      <TradingCard 
        title="Performance Breakdown" 
        subtitle="Detailed performance by time period"
        headerActions={
          <FilterPills options={VIEW_OPTIONS} activeId={view} onChange={setView} />
        }
      >
        <PerformanceTable data={performanceData} type="period" />
      </TradingCard>

      <TradingCard title="Strategy Comparison" subtitle="Performance metrics by trading model/strategy">
        <PerformanceTable data={strategyData} type="strategy" />
      </TradingCard>

      <TradingCard title="Key Metrics Explained" subtitle="Understanding your analytics">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-[0.78rem]">
          <div className="p-3 rounded-xl border border-[rgba(60,60,60,0.95)]" style={{ background: "rgba(10, 10, 10, 0.96)" }}>
            <div className="text-[#4fc3f7] font-semibold mb-1">Sharpe Ratio</div>
            <div className="text-[#b8b8b8]">
              Measures risk-adjusted return. {">"} 1 is good, {">"} 2 is very good. Higher is better.
            </div>
          </div>
          <div className="p-3 rounded-xl border border-[rgba(60,60,60,0.95)]" style={{ background: "rgba(10, 10, 10, 0.96)" }}>
            <div className="text-[#ff9ece] font-semibold mb-1">Max Drawdown</div>
            <div className="text-[#b8b8b8]">
              Largest peak-to-trough decline in your equity curve. Lower is better.
            </div>
          </div>
          <div className="p-3 rounded-xl border border-[rgba(60,60,60,0.95)]" style={{ background: "rgba(10, 10, 10, 0.96)" }}>
            <div className="text-[#ffd76e] font-semibold mb-1">Expectancy</div>
            <div className="text-[#b8b8b8]">
              Average R you can expect per trade. Positive means profitable on average.
            </div>
          </div>
          <div className="p-3 rounded-xl border border-[rgba(60,60,60,0.95)]" style={{ background: "rgba(10, 10, 10, 0.96)" }}>
            <div className="text-[#00d28a] font-semibold mb-1">Profit Factor</div>
            <div className="text-[#b8b8b8]">
              Gross profit ÷ gross loss. {">"} 1 means profitable. {">"} 2 is excellent.
            </div>
          </div>
        </div>
      </TradingCard>
    </div>
  );
}
