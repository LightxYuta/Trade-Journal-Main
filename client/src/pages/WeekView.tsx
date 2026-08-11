import { useState, useEffect } from "react";
import { ArrowLeft, Flame } from "lucide-react";
import {
  loadMonthData, dayVisualStateFromData, weekStatsFromData, computeDailyStreak,
  type MonthData, type DayVisualState,
} from "@/lib/planStorage";

function fmtShort(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
}

const STATE_STYLES: Record<DayVisualState, { bg: string; border: string; text: string; label: string }> = {
  'no-plan-no-trade': { bg: '#0a0a0a', border: '#161616', text: '#333', label: 'No trading day' },
  'planless-trading': { bg: '#1a0a0a', border: '#3a1414', text: '#ff8080', label: 'Traded without a plan' },
  'normal': { bg: '#0d0d0d', border: '#1e1e1e', text: '#ccc', label: '' },
};

interface WeekViewProps {
  mondayDate: string; // 'YYYY-MM-DD' of the Monday
  monthData: MonthData | null; // pass down if caller already has it loaded, else this loads its own
  onBack: () => void;
  onOpenDay: (date: string) => void;
}

export default function WeekView({ mondayDate, monthData, onBack, onOpenDay }: WeekViewProps) {
  const [data, setData] = useState<MonthData | null>(monthData);
  const [streak, setStreak] = useState<number | null>(null);

  const weekdayDates = (() => {
    const [y, m, d] = mondayDate.split('-').map(Number);
    const base = new Date(y, m - 1, d);
    return Array.from({ length: 5 }, (_, i) => {
      const dt = new Date(base);
      dt.setDate(base.getDate() + i);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    });
  })();

  useEffect(() => {
    if (monthData) { setData(monthData); return; }
    const [y, m] = mondayDate.split('-').map(Number);
    loadMonthData(y, m).then(setData);
  }, [mondayDate, monthData]);

  useEffect(() => {
    const todayD = new Date();
    const todayStr = `${todayD.getFullYear()}-${String(todayD.getMonth() + 1).padStart(2, '0')}-${String(todayD.getDate()).padStart(2, '0')}`;
    computeDailyStreak(todayStr).then(setStreak);
  }, []);

  const stats = data ? weekStatsFromData(weekdayDates, data) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="w-7 h-7 rounded-lg border border-[#1e1e1e] flex items-center justify-center text-[#555] hover:text-white transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
        <h2 className="text-sm font-semibold text-white">Week of {fmtShort(weekdayDates[0])}</h2>
      </div>

      {/* Stats strip */}
      <div className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] px-4 py-3 flex items-center gap-6">
        <div>
          <p className="text-xs text-[#444] mb-0.5">Days rule followed</p>
          <p className="text-sm font-semibold font-mono" style={{ color: stats && stats.pctFollowed >= 80 ? 'var(--t-win)' : stats && stats.pctFollowed >= 50 ? 'var(--t-gold)' : 'var(--t-loss)' }}>
            {stats ? `${stats.pctFollowed}%` : '—'} <span className="text-[#333] font-normal">({stats?.plannedCount ?? 0}/5 planned)</span>
          </p>
        </div>
        <div>
          <p className="text-xs text-[#444] mb-0.5">Current streak</p>
          <p className="text-sm font-semibold font-mono text-white flex items-center gap-1">
            {streak !== null ? streak : '—'} <Flame className="w-3.5 h-3.5" style={{ color: 'var(--t-gold)' }} />
          </p>
        </div>
        <div>
          <p className="text-xs text-[#444] mb-0.5">Planless trading days</p>
          <p className="text-sm font-semibold font-mono" style={{ color: (stats?.planlessCount ?? 0) > 0 ? 'var(--t-loss)' : '#666' }}>
            {stats ? stats.planlessCount : '—'}
          </p>
        </div>
      </div>

      {/* Day tiles */}
      <div className="grid grid-cols-5 gap-3">
        {weekdayDates.map(date => {
          const state = data ? dayVisualStateFromData(date, data) : 'no-plan-no-trade';
          const style = STATE_STYLES[state];
          return (
            <button key={date} onClick={() => onOpenDay(date)}
              className="rounded-xl border p-4 text-left hover:border-[#333] transition-colors"
              style={{ background: style.bg, borderColor: style.border }}>
              <p className="text-xs font-medium mb-1" style={{ color: style.text === '#333' ? '#666' : style.text }}>{fmtShort(date)}</p>
              {style.label && <p className="text-xs" style={{ color: style.text }}>{style.label}</p>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
