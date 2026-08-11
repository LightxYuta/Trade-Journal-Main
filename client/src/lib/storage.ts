import { supabase } from './supabase';
import type { Trade, Settings, CustomFieldDef, CustomFieldValues } from '@shared/schema';

export const DEFAULT_SETTINGS: Omit<Settings, 'id'> = {
  accounts: ['5K Evaluation', '5K Funded', '10K Challenge', '25K Challenge', '50K Challenge', '100K Challenge', 'Demo'],
  models: ['Continuation Model', 'Retracement Model'],
  sessions: ['London', 'Asia', 'London Lunch', 'NY'],
  entryTFs: ['5 Min', '15 Min', '3 Min'],
  setupGrades: ['A+', 'A', 'B', 'Retard'],
  keyLevels: ['1H', '4H', 'M30'],
  mistakes: ['Against 1H OF', '1H Consolidation', 'Trapped OF', 'Overextended Prev Session/Day'],
  nonNegotiableMistakes: [],
  tiltThreshold: 2,
  customFields: [],
};

// ─── Custom field value helpers ───────────────────────────────────────────────
// customFieldValues is persisted as a JSON string (custom_field_values column)
// but used as a parsed object everywhere else in the app.

export function parseCustomFieldValues(raw: string | null | undefined): CustomFieldValues {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch { return {}; }
}

export function stringifyCustomFieldValues(values: CustomFieldValues | null | undefined): string {
  if (!values || Object.keys(values).length === 0) return '';
  return JSON.stringify(values);
}

// ─── Cache Management ────────────────────────────────────────────────────────

const CACHE_DURATION = 30000; // 30 seconds
let tradesCache: Trade[] | null = null;
let tradesCacheTime = 0;
let biasCache: { [key: string]: any } | null = null;
let biasCacheTime = 0;

function invalidateTradesCache() {
  tradesCache = null;
  tradesCacheTime = 0;
}

function invalidateBiasCache() {
  biasCache = null;
  biasCacheTime = 0;
}

// ─── Image helpers ───────────────────────────────────────────────────────────

async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxW = 1920;
      const scale = Math.min(1, maxW / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.75);
    };
    img.src = url;
  });
}

export async function uploadImage(file: File): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not logged in');

  const compressed = await compressImage(file);
  const path = `${user.id}/${Date.now()}.jpg`;

  const { error } = await supabase.storage
    .from('trade-charts')
    .upload(path, compressed, { contentType: 'image/jpeg' });

  if (error) throw error;
  return path;
}

export async function getImageUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('trade-charts')
    .createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteImage(path: string): Promise<void> {
  await supabase.storage.from('trade-charts').remove([path]);
}

// ─── Trades ──────────────────────────────────────────────────────────────────

export async function loadTrades(): Promise<Trade[]> {
  // Return cached trades if fresh
  if (tradesCache && Date.now() - tradesCacheTime < CACHE_DURATION) {
    return tradesCache;
  }

  const { data, error } = await supabase
    .from('trades')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(500); // Load max 500 trades for performance
  
  if (error) throw error;
  
  const trades = (data || []).map(row => ({
    ...row,
    entryTF: row.entry_tf,
    riskPercent: row.risk_percent == null ? null : Number(row.risk_percent),
    realisedR: Number(row.realised_r ?? 0),
    maxR: row.max_r == null ? null : Number(row.max_r),
    setupGrade: row.setup_grade,
    keyLevels: row.key_levels || [],
    mistakes: row.mistakes || [],
    protocolId: row.protocol_id || null,
    customFieldValues: parseCustomFieldValues(row.custom_field_values),
    createdAt: Number(row.created_at),
  }));
  
  tradesCache = trades;
  tradesCacheTime = Date.now();
  return trades;
}

// Trades logged in the journal that have been linked to a given protocol.
// Reads from the same `trades` table (filtered by protocol_id), distinct
// from the standalone `protocol_trades` research log used inside Protocols.
export async function loadTradesByProtocol(protocolId: string): Promise<Trade[]> {
  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .eq('protocol_id', protocolId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(row => ({
    ...row,
    entryTF: row.entry_tf,
    riskPercent: row.risk_percent == null ? null : Number(row.risk_percent),
    realisedR: Number(row.realised_r ?? 0),
    maxR: row.max_r == null ? null : Number(row.max_r),
    setupGrade: row.setup_grade,
    keyLevels: row.key_levels || [],
    mistakes: row.mistakes || [],
    protocolId: row.protocol_id || null,
    customFieldValues: parseCustomFieldValues(row.custom_field_values),
    createdAt: Number(row.created_at),
  }));
}

export async function addTrade(trade: Omit<Trade, 'id'>): Promise<Trade> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not logged in');

  const id = crypto.randomUUID();
  const row = {
    id,
    user_id: user.id,
    date: trade.date,
    symbol: trade.symbol,
    account: trade.account,
    model: trade.model,
    session: trade.session,
    entry_tf: trade.entryTF,
    position: trade.position,
    risk_percent: trade.riskPercent,
    realised_r: trade.realisedR,
    max_r: trade.maxR,
    setup_grade: trade.setupGrade,
    key_levels: trade.keyLevels,
    mistakes: trade.mistakes,
    screenshots: trade.screenshots,
    notes: trade.notes,
    protocol_id: trade.protocolId || null,
    custom_field_values: stringifyCustomFieldValues(trade.customFieldValues),
    created_at: trade.createdAt || Date.now(),
  };

  const { error } = await supabase.from('trades').insert(row);
  if (error) throw error;
  
  invalidateTradesCache();
  return { ...trade, id };
}

export async function updateTrade(id: string, updates: Partial<Trade>): Promise<Trade | null> {
  const row: any = {};
  if (updates.date !== undefined) row.date = updates.date;
  if (updates.symbol !== undefined) row.symbol = updates.symbol;
  if (updates.account !== undefined) row.account = updates.account;
  if (updates.model !== undefined) row.model = updates.model;
  if (updates.session !== undefined) row.session = updates.session;
  if (updates.entryTF !== undefined) row.entry_tf = updates.entryTF;
  if (updates.position !== undefined) row.position = updates.position;
  if (updates.riskPercent !== undefined) row.risk_percent = updates.riskPercent;
  if (updates.realisedR !== undefined) row.realised_r = updates.realisedR;
  if (updates.maxR !== undefined) row.max_r = updates.maxR;
  if (updates.setupGrade !== undefined) row.setup_grade = updates.setupGrade;
  if (updates.keyLevels !== undefined) row.key_levels = updates.keyLevels;
  if (updates.mistakes !== undefined) row.mistakes = updates.mistakes;
  if (updates.screenshots !== undefined) row.screenshots = updates.screenshots;
  if (updates.notes !== undefined) row.notes = updates.notes;
  if (updates.protocolId !== undefined) row.protocol_id = updates.protocolId || null;
  if (updates.customFieldValues !== undefined) row.custom_field_values = stringifyCustomFieldValues(updates.customFieldValues);

  const { error } = await supabase.from('trades').update(row).eq('id', id);
  if (error) throw error;

  invalidateTradesCache();
  
  // Query only the updated trade instead of all trades
  const { data, error: selectError } = await supabase
    .from('trades')
    .select('*')
    .eq('id', id)
    .single();
  
  if (selectError || !data) return null;
  
  return {
    ...data,
    entryTF: data.entry_tf,
    riskPercent: data.risk_percent,
    realisedR: data.realised_r,
    maxR: data.max_r,
    setupGrade: data.setup_grade,
    keyLevels: data.key_levels || [],
    mistakes: data.mistakes || [],
    protocolId: data.protocol_id || null,
    customFieldValues: parseCustomFieldValues(data.custom_field_values),
    createdAt: data.created_at,
  };
}

export async function deleteTrade(id: string): Promise<boolean> {
  const { error } = await supabase.from('trades').delete().eq('id', id);
  if (error) throw error;
  invalidateTradesCache();
  return true;
}

export async function clearAllTrades(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not logged in');
  await supabase.from('trades').delete().eq('user_id', user.id);
  invalidateTradesCache();
}

// ─── Settings ────────────────────────────────────────────────────────────────

export async function loadSettings(): Promise<Omit<Settings, 'id'>> {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .single();
  if (error || !data) return { ...DEFAULT_SETTINGS };
  let customFields: CustomFieldDef[] = [];
  try {
    if (data.custom_fields) {
      const parsed = JSON.parse(data.custom_fields);
      if (Array.isArray(parsed)) customFields = parsed;
    }
  } catch {}
  return {
    accounts: data.accounts || DEFAULT_SETTINGS.accounts,
    models: data.models || DEFAULT_SETTINGS.models,
    sessions: data.sessions || DEFAULT_SETTINGS.sessions,
    entryTFs: data.entry_tfs || DEFAULT_SETTINGS.entryTFs,
    setupGrades: data.setup_grades || DEFAULT_SETTINGS.setupGrades,
    keyLevels: data.key_levels || DEFAULT_SETTINGS.keyLevels,
    mistakes: data.mistakes || DEFAULT_SETTINGS.mistakes,
    nonNegotiableMistakes: data.non_negotiable_mistakes || [],
    tiltThreshold: data.tilt_threshold ?? DEFAULT_SETTINGS.tiltThreshold,
    customFields,
  };
}

export async function saveSettings(settings: Omit<Settings, 'id'>): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not logged in');

  const row = {
    user_id: user.id,
    accounts: settings.accounts,
    models: settings.models,
    sessions: settings.sessions,
    entry_tfs: settings.entryTFs,
    setup_grades: settings.setupGrades,
    key_levels: settings.keyLevels,
    mistakes: settings.mistakes,
    non_negotiable_mistakes: settings.nonNegotiableMistakes || [],
    tilt_threshold: settings.tiltThreshold,
    custom_fields: settings.customFields && settings.customFields.length > 0 ? JSON.stringify(settings.customFields) : null,
  };

  await supabase.from('settings').upsert(row, { onConflict: 'user_id' });
}

export async function resetSettings(): Promise<void> {
  await saveSettings({ ...DEFAULT_SETTINGS });
}

export async function fullReset(): Promise<void> {
  await clearAllTrades();
  await saveSettings({ ...DEFAULT_SETTINGS });
}

// ─── Trade Templates ────────────────────────────────────────────────────────
// Quick-fill presets for trades that "look the same" — saved locally per
// device since they're just a data-entry shortcut, not core journal data.

const TRADE_TEMPLATES_KEY = 'tj_trade_templates_v1';

export interface TradeTemplate {
  id: string;
  name: string;
  data: {
    symbol: string; account: string; model: string; session: string; entryTF: string;
    position: string; riskPercent: string; setupGrade: string;
    keyLevels: string[]; mistakes: string[]; protocolId: string;
    customFieldValues: CustomFieldValues;
    notes: string;
  };
  createdAt: number;
}

export function loadTradeTemplates(): TradeTemplate[] {
  try {
    const raw = localStorage.getItem(TRADE_TEMPLATES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export function saveTradeTemplate(template: TradeTemplate): TradeTemplate[] {
  const existing = loadTradeTemplates();
  const updated = [template, ...existing];
  try { localStorage.setItem(TRADE_TEMPLATES_KEY, JSON.stringify(updated)); } catch {}
  return updated;
}

export function deleteTradeTemplate(id: string): TradeTemplate[] {
  const updated = loadTradeTemplates().filter(t => t.id !== id);
  try { localStorage.setItem(TRADE_TEMPLATES_KEY, JSON.stringify(updated)); } catch {}
  return updated;
}

// ─── Daily Bias ───────────────────────────────────────────────────────────────

export interface BiasEntry {
  id: string;
  date: string;
  asset: string;
  text: string;
  images: string[];
  createdAt: number;
}

export async function loadBiasEntries(): Promise<BiasEntry[]> {
  // Return cached bias if fresh
  if (biasCache && Date.now() - biasCacheTime < CACHE_DURATION) {
    return biasCache;
  }

  const { data, error } = await supabase
    .from('daily_bias')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200); // Limit for performance
  
  if (error) throw error;
  
  const bias = (data || []).map(row => ({
    id: row.id,
    date: row.date,
    asset: row.asset || '',
    text: row.text || '',
    images: row.images || [],
    createdAt: row.created_at,
  }));
  
  biasCache = bias;
  biasCacheTime = Date.now();
  return bias;
}

export async function saveBiasEntry(entry: BiasEntry): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not logged in');

  await supabase.from('daily_bias').upsert({
    id: entry.id,
    user_id: user.id,
    date: entry.date,
    asset: entry.asset,
    text: entry.text,
    images: entry.images,
    created_at: entry.createdAt,
  });
  
  invalidateBiasCache();
}

export async function deleteBiasEntry(id: string): Promise<void> {
  await supabase.from('daily_bias').delete().eq('id', id);
  invalidateBiasCache();
}
