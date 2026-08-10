import { useState, useEffect } from "react";
import { Flame, ShieldCheck } from "lucide-react";
import { computeDailyStreak, loadMonthData, dayVisualStateFromData } from "@/lib/planStorage";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function PlanAdherenceCard() {
  const [streak, setStreak] = useState<number | null>(null);
  const [pctFollowed, setPctFollowed] = useState<number | null>(null);
  const [planlessCount, setPlanlessCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const t = new Date();
    computeDailyStreak(todayStr()).then(s => { if (!cancelled) setStreak(s); });
    loadMonthData(t.getFullYear(), t.getMonth() + 1).then(data => {
      if (cancelled) return;
      const dates = Object.keys(data.dayPlans);
      let followed = 0, planned = 0, planless = 0;
      dates.forEach(date => {
        const plans = data.assetPlansByDate[date] || [];
        const hasContent = plans.some(p => (p.content?.length ?? 0) > 0 || p.bias || p.tookTrade);
        if (!hasContent) return;
        planned++;
        if (!plans.some(p => p.adherence === 'deviated')) followed++;
      });
      Object.keys(data.tradeCounts).forEach(date => {
        if (dayVisualStateFromData(date, data) === 'planless-trading') planless++;
      });
      setPctFollowed(planned > 0 ? Math.round((followed / planned) * 100) : null);
      setPlanlessCount(planless);
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="flex items-center justify-between h-full">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,215,110,0.08)' }}>
          <Flame className="w-4 h-4" style={{ color: '#ffd76e' }} />
        </div>
        <div>
          <p className="text-xl font-bold text-white leading-none">{streak !== null ? streak : '—'}</p>
          <p className="text-[10px] text-[#444] mt-1">Day streak</p>
        </div>
      </div>
      <div className="h-8 w-px bg-[#1a1a1a]" />
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,210,138,0.08)' }}>
          <ShieldCheck className="w-4 h-4" style={{ color: '#00d28a' }} />
        </div>
        <div>
          <p className="text-xl font-bold text-white leading-none">{pctFollowed !== null ? `${pctFollowed}%` : '—'}</p>
          <p className="text-[10px] text-[#444] mt-1">Plan followed (mo.)</p>
        </div>
      </div>
      {planlessCount !== null && planlessCount > 0 && (
        <div className="text-right">
          <p className="text-xl font-bold" style={{ color: '#ff4f4f' }}>{planlessCount}</p>
          <p className="text-[10px] text-[#444] mt-1">Planless days</p>
        </div>
      )}
    </div>
  );
}
