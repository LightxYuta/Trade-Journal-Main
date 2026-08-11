import { useState, useCallback, useRef } from "react";
import { CheckCircle2, TrendingUp, TrendingDown, Minus, Lock, Unlock, AlertTriangle } from "lucide-react";
import BlockNoteEditor from "@/components/BlockNoteEditor";
import {
  type AssetPlan, type Bias, type RiskTier, type GradeRule,
  updateAssetPlan, recomputeAdherence,
} from "@/lib/planStorage";

const BIAS_OPTIONS: { value: Bias; label: string; icon: any; color: string }[] = [
  { value: "Bullish", label: "Bullish", icon: TrendingUp, color: "var(--t-win)" },
  { value: "Bearish", label: "Bearish", icon: TrendingDown, color: "var(--t-loss)" },
  { value: "Neutral", label: "Neutral", icon: Minus, color: "#888" },
];

const GRADE_KEYS: { key: keyof GradeRule; label: string }[] = [
  { key: "aplus", label: "A+" },
  { key: "a", label: "A" },
  { key: "b", label: "B" },
  { key: "retard", label: "Retard" },
];

const TIER_OPTIONS: { value: RiskTier; label: string }[] = [
  { value: "full", label: "Full risk" },
  { value: "half", label: "Half risk" },
  { value: "none", label: "No trade" },
];

interface AssetCardProps {
  plan: AssetPlan;
  date: string;
  isPastDate: boolean; // reconciliation only unlocks once the trading day has actually passed
  onUpdated: (plan: AssetPlan) => void;
  onDelete: () => void;
}

export default function AssetCard({ plan, date, isPastDate, onUpdated, onDelete }: AssetCardProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reconOpen, setReconOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback((updates: Partial<AssetPlan>) => {
    const next = { ...plan, ...updates };
    onUpdated(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaved(false);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        await updateAssetPlan(plan.id, updates);
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      } finally {
        setSaving(false);
      }
    }, 800);
  }, [plan, onUpdated]);

  const handleCheckAdherence = async () => {
    setChecking(true);
    try {
      const adherence = await recomputeAdherence(plan, date);
      onUpdated({ ...plan, adherence });
      setReconOpen(true);
    } finally {
      setChecking(false);
    }
  };

  const adherenceBadge = plan.adherence === 'adherent'
    ? <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: 'var(--t-win-bg)', color: 'var(--t-win)' }}>Adherent</span>
    : plan.adherence === 'deviated'
    ? <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: 'var(--t-loss-bg)', color: 'var(--t-loss)' }}>Deviated</span>
    : null;

  return (
    <div className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a]">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">{plan.symbol}</span>
          {adherenceBadge}
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs transition-opacity ${saving || saved ? 'opacity-100' : 'opacity-0'}`}>
            {saving ? <span className="text-[#444]">Saving...</span> : <span className="flex items-center gap-1" style={{ color: 'var(--t-accent, #00d28a)' }}><CheckCircle2 className="w-3 h-3" /> Saved</span>}
          </span>
          <button onClick={onDelete} className="text-xs text-[#333] hover:text-[#ff4f4f] transition-colors">Remove</button>
        </div>
      </div>

      {/* Pinned fields */}
      <div className="px-4 py-3 border-b border-[#1a1a1a] space-y-3">
        {/* Bias */}
        <div>
          <label className="block text-xs text-[#444] mb-1.5">Bias</label>
          <div className="flex gap-1.5">
            {BIAS_OPTIONS.map(opt => {
              const Icon = opt.icon;
              const active = plan.bias === opt.value;
              return (
                <button key={opt.value} onClick={() => persist({ bias: opt.value })}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors"
                  style={{
                    borderColor: active ? opt.color : '#1e1e1e',
                    color: active ? opt.color : '#555',
                    background: active ? `${opt.color}14` : 'transparent',
                  }}>
                  <Icon className="w-3 h-3" /> {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Grade rule — risk tier per grade */}
        <div>
          <label className="block text-xs text-[#444] mb-1.5">Grade rule for today</label>
          <div className="grid grid-cols-4 gap-1.5">
            {GRADE_KEYS.map(g => (
              <div key={g.key}>
                <p className="text-xs text-[#555] mb-1 text-center">{g.label}</p>
                <select
                  value={plan.gradeRule[g.key]}
                  onChange={e => persist({ gradeRule: { ...plan.gradeRule, [g.key]: e.target.value as RiskTier } })}
                  className="w-full bg-[#080808] border border-[#1e1e1e] rounded-lg px-1.5 py-1.5 text-xs text-white focus:outline-none"
                  style={{ colorScheme: 'dark' }}>
                  {TIER_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* Took trade toggle */}
        <label className="flex items-center gap-2 cursor-pointer w-fit">
          <input type="checkbox" checked={plan.tookTrade} onChange={e => persist({ tookTrade: e.target.checked })}
            className="w-3.5 h-3.5 accent-[#00d28a]" />
          <span className="text-xs text-[#666]">I took a trade on this asset today</span>
        </label>
      </div>

      {/* Fluid BlockNote plan body */}
      <div className="px-2 py-2">
        <BlockNoteEditor
          key={plan.id}
          content={plan.content}
          onChange={content => persist({ content })}
          uploadCategory="daily-plans"
          uploadIdHint={plan.id}
          placeholder={`Write your ${plan.symbol} plan for today...`}
        />
      </div>

      {/* Reconciliation — separate, frozen-plan-stays-frozen section */}
      <div className="border-t border-[#1a1a1a]">
        {!reconOpen ? (
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-[#444]">
              <Lock className="w-3.5 h-3.5" />
              <span>Reconciliation {isPastDate ? '' : '(available after today closes)'}</span>
            </div>
            <button
              onClick={handleCheckAdherence}
              disabled={checking}
              className="text-xs px-3 py-1.5 rounded-lg border border-[#1e1e1e] text-[#888] hover:text-white hover:border-[#333] transition-colors disabled:opacity-40">
              {checking ? 'Checking...' : 'Check adherence & open'}
            </button>
          </div>
        ) : (
          <div className="px-4 py-3 space-y-3">
            <div className="flex items-center gap-2 text-xs text-[#444]">
              <Unlock className="w-3.5 h-3.5" />
              <span>Reconciliation</span>
              {adherenceBadge}
            </div>
            {plan.adherence === 'deviated' && (
              <div className="rounded-lg border border-[#2e1010] bg-[#1a0a0a] px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-xs text-[#ff4f4f] mb-1.5 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" /> Why did you deviate from this plan?
                </div>
                <textarea
                  value={plan.deviationReason || ''}
                  onChange={e => persist({ deviationReason: e.target.value })}
                  placeholder="Required — describe what happened and why you took the trade you did"
                  rows={3}
                  className="w-full bg-[#080808] border border-[#2e1010] rounded-lg px-3 py-2 text-xs text-white focus:outline-none resize-none"
                />
              </div>
            )}
            <BlockNoteEditor
              key={`${plan.id}-recon`}
              content={plan.reconciliation}
              onChange={reconciliation => persist({ reconciliation })}
              uploadCategory="daily-plans"
              uploadIdHint={`${plan.id}-recon`}
              placeholder="What actually happened today vs. what you planned..."
            />
          </div>
        )}
      </div>
    </div>
  );
}
