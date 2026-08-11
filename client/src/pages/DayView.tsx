import { useState, useEffect } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import AssetCard from "./AssetCard";
import {
  getOrCreateDayPlan, loadAssetPlans, createAssetPlan, deleteAssetPlan, loadTemplate,
  TRADED_SYMBOLS, type DayPlan, type AssetPlan,
} from "@/lib/planStorage";

function formatDateLong(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface DayViewProps {
  date: string;
  onBack: () => void;
}

export default function DayView({ date, onBack }: DayViewProps) {
  const [dayPlan, setDayPlan] = useState<DayPlan | null>(null);
  const [assetPlans, setAssetPlans] = useState<AssetPlan[]>([]);
  const [loading, setLoading] = useState(true);

  const isWeekendDate = (() => {
    const [y, m, d] = date.split('-').map(Number);
    const dow = new Date(y, m - 1, d).getDay();
    return dow === 0 || dow === 6;
  })();

  const isPastDate = date < todayStr();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const dp = await getOrCreateDayPlan(date, isWeekendDate);
      if (cancelled) return;
      setDayPlan(dp);
      const plans = await loadAssetPlans(dp.id);
      if (cancelled) return;
      setAssetPlans(plans);
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const addAsset = async (symbol: string) => {
    if (!dayPlan) return;
    const template = await loadTemplate(symbol);
    const plan = await createAssetPlan(dayPlan.id, symbol, template);
    setAssetPlans(prev => [...prev, plan]);
  };

  const removeAsset = async (id: string) => {
    await deleteAssetPlan(id);
    setAssetPlans(prev => prev.filter(p => p.id !== id));
  };

  const remainingSymbols = TRADED_SYMBOLS.filter(s => !assetPlans.some(p => p.symbol === s));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="w-7 h-7 rounded-lg border border-[#1e1e1e] flex items-center justify-center text-[#555] hover:text-white transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
        <div>
          <h2 className="text-sm font-semibold text-white">{formatDateLong(date)}</h2>
          {isWeekendDate && <p className="text-xs text-[#444] mt-0.5">Weekend — manually created day</p>}
        </div>
      </div>

      {loading ? (
        <div className="text-[#333] text-sm py-12 text-center">Loading...</div>
      ) : (
        <>
          <div className="space-y-4">
            {assetPlans.map(plan => (
              <AssetCard
                key={plan.id}
                plan={plan}
                date={date}
                isPastDate={isPastDate}
                onUpdated={updated => setAssetPlans(prev => prev.map(p => p.id === updated.id ? updated : p))}
                onDelete={() => removeAsset(plan.id)}
              />
            ))}
          </div>

          {remainingSymbols.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {remainingSymbols.map(symbol => (
                <button key={symbol} onClick={() => addAsset(symbol)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-[#1e1e1e] text-xs text-[#555] hover:text-white hover:border-[#333] transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Plan {symbol}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
