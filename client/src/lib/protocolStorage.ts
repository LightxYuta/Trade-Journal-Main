import { supabase } from './supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Protocol {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export type BlockType =
  | 'heading1' | 'heading2' | 'heading3'
  | 'paragraph' | 'bulletList' | 'numberedList'
  | 'table' | 'image' | 'divider' | 'callout';

export interface TableMeta { headers: string[]; rows: string[][] }
export interface ImageMeta { url: string; caption: string; storagePath?: string }
export interface CalloutMeta { icon: string; color: string }

export interface ProtocolBlock {
  id: string;
  protocolId: string;
  type: BlockType;
  content: string;
  metadata: TableMeta | ImageMeta | CalloutMeta | Record<string, unknown>;
  sortOrder: number;
  createdAt: number;
}

export interface ProtocolTrade {
  id: string;
  protocolId: string;
  date: string;
  symbol: string;
  account: string;
  model: string;
  session: string;
  entryTF: string;
  position: string;
  riskPercent: number | null;
  realisedR: number;
  maxR: number | null;
  setupGrade: string;
  keyLevels: string[];
  mistakes: string[];
  screenshots: string;
  notes: string;
  regime: string;
  createdAt: number;
}

// ─── Protocols CRUD ──────────────────────────────────────────────────────────

export async function loadProtocols(): Promise<Protocol[]> {
  const { data, error } = await supabase
    .from('protocols')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data || []).map(r => ({
    id: r.id,
    name: r.name,
    description: r.description || '',
    color: r.color || '#00d28a',
    icon: r.icon || '📋',
    sortOrder: r.sort_order || 0,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function createProtocol(data: Omit<Protocol, 'id' | 'createdAt' | 'updatedAt'>): Promise<Protocol> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not logged in');
  const now = Date.now();
  const id = crypto.randomUUID();
  const row = {
    id,
    user_id: user.id,
    name: data.name,
    description: data.description,
    color: data.color,
    icon: data.icon,
    sort_order: data.sortOrder,
    created_at: now,
    updated_at: now,
  };
  const { error } = await supabase.from('protocols').insert(row);
  if (error) throw error;
  return { ...data, id, createdAt: now, updatedAt: now };
}

export async function updateProtocol(id: string, updates: Partial<Protocol>): Promise<void> {
  const row: Record<string, unknown> = { updated_at: Date.now() };
  if (updates.name !== undefined) row.name = updates.name;
  if (updates.description !== undefined) row.description = updates.description;
  if (updates.color !== undefined) row.color = updates.color;
  if (updates.icon !== undefined) row.icon = updates.icon;
  if (updates.sortOrder !== undefined) row.sort_order = updates.sortOrder;
  const { error } = await supabase.from('protocols').update(row).eq('id', id);
  if (error) throw error;
}

export async function deleteProtocol(id: string): Promise<void> {
  const { error } = await supabase.from('protocols').delete().eq('id', id);
  if (error) throw error;
}

// ─── Protocol Notes Content (BlockNote document) ─────────────────────────────

export async function loadProtocolContent(protocolId: string): Promise<unknown[] | null> {
  const { data, error } = await supabase
    .from('protocols')
    .select('content')
    .eq('id', protocolId)
    .maybeSingle();
  if (error) throw error;
  return (data?.content as unknown[]) || null;
}

export async function saveProtocolContent(protocolId: string, content: unknown[]): Promise<void> {
  const { error } = await supabase.from('protocols').update({ content, updated_at: Date.now() }).eq('id', protocolId);
  if (error) throw error;
}

// ─── Blocks CRUD ─────────────────────────────────────────────────────────────

export async function loadBlocks(protocolId: string): Promise<ProtocolBlock[]> {
  const { data, error } = await supabase
    .from('protocol_blocks')
    .select('*')
    .eq('protocol_id', protocolId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data || []).map(r => ({
    id: r.id,
    protocolId: r.protocol_id,
    type: r.type as BlockType,
    content: r.content || '',
    metadata: r.metadata || {},
    sortOrder: r.sort_order || 0,
    createdAt: r.created_at,
  }));
}

export async function saveBlock(block: ProtocolBlock): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not logged in');
  await supabase.from('protocol_blocks').upsert({
    id: block.id,
    user_id: user.id,
    protocol_id: block.protocolId,
    type: block.type,
    content: block.content,
    metadata: block.metadata,
    sort_order: block.sortOrder,
    created_at: block.createdAt,
  });
}

export async function saveBlocks(blocks: ProtocolBlock[]): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not logged in');
  if (!blocks.length) return;
  const rows = blocks.map(b => ({
    id: b.id,
    user_id: user.id,
    protocol_id: b.protocolId,
    type: b.type,
    content: b.content,
    metadata: b.metadata,
    sort_order: b.sortOrder,
    created_at: b.createdAt,
  }));
  await supabase.from('protocol_blocks').upsert(rows);
}

export async function deleteBlock(id: string): Promise<void> {
  await supabase.from('protocol_blocks').delete().eq('id', id);
}

// ─── Protocol Trades CRUD ────────────────────────────────────────────────────

export async function loadProtocolTrades(protocolId: string): Promise<ProtocolTrade[]> {
  const { data, error } = await supabase
    .from('protocol_trades')
    .select('*')
    .eq('protocol_id', protocolId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(r => ({
    id: r.id,
    protocolId: r.protocol_id,
    date: r.date,
    symbol: r.symbol,
    account: r.account || '',
    model: r.model || '',
    session: r.session || '',
    entryTF: r.entry_tf || '',
    position: r.position || 'Long',
    riskPercent: r.risk_percent,
    realisedR: r.realised_r,
    maxR: r.max_r,
    setupGrade: r.setup_grade || '',
    keyLevels: r.key_levels || [],
    mistakes: r.mistakes || [],
    screenshots: r.screenshots || '',
    notes: r.notes || '',
    regime: r.regime || '',
    createdAt: r.created_at,
  }));
}

export async function addProtocolTrade(trade: Omit<ProtocolTrade, 'id'>): Promise<ProtocolTrade> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not logged in');
  const id = crypto.randomUUID();
  const row = {
    id,
    user_id: user.id,
    protocol_id: trade.protocolId,
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
    regime: trade.regime,
    created_at: trade.createdAt || Date.now(),
  };
  const { error } = await supabase.from('protocol_trades').insert(row);
  if (error) throw error;
  return { ...trade, id };
}

export async function updateProtocolTrade(id: string, updates: Partial<ProtocolTrade>): Promise<void> {
  const row: Record<string, unknown> = {};
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
  if (updates.regime !== undefined) row.regime = updates.regime;
  const { error } = await supabase.from('protocol_trades').update(row).eq('id', id);
  if (error) throw error;
}

export async function deleteProtocolTrade(id: string): Promise<void> {
  const { error } = await supabase.from('protocol_trades').delete().eq('id', id);
  if (error) throw error;
}

// ─── Image upload for protocols ──────────────────────────────────────────────

export async function uploadProtocolImage(file: File): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not logged in');

  // Compress
  const compressed: Blob = await new Promise(resolve => {
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
      canvas.toBlob(b => resolve(b!), 'image/jpeg', 0.80);
    };
    img.src = url;
  });

  const path = `protocols/${user.id}/${Date.now()}.jpg`;
  const { error } = await supabase.storage.from('trade-charts').upload(path, compressed, { contentType: 'image/jpeg' });
  if (error) throw error;

  const { data } = await supabase.storage.from('trade-charts').createSignedUrl(path, 60 * 60 * 24 * 365);
  return data?.signedUrl || path;
}
