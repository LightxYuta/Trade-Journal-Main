import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { TradeStats } from "@shared/schema";

interface StreakIndicatorProps {
  stats: TradeStats;
}

export function StreakIndicator({ stats }: StreakIndicatorProps) {
  const { currentStreak, bestWinStreak, worstLossStreak } = stats;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="text-[0.74rem] text-[#b8b8b8] mb-1">Current Streak</div>
          <div className="flex items-center gap-2">
            {currentStreak.type === "win" ? (
              <>
                <div className="w-8 h-8 rounded-full bg-[rgba(0,210,138,0.2)] flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-[#00d28a]" />
                </div>
                <div>
                  <div className="text-lg font-semibold text-[#00d28a]">{currentStreak.count}W</div>
                  <div className="text-[0.7rem] text-[#b8b8b8]">Win streak</div>
                </div>
              </>
            ) : currentStreak.type === "loss" ? (
              <>
                <div className="w-8 h-8 rounded-full bg-[rgba(255,79,79,0.2)] flex items-center justify-center">
                  <TrendingDown className="w-4 h-4 text-[#ff4f4f]" />
                </div>
                <div>
                  <div className="text-lg font-semibold text-[#ff4f4f]">{currentStreak.count}L</div>
                  <div className="text-[0.7rem] text-[#b8b8b8]">Loss streak</div>
                </div>
              </>
            ) : (
              <>
                <div className="w-8 h-8 rounded-full bg-[rgba(90,90,90,0.3)] flex items-center justify-center">
                  <Minus className="w-4 h-4 text-[#b8b8b8]" />
                </div>
                <div>
                  <div className="text-lg font-semibold text-[#b8b8b8]">None</div>
                  <div className="text-[0.7rem] text-[#b8b8b8]">No active streak</div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-xl border border-[rgba(60,60,60,0.95)]" style={{ background: "rgba(10, 10, 10, 0.96)" }}>
          <div className="text-[0.7rem] text-[#b8b8b8] uppercase tracking-wider mb-1">Best Win Streak</div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#00d28a]" />
            <span className="text-xl font-semibold text-[#00d28a]">{bestWinStreak}</span>
          </div>
        </div>

        <div className="p-3 rounded-xl border border-[rgba(60,60,60,0.95)]" style={{ background: "rgba(10, 10, 10, 0.96)" }}>
          <div className="text-[0.7rem] text-[#b8b8b8] uppercase tracking-wider mb-1">Worst Loss Streak</div>
          <div className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-[#ff4f4f]" />
            <span className="text-xl font-semibold text-[#ff4f4f]">{worstLossStreak}</span>
          </div>
        </div>
      </div>

      <div className="flex gap-1.5 mt-2">
        {Array.from({ length: Math.max(bestWinStreak, 10) }).map((_, idx) => {
          const isActive = currentStreak.type === "win" && idx < currentStreak.count;
          const isBest = idx < bestWinStreak;
          return (
            <div
              key={`win-${idx}`}
              className="h-2 flex-1 rounded-full transition-all duration-200"
              style={{
                background: isActive
                  ? "rgba(0, 210, 138, 0.9)"
                  : isBest
                  ? "rgba(0, 210, 138, 0.3)"
                  : "rgba(60, 60, 60, 0.3)",
                boxShadow: isActive ? "0 0 8px rgba(0, 210, 138, 0.5)" : "none",
              }}
            />
          );
        })}
      </div>

      <div className="flex gap-1.5">
        {Array.from({ length: Math.max(worstLossStreak, 10) }).map((_, idx) => {
          const isActive = currentStreak.type === "loss" && idx < currentStreak.count;
          const isWorst = idx < worstLossStreak;
          return (
            <div
              key={`loss-${idx}`}
              className="h-2 flex-1 rounded-full transition-all duration-200"
              style={{
                background: isActive
                  ? "rgba(255, 79, 79, 0.9)"
                  : isWorst
                  ? "rgba(255, 79, 79, 0.3)"
                  : "rgba(60, 60, 60, 0.3)",
                boxShadow: isActive ? "0 0 8px rgba(255, 79, 79, 0.5)" : "none",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
