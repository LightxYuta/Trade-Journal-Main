import type { PerformanceByPeriod, StrategyPerformance } from "@shared/schema";

interface PerformanceTableProps {
  data: PerformanceByPeriod[] | StrategyPerformance[];
  type: "period" | "strategy";
}

export function PerformanceTable({ data, type }: PerformanceTableProps) {
  if (data.length === 0) {
    return (
      <div className="text-center text-[#b8b8b8] text-sm py-4">
        No data available
      </div>
    );
  }

  if (type === "strategy") {
    const strategyData = data as StrategyPerformance[];
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-[0.78rem]">
          <thead>
            <tr className="text-left text-[0.72rem] text-[#b8b8b8] uppercase tracking-wider">
              <th className="pb-2 pr-4">Strategy</th>
              <th className="pb-2 pr-4">Trades</th>
              <th className="pb-2 pr-4">Total R</th>
              <th className="pb-2 pr-4">Win Rate</th>
              <th className="pb-2 pr-4">Avg R</th>
              <th className="pb-2 pr-4">PF</th>
              <th className="pb-2">Expectancy</th>
            </tr>
          </thead>
          <tbody>
            {strategyData.map((row, idx) => (
              <tr 
                key={idx} 
                className="border-t border-[rgba(50,50,50,0.95)]"
                data-testid={`strategy-row-${row.name}`}
              >
                <td className="py-2 pr-4 font-medium">{row.name}</td>
                <td className="py-2 pr-4 text-[#b8b8b8]">{row.trades}</td>
                <td className={`py-2 pr-4 font-semibold ${
                  row.totalR > 0 ? "text-[#00d28a]" : row.totalR < 0 ? "text-[#ff4f4f]" : "text-[#b8b8b8]"
                }`}>
                  {row.totalR >= 0 ? "+" : ""}{row.totalR.toFixed(2)}R
                </td>
                <td className="py-2 pr-4">{row.winRate.toFixed(1)}%</td>
                <td className={`py-2 pr-4 ${
                  row.avgR > 0 ? "text-[#00d28a]" : row.avgR < 0 ? "text-[#ff4f4f]" : "text-[#b8b8b8]"
                }`}>
                  {row.avgR >= 0 ? "+" : ""}{row.avgR.toFixed(2)}R
                </td>
                <td className="py-2 pr-4">
                  {row.profitFactor === Infinity ? "∞" : row.profitFactor.toFixed(2)}
                </td>
                <td className={`py-2 ${
                  row.expectancy > 0 ? "text-[#00d28a]" : row.expectancy < 0 ? "text-[#ff4f4f]" : "text-[#b8b8b8]"
                }`}>
                  {row.expectancy >= 0 ? "+" : ""}{row.expectancy.toFixed(2)}R
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const periodData = data as PerformanceByPeriod[];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[0.78rem]">
        <thead>
          <tr className="text-left text-[0.72rem] text-[#b8b8b8] uppercase tracking-wider">
            <th className="pb-2 pr-4">Period</th>
            <th className="pb-2 pr-4">Trades</th>
            <th className="pb-2 pr-4">Total R</th>
            <th className="pb-2 pr-4">Win Rate</th>
            <th className="pb-2">Avg R</th>
          </tr>
        </thead>
        <tbody>
          {periodData.map((row, idx) => (
            <tr 
              key={idx} 
              className="border-t border-[rgba(50,50,50,0.95)]"
              data-testid={`period-row-${row.label}`}
            >
              <td className="py-2 pr-4 font-medium">{row.label}</td>
              <td className="py-2 pr-4 text-[#b8b8b8]">{row.trades}</td>
              <td className={`py-2 pr-4 font-semibold ${
                row.totalR > 0 ? "text-[#00d28a]" : row.totalR < 0 ? "text-[#ff4f4f]" : "text-[#b8b8b8]"
              }`}>
                {row.totalR >= 0 ? "+" : ""}{row.totalR.toFixed(2)}R
              </td>
              <td className="py-2 pr-4">{row.winRate.toFixed(1)}%</td>
              <td className={`py-2 ${
                row.avgR > 0 ? "text-[#00d28a]" : row.avgR < 0 ? "text-[#ff4f4f]" : "text-[#b8b8b8]"
              }`}>
                {row.avgR >= 0 ? "+" : ""}{row.avgR.toFixed(2)}R
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
