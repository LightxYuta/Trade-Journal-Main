import { useState, useMemo, useRef } from "react";
import { Plus, X, Trash2, Edit2, ChevronLeft, ChevronRight, BookOpen, ImagePlus, ZoomIn } from "lucide-react";
import { useTradeContext } from "@/contexts/TradeContext";
import { useYearFilter } from "@/contexts/YearFilterContext";
import { classifyOutcome, formatDate, formatR } from "@/lib/tradeUtils";
import type { Trade } from "@shared/schema";

const TRADES_PER_PAGE = 20;
const DAILY_BIAS_KEY = "tj_daily_bias_v2";

interface BiasEntry {
  id: string;
  date: string;
  asset: string;
  text: string;
  images: string[];
  createdAt: number;
}

function loadBiasEntries(): BiasEntry[] {
  try {
    const raw = localStorage.getItem(DAILY_BIAS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch { return []; }
}

function saveBiasEntries(entries: BiasEntry[]) {
  try { localStorage.setItem(DAILY_BIAS_KEY, JSON.stringify(entries)); } catch {}
}

function getTodayKey() { return new Date().toISOString().slice(0, 10); }

function normalizeHref(val?: string) {
  if (!val) return '';
  const v = val.trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
}

function parseScreenshots(screenshots: string | null | undefined): string[] {
  if (!screenshots) return [];
  try {
    const parsed = JSON.parse(screenshots);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
  } catch {}
  return screenshots ? [screenshots] : [];
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let curr = ""; let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { curr += '"'; i++; }
      else inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) { result.push(curr); curr = ""; continue; }
    curr += ch;
  }
  result.push(curr);
  return result;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result as string);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
}

type ActiveView = "trades" | "bias-list" | "bias-editor";

export default function Trades() {
  const { trades, settings, addTrade, updateTrade, deleteTrade } = useTradeContext();
  const { year } = useYearFilter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const biasImageInputRef = useRef<HTMLInputElement | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>("trades");
  const [currentPage, setCurrentPage] = useState(1);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // Filters
  const [filterSession, setFilterSession] = useState("");
  const [filterModel, setFilterModel] = useState("");
  const [filterAccount, setFilterAccount] = useState("");
  const [filterPosition, setFilterPosition] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  // Daily bias
  const [biasEntries, setBiasEntries] = useState<BiasEntry[]>(() => loadBiasEntries());
  const [selectedBiasDate, setSelectedBiasDate] = useState(getTodayKey());
  const [biasAsset, setBiasAsset] = useState("");
  const [biasText, setBiasText] = useState("");
  const [biasImages, setBiasImages] = useState<string[]>([]);
  const [biasSaved, setBiasSaved] = useState(false);
  const [editingBiasId, setEditingBiasId] = useState<string | null>(null);

  const saveBias = () => {
    let updated: BiasEntry[];
    if (editingBiasId) {
      updated = biasEntries.map(e => e.id === editingBiasId
        ? { ...e, date: selectedBiasDate, asset: biasAsset, text: biasText, images: biasImages }
        : e
      );
    } else {
      const newEntry: BiasEntry = {
        id: crypto.randomUUID(),
        date: selectedBiasDate,
        asset: biasAsset,
        text: biasText,
        images: biasImages,
        createdAt: Date.now(),
      };
      updated = [newEntry, ...biasEntries];
    }
    setBiasEntries(updated);
    saveBiasEntries(updated);
    setBiasSaved(true);
    setTimeout(() => {
      setBiasSaved(false);
      setActiveView("bias-list");
    }, 800);
  };

  const openNewBias = () => {
    setEditingBiasId(null);
    setSelectedBiasDate(getTodayKey());
    setBiasAsset("");
    setBiasText("");
    setBiasImages([]);
    setBiasSaved(false);
    setActiveView("bias-editor");
  };

  const openBiasEditor = (entry: BiasEntry) => {
    setEditingBiasId(entry.id);
    setSelectedBiasDate(entry.date);
    setBiasAsset(entry.asset);
    setBiasText(entry.text);
    setBiasImages(entry.images);
    setBiasSaved(false);
    setActiveView("bias-editor");
  };

  const deleteBiasEntry = (id: string) => {
    if (!confirm("Delete this bias entry?")) return;
    const updated = biasEntries.filter(e => e.id !== id);
    setBiasEntries(updated);
    saveBiasEntries(updated);
  };

  const handleBiasImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const b64 = await fileToBase64(file);
      setBiasImages(prev => [...prev, b64]);
      setBiasSaved(false);
    } catch { alert("Failed to load image"); }
    if (biasImageInputRef.current) biasImageInputRef.current.value = '';
  };

  const removeBiasImage = (idx: number) => {
    setBiasImages(prev => prev.filter((_, i) => i !== idx));
    setBiasSaved(false);
  };

  // Form state
  const emptyForm = {
    date: new Date().toISOString().split("T")[0],
    symbol: "", account: "", model: "", session: "", entryTF: "",
    position: "Long", riskPercent: "", realisedR: "", maxR: "",
    setupGrade: "", keyLevels: [] as string[], mistakes: [] as string[],
    tradeImage: "",
    tradeImage2: "",
    tradeImage3: "",
    notes: "",
  };
  const [formData, setFormData] = useState(emptyForm);

  const yearFilteredTrades = useMemo(() => {
    if (year === "all") return trades;
    return trades.filter(t => t.date && new Date(t.date).getFullYear() === year);
  }, [trades, year]);

  const filteredTrades = useMemo(() => {
    return yearFilteredTrades.filter(t => {
      if (filterSession && t.session !== filterSession) return false;
      if (filterModel && t.model !== filterModel) return false;
      if (filterAccount && t.account !== filterAccount) return false;
      if (filterPosition && t.position !== filterPosition) return false;
      if (filterFrom && t.date && t.date < filterFrom) return false;
      if (filterTo && t.date && t.date > filterTo) return false;
      return true;
    }).sort((a, b) => {
      const cmp = (b.date || '').localeCompare(a.date || '');
      if (cmp !== 0) return cmp;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }, [yearFilteredTrades, filterSession, filterModel, filterAccount, filterPosition, filterFrom, filterTo]);

  const totalPages = Math.ceil(filteredTrades.length / TRADES_PER_PAGE);
  const paginatedTrades = filteredTrades.slice((currentPage - 1) * TRADES_PER_PAGE, currentPage * TRADES_PER_PAGE);

  const clearFilters = () => {
    setFilterSession(""); setFilterModel(""); setFilterAccount("");
    setFilterPosition(""); setFilterFrom(""); setFilterTo("");
    setCurrentPage(1);
  };

  const toggleTag = (field: "keyLevels" | "mistakes", value: string) => {
    setFormData(prev => {
      const arr = prev[field];
      return arr.includes(value)
        ? { ...prev, [field]: arr.filter(v => v !== value) }
        : { ...prev, [field]: [...arr, value] };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.date || !formData.symbol || !formData.realisedR) { alert("Please fill Date, Symbol, and Realised R."); return; }
    const realisedR = parseFloat(formData.realisedR);
    if (isNaN(realisedR)) { alert("Realised R must be a number."); return; }
    let riskPercent = null;
    if (formData.riskPercent) {
      riskPercent = parseFloat(formData.riskPercent);
      if (isNaN(riskPercent)) { alert("Risk % must be a number."); return; }
    }
    let maxR = realisedR;
    if (formData.maxR) { const p = parseFloat(formData.maxR); if (!isNaN(p)) maxR = p; }

    const screenshots = [formData.tradeImage, formData.tradeImage2, formData.tradeImage3]
      .filter(Boolean).length > 0
      ? JSON.stringify([formData.tradeImage, formData.tradeImage2, formData.tradeImage3].filter(Boolean))
      : '';

    const payload = {
      date: formData.date, symbol: formData.symbol.toUpperCase(),
      account: formData.account, model: formData.model, session: formData.session,
      entryTF: formData.entryTF, position: formData.position, riskPercent, realisedR, maxR,
      setupGrade: formData.setupGrade, keyLevels: formData.keyLevels,
      mistakes: formData.mistakes, screenshots, notes: formData.notes,
    };

    if (editingId) { updateTrade(editingId, payload); setEditingId(null); }
    else addTrade({ ...payload, createdAt: Date.now() });
    setFormData(emptyForm);
    setIsFormOpen(false);
  };

  const handleEdit = (t: Trade) => {
    setEditingId(t.id);
    const scrArr = parseScreenshots(t.screenshots);
    setFormData({
      date: t.date || new Date().toISOString().split("T")[0],
      symbol: t.symbol || "", account: t.account || "", model: t.model || "",
      session: t.session || "", entryTF: t.entryTF || "", position: t.position || "Long",
      riskPercent: t.riskPercent != null ? String(t.riskPercent) : "",
      realisedR: String(t.realisedR ?? ""), maxR: t.maxR != null ? String(t.maxR) : "",
      setupGrade: t.setupGrade || "",
      keyLevels: Array.isArray(t.keyLevels) ? t.keyLevels : [],
      mistakes: Array.isArray(t.mistakes) ? t.mistakes : [],
      tradeImage: scrArr[0] || "",
      tradeImage2: scrArr[1] || "",
      tradeImage3: scrArr[2] || "",
      notes: t.notes || "",
    });
    setIsFormOpen(true);
  };

  const handleDelete = (id: string) => { if (confirm("Delete this trade?")) deleteTrade(id); };

  const exportCSV = () => {
    if (!trades.length) { alert("No trades to export."); return; }
    const headers = ["id","date","symbol","account","model","session","entryTF","position","riskPercent","realisedR","maxR","setupGrade","keyLevels","mistakes","notes","createdAt"];
    const rows = trades.map(t => headers.map(h => {
      const v = (t as any)[h];
      if (v === null || v === undefined) return "";
      if (Array.isArray(v)) return `"${v.join(';').replace(/"/g, '""')}"`;
      return `"${String(v).replace(/"/g, '""')}"`;
    }).join(',')).join('\n');
    const csv = [headers.join(','), rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `trades_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const text = String(reader.result || '');
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) { alert('CSV appears empty or has no data rows.'); return; }

      const headers = parseCSVLine(lines[0]).map(h => h.trim().replace(/^"|"$/g, ''));
      let imported = 0;
      let failed = 0;
      const errors: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const obj: any = {};
        headers.forEach((h, idx) => { obj[h] = (values[idx] ?? '').replace(/^"|"$/g, '').trim(); });

        const realisedR = parseFloat(obj.realisedR);
        if (!obj.date || !obj.symbol || isNaN(realisedR)) {
          failed++;
          errors.push(`Row ${i}: missing date/symbol or invalid R (${JSON.stringify({ date: obj.date, symbol: obj.symbol, realisedR: obj.realisedR })})`);
          continue;
        }

        try {
          await addTrade({
            date: obj.date,
            symbol: (obj.symbol || '').toUpperCase(),
            account: obj.account || '',
            model: obj.model || '',
            session: obj.session || '',
            entryTF: obj.entryTF || '',
            position: obj.position || 'Long',
            riskPercent: obj.riskPercent ? parseFloat(obj.riskPercent) : null,
            realisedR,
            maxR: obj.maxR ? parseFloat(obj.maxR) : realisedR,
            setupGrade: obj.setupGrade || '',
            keyLevels: obj.keyLevels ? obj.keyLevels.split(';').map((s: string) => s.trim()).filter(Boolean) : [],
            mistakes: obj.mistakes ? obj.mistakes.split(';').map((s: string) => s.trim()).filter(Boolean) : [],
            screenshots: '',
            notes: obj.notes || '',
            createdAt: obj.createdAt ? parseInt(obj.createdAt) : Date.now(),
          });
          imported++;
        } catch (err: any) {
          failed++;
          errors.push(`Row ${i} (${obj.symbol}): ${err?.message || err}`);
          console.error('Import row failed:', err, obj);
        }
      }

      if (errors.length) console.warn('Import errors:\n' + errors.join('\n'));
      alert(`Import complete: ${imported} trades added${failed > 0 ? `, ${failed} failed (check console for details)` : ''}.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col min-h-screen p-6 max-w-[1400px]" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Trades</h1>
          <p className="text-sm text-[#666] mt-0.5">{trades.length} total trades logged</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-[#1e1e1e] overflow-hidden text-xs mr-2">
            <button onClick={() => setActiveView("trades")}
              className={`px-3 py-2 transition-colors ${activeView === "trades" ? "bg-[#1a1a1a] text-white" : "text-[#555] hover:text-white"}`}>
              Trades
            </button>
            <button onClick={() => setActiveView("bias-list")}
              className={`px-3 py-2 flex items-center gap-1.5 transition-colors ${activeView === "bias-list" || activeView === "bias-editor" ? "bg-[#1a1a1a] text-white" : "text-[#555] hover:text-white"}`}>
              <BookOpen className="w-3.5 h-3.5" /> Daily Bias
            </button>
          </div>
          <button onClick={exportCSV} className="px-3 py-2 rounded-lg border border-[#1e1e1e] text-xs text-[#666] hover:text-white transition-colors">Export</button>
          <button onClick={() => fileInputRef.current?.click()} className="px-3 py-2 rounded-lg border border-[#1e1e1e] text-xs text-[#666] hover:text-white transition-colors">Import</button>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFile} style={{ display: "none" }} />
          <button onClick={() => { setEditingId(null); setFormData(emptyForm); setIsFormOpen(true); }}
            className="px-4 py-2 rounded-lg bg-white text-black text-xs font-semibold hover:bg-[#e8e8e8] transition-colors flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add Trade
          </button>
        </div>
      </div>

      {/* ── Daily Bias List ── */}
      {activeView === "bias-list" && (
        <div className="flex-1">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-white">Daily Bias</h2>
              <p className="text-sm text-[#555] mt-0.5">{biasEntries.length} entries logged</p>
            </div>
            <button onClick={openNewBias}
              className="px-4 py-2 rounded-lg bg-white text-black text-xs font-semibold hover:bg-[#e8e8e8] transition-colors flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Log Daily Bias
            </button>
          </div>
          {biasEntries.length === 0 ? (
            <div className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] p-12 text-center">
              <p className="text-[#555] text-sm mb-4">No bias entries yet</p>
              <button onClick={openNewBias}
                className="px-4 py-2 rounded-lg bg-white text-black text-xs font-semibold hover:bg-[#e8e8e8] transition-colors">
                Log Today's Bias
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-[#1e1e1e] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left bg-[#080808] border-b border-[#1a1a1a]">
                    <th className="px-5 py-3 text-xs text-[#333] font-medium">Date</th>
                    <th className="px-5 py-3 text-xs text-[#333] font-medium">Pair / Asset</th>
                    <th className="px-5 py-3 text-xs text-[#333] font-medium">Preview</th>
                    <th className="px-5 py-3 text-xs text-[#333] font-medium">Images</th>
                    <th className="px-5 py-3 text-xs text-[#333] font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {biasEntries
                    .sort((a, b) => b.createdAt - a.createdAt)
                    .map((entry) => (
                    <tr key={entry.id} className="border-t border-[#111] hover:bg-[#0d0d0d] transition-colors group">
                      <td className="px-5 py-3">
                        <p className="text-sm font-medium text-white">
                          {entry.date === getTodayKey() ? "Today" : new Date(entry.date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                        </p>
                        <p className="text-xs text-[#333] mt-0.5">{entry.date}</p>
                      </td>
                      <td className="px-5 py-3">
                        {entry.asset ? (
                          <span className="text-xs px-2 py-1 rounded-lg border border-[#1e1e1e] text-white font-medium">{entry.asset}</span>
                        ) : (
                          <span className="text-xs text-[#333]">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 max-w-xs">
                        <p className="text-xs text-[#555] truncate">{entry.text?.slice(0, 80) || "—"}</p>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex gap-1">
                          {entry.images?.slice(0, 3).map((src, i) => (
                            <div key={i} className="w-8 h-7 rounded overflow-hidden border border-[#1e1e1e]">
                              <img src={src} alt="" className="w-full h-full object-cover" />
                            </div>
                          ))}
                          {(!entry.images || entry.images.length === 0) && <span className="text-xs text-[#333]">—</span>}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openBiasEditor(entry)}
                            className="text-xs text-[#444] hover:text-white transition-colors">Edit</button>
                          <button onClick={() => deleteBiasEntry(entry.id)}
                            className="text-xs text-[#444] hover:text-[#ff4f4f] transition-colors">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Daily Bias Editor ── */}
      {activeView === "bias-editor" && (
        <div className="flex-1 flex flex-col max-w-3xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <button onClick={() => setActiveView("bias-list")}
                className="text-xs text-[#444] hover:text-white transition-colors mb-2 flex items-center gap-1">
                ← Back to entries
              </button>
              <h2 className="text-lg font-semibold text-white">
                {editingBiasId ? "Edit Bias" : "New Bias Entry"}
              </h2>
              <p className="text-xs text-[#444] mt-0.5">Pre-session analysis and plan</p>
            </div>
            <div className="flex items-center gap-2">
              <input type="date" value={selectedBiasDate}
                onChange={(e) => { setSelectedBiasDate(e.target.value); setBiasSaved(false); }}
                className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-lg px-3 py-1.5 text-xs text-white" style={{ colorScheme: "dark" }} />
              <input
                type="text"
                value={biasAsset}
                onChange={(e) => { setBiasAsset(e.target.value); setBiasSaved(false); }}
                placeholder="Pair (EU, GU, Gold...)"
                className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-lg px-3 py-1.5 text-xs text-white w-36 focus:outline-none focus:border-[#333]"
              />
              <button onClick={() => biasImageInputRef.current?.click()}
                className="px-3 py-1.5 rounded-lg border border-[#1e1e1e] text-xs text-[#555] hover:text-white transition-colors flex items-center gap-1.5">
                <ImagePlus className="w-3.5 h-3.5" /> Add Image
              </button>
              <input ref={biasImageInputRef} type="file" accept="image/*" onChange={handleBiasImageUpload} style={{ display: "none" }} />
              <button onClick={saveBias}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${biasSaved ? "bg-[#00d28a] text-black" : "bg-white text-black hover:bg-[#e8e8e8]"}`}>
                {biasSaved ? "✓ Saved" : "Save"}
              </button>
            </div>
          </div>
          <textarea value={biasText}
            onChange={(e) => { setBiasText(e.target.value); setBiasSaved(false); }}
            placeholder={"DXY Context:\n\n\nEU Bias:\n\n\nGU Bias:\n\n\nGold Bias:\n\n\nGER40 Bias:\n\n\nKey levels to watch:\n\n\nPlan for today:"}
            className="w-full bg-transparent border-none text-sm text-white placeholder-[#222] resize-none focus:outline-none leading-relaxed mb-6"
            style={{ minHeight: "320px", fontFamily: "inherit" }} />
          {biasImages.length > 0 && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              {biasImages.map((src, i) => (
                <div key={i} className="relative group rounded-xl overflow-hidden border border-[#1e1e1e]">
                  <img src={src} alt={`Bias image ${i + 1}`} className="w-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                    style={{ maxHeight: "280px", objectFit: "cover" }} onClick={() => setLightboxSrc(src)} />
                  <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setLightboxSrc(src)}
                      className="w-7 h-7 rounded-lg bg-black/60 flex items-center justify-center text-white hover:bg-black/80">
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setBiasImages(prev => prev.filter((_, j) => j !== i))}
                      className="w-7 h-7 rounded-lg bg-black/60 flex items-center justify-center text-[#ff4f4f] hover:bg-black/80">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              <button onClick={() => biasImageInputRef.current?.click()}
                className="rounded-xl border border-dashed border-[#1e1e1e] flex flex-col items-center justify-center gap-2 text-[#333] hover:text-[#555] transition-colors"
                style={{ minHeight: "120px" }}>
                <ImagePlus className="w-5 h-5" />
                <span className="text-xs">Add image</span>
              </button>
            </div>
          )}
          {biasImages.length === 0 && (
            <button onClick={() => biasImageInputRef.current?.click()}
              className="w-full rounded-xl border border-dashed border-[#1a1a1a] py-8 flex flex-col items-center gap-2 text-[#222] hover:text-[#444] hover:border-[#222] transition-colors">
              <ImagePlus className="w-5 h-5" />
              <span className="text-xs">Upload chart screenshots or images</span>
            </button>
          )}
        </div>
      )}

      {/* ── Trades View ── */}
      {activeView === "trades" && (
        <>
          {/* Filters */}
          <div className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-[#444] uppercase tracking-wider">Filters</p>
              <button onClick={clearFilters} className="text-xs text-[#444] hover:text-white transition-colors">Clear</button>
            </div>
            <div className="grid grid-cols-6 gap-2">
              {[
                { label: "Session", value: filterSession, set: setFilterSession, options: settings.sessions || [] },
                { label: "Model", value: filterModel, set: setFilterModel, options: settings.models || [] },
                { label: "Account", value: filterAccount, set: setFilterAccount, options: settings.accounts || [] },
                { label: "Position", value: filterPosition, set: setFilterPosition, options: ["Long", "Short"] },
              ].map(f => (
                <div key={f.label}>
                  <label className="block text-xs text-[#333] mb-1">{f.label}</label>
                  <select value={f.value} onChange={(e) => { f.set(e.target.value); setCurrentPage(1); }}
                    className="w-full bg-[#080808] border border-[#1a1a1a] rounded-lg px-2 py-1.5 text-xs text-white" style={{ colorScheme: "dark" }}>
                    <option value="">All</option>
                    {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              ))}
              <div>
                <label className="block text-xs text-[#333] mb-1">From</label>
                <input type="date" value={filterFrom} onChange={(e) => { setFilterFrom(e.target.value); setCurrentPage(1); }}
                  className="w-full bg-[#080808] border border-[#1a1a1a] rounded-lg px-2 py-1.5 text-xs text-white" style={{ colorScheme: "dark" }} />
              </div>
              <div>
                <label className="block text-xs text-[#333] mb-1">To</label>
                <input type="date" value={filterTo} onChange={(e) => { setFilterTo(e.target.value); setCurrentPage(1); }}
                  className="w-full bg-[#080808] border border-[#1a1a1a] rounded-lg px-2 py-1.5 text-xs text-white" style={{ colorScheme: "dark" }} />
              </div>
            </div>
          </div>

          {/* Trade log table */}
          <div className="rounded-xl border border-[#1e1e1e] overflow-hidden flex-1">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1a1a1a] bg-[#0a0a0a]">
              <p className="text-xs text-[#444]">{filteredTrades.length} trades matching filters</p>
              {totalPages > 1 && <p className="text-xs text-[#333]">Page {currentPage} of {totalPages}</p>}
            </div>
            <div className="overflow-x-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.06) transparent" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left bg-[#080808] border-b border-[#1a1a1a]">
                    {["#", "Date", "Symbol", "Position", "Realised R", "Max R", "Session", "Account", "Grade", "Image", "Notes", ""].map(h => (
                      <th key={h} className="px-4 py-3 text-xs text-[#333] font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedTrades.length === 0 ? (
                    <tr><td colSpan={12} className="px-4 py-12 text-center text-xs text-[#333]">No trades match the current filters.</td></tr>
                  ) : paginatedTrades.map((t, idx) => {
                    const outcome = classifyOutcome(t.realisedR);
                    const scrArr = parseScreenshots(t.screenshots);
                    const globalIdx = (currentPage - 1) * TRADES_PER_PAGE + idx + 1;
                    return (
                      <tr key={t.id} className="border-t border-[#111] hover:bg-[#0d0d0d] transition-colors group">
                        <td className="px-4 py-3 text-xs text-[#2a2a2a] font-mono">{globalIdx}</td>
                        <td className="px-4 py-3 text-xs text-[#666] whitespace-nowrap">{formatDate(t.date)}</td>
                        <td className="px-4 py-3 font-semibold text-white text-xs">{t.symbol}</td>
                        <td className="px-4 py-3 text-xs text-[#555]">{t.position}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`text-sm font-semibold ${t.realisedR > 0 ? "text-[#00d28a]" : t.realisedR < 0 ? "text-[#ff4f4f]" : "text-[#888]"}`}>
                            {formatR(t.realisedR)}
                          </span>
                          <span className={`ml-2 text-xs px-1.5 py-0.5 rounded font-medium ${
                            outcome === "Win" ? "bg-[#0a2e1a] text-[#00d28a]" :
                            outcome === "Loss" ? "bg-[#2e0a0a] text-[#ff4f4f]" :
                            "bg-[#1a1500] text-[#ffd76e]"
                          }`}>{outcome}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-[#444]">{formatR(t.maxR || t.realisedR)}</td>
                        <td className="px-4 py-3 text-xs text-[#444]">{t.session}</td>
                        <td className="px-4 py-3 text-xs text-[#444] max-w-[100px] truncate">{t.account}</td>
                        <td className="px-4 py-3">
                          {t.setupGrade ? (
                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                              t.setupGrade === "A+" ? "bg-[#0a1e0a] text-[#00d28a]" :
                              t.setupGrade === "A" ? "bg-[#0a180a] text-[#4dba77]" :
                              "bg-[#2e0a0a] text-[#ff6b6b]"
                            }`}>{t.setupGrade}</span>
                          ) : <span className="text-xs text-[#222]">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {scrArr.slice(0, 3).map((url, i) => {
                              const isB64 = url.startsWith("data:");
                              return isB64 ? (
                                <button key={i} onClick={() => setLightboxSrc(url)}
                                  className="w-8 h-7 rounded overflow-hidden border border-[#1e1e1e] hover:border-[#333] transition-colors flex-shrink-0 relative group/img">
                                  <img src={url} alt="" className="w-full h-full object-cover" />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                    <ZoomIn className="w-2.5 h-2.5 text-white" />
                                  </div>
                                </button>
                              ) : (
                                <a key={i} href={normalizeHref(url)} target="_blank" rel="noopener noreferrer"
                                  className="text-xs px-1.5 py-1 rounded border border-[#1e1e1e] text-[#444] hover:text-white transition-colors">
                                  {["E","4H","1H"][i]}
                                </a>
                              );
                            })}
                            {scrArr.length === 0 && <span className="text-xs text-[#222]">—</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-[#444] max-w-[160px] truncate">{t.notes || "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEdit(t)}
                              className="w-7 h-7 rounded-lg border border-[#1e1e1e] flex items-center justify-center text-[#555] hover:text-white hover:border-[#333] transition-colors">
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button onClick={() => handleDelete(t.id)}
                              className="w-7 h-7 rounded-lg border border-[#1e1e1e] flex items-center justify-center text-[#555] hover:text-[#ff4f4f] hover:border-[#2e1010] transition-colors">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-[#1a1a1a] bg-[#0a0a0a]">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1e1e1e] text-xs text-[#555] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <ChevronLeft className="w-3.5 h-3.5" /> Previous
                </button>
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    let page = i + 1;
                    if (totalPages > 7) {
                      if (currentPage <= 4) page = i + 1;
                      else if (currentPage >= totalPages - 3) page = totalPages - 6 + i;
                      else page = currentPage - 3 + i;
                    }
                    return (
                      <button key={page} onClick={() => setCurrentPage(page)}
                        className={`w-7 h-7 rounded-lg text-xs transition-colors ${currentPage === page ? "bg-white text-black font-medium" : "text-[#444] hover:text-white border border-[#1e1e1e]"}`}>
                        {page}
                      </button>
                    );
                  })}
                </div>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1e1e1e] text-xs text-[#555] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Add/Edit Trade Modal ── */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && (setIsFormOpen(false), setEditingId(null))}>
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[#1e1e1e] bg-[#0a0a0a]"
            style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.06) transparent" }}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#1a1a1a] sticky top-0 bg-[#0a0a0a] z-10">
              <div>
                <h2 className="text-sm font-semibold text-white">{editingId ? "Edit Trade" : "Log New Trade"}</h2>
                <p className="text-xs text-[#444] mt-0.5">Fill in the details below</p>
              </div>
              <button onClick={() => (setIsFormOpen(false), setEditingId(null))}
                className="w-7 h-7 rounded-lg border border-[#1e1e1e] flex items-center justify-center text-[#444] hover:text-white transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="grid grid-cols-3 gap-3">
                {[{ label: "Date *", type: "date", key: "date" }, { label: "Symbol *", type: "text", key: "symbol", placeholder: "e.g. EU" }].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs text-[#444] mb-1.5">{f.label}</label>
                    <input type={f.type} value={(formData as any)[f.key]}
                      onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value })}
                      placeholder={(f as any).placeholder}
                      className="w-full bg-[#080808] border border-[#1e1e1e] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#2a2a2a]"
                      style={{ colorScheme: "dark" }} />
                  </div>
                ))}
                <div>
                  <label className="block text-xs text-[#444] mb-1.5">Position</label>
                  <select value={formData.position} onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    className="w-full bg-[#080808] border border-[#1e1e1e] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none" style={{ colorScheme: "dark" }}>
                    <option value="Long">Long</option>
                    <option value="Short">Short</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[{ label: "Realised R *", key: "realisedR", placeholder: "e.g. -1 or 2" }, { label: "Max R", key: "maxR", placeholder: "Optional" }, { label: "Risk %", key: "riskPercent", placeholder: "e.g. 1" }].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs text-[#444] mb-1.5">{f.label}</label>
                    <input type="text" value={(formData as any)[f.key]}
                      onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value })}
                      placeholder={f.placeholder}
                      className="w-full bg-[#080808] border border-[#1e1e1e] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#2a2a2a]" />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Account", key: "account", options: settings.accounts || [] },
                  { label: "Model", key: "model", options: settings.models || [] },
                  { label: "Session", key: "session", options: settings.sessions || [] },
                  { label: "Setup Grade", key: "setupGrade", options: settings.setupGrades || [] },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs text-[#444] mb-1.5">{f.label}</label>
                    <select value={(formData as any)[f.key]} onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value })}
                      className="w-full bg-[#080808] border border-[#1e1e1e] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none" style={{ colorScheme: "dark" }}>
                      <option value="">Select</option>
                      {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              {settings.keyLevels && settings.keyLevels.length > 0 && (
                <div>
                  <label className="block text-xs text-[#444] mb-2">Key Levels</label>
                  <div className="flex flex-wrap gap-2">
                    {settings.keyLevels.map(kl => (
                      <button key={kl} type="button" onClick={() => toggleTag("keyLevels", kl)}
                        className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${formData.keyLevels.includes(kl) ? "border-[#ffd76e] text-[#ffd76e] bg-[#1a1500]" : "border-[#1e1e1e] text-[#444] hover:text-white"}`}>
                        {kl}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {settings.mistakes && settings.mistakes.length > 0 && (
                <div>
                  <label className="block text-xs text-[#444] mb-2">Mistakes</label>
                  <div className="flex flex-wrap gap-2">
                    {settings.mistakes.map(m => (
                      <button key={m} type="button" onClick={() => toggleTag("mistakes", m)}
                        className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${formData.mistakes.includes(m) ? "border-[#ff4f4f] text-[#ff4f4f] bg-[#1a0505]" : "border-[#1e1e1e] text-[#444] hover:text-white"}`}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Trade images - 3 slots */}
              <div>
                <label className="block text-xs text-[#444] mb-2">Trade Screenshots <span className="text-[#333]">(Entry, 4H, 1H)</span></label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { key: "tradeImage", label: "Entry" },
                    { key: "tradeImage2", label: "4H" },
                    { key: "tradeImage3", label: "1H" },
                  ] as const).map((slot) => {
                    const val = formData[slot.key];
                    return (
                      <div key={slot.key}>
                        {val ? (
                          <div className="relative rounded-xl overflow-hidden border border-[#1e1e1e] group">
                            <img src={val} alt={slot.label} className="w-full object-cover cursor-pointer"
                              style={{ height: "80px", objectFit: "cover" }}
                              onClick={() => setLightboxSrc(val)} />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                              <button type="button" onClick={() => setLightboxSrc(val)}
                                className="w-6 h-6 rounded bg-black/60 flex items-center justify-center text-white">
                                <ZoomIn className="w-3 h-3" />
                              </button>
                              <button type="button" onClick={() => setFormData(prev => ({ ...prev, [slot.key]: "" }))}
                                className="w-6 h-6 rounded bg-black/60 flex items-center justify-center text-[#ff4f4f]">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button type="button" onClick={() => {
                            const inp = document.getElementById(`img-upload-${slot.key}`) as HTMLInputElement;
                            inp?.click();
                          }}
                            className="w-full rounded-xl border border-dashed border-[#1e1e1e] flex flex-col items-center justify-center gap-1 text-[#333] hover:text-[#555] hover:border-[#2a2a2a] transition-colors"
                            style={{ height: "80px" }}>
                            <ImagePlus className="w-4 h-4" />
                            <span className="text-xs">{slot.label}</span>
                          </button>
                        )}
                        <input
                          id={`img-upload-${slot.key}`}
                          type="file" accept="image/*"
                          style={{ display: "none" }}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            try {
                              const b64 = await fileToBase64(file);
                              setFormData(prev => ({ ...prev, [slot.key]: b64 }));
                            } catch { alert("Failed to load image"); }
                            e.target.value = '';
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs text-[#444] mb-1.5">Notes</label>
                <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3} placeholder="What happened? What did you see?"
                  className="w-full bg-[#080808] border border-[#1e1e1e] rounded-xl px-3 py-2.5 text-sm text-white resize-none focus:outline-none focus:border-[#2a2a2a]" />
              </div>

              <div className="flex gap-2 pt-1">
                <button type="submit"
                  className="flex-1 py-3 rounded-xl bg-white text-black text-sm font-semibold hover:bg-[#e8e8e8] transition-colors flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" />{editingId ? "Update Trade" : "Log Trade"}
                </button>
                <button type="button" onClick={() => (setIsFormOpen(false), setEditingId(null))}
                  className="flex-1 py-3 rounded-xl border border-[#1e1e1e] text-sm text-[#555] hover:text-white transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Image Lightbox ── */}
      {lightboxSrc && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60] p-4"
          onClick={() => setLightboxSrc(null)}>
          <button className="absolute top-4 right-4 w-9 h-9 rounded-xl border border-[#333] flex items-center justify-center text-[#888] hover:text-white transition-colors bg-black/50"
            onClick={() => setLightboxSrc(null)}>
            <X className="w-4 h-4" />
          </button>
          <img src={lightboxSrc} alt="Full size" className="max-w-full max-h-full object-contain rounded-xl"
            style={{ maxHeight: "90vh" }} onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
