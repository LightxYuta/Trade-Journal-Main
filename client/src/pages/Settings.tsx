import { useState, useEffect } from "react";
import { X, Plus, Trash2, AlertTriangle, ChevronRight } from "lucide-react";
import { useTradeContext } from "@/contexts/TradeContext";
import { useTheme } from "@/contexts/ThemeContext";

type SettingsKey = "accounts" | "models" | "sessions" | "entryTFs" | "setupGrades" | "keyLevels" | "mistakes";

const SETTINGS_CONFIG: { key: SettingsKey; label: string; description: string }[] = [
  { key: "accounts", label: "Accounts", description: "Prop firm accounts and challenges" },
  { key: "models", label: "Models", description: "Trading strategies and setups" },
  { key: "sessions", label: "Sessions", description: "Trading sessions" },
  { key: "entryTFs", label: "Entry Timeframes", description: "Entry trigger timeframes" },
  { key: "setupGrades", label: "Setup Grades", description: "Quality grades for your setups" },
  { key: "keyLevels", label: "Key Levels", description: "Key level timeframes" },
  { key: "mistakes", label: "Mistakes", description: "Rule violations to tag on trades" },
];

const LOSS_CONDITIONS_KEY = "tj_loss_conditions_v1";
const DEFAULT_LOSS_CONDITIONS = [
  { id: "trapOF", label: "Trap OF Present", description: "A trap order flow pattern was in the way", danger: true },
  { id: "overextendedT1", label: "OE Type 1", description: "Overextended — price moved too far from prev session", danger: true },
  { id: "overextendedT2", label: "OE Type 2", description: "Overextended — structural OE (no PD arrays nearby)", danger: true },
  { id: "ofClean", label: "1H OF Clean", description: "1H order flow was genuinely clean (not forced)", danger: false },
  { id: "noPOI", label: "No POI", description: "There was no clear point of interest", danger: true },
  { id: "reentry", label: "Re-entry", description: "This was a re-entry after a previous stop", danger: true },
];

export function loadLossConditions() {
  try {
    const raw = localStorage.getItem(LOSS_CONDITIONS_KEY);
    if (!raw) return DEFAULT_LOSS_CONDITIONS;
    return JSON.parse(raw);
  } catch { return DEFAULT_LOSS_CONDITIONS; }
}

function saveLossConditions(conditions: typeof DEFAULT_LOSS_CONDITIONS) {
  try {
    localStorage.setItem(LOSS_CONDITIONS_KEY, JSON.stringify(conditions));
  } catch {}
}

type ActiveSection = "journal" | "appearance" | "lossTracker" | "danger" | null;

export default function Settings() {
  const { trades, settings, updateTrade, updateSettings, resetSettings, clearAllTrades, fullReset } = useTradeContext();
  const { theme, toggleTheme } = useTheme();
  const [editingKey, setEditingKey] = useState<SettingsKey | null>(null);
  const [editValues, setEditValues] = useState<string[]>([]);
  const [tiltInput, setTiltInput] = useState(settings.tiltThreshold?.toString() ?? "2");
  const [tiltSaved, setTiltSaved] = useState(false);
  const [activeSection, setActiveSection] = useState<ActiveSection>("journal");
  const [nonNegotiableMistakes, setNonNegotiableMistakes] = useState<string[]>(settings.nonNegotiableMistakes || []);

  // Keep local state in sync when settings load from Supabase
  useEffect(() => {
    setNonNegotiableMistakes(settings.nonNegotiableMistakes || []);
  }, [settings.nonNegotiableMistakes]);

  // Toggle is applied to editValues (the draft being edited in the modal),
  // but only saved when the user clicks Save in the modal footer.
  // We track pending non-negotiable state separately so it doesn't
  // fire updateSettings on every checkbox click mid-edit.
  const [pendingNonNeg, setPendingNonNeg] = useState<string[]>([]);

  const openEditor = (key: SettingsKey) => {
    setEditingKey(key);
    setEditValues([...(settings[key] || [])]);
    // Snapshot current non-negotiables into pending state when modal opens
    if (key === 'mistakes') {
      setPendingNonNeg([...(settings.nonNegotiableMistakes || [])]);
    }
  };

  const closeEditor = () => { setEditingKey(null); setEditValues([]); setPendingNonNeg([]); };

  const saveEditorSettings = async () => {
    if (!editingKey) return;
    const previousValues = [...(settings[editingKey] || [])];
    const filtered = editValues.filter(v => v.trim());
    const renameMap = new Map<string, string>();
    const compareLen = Math.min(previousValues.length, filtered.length);

    // Index-based rename detection: if user edits an existing item, propagate it to old trades.
    for (let i = 0; i < compareLen; i++) {
      const from = previousValues[i]?.trim();
      const to = filtered[i]?.trim();
      if (from && to && from !== to) renameMap.set(from, to);
    }

    const renamedEntries = Array.from(renameMap.entries());
    if (renamedEntries.length > 0) {
      for (const trade of trades) {
        const updates: any = {};

        if (editingKey === "accounts" && trade.account && renameMap.has(trade.account)) {
          updates.account = renameMap.get(trade.account);
        }
        if (editingKey === "models" && trade.model && renameMap.has(trade.model)) {
          updates.model = renameMap.get(trade.model);
        }
        if (editingKey === "sessions" && trade.session && renameMap.has(trade.session)) {
          updates.session = renameMap.get(trade.session);
        }
        if (editingKey === "entryTFs" && trade.entryTF && renameMap.has(trade.entryTF)) {
          updates.entryTF = renameMap.get(trade.entryTF);
        }
        if (editingKey === "setupGrades" && trade.setupGrade && renameMap.has(trade.setupGrade)) {
          updates.setupGrade = renameMap.get(trade.setupGrade);
        }
        if (editingKey === "mistakes" && Array.isArray(trade.mistakes) && trade.mistakes.length > 0) {
          const nextMistakes = trade.mistakes.map((m) => renameMap.get(m) ?? m);
          const changed = nextMistakes.some((m, idx) => m !== trade.mistakes![idx]);
          if (changed) updates.mistakes = nextMistakes;
        }
        if (editingKey === "keyLevels" && Array.isArray(trade.keyLevels) && trade.keyLevels.length > 0) {
          const nextKeyLevels = trade.keyLevels.map((k) => renameMap.get(k) ?? k);
          const changed = nextKeyLevels.some((k, idx) => k !== trade.keyLevels![idx]);
          if (changed) updates.keyLevels = nextKeyLevels;
        }

        if (Object.keys(updates).length > 0) {
          // Keep trade history consistent with renamed settings labels.
          await updateTrade(trade.id, updates);
        }
      }
    }

    // When saving mistakes, also save the non-negotiable list,
    // pruned to only include names that still exist in the list
    if (editingKey === 'mistakes') {
      const remappedNonNeg = pendingNonNeg.map((nn) => renameMap.get(nn) ?? nn);
      const validNonNeg = remappedNonNeg.filter(nn => filtered.includes(nn));
      setNonNegotiableMistakes(validNonNeg);
      await updateSettings({ [editingKey]: filtered, nonNegotiableMistakes: validNonNeg });
    } else {
      await updateSettings({ [editingKey]: filtered });
    }
    closeEditor();
  };

  const togglePendingNonNeg = (mistake: string) => {
    if (!mistake.trim()) return; // never toggle empty strings
    setPendingNonNeg(prev =>
      prev.includes(mistake) ? prev.filter(m => m !== mistake) : [...prev, mistake]
    );
  };

  const handleTiltSave = () => {
    const num = Math.max(1, Math.min(20, Number(tiltInput)));
    updateSettings({ tiltThreshold: num });
    setTiltInput(num.toString());
    setTiltSaved(true);
    setTimeout(() => setTiltSaved(false), 1200);
  };

  // Loss conditions state (for Loss Tracker section)
  const [lossConditions, setLossConditions] = useState(() => loadLossConditions());
  const [editingConditions, setEditingConditions] = useState(false);
  const [conditionDraft, setConditionDraft] = useState(lossConditions);

  useEffect(() => {
    setTiltInput(settings.tiltThreshold?.toString() ?? "2");
  }, [settings.tiltThreshold]);

  const saveConditions = () => {
    const filtered = conditionDraft.filter(c => c.label.trim());
    setLossConditions(filtered);
    saveLossConditions(filtered);
    setEditingConditions(false);
  };

  const sections = [
    { id: "journal", label: "Journal Settings" },
    { id: "appearance", label: "Appearance" },
    { id: "lossTracker", label: "Loss Tracker" },
    { id: "danger", label: "Data Management" },
  ] as const;

  return (
    <div className="flex h-full min-h-screen">
      {/* Left nav */}
      <div className="w-56 flex-shrink-0 border-r border-[#1a1a1a] p-4 pt-8">
        <p className="text-xs text-[#444] uppercase tracking-wider mb-4 px-2">Settings</p>
        <div className="space-y-1">
          {sections.map((s) => (
            <button key={s.id} onClick={() => setActiveSection(s.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${activeSection === s.id ? "bg-[#1a1a1a] text-white" : "text-[#666] hover:text-white"}`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-8 max-w-3xl overflow-y-auto">

        {/* ── Journal Settings ── */}
        {activeSection === "journal" && (
          <div>
            <h1 className="text-xl font-semibold mb-1">Journal Settings</h1>
            <p className="text-sm text-[#666] mb-8">Configure dropdowns and tags used when logging trades</p>

            <div className="space-y-2 mb-8">
              {SETTINGS_CONFIG.map(({ key, label, description }) => (
                <button key={key} onClick={() => openEditor(key)}
                  className="w-full flex items-center justify-between p-4 rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] hover:bg-[#111] transition-colors group">
                  <div className="text-left">
                    <p className="text-sm font-medium text-white">{label}</p>
                    <p className="text-xs text-[#555] mt-0.5">{description}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1.5 flex-wrap justify-end max-w-[240px]">
                      {settings[key]?.slice(0, 3).map((v, i) => (
                        <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] text-[#888]">{v}</span>
                      ))}
                      {(settings[key]?.length || 0) > 3 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] text-[#555]">
                          +{settings[key]!.length - 3}
                        </span>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#333] group-hover:text-[#666] transition-colors flex-shrink-0" />
                  </div>
                </button>
              ))}
            </div>

            {/* Tilt threshold */}
            <div className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] p-5">
              <p className="text-sm font-medium mb-1">Tilt Trade Threshold</p>
              <p className="text-xs text-[#555] mb-4">Number of trades per day after which they're flagged as tilt trades</p>
              <div className="flex items-center gap-3">
                <input type="number" min={1} max={20} value={tiltInput}
                  onChange={e => setTiltInput(e.target.value.replace(/[^\d]/g, ""))}
                  className="w-20 px-3 py-2 rounded-lg border border-[#222] bg-[#080808] text-white text-sm" />
                <button onClick={handleTiltSave}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tiltSaved ? "bg-[#00d28a] text-black" : "bg-[#1a1a1a] text-white hover:bg-[#222]"}`}>
                  {tiltSaved ? "✓ Saved" : "Save"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Appearance ── */}
        {activeSection === "appearance" && (
          <div>
            <h1 className="text-xl font-semibold mb-1">Appearance</h1>
            <p className="text-sm text-[#666] mb-8">Customise how your journal looks</p>

            <div className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] p-5 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white mb-1">Colour Theme</p>
                  <p className="text-xs text-[#555] leading-relaxed max-w-xs">
                    {theme === 'color'
                      ? 'Default — green for wins, red for losses, gold for BE'
                      : 'Monochrome — white/silver for wins, muted rose for losses'
                    }
                  </p>
                </div>

                {/* Toggle pill */}
                <button
                  onClick={toggleTheme}
                  className="flex-shrink-0 relative rounded-xl overflow-hidden transition-all duration-300"
                  style={{
                    width: '160px',
                    height: '80px',
                    background: theme === 'color' ? '#080808' : '#111',
                    border: `1px solid ${theme === 'color' ? '#1e1e1e' : '#2a2a2a'}`,
                  }}
                >
                  {/* Color side */}
                  <div className={`absolute inset-0 flex flex-col items-center justify-center gap-1 transition-opacity duration-300 ${theme === 'color' ? 'opacity-100' : 'opacity-0'}`}>
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full" style={{ background: '#00d28a' }} />
                      <div className="w-3 h-3 rounded-full" style={{ background: '#ff4f4f' }} />
                      <div className="w-3 h-3 rounded-full" style={{ background: '#ffd76e' }} />
                    </div>
                    <span className="text-xs font-medium text-white">Colour</span>
                    <span className="text-[10px] text-[#555]">currently active</span>
                  </div>

                  {/* Mono side */}
                  <div className={`absolute inset-0 flex flex-col items-center justify-center gap-1 transition-opacity duration-300 ${theme === 'mono' ? 'opacity-100' : 'opacity-0'}`}>
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-[#e8e8e8]" />
                      <div className="w-3 h-3 rounded-full" style={{ background: '#c0786a' }} />
                      <div className="w-3 h-3 rounded-full bg-[#888]" />
                    </div>
                    <span className="text-xs font-medium text-white">Monochrome</span>
                    <span className="text-[10px] text-[#555]">currently active</span>
                  </div>

                  {/* Active glow */}
                  {theme === 'mono' && (
                    <div className="absolute inset-0 rounded-xl" style={{ boxShadow: 'inset 0 0 20px rgba(255,255,255,0.03)' }} />
                  )}
                </button>
              </div>

              {/* Side-by-side preview */}
              <div className="grid grid-cols-2 gap-3 mt-5 pt-5 border-t border-[#111]">
                {/* Color preview */}
                <button
                  onClick={() => theme !== 'color' && toggleTheme()}
                  className={`rounded-xl p-3 transition-all ${theme === 'color' ? 'ring-1 ring-[#00d28a]' : 'opacity-50 hover:opacity-75'}`}
                  style={{ background: '#080808', border: '1px solid #1a1a1a' }}
                >
                  <p className="text-xs text-[#555] mb-2 text-left">Colour</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#666]">Win</span>
                      <span className="text-xs font-mono font-semibold" style={{ color: '#00d28a' }}>+2.50R</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#666]">Loss</span>
                      <span className="text-xs font-mono font-semibold" style={{ color: '#ff4f4f' }}>-1.00R</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#666]">BE</span>
                      <span className="text-xs font-mono font-semibold" style={{ color: '#ffd76e' }}>0.00R</span>
                    </div>
                  </div>
                  {theme === 'color' && <p className="text-[10px] text-[#00d28a] mt-2 text-left">✓ Active</p>}
                </button>

                {/* Mono preview */}
                <button
                  onClick={() => theme !== 'mono' && toggleTheme()}
                  className={`rounded-xl p-3 transition-all ${theme === 'mono' ? 'ring-1 ring-[#555]' : 'opacity-50 hover:opacity-75'}`}
                  style={{ background: '#080808', border: '1px solid #1a1a1a' }}
                >
                  <p className="text-xs text-[#555] mb-2 text-left">Monochrome</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#666]">Win</span>
                      <span className="text-xs font-mono font-semibold text-[#e8e8e8]">+2.50R</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#666]">Loss</span>
                      <span className="text-xs font-mono font-semibold" style={{ color: '#c0786a' }}>-1.00R</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#666]">BE</span>
                      <span className="text-xs font-mono font-semibold text-[#888]">0.00R</span>
                    </div>
                  </div>
                  {theme === 'mono' && <p className="text-[10px] text-[#888] mt-2 text-left">✓ Active</p>}
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] px-5 py-4">
              <p className="text-xs text-[#444] font-medium mb-1">About monochrome mode</p>
              <p className="text-xs text-[#555] leading-relaxed">
                Wins show in white/silver. Losses use a desaturated rose tone — enough to distinguish critical signals like costliest mistakes without the intensity of full red. All charts, badges, and stat cards adapt automatically.
              </p>
            </div>
          </div>
        )}

        {/* ── Loss Tracker Settings ── */}
        {activeSection === "lossTracker" && (
          <div>
            <h1 className="text-xl font-semibold mb-1">Loss Tracker</h1>
            <p className="text-sm text-[#666] mb-8">Configure the conditions checked when tagging each loss</p>

            <div className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] overflow-hidden mb-4">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e1e1e]">
                <div>
                  <p className="text-sm font-medium">Loss Conditions</p>
                  <p className="text-xs text-[#555] mt-0.5">{lossConditions.length} conditions configured</p>
                </div>
                <button onClick={() => { setConditionDraft(lossConditions); setEditingConditions(true); }}
                  className="px-3 py-1.5 rounded-lg border border-[#222] text-xs text-[#888] hover:text-white transition-colors">
                  Edit
                </button>
              </div>
              <div className="divide-y divide-[#141414]">
                {lossConditions.map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm text-white">{c.label}</p>
                      <p className="text-xs text-[#555]">{c.description}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${c.danger ? "border-[#3e1f1f] bg-[#1a0808] text-[#ff4f4f]" : "border-[#1f3e1f] bg-[#081a08] text-[#00d28a]"}`}>
                      {c.danger ? "Negative" : "Positive"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-[#1e2e1e] bg-[#0a140a] px-5 py-4">
              <p className="text-xs text-[#00d28a] font-medium mb-1">How conditions work</p>
              <p className="text-xs text-[#666] leading-relaxed">
                Negative conditions (red) indicate rule violations — Trap OF, overextension, etc. 
                Positive conditions (green) indicate good execution — clean OF, valid POI. 
                The root cause is auto-calculated based on which conditions are checked.
              </p>
            </div>
          </div>
        )}

        {/* ── Data Management ── */}
        {activeSection === "danger" && (
          <div>
            <h1 className="text-xl font-semibold mb-1">Data Management</h1>
            <p className="text-sm text-[#666] mb-8">Reset or clear your journal data — these actions cannot be undone</p>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-5 rounded-xl border border-[#1e1e1e] bg-[#0d0d0d]">
                <div>
                  <p className="text-sm font-medium text-white">Reset Settings Only</p>
                  <p className="text-xs text-[#555] mt-1">Restore all dropdowns and tags to defaults. Your trades will not be affected.</p>
                </div>
                <button onClick={() => { if (confirm("Reset settings to defaults? Trades won't be affected.")) resetSettings(); }}
                  className="px-4 py-2 rounded-lg border border-[#222] text-sm text-[#888] hover:text-white transition-colors flex-shrink-0 ml-4">
                  Reset Settings
                </button>
              </div>

              <div className="flex items-center justify-between p-5 rounded-xl border border-[#3e1f1f] bg-[#140808]">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-4 h-4 text-[#ff4f4f]" />
                    <p className="text-sm font-medium text-white">Clear All Trades</p>
                  </div>
                  <p className="text-xs text-[#666]">Delete all trade data from this browser. This cannot be undone.</p>
                </div>
                <button onClick={() => { if (confirm("Delete all trades? This cannot be undone.")) clearAllTrades(); }}
                  className="px-4 py-2 rounded-lg border border-[#ff4f4f] text-sm text-[#ff4f4f] hover:bg-[#ff4f4f] hover:text-black transition-colors flex-shrink-0 ml-4">
                  Clear Trades
                </button>
              </div>

              <div className="flex items-center justify-between p-5 rounded-xl border border-[#5e1f1f] bg-[#1a0808]">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-4 h-4 text-[#ff4f4f]" />
                    <p className="text-sm font-medium text-white">Full Reset</p>
                  </div>
                  <p className="text-xs text-[#666]">Delete ALL data including trades and settings. This cannot be undone.</p>
                </div>
                <button onClick={() => { if (confirm("Full reset? Everything will be deleted. This cannot be undone.")) fullReset(); }}
                  className="px-4 py-2 rounded-lg bg-[#ff4f4f] text-black text-sm font-semibold hover:bg-[#ff3333] transition-colors flex-shrink-0 ml-4">
                  Full Reset
                </button>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] p-5">
              <p className="text-sm font-medium mb-1">About</p>
              <p className="text-xs text-[#555] mb-3">R-based performance dashboard for prop trading. All data stored locally in your browser.</p>
              <span className="text-xs px-2 py-1 rounded-full border border-[#222] text-[#555]">React · v2.0 · LocalStorage</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Edit dropdown modal ── */}
      {editingKey && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && closeEditor()}>
          <div className="w-full max-w-md rounded-2xl border border-[#1e1e1e] bg-[#0a0a0a] overflow-hidden">
            {/* Modal header */}
            <div className="flex justify-between items-center px-6 py-5 border-b border-[#1a1a1a]">
              <div>
                <h2 className="text-sm font-semibold text-white">
                  {SETTINGS_CONFIG.find(c => c.key === editingKey)?.label}
                </h2>
                <p className="text-xs text-[#555] mt-0.5">{editValues.length} items</p>
              </div>
              <button onClick={closeEditor} className="w-7 h-7 rounded-lg border border-[#222] flex items-center justify-center text-[#555] hover:text-white hover:border-[#444] transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Items list */}
            <div className="px-6 py-4 max-h-[50vh] overflow-y-auto space-y-2">
              {editValues.length === 0 && (
                <p className="text-xs text-[#444] text-center py-4">No items yet. Add one below.</p>
              )}
              {editValues.map((value, index) => (
                <div key={index} className="flex items-center gap-2 group">
                  <div className="flex-1 flex items-center gap-2 bg-[#111] border border-[#1e1e1e] rounded-xl px-4 py-2.5 focus-within:border-[#333] transition-colors">
                    <input type="text" value={value}
                      onChange={(e) => { const n = [...editValues]; n[index] = e.target.value; setEditValues(n); }}
                      className="flex-1 bg-transparent text-sm text-white placeholder-[#444] focus:outline-none"
                      placeholder="Enter value..." />
                  </div>
                  {editingKey === 'mistakes' && value.trim() && (
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer flex-shrink-0">
                      <div
                        onClick={() => togglePendingNonNeg(value)}
                        className={`w-8 h-4 rounded-full transition-colors cursor-pointer relative flex-shrink-0 ${
                          pendingNonNeg.includes(value) ? 'bg-[#00d28a]' : 'bg-[#222]'
                        }`}
                      >
                        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                          pendingNonNeg.includes(value) ? 'translate-x-4' : 'translate-x-0.5'
                        }`} />
                      </div>
                      <span className={`whitespace-nowrap transition-colors ${pendingNonNeg.includes(value) ? 'text-[#00d28a]' : 'text-[#444]'}`}>
                        Non-neg
                      </span>
                    </label>
                  )}
                  <button onClick={() => setEditValues(editValues.filter((_, i) => i !== index))}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[#333] hover:text-[#ff4f4f] hover:bg-[#1a0808] border border-transparent hover:border-[#2e1010] transition-all opacity-0 group-hover:opacity-100">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add item */}
            <div className="px-6 pb-4">
              <button onClick={() => setEditValues([...editValues, ""])}
                className="w-full py-2.5 rounded-xl border border-dashed border-[#222] text-xs text-[#555] hover:text-[#888] hover:border-[#333] transition-colors flex items-center justify-center gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Add Item
              </button>
            </div>

            {/* Footer */}
            <div className="flex gap-2 px-6 py-4 border-t border-[#1a1a1a]">
              <button onClick={saveEditorSettings}
                className="flex-1 py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-[#e8e8e8] transition-colors">
                Save
              </button>
              <button onClick={closeEditor}
                className="flex-1 py-2.5 rounded-xl border border-[#1e1e1e] text-sm text-[#666] hover:text-white hover:border-[#333] transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit loss conditions modal ── */}
      {editingConditions && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && setEditingConditions(false)}>
          <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-[#222] bg-[#0d0d0d] p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-base font-semibold">Edit Loss Conditions</h2>
              <button onClick={() => setEditingConditions(false)} className="text-[#555] hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 mb-4">
              {conditionDraft.map((c, i) => (
                <div key={c.id} className="rounded-xl border border-[#1e1e1e] bg-[#080808] p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <input type="text" value={c.label}
                      onChange={(e) => {
                        const d = [...conditionDraft];
                        d[i] = { ...d[i], label: e.target.value };
                        setConditionDraft(d);
                      }}
                      placeholder="Condition name"
                      className="flex-1 bg-transparent border-b border-[#222] pb-1 text-sm text-white focus:outline-none focus:border-[#444]" />
                    <button onClick={() => setConditionDraft(conditionDraft.filter((_, j) => j !== i))}
                      className="text-[#ff4f4f] hover:text-[#ff3333] flex-shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <input type="text" value={c.description}
                    onChange={(e) => {
                      const d = [...conditionDraft];
                      d[i] = { ...d[i], description: e.target.value };
                      setConditionDraft(d);
                    }}
                    placeholder="Description (optional)"
                    className="w-full bg-transparent text-xs text-[#555] focus:outline-none mb-3" />
                  <div className="flex gap-2">
                    <button onClick={() => {
                      const d = [...conditionDraft];
                      d[i] = { ...d[i], danger: true };
                      setConditionDraft(d);
                    }}
                      className={`flex-1 py-1.5 rounded-lg text-xs transition-colors ${c.danger ? "bg-[#2e0f0f] border border-[#3e1f1f] text-[#ff4f4f]" : "border border-[#1e1e1e] text-[#555]"}`}>
                      Negative
                    </button>
                    <button onClick={() => {
                      const d = [...conditionDraft];
                      d[i] = { ...d[i], danger: false };
                      setConditionDraft(d);
                    }}
                      className={`flex-1 py-1.5 rounded-lg text-xs transition-colors ${!c.danger ? "bg-[#0f2e0f] border border-[#1f3e1f] text-[#00d28a]" : "border border-[#1e1e1e] text-[#555]"}`}>
                      Positive
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={() => setConditionDraft([...conditionDraft, {
              id: `custom_${Date.now()}`, label: "", description: "", danger: true
            }])}
              className="w-full mb-4 py-2.5 rounded-lg border border-dashed border-[#222] text-sm text-[#555] hover:text-white hover:border-[#444] transition-colors flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" /> Add Condition
            </button>

            <div className="flex gap-2">
              <button onClick={saveConditions}
                className="flex-1 py-2.5 rounded-lg bg-white text-black text-sm font-semibold hover:bg-[#eee] transition-colors">
                Save Changes
              </button>
              <button onClick={() => setEditingConditions(false)}
                className="flex-1 py-2.5 rounded-lg border border-[#222] text-sm text-[#888] hover:text-white transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
