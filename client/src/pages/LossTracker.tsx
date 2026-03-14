import { useState, useMemo } from "react";
import { useTradeContext } from "@/contexts/TradeContext";
import { loadLossConditions } from "./Settings";

// ── Types ─────────────────────────────────────────────────────────────────────

type LossTag = "A" | "B" | "C";

interface LossCondition {
  id: string;
  label: string;
  description: string;
  danger: boolean;
}

interface LossEntry {
  tradeId: string;
  date: string;
  pair: string;
  session: string;
  rrRealised: number;
  maxRReached: number;
  lossTag: LossTag | null;
  conditions: Record<string, boolean>;
  notes: string;
  tagged: boolean;
}

const STORAGE_KEY = "tj_loss_tracker_v1";

function loadEntries(): Record<string, LossEntry> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch { return {}; }
}

function saveEntries(entries: Record<string, LossEntry>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {}
}

// ── Root cause logic (works with dynamic conditions) ──────────────────────────

function getRootCause(entry: LossEntry, conditions: LossCondition[]): { label: string; emoji: string; color: string } {
  const entryConditions = entry.conditions || {};
  const negativeChecked = conditions.filter(c => c.danger && entryConditions[c.id]);
  if (negativeChecked.length > 0) {
    const first = negativeChecked[0];
    if (first.label.toLowerCase().includes("trap")) return { label: first.label, emoji: "🚫", color: "#ff4f4f" };
    if (first.label.toLowerCase().includes("oe") || first.label.toLowerCase().includes("overext")) return { label: first.label, emoji: "⚠️", color: "#ffd76e" };
    if (first.label.toLowerCase().includes("re-entry") || first.label.toLowerCase().includes("reentry")) return { label: first.label, emoji: "🔄", color: "#ffd76e" };
    return { label: first.label, emoji: "❌", color: "#ff4f4f" };
  }
  const positiveUnchecked = conditions.filter(c => !c.danger && !entryConditions[c.id]);
  if (positiveUnchecked.length > 0) {
    return { label: `Weak ${positiveUnchecked[0].label}`, emoji: "⚠️", color: "#ffd76e" };
  }
  return { label: "Clean Loss", emoji: "✅", color: "#00d28a" };
}

// ── Tag badge ─────────────────────────────────────────────────────────────────

function TagBadge({ tag }: { tag: LossTag | null }) {
  if (!tag) return <span className="text-xs text-[#444]">Untagged</span>;
  const colors: Record<LossTag, string> = {
    A: "bg-[#2e0f0f] text-[#ff4f4f] border-[#3e1f1f]",
    B: "bg-[#2e2000] text-[#ffd76e] border-[#3e3000]",
    C: "bg-[#0f2e0f] text-[#00d28a] border-[#1f3e1f]",
  };
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${colors[tag]}`}>{tag}</span>;
}

type View = "dashboard" | "log" | "tag";

export default function LossTracker() {
  const { trades } = useTradeContext();
  const [entries, setEntries] = useState<Record<string, LossEntry>>(() => loadEntries());
  const [view, setView] = useState<View>("dashboard");
  const [filterTag, setFilterTag] = useState<"all" | LossTag>("all");
  const [draft, setDraft] = useState<LossEntry | null>(null);

  // Always load fresh conditions from settings
  const conditions: LossCondition[] = loadLossConditions();

  // Build default conditions map
  const defaultConditions = useMemo(() => {
    const map: Record<string, boolean> = {};
    conditions.forEach(c => { map[c.id] = !c.danger; }); // positive = checked by default, negative = unchecked
    return map;
  }, [conditions]);

  // All losses from trades merged with saved entries
  const allLosses = useMemo(() => {
    return trades
      .filter((t) => (t.realisedR || 0) < 0)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map((t) => {
        const saved = entries[t.id];
        if (saved) return saved;
        return {
          tradeId: t.id,
          date: t.date,
          pair: t.symbol || "",
          session: t.session || "",
          rrRealised: t.realisedR || 0,
          maxRReached: t.maxR || 0,
          lossTag: null,
          conditions: { ...defaultConditions },
          notes: "",
          tagged: false,
        } as LossEntry;
      });
  }, [trades, entries, defaultConditions]);

  const taggedLosses = allLosses.filter((l) => l.tagged);
  const untaggedLosses = allLosses.filter((l) => !l.tagged);

  const saveEntry = (entry: LossEntry) => {
    const updated = { ...entries, [entry.tradeId]: entry };
    setEntries(updated);
    saveEntries(updated);
  };

  const openTag = (entry: LossEntry) => {
    // Ensure conditions map has all current condition keys
    const mergedConditions = { ...defaultConditions, ...entry.conditions };
    setDraft({ ...entry, conditions: mergedConditions });
    setView("tag");
  };

  const saveTag = () => {
    if (!draft) return;
    saveEntry({ ...draft, tagged: true });
    setDraft(null);
    setView("log");
  };

  // ── Dashboard stats ──
  const total = taggedLosses.length;
  const aLosses = taggedLosses.filter((l) => l.lossTag === "A");
  const bLosses = taggedLosses.filter((l) => l.lossTag === "B");
  const cLosses = taggedLosses.filter((l) => l.lossTag === "C");
  const aRate = total > 0 ? (aLosses.length / total) * 100 : 0;

  const trapOFCount = taggedLosses.filter((l) => {
    if (!l.conditions) return false;
    const trapCond = conditions.find(c => c.label.toLowerCase().includes("trap"));
    return trapCond && l.conditions[trapCond.id];
  }).length;

  const reentryCount = taggedLosses.filter((l) => {
    if (!l.conditions) return false;
    const reCond = conditions.find(c => c.label.toLowerCase().includes("re-entry") || c.label.toLowerCase().includes("reentry"));
    return reCond && l.conditions[reCond.id];
  }).length;

  const avoidable = taggedLosses.filter((l) => getRootCause(l, conditions).label !== "Clean Loss").length;
  const avoidableRate = total > 0 ? (avoidable / total) * 100 : 0;

  const rootCauses = useMemo(() => {
    const map: Record<string, number> = {};
    taggedLosses.forEach((l) => {
      const rc = getRootCause({ ...l, conditions: l.conditions || {} }, conditions).label;
      map[rc] = (map[rc] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [taggedLosses, conditions]);

  // A loss condition breakdown (dynamic)
  const aConditionBreakdown = useMemo(() => {
    if (aLosses.length === 0) return null;
    return conditions.map(c => ({
      label: c.label,
      count: aLosses.filter(l => {
        const conds = l.conditions || {};
        return c.danger ? conds[c.id] : !conds[c.id];
      }).length,
      total: aLosses.length,
    })).filter(c => c.count > 0);
  }, [aLosses, conditions]);

  const filteredLog = filterTag === "all" ? taggedLosses : taggedLosses.filter((l) => l.lossTag === filterTag);

  // ── Tagging view ──────────────────────────────────────────────────────────

  if (view === "tag" && draft) {
    const rootCause = getRootCause({ ...draft, conditions: draft.conditions || {} }, conditions);
    return (
      <div className="p-6 max-w-2xl">
        <button onClick={() => { setView("log"); setDraft(null); }}
          className="text-xs text-[#555] hover:text-white mb-6 flex items-center gap-1">
          ← Back to log
        </button>
        <div className="mb-6">
          <h2 className="text-xl font-semibold">Tag Loss</h2>
          <p className="text-sm text-[#888] mt-1">
            {draft.pair} · {draft.session} · {new Date(draft.date).toLocaleDateString("en-GB")} · {draft.rrRealised.toFixed(2)}R
          </p>
        </div>

        {/* Loss Tag A/B/C */}
        <div className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] p-5 mb-4">
          <p className="text-sm font-medium mb-1">Loss Tag</p>
          <p className="text-xs text-[#555] mb-4">How far did price move before stopping you out?</p>
          <div className="grid grid-cols-3 gap-3">
            {(["A", "B", "C"] as LossTag[]).map((tag) => {
              const descriptions: Record<LossTag, string> = {
                A: "Straight to stop — less than 0.2R",
                B: "Moved 0.2R–1R then reversed",
                C: "Hit 1R+ then fully reversed",
              };
              const active = draft.lossTag === tag;
              const colors: Record<LossTag, string> = {
                A: "border-[#ff4f4f] bg-[#1a0505]",
                B: "border-[#ffd76e] bg-[#1a1505]",
                C: "border-[#00d28a] bg-[#05140a]",
              };
              return (
                <button key={tag} onClick={() => setDraft({ ...draft, lossTag: tag })}
                  className={`rounded-xl border-2 p-4 text-left transition-all ${active ? colors[tag] : "border-[#1e1e1e] bg-[#080808] hover:border-[#333]"}`}>
                  <p className="text-xl font-bold text-white mb-1">{tag}</p>
                  <p className="text-xs text-[#666]">{descriptions[tag]}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Max R */}
        <div className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] p-5 mb-4">
          <p className="text-sm font-medium mb-1">Max R Reached</p>
          <p className="text-xs text-[#555] mb-3">How far did price move in your favour?</p>
          <div className="flex items-center gap-3">
            <input type="number" step="0.1" value={draft.maxRReached}
              onChange={(e) => setDraft({ ...draft, maxRReached: parseFloat(e.target.value) || 0 })}
              className="w-32 bg-[#080808] border border-[#222] rounded-lg px-3 py-2 text-sm text-white" />
            <span className="text-xs text-[#555]">R — pre-filled from trade, edit if needed</span>
          </div>
        </div>

        {/* Dynamic conditions */}
        <div className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] p-5 mb-4">
          <p className="text-sm font-medium mb-1">Conditions Present</p>
          <p className="text-xs text-[#555] mb-4">Check all that applied to this trade</p>
          <div className="space-y-3">
            {conditions.map((cond) => {
              const checked = !!draft.conditions[cond.id];
              const isActive = cond.danger ? checked : !checked; // danger=bad if checked, positive=bad if unchecked
              return (
                <label key={cond.id} className="flex items-start gap-3 cursor-pointer">
                  <div onClick={() => setDraft({ ...draft, conditions: { ...draft.conditions, [cond.id]: !checked } })}
                    className={`w-5 h-5 rounded border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-all cursor-pointer ${
                      checked
                        ? cond.danger ? "bg-[#ff4f4f] border-[#ff4f4f]" : "bg-[#00d28a] border-[#00d28a]"
                        : "border-[#333] bg-[#080808]"
                    }`}>
                    {checked && <span className="text-black text-xs font-bold">✓</span>}
                  </div>
                  <div onClick={() => setDraft({ ...draft, conditions: { ...draft.conditions, [cond.id]: !checked } })} className="cursor-pointer">
                    <p className="text-sm text-white">{cond.label}</p>
                    <p className="text-xs text-[#555]">{cond.description}</p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Auto root cause */}
        <div className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] p-5 mb-4">
          <p className="text-sm font-medium mb-1">Auto Root Cause</p>
          <p className="text-xs text-[#555] mb-3">Calculated live from your checkboxes</p>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{rootCause.emoji}</span>
            <span className="text-lg font-semibold" style={{ color: rootCause.color }}>{rootCause.label}</span>
          </div>
        </div>

        {/* Notes */}
        <div className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] p-5 mb-6">
          <p className="text-sm font-medium mb-3">Notes</p>
          <textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            placeholder="What happened? What would you do differently?"
            rows={3}
            className="w-full bg-[#080808] border border-[#222] rounded-lg px-3 py-2 text-sm text-white placeholder-[#444] resize-none" />
        </div>

        <div className="flex gap-3">
          <button onClick={saveTag} disabled={!draft.lossTag}
            className="flex-1 py-3 rounded-xl bg-[#00d28a] text-black font-semibold text-sm disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#00e89a] transition-colors">
            Save Loss Entry
          </button>
          <button onClick={() => { setView("log"); setDraft(null); }}
            className="px-6 py-3 rounded-xl border border-[#222] text-sm text-[#888] hover:text-white transition-colors">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ── Dashboard view ────────────────────────────────────────────────────────

  if (view === "dashboard") {
    return (
      <div className="p-6 max-w-6xl">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Loss Tracker</h1>
            <p className="text-sm text-[#888] mt-1">
              {taggedLosses.length} of {allLosses.length} losses tagged
              {untaggedLosses.length > 0 && <span className="text-[#ffd76e] ml-2">· {untaggedLosses.length} awaiting review</span>}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setView("log")}
              className="px-4 py-2 rounded-lg border border-[#222] text-sm text-[#888] hover:text-white transition-colors">
              Loss Log
            </button>
            {untaggedLosses.length > 0 && (
              <button onClick={() => openTag(untaggedLosses[0])}
                className="px-4 py-2 rounded-lg bg-[#00d28a] text-black text-sm font-semibold hover:bg-[#00e89a] transition-colors">
                Tag Next ({untaggedLosses.length})
              </button>
            )}
          </div>
        </div>

        {taggedLosses.length < 5 ? (
          <div className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] p-12 text-center">
            <p className="text-4xl mb-4">📊</p>
            <p className="text-white font-medium mb-2">Tag at least 5 losses to see analysis</p>
            <p className="text-sm text-[#555] mb-6">
              {allLosses.length > 0 ? `${untaggedLosses.length} losses waiting to be tagged` : "No losses found in your trade log"}
            </p>
            {untaggedLosses.length > 0 && (
              <button onClick={() => openTag(untaggedLosses[0])}
                className="px-6 py-3 rounded-xl bg-[#00d28a] text-black font-semibold text-sm hover:bg-[#00e89a] transition-colors">
                Start Tagging
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Targets */}
            <div className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] p-5 mb-6">
              <p className="text-sm font-medium mb-1">Targets</p>
              <p className="text-xs text-[#555] mb-4">Based on {total} tagged losses</p>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "A Loss Rate", value: `${aRate.toFixed(0)}%`, target: "Target: below 35%", pass: aRate < 35, detail: `${aLosses.length} of ${total}` },
                  { label: "Trap OF Losses", value: String(trapOFCount), target: "Target: zero", pass: trapOFCount === 0, detail: `${total > 0 ? ((trapOFCount / total) * 100).toFixed(0) : 0}% of losses` },
                  { label: "Re-entry Losses", value: String(reentryCount), target: "Target: zero", pass: reentryCount === 0, detail: `${total > 0 ? ((reentryCount / total) * 100).toFixed(0) : 0}% of losses` },
                  { label: "Avoidable Rate", value: `${avoidableRate.toFixed(0)}%`, target: "Target: below 15%", pass: avoidableRate < 15, detail: `${avoidable} of ${total}` },
                ].map((t) => (
                  <div key={t.label} className={`rounded-xl border p-4 ${t.pass ? "border-[#1e2e1e] bg-[#0a140a]" : "border-[#2e1e1e] bg-[#140a0a]"}`}>
                    <p className="text-xs text-[#666] mb-2">{t.label}</p>
                    <p className={`text-2xl font-semibold mb-1 ${t.pass ? "text-[#00d28a]" : "text-[#ff4f4f]"}`}>{t.value}</p>
                    <p className="text-xs text-[#555]">{t.detail}</p>
                    <p className={`text-xs mt-1 ${t.pass ? "text-[#00d28a]" : "text-[#555]"}`}>{t.pass ? "✓ On target" : t.target}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* A/B/C + Root causes */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] p-5">
                <p className="text-sm font-medium mb-1">Loss Type Breakdown</p>
                <p className="text-xs text-[#555] mb-4">A / B / C distribution</p>
                <div className="space-y-3">
                  {([
                    { tag: "A", losses: aLosses, label: "Straight to stop", color: "#ff4f4f", bg: "bg-[#ff4f4f]" },
                    { tag: "B", losses: bLosses, label: "Moved 0.2R–1R then reversed", color: "#ffd76e", bg: "bg-[#ffd76e]" },
                    { tag: "C", losses: cLosses, label: "Hit 1R+ then reversed", color: "#00d28a", bg: "bg-[#00d28a]" },
                  ] as const).map((item) => {
                    const pct = total > 0 ? (item.losses.length / total) * 100 : 0;
                    return (
                      <div key={item.tag}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold" style={{ color: item.color }}>{item.tag}</span>
                            <span className="text-xs text-[#555]">{item.label}</span>
                          </div>
                          <span className="text-sm font-medium text-white">{item.losses.length} <span className="text-xs text-[#555]">({pct.toFixed(0)}%)</span></span>
                        </div>
                        <div className="h-2 rounded-full bg-[#1a1a1a] overflow-hidden">
                          <div className={`h-full rounded-full ${item.bg}`} style={{ width: `${pct}%`, opacity: 0.8 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] p-5">
                <p className="text-sm font-medium mb-1">Root Cause Breakdown</p>
                <p className="text-xs text-[#555] mb-4">What's actually causing your losses</p>
                <div className="space-y-3">
                  {rootCauses.map(([cause, count]) => {
                    const pct = total > 0 ? (count / total) * 100 : 0;
                    let emoji = "❌"; let color = "#888";
                    if (cause.toLowerCase().includes("trap")) { emoji = "🚫"; color = "#ff4f4f"; }
                    else if (cause.toLowerCase().includes("oe") || cause.toLowerCase().includes("overext")) { emoji = "⚠️"; color = "#ffd76e"; }
                    else if (cause.toLowerCase().includes("re-entry") || cause.toLowerCase().includes("reentry")) { emoji = "🔄"; color = "#ffd76e"; }
                    else if (cause.toLowerCase().includes("clean")) { emoji = "✅"; color = "#00d28a"; }
                    else if (cause.toLowerCase().includes("weak")) { emoji = "⚠️"; color = "#ffd76e"; }
                    return (
                      <div key={cause}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm">{emoji} <span style={{ color }}>{cause}</span></span>
                          <span className="text-sm font-medium text-white">{count} <span className="text-xs text-[#555]">({pct.toFixed(0)}%)</span></span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[#1a1a1a] overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.7 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* A loss deep dive */}
            {aConditionBreakdown && aConditionBreakdown.length > 0 && (
              <div className="rounded-xl border border-[#2e1e1e] bg-[#140a0a] p-5">
                <p className="text-sm font-medium mb-1">A Loss Deep Dive</p>
                <p className="text-xs text-[#888] mb-4">Conditions present on your {aLosses.length} straight-to-stop losses</p>
                <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(aConditionBreakdown.length, 5)}, 1fr)` }}>
                  {aConditionBreakdown.map((item) => (
                    <div key={item.label} className="rounded-lg border border-[#2e1e1e] bg-[#1a0a0a] p-3 text-center">
                      <p className="text-xs text-[#666] mb-1">{item.label}</p>
                      <p className="text-xl font-semibold text-[#ff4f4f]">{item.total > 0 ? ((item.count / item.total) * 100).toFixed(0) : 0}%</p>
                      <p className="text-xs text-[#555]">{item.count} of {item.total}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // ── Log view ──────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Loss Log</h1>
          <p className="text-sm text-[#888] mt-1">{allLosses.length} total losses · {taggedLosses.length} tagged</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setView("dashboard")}
            className="px-4 py-2 rounded-lg border border-[#222] text-sm text-[#888] hover:text-white transition-colors">
            Dashboard
          </button>
          {untaggedLosses.length > 0 && (
            <button onClick={() => openTag(untaggedLosses[0])}
              className="px-4 py-2 rounded-lg bg-[#00d28a] text-black text-sm font-semibold hover:bg-[#00e89a] transition-colors">
              Tag Next ({untaggedLosses.length})
            </button>
          )}
        </div>
      </div>

      {untaggedLosses.length > 0 && (
        <div className="rounded-xl border border-[#2e2000] bg-[#1a1200] p-4 mb-6">
          <p className="text-sm font-medium text-[#ffd76e] mb-3">{untaggedLosses.length} losses need tagging</p>
          <div className="flex flex-wrap gap-2">
            {untaggedLosses.slice(0, 8).map((l) => (
              <button key={l.tradeId} onClick={() => openTag(l)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#111] border border-[#2a2000] text-xs hover:border-[#ffd76e] transition-colors">
                <span className="text-[#888]">{new Date(l.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                <span className="text-white font-medium">{l.pair}</span>
                <span className="text-[#ff4f4f]">{l.rrRealised.toFixed(1)}R</span>
              </button>
            ))}
            {untaggedLosses.length > 8 && <span className="px-3 py-1.5 text-xs text-[#555]">+{untaggedLosses.length - 8} more</span>}
          </div>
        </div>
      )}

      {taggedLosses.length > 0 && (
        <>
          <div className="flex gap-2 mb-4">
            {(["all", "A", "B", "C"] as const).map((f) => (
              <button key={f} onClick={() => setFilterTag(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterTag === f ? "bg-[#1e1e1e] text-white" : "text-[#555] hover:text-white"}`}>
                {f === "all" ? "All" : `Tag ${f}`}
              </button>
            ))}
          </div>
          <div className="rounded-xl border border-[#1e1e1e] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left bg-[#080808] border-b border-[#1e1e1e]">
                  <th className="px-4 py-3 text-xs text-[#555] font-medium">Date</th>
                  <th className="px-4 py-3 text-xs text-[#555] font-medium">Pair</th>
                  <th className="px-4 py-3 text-xs text-[#555] font-medium">Session</th>
                  <th className="px-4 py-3 text-xs text-[#555] font-medium text-right">RR</th>
                  <th className="px-4 py-3 text-xs text-[#555] font-medium text-right">Max R</th>
                  <th className="px-4 py-3 text-xs text-[#555] font-medium">Tag</th>
                  <th className="px-4 py-3 text-xs text-[#555] font-medium">Root Cause</th>
                  <th className="px-4 py-3 text-xs text-[#555] font-medium">Notes</th>
                  <th className="px-4 py-3 text-xs text-[#555] font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filteredLog.map((l) => {
                  const rc = getRootCause({ ...l, conditions: l.conditions || {} }, conditions);
                  return (
                    <tr key={l.tradeId} className="border-t border-[#141414] hover:bg-[#0d0d0d] transition-colors">
                      <td className="px-4 py-3 text-[#888] text-xs">{new Date(l.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" })}</td>
                      <td className="px-4 py-3 font-medium text-white">{l.pair}</td>
                      <td className="px-4 py-3 text-[#888] text-xs">{l.session}</td>
                      <td className="px-4 py-3 text-right text-[#ff4f4f] font-medium">{l.rrRealised.toFixed(2)}R</td>
                      <td className="px-4 py-3 text-right text-[#888]">{l.maxRReached.toFixed(2)}R</td>
                      <td className="px-4 py-3"><TagBadge tag={l.lossTag} /></td>
                      <td className="px-4 py-3"><span className="text-xs" style={{ color: rc.color }}>{rc.emoji} {rc.label}</span></td>
                      <td className="px-4 py-3 text-xs text-[#555] max-w-[150px] truncate">{l.notes || "—"}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => openTag(l)} className="text-xs text-[#555] hover:text-white transition-colors">Edit</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
