import type { Trade, TradeStats, DayStats, PerformanceByPeriod, StrategyPerformance, HeatMapCell, DistributionData } from "@shared/schema";

export function classifyOutcome(r: number): "Win" | "Loss" | "BE" {
  if (r > 0.0001) return "Win";
  if (r < -0.0001) return "Loss";
  return "BE";
}

export function formatDate(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso + "T00:00:00");
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return iso;
  }
}

export function formatR(r: number): string {
  return `${r >= 0 ? "+" : ""}${r.toFixed(2)}R`;
}

function parseNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = parseFloat(value.replace(/,/g, "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function computeStats(trades: Trade[]): TradeStats {
  const n = trades.length;
  const rValues = trades.map(t => t.realisedR || 0);

  let totalR = 0;
  let wins = 0;
  let losses = 0;
  let bes = 0;
  let winSum = 0;
  let lossSum = 0;

  let runningEquity = 0;
  let maxEquity = 0;
  let maxDrawdown = 0;

  let currentWinStreak = 0;
  let currentLossStreak = 0;
  let bestWinStreak = 0;
  let worstLossStreak = 0;

  const dayTotals: Record<string, number> = {};
  const dailyReturns: number[] = [];

  for (let i = 0; i < trades.length; i++) {
    const t = trades[i];
    const safeR = parseNumber(t.realisedR);
    totalR += safeR;

    runningEquity += safeR;
    if (runningEquity > maxEquity) maxEquity = runningEquity;
    const dd = maxEquity - runningEquity;
    if (dd > maxDrawdown) maxDrawdown = dd;

    if (safeR > 0.0001) {
      wins++;
      winSum += safeR;
      currentWinStreak++;
      currentLossStreak = 0;
      if (currentWinStreak > bestWinStreak) bestWinStreak = currentWinStreak;
    } else if (safeR < -0.0001) {
      losses++;
      lossSum += safeR;
      currentLossStreak++;
      currentWinStreak = 0;
      if (currentLossStreak > worstLossStreak) worstLossStreak = currentLossStreak;
    } else {
      bes++;
      currentWinStreak = 0;
      currentLossStreak = 0;
    }

    if (t.date) {
      dayTotals[t.date] = (dayTotals[t.date] || 0) + safeR;
    }
  }

  Object.values(dayTotals).forEach(v => dailyReturns.push(v));

  const winrate = n > 0 ? (wins / n) * 100 : 0;
  const avgR = n > 0 ? totalR / n : 0;
  const bestR = n > 0 ? Math.max(...rValues) : 0;
  const worstR = n > 0 ? Math.min(...rValues) : 0;

  const dayValues = Object.values(dayTotals);
  const activeDays = dayValues.length;
  const avgPerDay = activeDays > 0 ? totalR / activeDays : 0;
  const bestDay = activeDays > 0 ? Math.max(...dayValues) : 0;
  const worstDay = activeDays > 0 ? Math.min(...dayValues) : 0;

  const avgWin = wins > 0 ? winSum / wins : 0;
  const avgLoss = losses > 0 ? Math.abs(lossSum / losses) : 0;
  const profitFactor = losses > 0 && lossSum !== 0 ? winSum / Math.abs(lossSum) : wins > 0 ? Infinity : 0;

  let expR = 0;
  if (n > 0) {
    const pWin = wins / n;
    const pLoss = losses / n;
    expR = pWin * avgWin + pLoss * avgLoss;
  }

  const winLossRatio = avgLoss > 0 ? avgWin / avgLoss : 0;

  let sharpeRatio = 0;
  if (dailyReturns.length > 1) {
    const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
    const variance = dailyReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / dailyReturns.length;
    const stdDev = Math.sqrt(variance);
    if (stdDev > 0) {
      sharpeRatio = (mean / stdDev) * Math.sqrt(252);
    }
  }

  let currentStreak: { type: 'win' | 'loss' | 'none'; count: number } = { type: 'none', count: 0 };
  if (currentWinStreak > 0) {
    currentStreak = { type: 'win', count: currentWinStreak };
  } else if (currentLossStreak > 0) {
    currentStreak = { type: 'loss', count: currentLossStreak };
  }

  return {
    n,
    totalR,
    wins,
    losses,
    bes,
    winrate,
    avgR,
    bestR,
    worstR,
    maxDrawdown,
    bestDay,
    worstDay,
    avgPerDay,
    profitFactor,
    expR,
    avgWin,
    avgLoss,
    winLossRatio,
    bestWinStreak,
    worstLossStreak,
    activeDays,
    sharpeRatio,
    currentStreak,
  };
}

export interface EdgeScoreAxis { key: string; label: string; raw: number; score: number }
export interface EdgeScoreResult { overall: number; axes: EdgeScoreAxis[] }

// Piecewise-linear interpolation across [minValue, maxValue, minScore, maxScore] bands,
// matching TradeZella's Zella Score published thresholds exactly.
function bandedScore(value: number, segments: [number, number, number, number][]): number {
  for (const [lo, hi, sLo, sHi] of segments) {
    if (value >= lo && value < hi) {
      if (hi === Infinity || hi === lo) return sLo;
      const t = (value - lo) / (hi - lo);
      return sLo + t * (sHi - sLo);
    }
  }
  return segments[segments.length - 1][3];
}

const RATIO_BANDS: [number, number, number, number][] = [
  [-Infinity, 1.0, 0, 15],
  [1.0, 1.2, 15, 25],
  [1.2, 1.4, 25, 35],
  [1.4, 1.6, 35, 45],
  [1.6, 1.8, 45, 55],
  [1.8, 2.0, 60, 69],
  [2.0, 2.2, 70, 79],
  [2.2, 2.4, 80, 89],
  [2.4, 2.6, 90, 99],
  [2.6, Infinity, 100, 100],
];

const RECOVERY_BANDS: [number, number, number, number][] = [
  [-Infinity, 1.0, 0, 0],
  [1.0, 1.5, 1, 29],
  [1.5, 2.0, 30, 49],
  [2.0, 2.5, 50, 59],
  [2.5, 3.0, 60, 69],
  [3.0, 3.5, 70, 89],
  [3.5, Infinity, 100, 100],
];

/**
 * Edge Score — TradeZella's "Zella Score" methodology, adapted to R-multiples
 * instead of dollars (everything here is already R-denominated, so no
 * conversion is needed). Six weighted axes, each scored 0-100:
 * Profit Factor 25%, Avg Win/Loss 20%, Max Drawdown 20%, Win% 15%,
 * Recovery Factor 10%, Consistency 10%.
 */
export function computeEdgeScore(trades: Trade[]): EdgeScoreResult {
  const axes: EdgeScoreAxis[] = [
    { key: 'profitFactor', label: 'Profit factor', raw: 0, score: 0 },
    { key: 'winLoss', label: 'Avg win/loss', raw: 0, score: 0 },
    { key: 'drawdown', label: 'Max drawdown', raw: 0, score: 0 },
    { key: 'winRate', label: 'Win %', raw: 0, score: 0 },
    { key: 'recovery', label: 'Recovery factor', raw: 0, score: 0 },
    { key: 'consistency', label: 'Consistency', raw: 0, score: 0 },
  ];
  const n = trades.length;
  if (n === 0) return { overall: 0, axes };

  let wins = 0, losses = 0, winSum = 0, lossSum = 0, totalR = 0;
  let runningEquity = 0, maxEquity = 0, maxDrawdown = 0, peakBeforeDD = 0;
  const dayTotals: Record<string, number> = {};

  const parseNumber = (value: unknown): number => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value.replace(/,/g, '.'));
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  };

  for (const t of trades) {
    const rawR = t.realisedR;
    const safeR = parseNumber(rawR);
    totalR += safeR;
    runningEquity += safeR;
    if (runningEquity > maxEquity) maxEquity = runningEquity;
    const dd = maxEquity - runningEquity;
    if (dd > maxDrawdown) { maxDrawdown = dd; peakBeforeDD = maxEquity; }
    if (safeR > 0.0001) { wins++; winSum += safeR; }
    else if (safeR < -0.0001) { losses++; lossSum += safeR; }
    if (t.date) dayTotals[t.date] = (dayTotals[t.date] || 0) + safeR;
  }

  const winRate = (wins / n) * 100;
  const avgWin = wins > 0 ? winSum / wins : 0;
  const avgLoss = losses > 0 ? Math.abs(lossSum / losses) : 0;
  const winLossRatio = avgLoss > 0 ? avgWin / avgLoss : (wins > 0 ? Infinity : 0);
  const profitFactor = losses > 0 && lossSum !== 0 ? winSum / Math.abs(lossSum) : (wins > 0 ? Infinity : 0);
  const maxDrawdownPct = maxDrawdown > 0
    ? maxEquity > 0
      ? (maxDrawdown / maxEquity) * 100
      : 100
    : 0;
  const recoveryFactor = maxDrawdown > 0 ? totalR / maxDrawdown : (totalR > 0 ? 100 : 0);

  const clampScore = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  const safeProfitFactor = Number.isFinite(profitFactor) ? profitFactor : 100;
  const safeWinLossRatio = Number.isFinite(winLossRatio) ? winLossRatio : 100;
  const safeRecoveryFactor = Number.isFinite(recoveryFactor) ? recoveryFactor : 0;

  const scoredProfitFactor = clampScore(bandedScore(safeProfitFactor, RATIO_BANDS));
  const scoredWinLossRatio = clampScore(bandedScore(safeWinLossRatio, RATIO_BANDS));
  const scoredDrawdown = clampScore(100 - maxDrawdownPct);
  const scoredWinRate = clampScore((winRate / 60) * 100);
  const scoredRecovery = clampScore(bandedScore(safeRecoveryFactor, RECOVERY_BANDS));

  const dailyVals = Object.values(dayTotals);
  let consistencyScore = 0;
  if (dailyVals.length > 1) {
    const mean = dailyVals.reduce((a, b) => a + b, 0) / dailyVals.length;
    const variance = dailyVals.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / dailyVals.length;
    const stdDev = Number.isFinite(variance) ? Math.sqrt(variance) : 0;
    if (Number.isFinite(mean) && Number.isFinite(stdDev)) {
      const ratio = Math.abs(mean) / (Math.abs(mean) + stdDev);
      consistencyScore = Math.max(0, Math.min(100, ratio * 100));
    }
  }

  axes[0] = { key: 'profitFactor', label: 'Profit factor', raw: safeProfitFactor, score: scoredProfitFactor };
  axes[1] = { key: 'winLoss', label: 'Avg win/loss', raw: safeWinLossRatio, score: scoredWinLossRatio };
  axes[2] = { key: 'drawdown', label: 'Max drawdown', raw: maxDrawdownPct, score: scoredDrawdown };
  axes[3] = { key: 'winRate', label: 'Win %', raw: winRate, score: scoredWinRate };
  axes[4] = { key: 'recovery', label: 'Recovery factor', raw: safeRecoveryFactor, score: scoredRecovery };
  axes[5] = { key: 'consistency', label: 'Consistency', raw: consistencyScore, score: clampScore(consistencyScore) };

  const WEIGHTS: Record<string, number> = { profitFactor: 0.25, winLoss: 0.20, drawdown: 0.20, winRate: 0.15, recovery: 0.10, consistency: 0.10 };
  const overallValue = axes.reduce((sum, a) => {
    const weight = WEIGHTS[a.key] ?? 0;
    const score = Number.isFinite(a.score) ? a.score : 0;
    return sum + score * weight;
  }, 0);
  const overall = Number.isFinite(overallValue) ? overallValue : 0;

  return { overall, axes };
}

export function getFilteredTrades(
  trades: Trade[],
  filter: string,
  customFrom?: string | null,
  customTo?: string | null
): Trade[] {
  if (!trades || trades.length === 0) return [];

  const fmt = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  if (filter === "all") {
    return trades.slice();
  }

  const today = new Date();
  let fromStr: string | null = null;
  let toStr: string | null = null;

  if (filter === "today") {
    const todayStr = fmt(today);
    fromStr = todayStr;
    toStr = todayStr;
  } else if (filter === "week") {
    const day = today.getDay();
    const diffToMonday = (day + 6) % 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - diffToMonday);
    fromStr = fmt(monday);
    toStr = fmt(today);
  } else if (filter === "month") {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    fromStr = fmt(first);
    toStr = fmt(today);
  } else if (filter === "custom") {
    if (customFrom && customTo) {
      fromStr = customFrom;
      toStr = customTo;
      if (fromStr > toStr) {
        const tmp = fromStr;
        fromStr = toStr;
        toStr = tmp;
      }
    } else {
      return trades.slice();
    }
  }

  if (!fromStr || !toStr) {
    return trades.slice();
  }

  return trades.filter(t => {
    if (!t.date) return false;
    return t.date >= fromStr! && t.date <= toStr!;
  });
}

export function getPerformanceByDayOfWeek(trades: Trade[]): PerformanceByPeriod[] {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const buckets: Record<number, Trade[]> = {};
  
  for (let i = 0; i < 7; i++) {
    buckets[i] = [];
  }
  
  trades.forEach(t => {
    if (t.date) {
      const d = new Date(t.date + "T00:00:00");
      const dayOfWeek = d.getDay();
      buckets[dayOfWeek].push(t);
    }
  });
  
  return days.map((label, idx) => {
    const dayTrades = buckets[idx];
    const n = dayTrades.length;
    const totalR = dayTrades.reduce((sum, t) => sum + (t.realisedR || 0), 0);
    const wins = dayTrades.filter(t => (t.realisedR || 0) > 0.0001).length;
    const winRate = n > 0 ? (wins / n) * 100 : 0;
    const avgR = n > 0 ? totalR / n : 0;
    
    return { label, totalR, trades: n, winRate, avgR };
  });
}

export function getPerformanceByMonth(trades: Trade[]): PerformanceByPeriod[] {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const buckets: Record<string, Trade[]> = {};
  
  trades.forEach(t => {
    if (t.date) {
      const d = new Date(t.date + "T00:00:00");
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(t);
    }
  });
  
  return Object.entries(buckets)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, monthTrades]) => {
      const [year, month] = key.split("-");
      const label = `${months[parseInt(month)]} ${year}`;
      const n = monthTrades.length;
      const totalR = monthTrades.reduce((sum, t) => sum + (t.realisedR || 0), 0);
      const wins = monthTrades.filter(t => (t.realisedR || 0) > 0.0001).length;
      const winRate = n > 0 ? (wins / n) * 100 : 0;
      const avgR = n > 0 ? totalR / n : 0;
      
      return { label, totalR, trades: n, winRate, avgR };
    });
}

export function getPerformanceBySession(trades: Trade[]): PerformanceByPeriod[] {
  const buckets: Record<string, Trade[]> = {};
  
  trades.forEach(t => {
    const session = t.session || "Unknown";
    if (!buckets[session]) buckets[session] = [];
    buckets[session].push(t);
  });
  
  return Object.entries(buckets).map(([label, sessionTrades]) => {
    const n = sessionTrades.length;
    const totalR = sessionTrades.reduce((sum, t) => sum + (t.realisedR || 0), 0);
    const wins = sessionTrades.filter(t => (t.realisedR || 0) > 0.0001).length;
    const winRate = n > 0 ? (wins / n) * 100 : 0;
    const avgR = n > 0 ? totalR / n : 0;
    
    return { label, totalR, trades: n, winRate, avgR };
  });
}

export function getStrategyPerformance(trades: Trade[]): StrategyPerformance[] {
  const buckets: Record<string, Trade[]> = {};
  
  trades.forEach(t => {
    const model = t.model || "Unknown";
    if (!buckets[model]) buckets[model] = [];
    buckets[model].push(t);
  });
  
  return Object.entries(buckets).map(([name, modelTrades]) => {
    const n = modelTrades.length;
    const totalR = modelTrades.reduce((sum, t) => sum + (t.realisedR || 0), 0);
    const wins = modelTrades.filter(t => (t.realisedR || 0) > 0.0001).length;
    const losses = modelTrades.filter(t => (t.realisedR || 0) < -0.0001).length;
    const winSum = modelTrades.filter(t => (t.realisedR || 0) > 0.0001).reduce((sum, t) => sum + t.realisedR, 0);
    const lossSum = modelTrades.filter(t => (t.realisedR || 0) < -0.0001).reduce((sum, t) => sum + t.realisedR, 0);
    
    const winRate = n > 0 ? (wins / n) * 100 : 0;
    const avgR = n > 0 ? totalR / n : 0;
    const profitFactor = lossSum !== 0 ? winSum / Math.abs(lossSum) : wins > 0 ? Infinity : 0;
    
    const avgWin = wins > 0 ? winSum / wins : 0;
    const avgLoss = losses > 0 ? lossSum / losses : 0;
    const pWin = n > 0 ? wins / n : 0;
    const pLoss = n > 0 ? losses / n : 0;
    const expectancy = pWin * avgWin + pLoss * avgLoss;
    
    return { name, trades: n, totalR, winRate, avgR, profitFactor, expectancy };
  });
}

export function getDayStats(trades: Trade[]): Record<string, DayStats> {
  const dayStats: Record<string, DayStats> = {};
  
  trades.forEach(t => {
    if (!t.date) return;
    
    if (!dayStats[t.date]) {
      dayStats[t.date] = { date: t.date, totalR: 0, trades: 0, wins: 0, losses: 0 };
    }
    
    dayStats[t.date].totalR += t.realisedR || 0;
    dayStats[t.date].trades++;
    
    const outcome = classifyOutcome(t.realisedR || 0);
    if (outcome === "Win") dayStats[t.date].wins++;
    else if (outcome === "Loss") dayStats[t.date].losses++;
  });
  
  return dayStats;
}

export function getHeatMapData(trades: Trade[]): HeatMapCell[] {
  const grid: Record<string, { value: number; trades: number }> = {};
  
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      grid[`${day}-${hour}`] = { value: 0, trades: 0 };
    }
  }
  
  trades.forEach(t => {
    if (t.date) {
      const d = new Date(t.date + "T12:00:00");
      const day = d.getDay();
      const hour = 12;
      const key = `${day}-${hour}`;
      grid[key].value += t.realisedR || 0;
      grid[key].trades++;
    }
  });
  
  return Object.entries(grid).map(([key, data]) => {
    const [day, hour] = key.split("-").map(Number);
    return { day, hour, value: data.value, trades: data.trades };
  });
}

export function getRDistribution(trades: Trade[]): DistributionData[] {
  const ranges = [
    { min: -Infinity, max: -3, label: "< -3R" },
    { min: -3, max: -2, label: "-3R to -2R" },
    { min: -2, max: -1, label: "-2R to -1R" },
    { min: -1, max: 0, label: "-1R to 0R" },
    { min: 0, max: 1, label: "0R to 1R" },
    { min: 1, max: 2, label: "1R to 2R" },
    { min: 2, max: 3, label: "2R to 3R" },
    { min: 3, max: Infinity, label: "> 3R" },
  ];
  
  const counts: Record<string, number> = {};
  ranges.forEach(r => counts[r.label] = 0);
  
  trades.forEach(t => {
    const r = t.realisedR || 0;
    for (const range of ranges) {
      if (r > range.min && r <= range.max) {
        counts[range.label]++;
        break;
      }
    }
  });
  
  const total = trades.length;
  return ranges.map(range => ({
    range: range.label,
    count: counts[range.label],
    percentage: total > 0 ? (counts[range.label] / total) * 100 : 0,
  }));
}

export function getEquityCurve(trades: Trade[]): { x: number; y: number; label: string }[] {
  let cumulative = 0;
  const sortedTrades = [...trades].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (a.createdAt || 0) - (b.createdAt || 0);
  });
  
  return sortedTrades.map((t, idx) => {
    cumulative += t.realisedR || 0;
    return {
      x: idx + 1,
      y: cumulative,
      label: `Trade ${idx + 1}: ${formatR(t.realisedR || 0)}`,
    };
  });
}
