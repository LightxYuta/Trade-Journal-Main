import type { Trade } from "@shared/schema";

export type MistakeStats = {
  mistake: string;
  trades: number;
  wins: number;
  losses: number;
  totalR: number;
  expectancy: number;
};

export function calculateMistakeStats(trades: Trade[]): MistakeStats[] {
  const map: Record<string, MistakeStats> = {};

  trades.forEach((trade) => {
    if (!trade.mistakes || trade.mistakes.length === 0) return;

    trade.mistakes.forEach((mistake: string) => {
      if (!map[mistake]) {
        map[mistake] = {
          mistake,
          trades: 0,
          wins: 0,
          losses: 0,
          totalR: 0,
          expectancy: 0,
        };
      }

      map[mistake].trades += 1;
      map[mistake].totalR += trade.realisedR;

      if (trade.realisedR > 0) {

        map[mistake].wins += 1;
      } else {
        map[mistake].losses += 1;
      }
    });
  });

    return Object.values(map).map((m) => ({
    ...m,
    expectancy: m.trades > 0 ? m.totalR / m.trades : 0,
  }));
}

