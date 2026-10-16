import type { Trade } from "@shared/schema";
import { isCleanLossTag } from "./cleanLoss";

export function sequenceGrade(trade: Trade) {
  const grade = trade.setupGrade?.trim().replace(/\s+/g, " ").toLowerCase();
  return grade === "a+" ? "A+" : grade === "a" ? "A" : grade === "fake a+" ? "Fake A+" : grade === "b" ? "B" : grade === "retard" ? "Retard" : null;
}

export function sequenceTrades(trades: Trade[], clean: boolean) {
  return [...trades].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt || a.id.localeCompare(b.id))
    .map((trade, index) => ({ trade, number: index + 1 }))
    .filter(({ trade }) => !clean || !trade.mistakes?.length || trade.mistakes.every(isCleanLossTag));
}

export function sequenceStats(trades: Trade[]) {
  const aPlus = trades.filter(t => sequenceGrade(t) === "A+").length;
  const fake = trades.filter(t => sequenceGrade(t) === "Fake A+").length;
  const a = trades.filter(t => sequenceGrade(t) === "A").length;
  const b = trades.filter(t => sequenceGrade(t) === "B").length;
  const retard = trades.filter(t => sequenceGrade(t) === "Retard").length;
  const good = aPlus + a;
  const bad = fake + b + retard;
  const classified = good + bad;
  return {
    totalR: trades.reduce((sum, t) => sum + t.realisedR, 0),
    activeDays: new Set(trades.map(t => t.date).filter(Boolean)).size,
    aPlus, a, fake, b, retard, good, bad, unclassified: trades.length - classified,
    purity: classified ? `${Math.round(good / classified * 100)}%` : "—",
    wins: trades.filter(t => t.realisedR > 0.0001).length,
    losses: trades.filter(t => t.realisedR < -0.0001).length,
    bes: trades.filter(t => Math.abs(t.realisedR) <= 0.0001).length,
  };
}

export function sequenceSamples<T>(items: T[], size = 10): T[][] {
  if (![10, 20, 30].includes(size)) throw new Error("Sample size must be 10, 20, or 30 trades");
  return Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, i * size + size));
}

export function sampleWindow(total: number, offset: number) {
  const safeOffset = Math.max(0, Math.min(offset, Math.max(0, total - 1)));
  const end = Math.max(0, total - safeOffset);
  return { start: Math.max(0, end - 3), end };
}