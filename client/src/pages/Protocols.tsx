import { useState, useEffect, useRef, useCallback } from "react";
import {
  Plus, X, Trash2, Edit2, ChevronDown, ChevronRight,
  BarChart2, FileText, ImagePlus, ZoomIn, GripVertical,
  Table, Type, List, Hash, Minus, Lightbulb, AlignLeft,
  CheckCircle2, TrendingUp, TrendingDown, Minus as MinusIcon,
  MoreHorizontal, Save, ArrowLeft
} from "lucide-react";
import { useTradeContext } from "@/contexts/TradeContext";
import { classifyOutcome, formatDate, formatR } from "@/lib/tradeUtils";
import { computeStats } from "@/lib/tradeUtils";
import type { Trade } from "@shared/schema";
import {
  loadProtocols, createProtocol, updateProtocol, deleteProtocol,
  loadBlocks, saveBlocks, deleteBlock,
  loadProtocolTrades, addProtocolTrade, updateProtocolTrade, deleteProtocolTrade,
  uploadProtocolImage,
  type Protocol, type ProtocolBlock, type BlockType, type ProtocolTrade,
} from "@/lib/protocolStorage";

// ─── Constants ────────────────────────────────────────────────────────────────

const PROTOCOL_COLORS = [
  '#00d28a', '#3b82f6', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
];

const PROTOCOL_ICONS = ['📋', '⚡', '🎯', '🔒', '📊', '🧠', '🌊', '🔥', '💡', '🛡️', '⚙️', '🎲'];

const REGIMES = ['Trending', 'Ranging', 'Volatile', 'Low Volatility', 'News Driven'];

const BLOCK_MENU: { type: BlockType; label: string; icon: React.ReactNode; desc: string }[] = [
  { type: 'heading1',     label: 'Heading 1',      icon: <Hash className="w-4 h-4" />,       desc: 'Large section header' },
  { type: 'heading2',     label: 'Heading 2',      icon: <Hash className="w-3.5 h-3.5" />,   desc: 'Medium section header' },
  { type: 'heading3',     label: 'Heading 3',      icon: <Hash className="w-3 h-3" />,       desc: 'Small section header' },
  { type: 'paragraph',    label: 'Text',           icon: <AlignLeft className="w-4 h-4" />,  desc: 'Plain paragraph' },
  { type: 'bulletList',   label: 'Bullet List',    icon: <List className="w-4 h-4" />,       desc: 'Unordered list' },
  { type: 'numberedList', label: 'Numbered List',  icon: <List className="w-4 h-4" />,       desc: 'Ordered list' },
  { type: 'callout',      label: 'Callout',        icon: <Lightbulb className="w-4 h-4" />,  desc: 'Highlighted note' },
  { type: 'table',        label: 'Table',          icon: <Table className="w-4 h-4" />,      desc: 'Data table' },
  { type: 'image',        label: 'Image',          icon: <ImagePlus className="w-4 h-4" />,  desc: 'Upload an image' },
  { type: 'divider',      label: 'Divider',        icon: <Minus className="w-4 h-4" />,      desc: 'Horizontal rule' },
];

function newBlock(protocolId: string, type: BlockType, order: number): ProtocolBlock {
  const base = { id: crypto.randomUUID(), protocolId, type, content: '', sortOrder: order, createdAt: Date.now() };
  if (type === 'table') return { ...base, metadata: { headers: ['Column 1', 'Column 2', 'Column 3'], rows: [['', '', '']] } };
  if (type === 'image') return { ...base, metadata: { url: '', caption: '' } };
  if (type === 'callout') return { ...base, metadata: { icon: '💡', color: '#ffd76e' } };
  return { ...base, metadata: {} };
}

function parseScreenshots(s: string | null | undefined): string[] {
  if (!s) return [];
  try { const p = JSON.parse(s); if (Array.isArray(p)) return p.filter(Boolean); } catch {}
  return s ? [s] : [];
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

// ─── Stats helper ─────────────────────────────────────────────────────────────

function calcStats(trades: ProtocolTrade[]) {
  const n = trades.length;
  if (!n) return null;
  const wins = trades.filter(t => t.realisedR > 0.0001).length;
  const losses = trades.filter(t => t.realisedR < -0.0001).length;
  const bes = n - wins - losses;
  const totalR = trades.reduce((s, t) => s + t.realisedR, 0);
  const winSum = trades.filter(t => t.realisedR > 0).reduce((s, t) => s + t.realisedR, 0);
  const lossSum = trades.filter(t => t.realisedR < 0).reduce((s, t) => s + t.realisedR, 0);
  const avgR = totalR / n;
  const winRate = (wins / n) * 100;
  const avgWin = wins > 0 ? winSum / wins : 0;
  const avgLoss = losses > 0 ? lossSum / losses : 0;
  const pf = lossSum !== 0 ? winSum / Math.abs(lossSum) : wins > 0 ? Infinity : 0;
  const confidence = n < 30 ? 'low' : n < 100 ? 'medium' : 'high';
  return { n, wins, losses, bes, totalR, avgR, winRate, avgWin, avgLoss, pf, confidence };
}

// ─── Block Editor Component ───────────────────────────────────────────────────

function BlockEditor({
  block, onChange, onDelete, onAddAfter, onMoveUp, onMoveDown,
  isFirst, isLast,
}: {
  block: ProtocolBlock;
  onChange: (b: ProtocolBlock) => void;
  onDelete: () => void;
  onAddAfter: (type: BlockType) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const meta = block.metadata as any;

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [block.content]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadProtocolImage(file);
      onChange({ ...block, metadata: { ...meta, url } });
    } catch {
      // fallback to base64
      const b64 = await fileToBase64(file);
      onChange({ ...block, metadata: { ...meta, url: b64 } });
    }
    e.target.value = '';
  };

  const textClass = "w-full bg-transparent focus:outline-none text-white resize-none leading-relaxed placeholder-[#2a2a2a]";

  const renderContent = () => {
    switch (block.type) {
      case 'heading1':
        return (
          <textarea ref={textareaRef} value={block.content}
            onChange={e => onChange({ ...block, content: e.target.value })}
            placeholder="Heading 1"
            className={`${textClass} text-2xl font-bold tracking-tight`}
            style={{ fontFamily: "'JetBrains Mono', monospace", minHeight: '40px' }}
            rows={1} />
        );
      case 'heading2':
        return (
          <textarea ref={textareaRef} value={block.content}
            onChange={e => onChange({ ...block, content: e.target.value })}
            placeholder="Heading 2"
            className={`${textClass} text-xl font-semibold`}
            style={{ minHeight: '36px' }}
            rows={1} />
        );
      case 'heading3':
        return (
          <textarea ref={textareaRef} value={block.content}
            onChange={e => onChange({ ...block, content: e.target.value })}
            placeholder="Heading 3"
            className={`${textClass} text-base font-semibold text-[#aaa]`}
            style={{ minHeight: '32px' }}
            rows={1} />
        );
      case 'paragraph':
        return (
          <textarea ref={textareaRef} value={block.content}
            onChange={e => onChange({ ...block, content: e.target.value })}
            placeholder="Start writing..."
            className={`${textClass} text-sm text-[#ccc]`}
            style={{ minHeight: '28px' }}
            rows={1} />
        );
      case 'bulletList':
        return (
          <div className="space-y-1">
            {(block.content || '').split('\n').map((line, i, arr) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-[#00d28a] mt-1 flex-shrink-0" style={{ fontSize: '8px' }}>●</span>
                <input
                  value={line}
                  onChange={e => {
                    const lines = block.content.split('\n');
                    lines[i] = e.target.value;
                    onChange({ ...block, content: lines.join('\n') });
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const lines = block.content.split('\n');
                      lines.splice(i + 1, 0, '');
                      onChange({ ...block, content: lines.join('\n') });
                    }
                    if (e.key === 'Backspace' && line === '' && arr.length > 1) {
                      e.preventDefault();
                      const lines = block.content.split('\n').filter((_, j) => j !== i);
                      onChange({ ...block, content: lines.join('\n') });
                    }
                  }}
                  placeholder="List item"
                  className="flex-1 bg-transparent focus:outline-none text-sm text-[#ccc] placeholder-[#2a2a2a]"
                />
              </div>
            ))}
          </div>
        );
      case 'numberedList':
        return (
          <div className="space-y-1">
            {(block.content || '').split('\n').map((line, i, arr) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-[#666] mt-0.5 flex-shrink-0 text-xs font-mono w-4 text-right">{i + 1}.</span>
                <input
                  value={line}
                  onChange={e => {
                    const lines = block.content.split('\n');
                    lines[i] = e.target.value;
                    onChange({ ...block, content: lines.join('\n') });
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const lines = block.content.split('\n');
                      lines.splice(i + 1, 0, '');
                      onChange({ ...block, content: lines.join('\n') });
                    }
                    if (e.key === 'Backspace' && line === '' && arr.length > 1) {
                      e.preventDefault();
                      const lines = block.content.split('\n').filter((_, j) => j !== i);
                      onChange({ ...block, content: lines.join('\n') });
                    }
                  }}
                  placeholder="List item"
                  className="flex-1 bg-transparent focus:outline-none text-sm text-[#ccc] placeholder-[#2a2a2a]"
                />
              </div>
            ))}
          </div>
        );
      case 'callout':
        return (
          <div className="flex gap-3 rounded-xl p-4" style={{ background: 'rgba(255,215,110,0.05)', border: '1px solid rgba(255,215,110,0.12)' }}>
            <input
              value={meta.icon || '💡'}
              onChange={e => onChange({ ...block, metadata: { ...meta, icon: e.target.value } })}
              className="bg-transparent focus:outline-none text-xl w-8 flex-shrink-0"
              maxLength={4}
            />
            <textarea ref={textareaRef} value={block.content}
              onChange={e => onChange({ ...block, content: e.target.value })}
              placeholder="Write a callout note..."
              className={`${textClass} text-sm text-[#ffd76e]`}
              style={{ minHeight: '28px' }}
              rows={1} />
          </div>
        );
      case 'table': {
        const headers: string[] = meta.headers || ['Col 1', 'Col 2'];
        const rows: string[][] = meta.rows || [['', '']];
        return (
          <div className="overflow-x-auto rounded-xl border border-[#1e1e1e]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e1e1e] bg-[#0d0d0d]">
                  {headers.map((h, ci) => (
                    <th key={ci} className="px-3 py-2 text-left">
                      <input value={h}
                        onChange={e => {
                          const nh = [...headers]; nh[ci] = e.target.value;
                          onChange({ ...block, metadata: { ...meta, headers: nh } });
                        }}
                        className="bg-transparent focus:outline-none text-xs font-semibold text-[#666] w-full"
                        placeholder={`Column ${ci + 1}`}
                      />
                    </th>
                  ))}
                  <th className="px-2 py-2 w-8">
                    <button onClick={() => {
                      const nh = [...headers, `Col ${headers.length + 1}`];
                      const nr = rows.map(r => [...r, '']);
                      onChange({ ...block, metadata: { ...meta, headers: nh, rows: nr } });
                    }} className="text-[#333] hover:text-[#555] text-xs">+</button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri} className="border-t border-[#111] group/row">
                    {headers.map((_, ci) => (
                      <td key={ci} className="px-3 py-2">
                        <input value={row[ci] || ''}
                          onChange={e => {
                            const nr = rows.map((r, rj) => rj === ri ? r.map((c, cj) => cj === ci ? e.target.value : c) : [...r]);
                            onChange({ ...block, metadata: { ...meta, rows: nr } });
                          }}
                          className="bg-transparent focus:outline-none text-xs text-[#ccc] w-full placeholder-[#2a2a2a]"
                          placeholder="—"
                        />
                      </td>
                    ))}
                    <td className="px-2 py-2 w-8">
                      <button onClick={() => {
                        const nr = rows.filter((_, j) => j !== ri);
                        onChange({ ...block, metadata: { ...meta, rows: nr.length ? nr : [[...headers.map(() => '')]] } });
                      }} className="opacity-0 group-hover/row:opacity-100 text-[#333] hover:text-[#ff4f4f] transition-all text-xs">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={headers.length + 1} className="px-3 py-2">
                    <button onClick={() => {
                      const nr = [...rows, headers.map(() => '')];
                      onChange({ ...block, metadata: { ...meta, rows: nr } });
                    }} className="text-xs text-[#333] hover:text-[#555] transition-colors">+ Add row</button>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        );
      }
      case 'image':
        return (
          <div>
            {meta.url ? (
              <div className="relative group/img rounded-xl overflow-hidden border border-[#1e1e1e]">
                <img src={meta.url} alt={meta.caption || ''} className="w-full object-cover max-h-[500px]" style={{ objectFit: 'contain', background: '#080808' }} />
                <div className="absolute top-2 right-2 opacity-0 group-hover/img:opacity-100 transition-opacity flex gap-1">
                  <button onClick={() => onChange({ ...block, metadata: { ...meta, url: '' } })}
                    className="w-7 h-7 rounded-lg bg-black/70 flex items-center justify-center text-[#ff4f4f] hover:bg-black">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="p-2 border-t border-[#1e1e1e]">
                  <input value={meta.caption || ''}
                    onChange={e => onChange({ ...block, metadata: { ...meta, caption: e.target.value } })}
                    placeholder="Add a caption..."
                    className="w-full bg-transparent focus:outline-none text-xs text-[#555] text-center placeholder-[#2a2a2a]"
                  />
                </div>
              </div>
            ) : (
              <button onClick={() => imageInputRef.current?.click()}
                className="w-full rounded-xl border border-dashed border-[#1e1e1e] py-12 flex flex-col items-center gap-2 text-[#333] hover:text-[#555] hover:border-[#2a2a2a] transition-colors">
                <ImagePlus className="w-6 h-6" />
                <span className="text-xs">Click to upload image</span>
              </button>
            )}
            <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
          </div>
        );
      case 'divider':
        return <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)' }} />;
      default:
        return null;
    }
  };

  return (
    <div
      className="relative group/block"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setMenuOpen(false); setAddMenuOpen(false); }}
    >
      {/* Left controls */}
      <div className={`absolute -left-12 top-1 flex gap-1 transition-opacity ${hovered ? 'opacity-100' : 'opacity-0'}`}>
        <button onClick={() => setAddMenuOpen(v => !v)}
          className="w-6 h-6 rounded flex items-center justify-center text-[#333] hover:text-[#555] hover:bg-[#111] transition-colors">
          <Plus className="w-3.5 h-3.5" />
        </button>
        <button className="w-6 h-6 rounded flex items-center justify-center text-[#2a2a2a] hover:text-[#444] hover:bg-[#111] transition-colors cursor-grab">
          <GripVertical className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Add menu */}
      {addMenuOpen && (
        <div className="absolute left-0 top-8 z-50 rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] py-1 shadow-2xl w-56"
          style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.8)' }}>
          {BLOCK_MENU.map(bm => (
            <button key={bm.type} onClick={() => { onAddAfter(bm.type); setAddMenuOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-[#111] transition-colors">
              <span className="text-[#444]">{bm.icon}</span>
              <div>
                <p className="text-xs text-white font-medium">{bm.label}</p>
                <p className="text-xs text-[#333]">{bm.desc}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Block content */}
      <div className="py-1">
        {renderContent()}
      </div>

      {/* Right controls */}
      <div className={`absolute -right-8 top-1 transition-opacity ${hovered ? 'opacity-100' : 'opacity-0'}`}>
        <div className="relative">
          <button onClick={() => setMenuOpen(v => !v)}
            className="w-6 h-6 rounded flex items-center justify-center text-[#2a2a2a] hover:text-[#555] hover:bg-[#111] transition-colors">
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-7 z-50 rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] py-1 shadow-2xl w-40"
              style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.8)' }}>
              {!isFirst && <button onClick={() => { onMoveUp(); setMenuOpen(false); }} className="w-full px-3 py-1.5 text-left text-xs text-[#666] hover:text-white hover:bg-[#111] transition-colors">Move up</button>}
              {!isLast && <button onClick={() => { onMoveDown(); setMenuOpen(false); }} className="w-full px-3 py-1.5 text-left text-xs text-[#666] hover:text-white hover:bg-[#111] transition-colors">Move down</button>}
              <button onClick={() => { onDelete(); setMenuOpen(false); }} className="w-full px-3 py-1.5 text-left text-xs text-[#ff4f4f] hover:bg-[#1a0505] transition-colors">Delete block</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Protocol Notes Editor ────────────────────────────────────────────────────

function ProtocolNotesEditor({ protocol }: { protocol: Protocol }) {
  const [blocks, setBlocks] = useState<ProtocolBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadBlocks(protocol.id).then(b => {
      if (b.length === 0) {
        setBlocks([newBlock(protocol.id, 'paragraph', 0)]);
      } else {
        setBlocks(b);
      }
      setLoading(false);
    });
  }, [protocol.id]);

  const triggerSave = useCallback((newBlocks: ProtocolBlock[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaved(false);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        await saveBlocks(newBlocks);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } finally {
        setSaving(false);
      }
    }, 1200);
  }, []);

  const updateBlock = (idx: number, b: ProtocolBlock) => {
    const nb = blocks.map((bl, i) => i === idx ? b : bl);
    setBlocks(nb);
    triggerSave(nb);
  };

  const addBlockAfter = (idx: number, type: BlockType) => {
    const inserted = newBlock(protocol.id, type, 0);
    const nb = [...blocks.slice(0, idx + 1), inserted, ...blocks.slice(idx + 1)].map((b, i) => ({ ...b, sortOrder: i }));
    setBlocks(nb);
    triggerSave(nb);
  };

  const deleteBlock_ = async (idx: number) => {
    const b = blocks[idx];
    await deleteBlock(b.id);
    const nb = blocks.filter((_, i) => i !== idx).map((b, i) => ({ ...b, sortOrder: i }));
    if (nb.length === 0) {
      const fresh = [newBlock(protocol.id, 'paragraph', 0)];
      setBlocks(fresh);
    } else {
      setBlocks(nb);
      triggerSave(nb);
    }
  };

  const moveBlock = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= blocks.length) return;
    const nb = [...blocks];
    [nb[idx], nb[newIdx]] = [nb[newIdx], nb[idx]];
    const ordered = nb.map((b, i) => ({ ...b, sortOrder: i }));
    setBlocks(ordered);
    triggerSave(ordered);
  };

  if (loading) return <div className="text-[#333] text-sm py-12 text-center">Loading...</div>;

  return (
    <div className="relative">
      {/* Save indicator */}
      <div className={`absolute top-0 right-0 flex items-center gap-1.5 text-xs transition-opacity ${saving || saved ? 'opacity-100' : 'opacity-0'}`}>
        {saving ? <span className="text-[#444]">Saving...</span> : <span className="text-[#00d28a] flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Saved</span>}
      </div>

      <div className="pl-12 pr-8 py-2 space-y-1">
        {blocks.map((block, idx) => (
          <BlockEditor
            key={block.id}
            block={block}
            onChange={b => updateBlock(idx, b)}
            onDelete={() => deleteBlock_(idx)}
            onAddAfter={type => addBlockAfter(idx, type)}
            onMoveUp={() => moveBlock(idx, -1)}
            onMoveDown={() => moveBlock(idx, 1)}
            isFirst={idx === 0}
            isLast={idx === blocks.length - 1}
          />
        ))}

        {/* Add block button at end */}
        <div className="pl-0 pt-4">
          <div className="relative group/add">
            <button onClick={() => addBlockAfter(blocks.length - 1, 'paragraph')}
              className="flex items-center gap-2 text-xs text-[#2a2a2a] hover:text-[#444] transition-colors py-1">
              <Plus className="w-3.5 h-3.5" />
              <span>Add a block</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Protocol Data Collection ─────────────────────────────────────────────────

function ProtocolDataTab({ protocol }: { protocol: Protocol }) {
  const { settings } = useTradeContext();
  const [trades, setTrades] = useState<ProtocolTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const emptyForm = {
    date: new Date().toISOString().split('T')[0],
    symbol: '', account: '', model: '', session: '', entryTF: '',
    position: 'Long', riskPercent: '', realisedR: '', maxR: '',
    setupGrade: '', keyLevels: [] as string[], mistakes: [] as string[],
    regime: '', notes: '',
    tradeImage: '', tradeImage2: '', tradeImage3: '',
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    loadProtocolTrades(protocol.id).then(t => { setTrades(t); setLoading(false); });
  }, [protocol.id]);

  const toggleTag = (field: 'keyLevels' | 'mistakes', val: string) => {
    setForm(prev => ({
      ...prev,
      [field]: prev[field].includes(val) ? prev[field].filter(v => v !== val) : [...prev[field], val],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.date || !form.symbol || !form.realisedR) { alert('Fill Date, Symbol, and Realised R.'); return; }
    const realisedR = parseFloat(form.realisedR);
    if (isNaN(realisedR)) { alert('Realised R must be a number.'); return; }
    const riskPercent = form.riskPercent ? parseFloat(form.riskPercent) : null;
    const maxR = form.maxR ? parseFloat(form.maxR) : realisedR;

    const screenshots = [form.tradeImage, form.tradeImage2, form.tradeImage3].filter(Boolean);
    const payload: Omit<ProtocolTrade, 'id'> = {
      protocolId: protocol.id,
      date: form.date,
      symbol: form.symbol.toUpperCase(),
      account: form.account, model: form.model, session: form.session, entryTF: form.entryTF,
      position: form.position, riskPercent, realisedR, maxR,
      setupGrade: form.setupGrade, keyLevels: form.keyLevels, mistakes: form.mistakes,
      screenshots: screenshots.length ? JSON.stringify(screenshots) : '',
      notes: form.notes, regime: form.regime,
      createdAt: Date.now(),
    };

    if (editingId) {
      await updateProtocolTrade(editingId, payload);
      setTrades(prev => prev.map(t => t.id === editingId ? { ...t, ...payload, id: editingId } : t));
    } else {
      const newT = await addProtocolTrade(payload);
      setTrades(prev => [newT, ...prev]);
    }
    setForm(emptyForm); setIsFormOpen(false); setEditingId(null);
  };

  const handleEdit = (t: ProtocolTrade) => {
    setEditingId(t.id);
    const scrArr = parseScreenshots(t.screenshots);
    setForm({
      date: t.date, symbol: t.symbol, account: t.account, model: t.model,
      session: t.session, entryTF: t.entryTF, position: t.position,
      riskPercent: t.riskPercent != null ? String(t.riskPercent) : '',
      realisedR: String(t.realisedR), maxR: t.maxR != null ? String(t.maxR) : '',
      setupGrade: t.setupGrade, keyLevels: t.keyLevels, mistakes: t.mistakes,
      regime: t.regime, notes: t.notes,
      tradeImage: scrArr[0] || '', tradeImage2: scrArr[1] || '', tradeImage3: scrArr[2] || '',
    });
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this trade?')) return;
    await deleteProtocolTrade(id);
    setTrades(prev => prev.filter(t => t.id !== id));
  };

  const stats = calcStats(trades);

  if (loading) return <div className="text-[#333] text-sm py-12 text-center">Loading trades...</div>;

  const confidenceColor = stats?.confidence === 'high' ? '#00d28a' : stats?.confidence === 'medium' ? '#ffd76e' : '#ff4f4f';
  const confidenceLabel = stats?.confidence === 'high' ? 'High Confidence (100+ trades)' : stats?.confidence === 'medium' ? 'Medium Confidence (30–99 trades)' : 'Low Confidence (<30 trades)';

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      {stats && (
        <div className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-[#444] uppercase tracking-wider font-medium">Data Summary</p>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: confidenceColor, boxShadow: `0 0 6px ${confidenceColor}` }} />
              <span className="text-xs" style={{ color: confidenceColor }}>{confidenceLabel}</span>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-3">
            {[
              { label: 'Trades', value: stats.n, color: '#fff' },
              { label: 'Win Rate', value: `${stats.winRate.toFixed(1)}%`, color: stats.winRate >= 50 ? '#00d28a' : '#ff4f4f' },
              { label: 'Total R', value: `${stats.totalR >= 0 ? '+' : ''}${stats.totalR.toFixed(2)}R`, color: stats.totalR >= 0 ? '#00d28a' : '#ff4f4f' },
              { label: 'Avg R', value: `${stats.avgR >= 0 ? '+' : ''}${stats.avgR.toFixed(2)}R`, color: stats.avgR >= 0 ? '#00d28a' : '#ff4f4f' },
              { label: 'Avg Win', value: `+${stats.avgWin.toFixed(2)}R`, color: '#00d28a' },
              { label: 'Avg Loss', value: `${stats.avgLoss.toFixed(2)}R`, color: '#ff4f4f' },
              { label: 'Profit Factor', value: isFinite(stats.pf) ? stats.pf.toFixed(2) : '∞', color: stats.pf >= 1.5 ? '#00d28a' : stats.pf >= 1 ? '#ffd76e' : '#ff4f4f' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className="text-xs text-[#333] mb-1">{s.label}</p>
                <p className="text-sm font-semibold font-mono" style={{ color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Sample size progress */}
          <div className="mt-3 pt-3 border-t border-[#111]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-[#333]">Sample maturity</span>
              <span className="text-xs text-[#444]">{stats.n} / 100 trades for high confidence</span>
            </div>
            <div className="h-1 rounded-full bg-[#111] overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{
                width: `${Math.min(100, (stats.n / 100) * 100)}%`,
                background: `linear-gradient(90deg, ${stats.confidence === 'low' ? '#ff4f4f' : stats.confidence === 'medium' ? '#ffd76e' : '#00d28a'}, ${confidenceColor})`
              }} />
            </div>
          </div>

          {/* Regime breakdown */}
          {trades.some(t => t.regime) && (
            <div className="mt-3 pt-3 border-t border-[#111]">
              <p className="text-xs text-[#333] mb-2">Win rate by regime</p>
              <div className="flex flex-wrap gap-2">
                {REGIMES.filter(r => trades.some(t => t.regime === r)).map(regime => {
                  const rt = trades.filter(t => t.regime === regime);
                  const rw = rt.filter(t => t.realisedR > 0.0001).length;
                  const rwr = rt.length > 0 ? (rw / rt.length) * 100 : 0;
                  return (
                    <div key={regime} className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-[#1e1e1e] bg-[#080808]">
                      <span className="text-xs text-[#555]">{regime}</span>
                      <span className="text-xs font-mono" style={{ color: rwr >= 50 ? '#00d28a' : '#ff4f4f' }}>{rwr.toFixed(0)}%</span>
                      <span className="text-xs text-[#333]">({rt.length})</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Header + Add button */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#444]">{trades.length} data trades logged</p>
        <button onClick={() => { setEditingId(null); setForm(emptyForm); setIsFormOpen(true); }}
          className="px-4 py-2 rounded-lg bg-white text-black text-xs font-semibold hover:bg-[#e8e8e8] transition-colors flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Log Trade
        </button>
      </div>

      {/* Trade Table */}
      {trades.length === 0 ? (
        <div className="rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] p-12 text-center">
          <p className="text-[#333] text-sm mb-1">No data trades yet</p>
          <p className="text-[#222] text-xs mb-4">Log trades here to track this protocol's performance separately</p>
          <button onClick={() => { setForm(emptyForm); setIsFormOpen(true); }}
            className="px-4 py-2 rounded-lg bg-white text-black text-xs font-semibold hover:bg-[#e8e8e8] transition-colors">
            Log First Trade
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-[#1e1e1e] overflow-hidden">
          <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.06) transparent' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#080808] border-b border-[#1a1a1a]">
                  {['Date', 'Symbol', 'Position', 'R', 'Grade', 'Regime', 'Session', 'Notes', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs text-[#333] font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trades.map(t => {
                  const outcome = classifyOutcome(t.realisedR);
                  return (
                    <tr key={t.id} className="border-t border-[#111] hover:bg-[#0d0d0d] transition-colors group">
                      <td className="px-4 py-3 text-xs text-[#666] whitespace-nowrap">{formatDate(t.date)}</td>
                      <td className="px-4 py-3 font-semibold text-white text-xs">{t.symbol}</td>
                      <td className="px-4 py-3 text-xs text-[#555]">{t.position}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-sm font-semibold font-mono ${t.realisedR > 0 ? 'text-[#00d28a]' : t.realisedR < 0 ? 'text-[#ff4f4f]' : 'text-[#888]'}`}>
                          {formatR(t.realisedR)}
                        </span>
                        <span className={`ml-2 text-xs px-1.5 py-0.5 rounded font-medium ${outcome === 'Win' ? 'bg-[#0a2e1a] text-[#00d28a]' : outcome === 'Loss' ? 'bg-[#2e0a0a] text-[#ff4f4f]' : 'bg-[#1a1500] text-[#ffd76e]'}`}>
                          {outcome}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {t.setupGrade ? (
                          <span className="text-xs px-2 py-0.5 rounded font-medium bg-[#0a180a] text-[#4dba77]">{t.setupGrade}</span>
                        ) : <span className="text-xs text-[#222]">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {t.regime ? (
                          <span className="text-xs px-2 py-0.5 rounded border border-[#1e1e1e] text-[#555]">{t.regime}</span>
                        ) : <span className="text-xs text-[#222]">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#444]">{t.session || '—'}</td>
                      <td className="px-4 py-3 text-xs text-[#444] max-w-[140px] truncate">{t.notes || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleEdit(t)} className="w-7 h-7 rounded-lg border border-[#1e1e1e] flex items-center justify-center text-[#555] hover:text-white hover:border-[#333] transition-colors">
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button onClick={() => handleDelete(t.id)} className="w-7 h-7 rounded-lg border border-[#1e1e1e] flex items-center justify-center text-[#555] hover:text-[#ff4f4f] hover:border-[#2e1010] transition-colors">
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
        </div>
      )}

      {/* Trade Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={e => e.target === e.currentTarget && (setIsFormOpen(false), setEditingId(null))}>
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[#1e1e1e] bg-[#0a0a0a]"
            style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.06) transparent' }}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#1a1a1a] sticky top-0 bg-[#0a0a0a] z-10">
              <div>
                <h2 className="text-sm font-semibold text-white">{editingId ? 'Edit Trade' : 'Log Data Trade'}</h2>
                <p className="text-xs text-[#444] mt-0.5">{protocol.name} · Research trade, separate from main journal</p>
              </div>
              <button onClick={() => (setIsFormOpen(false), setEditingId(null))} className="w-7 h-7 rounded-lg border border-[#1e1e1e] flex items-center justify-center text-[#444] hover:text-white transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Row 1: Date, Symbol, Position */}
              <div className="grid grid-cols-3 gap-3">
                {[{ label: 'Date *', type: 'date', key: 'date' }, { label: 'Symbol *', type: 'text', key: 'symbol', placeholder: 'e.g. EURUSD' }].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs text-[#444] mb-1.5">{f.label}</label>
                    <input type={f.type} value={(form as any)[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                      placeholder={(f as any).placeholder}
                      className="w-full bg-[#080808] border border-[#1e1e1e] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#2a2a2a]"
                      style={{ colorScheme: 'dark' }} />
                  </div>
                ))}
                <div>
                  <label className="block text-xs text-[#444] mb-1.5">Position</label>
                  <select value={form.position} onChange={e => setForm({ ...form, position: e.target.value })}
                    className="w-full bg-[#080808] border border-[#1e1e1e] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none" style={{ colorScheme: 'dark' }}>
                    <option>Long</option><option>Short</option>
                  </select>
                </div>
              </div>

              {/* Row 2: R values */}
              <div className="grid grid-cols-3 gap-3">
                {[{ label: 'Realised R *', key: 'realisedR', ph: 'e.g. -1 or 2' }, { label: 'Max R', key: 'maxR', ph: 'Optional' }, { label: 'Risk %', key: 'riskPercent', ph: 'e.g. 1' }].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs text-[#444] mb-1.5">{f.label}</label>
                    <input type="text" value={(form as any)[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} placeholder={f.ph}
                      className="w-full bg-[#080808] border border-[#1e1e1e] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#2a2a2a]" />
                  </div>
                ))}
              </div>

              {/* Row 3: Account/Model/Session/Grade + Regime */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Account', key: 'account', options: settings.accounts || [] },
                  { label: 'Session', key: 'session', options: settings.sessions || [] },
                  { label: 'Setup Grade', key: 'setupGrade', options: settings.setupGrades || [] },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs text-[#444] mb-1.5">{f.label}</label>
                    <select value={(form as any)[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                      className="w-full bg-[#080808] border border-[#1e1e1e] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none" style={{ colorScheme: 'dark' }}>
                      <option value="">Select</option>
                      {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              {/* Regime — key field */}
              <div>
                <label className="block text-xs text-[#444] mb-2">Market Regime <span className="text-[#333]">(helps filter performance by conditions)</span></label>
                <div className="flex flex-wrap gap-2">
                  {REGIMES.map(r => (
                    <button key={r} type="button" onClick={() => setForm(prev => ({ ...prev, regime: prev.regime === r ? '' : r }))}
                      className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${form.regime === r ? 'border-[#3b82f6] text-[#3b82f6] bg-[#0a1020]' : 'border-[#1e1e1e] text-[#444] hover:text-white'}`}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mistakes */}
              {settings.mistakes && settings.mistakes.length > 0 && (
                <div>
                  <label className="block text-xs text-[#444] mb-2">Mistakes</label>
                  <div className="flex flex-wrap gap-2">
                    {settings.mistakes.map(m => (
                      <button key={m} type="button" onClick={() => toggleTag('mistakes', m)}
                        className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${form.mistakes.includes(m) ? 'border-[#ff4f4f] text-[#ff4f4f] bg-[#1a0505]' : 'border-[#1e1e1e] text-[#444] hover:text-white'}`}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Screenshots */}
              <div>
                <label className="block text-xs text-[#444] mb-2">Screenshots</label>
                <div className="grid grid-cols-3 gap-2">
                  {([{ key: 'tradeImage', label: 'Entry' }, { key: 'tradeImage2', label: '4H' }, { key: 'tradeImage3', label: '1H' }] as const).map(slot => {
                    const val = (form as any)[slot.key];
                    return (
                      <div key={slot.key}>
                        {val ? (
                          <div className="relative rounded-xl overflow-hidden border border-[#1e1e1e] group/slot">
                            <img src={val} alt={slot.label} className="w-full object-cover cursor-pointer" style={{ height: '80px', objectFit: 'cover' }} onClick={() => setLightboxSrc(val)} />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/slot:opacity-100 transition-opacity flex items-center justify-center gap-1">
                              <button type="button" onClick={() => setForm(prev => ({ ...prev, [slot.key]: '' }))}
                                className="w-6 h-6 rounded bg-black/60 flex items-center justify-center text-[#ff4f4f]">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button type="button" onClick={() => document.getElementById(`pdt-img-${slot.key}`)?.click()}
                            className="w-full rounded-xl border border-dashed border-[#1e1e1e] flex flex-col items-center justify-center gap-1 text-[#333] hover:text-[#555] transition-colors"
                            style={{ height: '80px' }}>
                            <ImagePlus className="w-4 h-4" />
                            <span className="text-xs">{slot.label}</span>
                          </button>
                        )}
                        <input id={`pdt-img-${slot.key}`} type="file" accept="image/*" style={{ display: 'none' }}
                          onChange={async e => {
                            const file = e.target.files?.[0]; if (!file) return;
                            const b64 = await fileToBase64(file);
                            setForm(prev => ({ ...prev, [slot.key]: b64 }));
                            e.target.value = '';
                          }} />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs text-[#444] mb-1.5">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3}
                  placeholder="What conditions were present? What was the reason for outcome?"
                  className="w-full bg-[#080808] border border-[#1e1e1e] rounded-xl px-3 py-2.5 text-sm text-white resize-none focus:outline-none focus:border-[#2a2a2a]" />
              </div>

              <div className="flex gap-2 pt-1">
                <button type="submit" className="flex-1 py-3 rounded-xl bg-white text-black text-sm font-semibold hover:bg-[#e8e8e8] transition-colors">
                  {editingId ? 'Update Trade' : 'Log Trade'}
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

      {/* Lightbox */}
      {lightboxSrc && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60] p-4" onClick={() => setLightboxSrc(null)}>
          <button className="absolute top-4 right-4 w-9 h-9 rounded-xl border border-[#333] flex items-center justify-center text-[#888] hover:text-white bg-black/50" onClick={() => setLightboxSrc(null)}>
            <X className="w-4 h-4" />
          </button>
          <img src={lightboxSrc} alt="Full size" className="max-w-full max-h-full object-contain rounded-xl" style={{ maxHeight: '90vh' }} onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

// ─── Main Protocols Page ──────────────────────────────────────────────────────

export default function Protocols() {
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'notes' | 'data'>('notes');
  const [isCreating, setIsCreating] = useState(false);
  const [editingProtocol, setEditingProtocol] = useState<Protocol | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftDesc, setDraftDesc] = useState('');
  const [draftColor, setDraftColor] = useState(PROTOCOL_COLORS[0]);
  const [draftIcon, setDraftIcon] = useState(PROTOCOL_ICONS[0]);

  useEffect(() => {
    loadProtocols().then(p => {
      setProtocols(p);
      if (p.length > 0 && !selectedId) setSelectedId(p[0].id);
      setLoading(false);
    });
  }, []);

  const selected = protocols.find(p => p.id === selectedId) || null;

  const openCreate = () => {
    setEditingProtocol(null);
    setDraftName(''); setDraftDesc('');
    setDraftColor(PROTOCOL_COLORS[protocols.length % PROTOCOL_COLORS.length]);
    setDraftIcon(PROTOCOL_ICONS[protocols.length % PROTOCOL_ICONS.length]);
    setIsCreating(true);
  };

  const openEdit = (p: Protocol) => {
    setEditingProtocol(p);
    setDraftName(p.name); setDraftDesc(p.description);
    setDraftColor(p.color); setDraftIcon(p.icon);
    setIsCreating(true);
  };

  const handleSaveProtocol = async () => {
    if (!draftName.trim()) return;
    if (editingProtocol) {
      await updateProtocol(editingProtocol.id, { name: draftName, description: draftDesc, color: draftColor, icon: draftIcon });
      setProtocols(prev => prev.map(p => p.id === editingProtocol.id ? { ...p, name: draftName, description: draftDesc, color: draftColor, icon: draftIcon } : p));
    } else {
      const p = await createProtocol({ name: draftName, description: draftDesc, color: draftColor, icon: draftIcon, sortOrder: protocols.length });
      setProtocols(prev => [...prev, p]);
      setSelectedId(p.id);
    }
    setIsCreating(false);
  };

  const handleDeleteProtocol = async (id: string) => {
    if (!confirm('Delete this protocol and all its data?')) return;
    await deleteProtocol(id);
    setProtocols(prev => prev.filter(p => p.id !== id));
    if (selectedId === id) setSelectedId(protocols.find(p => p.id !== id)?.id || null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[#333] text-sm">Loading protocols...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── Left Sidebar ── */}
      <aside className="w-60 flex-shrink-0 flex flex-col border-r border-[#111]" style={{ background: '#070707' }}>
        <div className="px-4 pt-5 pb-4 border-b border-[#111]">
          <div className="flex items-center justify-between">
            <h1 className="text-sm font-semibold text-white tracking-tight">Protocols</h1>
            <button onClick={openCreate}
              className="w-6 h-6 rounded-lg flex items-center justify-center text-[#333] hover:text-white hover:bg-[#111] transition-colors">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-xs text-[#2a2a2a] mt-1">{protocols.length} protocol{protocols.length !== 1 ? 's' : ''}</p>
        </div>

        <nav className="flex-1 overflow-y-auto py-2" style={{ scrollbarWidth: 'none' }}>
          {protocols.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-xs text-[#2a2a2a] mb-3">No protocols yet</p>
              <button onClick={openCreate}
                className="text-xs text-[#333] hover:text-white transition-colors underline underline-offset-2">
                Create first protocol
              </button>
            </div>
          ) : protocols.map(p => (
            <button key={p.id}
              onClick={() => { setSelectedId(p.id); setActiveTab('notes'); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors relative group/nav ${selectedId === p.id ? 'bg-[#0f0f0f]' : 'hover:bg-[#0c0c0c]'}`}>
              {selectedId === p.id && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r-full" style={{ background: p.color }} />
              )}
              <span className="text-base flex-shrink-0">{p.icon}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium truncate ${selectedId === p.id ? 'text-white' : 'text-[#444]'}`}>{p.name}</p>
                {p.description && <p className="text-xs text-[#222] truncate mt-0.5">{p.description}</p>}
              </div>
              <div className="opacity-0 group-hover/nav:opacity-100 transition-opacity flex gap-0.5">
                <button onClick={e => { e.stopPropagation(); openEdit(p); }}
                  className="w-5 h-5 rounded flex items-center justify-center text-[#333] hover:text-[#666]">
                  <Edit2 className="w-2.5 h-2.5" />
                </button>
                <button onClick={e => { e.stopPropagation(); handleDeleteProtocol(p.id); }}
                  className="w-5 h-5 rounded flex items-center justify-center text-[#333] hover:text-[#ff4f4f]">
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </div>
            </button>
          ))}
        </nav>

        {/* Bottom hint */}
        <div className="px-4 py-3 border-t border-[#111]">
          <p className="text-xs text-[#1e1e1e]">Each protocol has notes + a data collection tab</p>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.06) transparent' }}>
        {!selected ? (
          <div className="h-full flex flex-col items-center justify-center gap-4">
            <div className="text-4xl mb-2">📋</div>
            <p className="text-white font-semibold">No protocol selected</p>
            <p className="text-[#333] text-sm text-center max-w-xs">Create a protocol to document your trading strategies and collect isolated performance data</p>
            <button onClick={openCreate}
              className="mt-2 px-5 py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-[#e8e8e8] transition-colors flex items-center gap-2">
              <Plus className="w-4 h-4" /> New Protocol
            </button>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto px-8 py-8">
            {/* Protocol Header */}
            <div className="mb-8">
              <div className="flex items-start justify-between mb-1">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{selected.icon}</span>
                  <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">{selected.name}</h1>
                    {selected.description && <p className="text-sm text-[#444] mt-0.5">{selected.description}</p>}
                  </div>
                </div>
                <button onClick={() => openEdit(selected)}
                  className="px-3 py-1.5 rounded-lg border border-[#1e1e1e] text-xs text-[#444] hover:text-white transition-colors flex items-center gap-1.5">
                  <Edit2 className="w-3 h-3" /> Edit
                </button>
              </div>
              {/* Color accent line */}
              <div className="mt-4 h-px" style={{ background: `linear-gradient(90deg, ${selected.color}40, transparent)` }} />
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-6 border-b border-[#111] pb-0">
              {[
                { id: 'notes' as const, label: 'Notes', icon: <FileText className="w-3.5 h-3.5" /> },
                { id: 'data' as const, label: 'Data Collection', icon: <BarChart2 className="w-3.5 h-3.5" /> },
              ].map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors -mb-px ${activeTab === tab.id
                    ? 'border-[#00d28a] text-white'
                    : 'border-transparent text-[#444] hover:text-[#666]'
                  }`}>
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {activeTab === 'notes' ? (
              <ProtocolNotesEditor key={selected.id} protocol={selected} />
            ) : (
              <ProtocolDataTab key={selected.id} protocol={selected} />
            )}
          </div>
        )}
      </main>

      {/* ── Create/Edit Protocol Modal ── */}
      {isCreating && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={e => e.target === e.currentTarget && setIsCreating(false)}>
          <div className="w-full max-w-md rounded-2xl border border-[#1e1e1e] bg-[#0a0a0a] overflow-hidden"
            style={{ boxShadow: '0 25px 80px rgba(0,0,0,0.9)' }}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#1a1a1a]">
              <h2 className="text-sm font-semibold text-white">{editingProtocol ? 'Edit Protocol' : 'New Protocol'}</h2>
              <button onClick={() => setIsCreating(false)} className="w-7 h-7 rounded-lg border border-[#1e1e1e] flex items-center justify-center text-[#444] hover:text-white transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              {/* Icon picker */}
              <div>
                <label className="block text-xs text-[#444] mb-2">Icon</label>
                <div className="flex flex-wrap gap-1.5">
                  {PROTOCOL_ICONS.map(icon => (
                    <button key={icon} type="button" onClick={() => setDraftIcon(icon)}
                      className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-colors ${draftIcon === icon ? 'bg-[#1a1a1a] ring-1 ring-[#333]' : 'hover:bg-[#111]'}`}>
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color picker */}
              <div>
                <label className="block text-xs text-[#444] mb-2">Color</label>
                <div className="flex gap-2">
                  {PROTOCOL_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setDraftColor(c)}
                      className={`w-6 h-6 rounded-full transition-transform ${draftColor === c ? 'scale-125 ring-2 ring-white/20' : 'hover:scale-110'}`}
                      style={{ background: c }} />
                  ))}
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs text-[#444] mb-1.5">Protocol Name *</label>
                <input value={draftName} onChange={e => setDraftName(e.target.value)}
                  placeholder="e.g. Trapped Orderflow Protocol"
                  className="w-full bg-[#080808] border border-[#1e1e1e] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#2a2a2a]"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleSaveProtocol()}
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs text-[#444] mb-1.5">Description <span className="text-[#2a2a2a]">(optional)</span></label>
                <input value={draftDesc} onChange={e => setDraftDesc(e.target.value)}
                  placeholder="Brief description of this protocol"
                  className="w-full bg-[#080808] border border-[#1e1e1e] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#2a2a2a]"
                />
              </div>

              {/* Preview */}
              <div className="rounded-xl border border-[#1e1e1e] bg-[#080808] px-4 py-3 flex items-center gap-3">
                <span className="text-2xl">{draftIcon}</span>
                <div>
                  <p className="text-sm font-semibold text-white">{draftName || 'Protocol name'}</p>
                  {draftDesc && <p className="text-xs text-[#444] mt-0.5">{draftDesc}</p>}
                </div>
                <div className="ml-auto w-2 h-2 rounded-full" style={{ background: draftColor }} />
              </div>

              <div className="flex gap-2">
                <button onClick={handleSaveProtocol} disabled={!draftName.trim()}
                  className="flex-1 py-3 rounded-xl bg-white text-black text-sm font-semibold hover:bg-[#e8e8e8] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  {editingProtocol ? 'Save Changes' : 'Create Protocol'}
                </button>
                <button onClick={() => setIsCreating(false)}
                  className="flex-1 py-3 rounded-xl border border-[#1e1e1e] text-sm text-[#555] hover:text-white transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
