import { supabase } from './supabase';
import type { Trade } from '@shared/schema';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Bias = 'Bullish' | 'Bearish' | 'Neutral';
export type RiskTier = 'full' | 'half' | 'none';
export type SetupGrade = 'A+' | 'A' | 'B' | 'Retard';

// How much risk is allowed at each grade for a given asset plan.
// e.g. { aplus: 'full', a: 'half', b: 'none', retard: 'none' }
export interface GradeRule {
  aplus: RiskTier;
  a: RiskTier;
  b: RiskTier;
  retard: RiskTier;
}

export const DEFAULT_GRADE_RULE: GradeRule = {
  aplus: 'full',
  a: 'half',
  b: 'none',
  retard: 'none',
};

export type Adherence = 'adherent' | 'deviated' | null;

// BlockNote stores its document as an array of Block objects (JSON-serializable).
// We keep it loosely typed here so this file doesn't depend on @blocknote/core.
export type BlockNoteDoc = unknown[];

export const EMPTY_DOC: BlockNoteDoc = [];

export interface DayPlan {
  id: string;
  date: string; // 'YYYY-MM-DD'
  createdAt: number;
  isManual: boolean;
}

export interface AssetPlan {
  id: string;
  dayPlanId: string;
  symbol: string;
  bias: Bias | null;
  gradeRule: GradeRule;
  tookTrade: boolean;
  content: BlockNoteDoc;
  reconciliation: BlockNoteDoc;
  adherence: Adherence;
  deviationReason: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface MonthCover {
  year: number;
  month: number; // 1-12
  imageUrl: string;
}

export const TRADED_SYMBOLS = ['XAUUSD', 'EURUSD', 'GBPUSD', 'DAX'] as const;
export type TradedSymbol = typeof TRADED_SYMBOLS[number];

// ─── Day-state used for calendar dimming/glowing ─────────────────────────────

export type DayVisualState = 'no-plan-no-trade' | 'planless-trading' | 'normal';

export function isWeekend(dateStr: string): boolean {
  // dateStr = 'YYYY-MM-DD', parsed as local date (not UTC) to avoid off-by-one
  const [y, m, d] = dateStr.split('-').map(Number);
  const day = new Date(y, m - 1, d).getDay();
  return day === 0 || day === 6;
}

async function currentUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not logged in');
  return user.id;
}

// ─── Day plans ────────────────────────────────────────────────────────────────

export async function getOrCreateDayPlan(date: string, isManual = false): Promise<DayPlan> {
  const userId = await currentUserId();
  const { data: existing, error: findErr } = await supabase
    .from('day_plans')
    .select('*')
    .eq('date', date)
    .maybeSingle();
  if (findErr) throw findErr;
  if (existing) {
    return { id: existing.id, date: existing.date, createdAt: existing.created_at, isManual: existing.is_manual };
  }
  const id = crypto.randomUUID();
  const row = { id, user_id: userId, date, created_at: Date.now(), is_manual: isManual };
  const { error } = await supabase.from('day_plans').insert(row);
  if (error) throw error;
  return { id, date, createdAt: row.created_at, isManual };
}

export async function loadDayPlansInRange(startDate: string, endDate: string): Promise<DayPlan[]> {
  const { data, error } = await supabase
    .from('day_plans')
    .select('*')
    .gte('date', startDate)
    .lte('date', endDate);
  if (error) throw error;
  return (data || []).map(r => ({ id: r.id, date: r.date, createdAt: r.created_at, isManual: r.is_manual }));
}

// ─── Asset plans ──────────────────────────────────────────────────────────────

export async function loadAssetPlans(dayPlanId: string): Promise<AssetPlan[]> {
  const { data, error } = await supabase
    .from('asset_plans')
    .select('*')
    .eq('day_plan_id', dayPlanId)
    .order('symbol', { ascending: true });
  if (error) throw error;
  return (data || []).map(rowToAssetPlan);
}

export async function loadAssetPlansInRange(startDate: string, endDate: string): Promise<AssetPlan[]> {
  // Joins through day_plans since asset_plans has no date column directly.
  const days = await loadDayPlansInRange(startDate, endDate);
  if (!days.length) return [];
  const { data, error } = await supabase
    .from('asset_plans')
    .select('*')
    .in('day_plan_id', days.map(d => d.id));
  if (error) throw error;
  return (data || []).map(rowToAssetPlan);
}

function rowToAssetPlan(r: any): AssetPlan {
  return {
    id: r.id,
    dayPlanId: r.day_plan_id,
    symbol: r.symbol,
    bias: r.bias || null,
    gradeRule: r.grade_rule && Object.keys(r.grade_rule).length ? r.grade_rule : DEFAULT_GRADE_RULE,
    tookTrade: r.took_trade,
    content: r.content || [],
    reconciliation: r.reconciliation || [],
    adherence: r.adherence,
    deviationReason: r.deviation_reason,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function createAssetPlan(dayPlanId: string, symbol: string, template: BlockNoteDoc): Promise<AssetPlan> {
  const userId = await currentUserId();
  const id = crypto.randomUUID();
  const now = Date.now();
  const row = {
    id,
    user_id: userId,
    day_plan_id: dayPlanId,
    symbol,
    bias: null,
    grade_rule: DEFAULT_GRADE_RULE,
    took_trade: false,
    content: template,
    reconciliation: [],
    adherence: null,
    deviation_reason: null,
    created_at: now,
    updated_at: now,
  };
  const { error } = await supabase.from('asset_plans').insert(row);
  if (error) throw error;
  return rowToAssetPlan(row);
}

export async function updateAssetPlan(id: string, updates: Partial<AssetPlan>): Promise<void> {
  const row: Record<string, unknown> = { updated_at: Date.now() };
  if (updates.bias !== undefined) row.bias = updates.bias;
  if (updates.gradeRule !== undefined) row.grade_rule = updates.gradeRule;
  if (updates.tookTrade !== undefined) row.took_trade = updates.tookTrade;
  if (updates.content !== undefined) row.content = updates.content;
  if (updates.reconciliation !== undefined) row.reconciliation = updates.reconciliation;
  if (updates.adherence !== undefined) row.adherence = updates.adherence;
  if (updates.deviationReason !== undefined) row.deviation_reason = updates.deviationReason;
  const { error } = await supabase.from('asset_plans').update(row).eq('id', id);
  if (error) throw error;
}

export async function deleteAssetPlan(id: string): Promise<void> {
  const { error } = await supabase.from('asset_plans').delete().eq('id', id);
  if (error) throw error;
}

// ─── Templates ────────────────────────────────────────────────────────────────

export async function loadTemplate(symbol: string): Promise<BlockNoteDoc> {
  const { data, error } = await supabase
    .from('plan_templates')
    .select('*')
    .eq('symbol', symbol)
    .maybeSingle();
  if (error) throw error;
  if (data) return data.content;
  // fall back to universal default template if one exists
  const { data: fallback } = await supabase
    .from('plan_templates')
    .select('*')
    .eq('symbol', '*')
    .maybeSingle();
  return fallback?.content || EMPTY_DOC;
}

export async function saveTemplate(symbol: string, content: BlockNoteDoc): Promise<void> {
  const userId = await currentUserId();
  const { data: existing } = await supabase
    .from('plan_templates')
    .select('id')
    .eq('symbol', symbol)
    .maybeSingle();
  const row = { user_id: userId, symbol, content, updated_at: Date.now() };
  if (existing) {
    const { error } = await supabase.from('plan_templates').update(row).eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('plan_templates').insert({ id: crypto.randomUUID(), ...row });
    if (error) throw error;
  }
}

// ─── Month covers ─────────────────────────────────────────────────────────────

export async function loadMonthCover(year: number, month: number): Promise<string | null> {
  const { data, error } = await supabase
    .from('month_covers')
    .select('image_url')
    .eq('year', year).eq('month', month)
    .maybeSingle();
  if (error) throw error;
  return data?.image_url || null;
}

export async function setMonthCover(year: number, month: number, imageUrl: string): Promise<void> {
  const userId = await currentUserId();
  const { data: existing } = await supabase
    .from('month_covers')
    .select('id')
    .eq('year', year).eq('month', month)
    .maybeSingle();
  if (existing) {
    const { error } = await supabase.from('month_covers').update({ image_url: imageUrl }).eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('month_covers').insert({
      id: crypto.randomUUID(), user_id: userId, year, month, image_url: imageUrl, created_at: Date.now(),
    });
    if (error) throw error;
  }
}

// Reuses the same compress-then-upload pattern as uploadProtocolImage.
export async function uploadMonthCoverImage(file: File, year: number, month: number): Promise<string> {
  const userId = await currentUserId();
  const compressed: Blob = await new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxW = 1200;
      const scale = Math.min(1, maxW / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(b => resolve(b!), 'image/jpeg', 0.82);
    };
    img.src = url;
  });
  const path = `months/${userId}/${year}-${month}.jpg`;
  const { error } = await supabase.storage.from('trade-charts').upload(path, compressed, {
    contentType: 'image/jpeg', upsert: true,
  });
  if (error) throw error;
  const { data } = await supabase.storage.from('trade-charts').createSignedUrl(path, 60 * 60 * 24 * 365);
  return data?.signedUrl || path;
}

// ─── Adherence computation ────────────────────────────────────────────────────
// This is the core enforcement logic. Deliberately kept in one function so
// tweaking the rules later (e.g. adding a new grade tier) only touches here.

function gradeKey(grade: string | null | undefined): keyof GradeRule | null {
  switch ((grade || '').trim()) {
    case 'A+': return 'aplus';
    case 'A': return 'a';
    case 'B': return 'b';
    case 'Retard': return 'retard';
    default: return null;
  }
}

// A trade's risk_percent is compared against the account's "full risk" baseline.
// Since risk baselines vary by account/challenge, "half" is treated as anything
// <= 60% of the full-risk trade's size that day, and "full" as > 60%, using the
// asset plan's own trades that day as the reference set. If only one trade
// exists that day, we can't compare relative sizing, so grade-floor check alone
// applies (sizing check is skipped, not auto-failed).
function checkTradeAgainstRule(trade: Trade, rule: GradeRule, maxRiskThatDay: number): 'adherent' | 'deviated' {
  const key = gradeKey(trade.setupGrade);
  if (!key) return 'deviated'; // ungraded trade against a graded plan = flag it, don't guess
  const allowed = rule[key];
  if (allowed === 'none') return 'deviated';
  if (allowed === 'full') return 'adherent'; // any size fine at full-risk tier
  // allowed === 'half': the trade's risk must be meaningfully smaller than that day's max
  if (!trade.riskPercent || !maxRiskThatDay) return 'adherent'; // can't compare, don't punish
  return trade.riskPercent <= maxRiskThatDay * 0.6 ? 'adherent' : 'deviated';
}

/**
 * Computes adherence for a single asset plan given that day's trades
 * (already filtered to the matching date + symbol by the caller).
 */
export function computeAdherence(plan: Pick<AssetPlan, 'tookTrade' | 'gradeRule'>, dayTrades: Trade[]): Adherence {
  if (!dayTrades.length) {
    // No trades logged for this asset that date.
    return plan.tookTrade ? 'deviated' : 'adherent';
  }
  const maxRisk = Math.max(...dayTrades.map(t => t.riskPercent || 0));
  const results = dayTrades.map(t => checkTradeAgainstRule(t, plan.gradeRule, maxRisk));
  return results.some(r => r === 'deviated') ? 'deviated' : 'adherent';
}

/**
 * Recomputes and persists adherence for one asset plan by pulling matching
 * trades from the `trades` table. Call this after the trading day closes
 * (or on-demand when the user opens the reconciliation section).
 */
export async function recomputeAdherence(assetPlan: AssetPlan, date: string): Promise<Adherence> {
  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .eq('date', date)
    .eq('symbol', assetPlan.symbol);
  if (error) throw error;
  const trades = (data || []) as unknown as Trade[];
  const adherence = computeAdherence(assetPlan, trades);
  await updateAssetPlan(assetPlan.id, { adherence });
  return adherence;
}

// ─── Calendar day visual state ────────────────────────────────────────────────

export async function getDayVisualState(date: string, dayPlanId: string | null): Promise<DayVisualState> {
  if (!dayPlanId) {
    // No day_plan row at all -> definitely no plan. Check if trades exist anyway.
    const { count } = await supabase
      .from('trades').select('*', { count: 'exact', head: true }).eq('date', date);
    return (count || 0) > 0 ? 'planless-trading' : 'no-plan-no-trade';
  }
  const assetPlans = await loadAssetPlans(dayPlanId);
  const hasContent = assetPlans.some(p => p.content && p.content.length > 0 || p.bias || p.tookTrade);
  if (hasContent) return 'normal';
  const { count } = await supabase
    .from('trades').select('*', { count: 'exact', head: true }).eq('date', date);
  return (count || 0) > 0 ? 'planless-trading' : 'no-plan-no-trade';
}

// ─── Bulk month data (avoids N+1 queries when rendering a calendar grid) ────

export async function loadTradeDatesInRange(startDate: string, endDate: string): Promise<Record<string, number>> {
  const { data, error } = await supabase.from('trades').select('date').gte('date', startDate).lte('date', endDate);
  if (error) throw error;
  const counts: Record<string, number> = {};
  (data || []).forEach((r: any) => { counts[r.date] = (counts[r.date] || 0) + 1; });
  return counts;
}

export interface MonthData {
  dayPlans: Record<string, DayPlan>;           // date -> DayPlan
  assetPlansByDate: Record<string, AssetPlan[]>; // date -> AssetPlan[]
  tradeCounts: Record<string, number>;          // date -> # trades logged
}

function monthDateRange(year: number, month: number): [string, string] {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return [start, end];
}

export async function loadMonthData(year: number, month: number): Promise<MonthData> {
  const [start, end] = monthDateRange(year, month);
  const [dayPlansArr, assetPlansArr, tradeCounts] = await Promise.all([
    loadDayPlansInRange(start, end),
    loadAssetPlansInRange(start, end),
    loadTradeDatesInRange(start, end),
  ]);
  const dayPlans: Record<string, DayPlan> = {};
  const idToDate: Record<string, string> = {};
  dayPlansArr.forEach(dp => { dayPlans[dp.date] = dp; idToDate[dp.id] = dp.date; });
  const assetPlansByDate: Record<string, AssetPlan[]> = {};
  assetPlansArr.forEach(ap => {
    const date = idToDate[ap.dayPlanId];
    if (!date) return;
    (assetPlansByDate[date] ||= []).push(ap);
  });
  return { dayPlans, assetPlansByDate, tradeCounts };
}

export function dayVisualStateFromData(date: string, data: MonthData): DayVisualState {
  const plans = data.assetPlansByDate[date] || [];
  const hasContent = plans.some(p => (p.content && p.content.length > 0) || p.bias || p.tookTrade);
  if (hasContent) return 'normal';
  return (data.tradeCounts[date] || 0) > 0 ? 'planless-trading' : 'no-plan-no-trade';
}

// A week (Mon-Fri) "adherent" fraction + planless count, computed from
// already-loaded MonthData so no extra queries are needed per week card.
export function weekStatsFromData(weekdayDates: string[], data: MonthData): { pctFollowed: number; planlessCount: number; plannedCount: number } {
  let followedDays = 0, plannedDays = 0, planlessCount = 0;
  for (const date of weekdayDates) {
    const plans = data.assetPlansByDate[date] || [];
    const hasContent = plans.some(p => (p.content && p.content.length > 0) || p.bias || p.tookTrade);
    if (!hasContent) {
      if ((data.tradeCounts[date] || 0) > 0) planlessCount++;
      continue;
    }
    plannedDays++;
    const anyDeviated = plans.some(p => p.adherence === 'deviated');
    if (!anyDeviated) followedDays++;
  }
  const pctFollowed = plannedDays > 0 ? Math.round((followedDays / plannedDays) * 100) : 0;
  return { pctFollowed, planlessCount, plannedCount: plannedDays };
}



export async function computeDailyStreak(upToDate: string): Promise<number> {
  // Walk backwards from upToDate, skipping weekends, until we hit a day with
  // no plan at all (streak stops counting, doesn't count as broken) or a
  // deviated asset (streak broken -> stop).
  let streak = 0;
  const cursor = new Date(upToDate + 'T00:00:00');
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const dow = cursor.getDay();
    if (dow === 0 || dow === 6) {
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    const dateStr = cursor.toISOString().slice(0, 10);
    const { data: dayPlan } = await supabase.from('day_plans').select('id').eq('date', dateStr).maybeSingle();
    if (!dayPlan) break; // no plan that day -> streak ends here (not counted, not broken further back... simplest: stop)
    const plans = await loadAssetPlans(dayPlan.id);
    if (!plans.length) break;
    const anyDeviated = plans.some(p => p.adherence === 'deviated');
    if (anyDeviated) break;
    const anyAdherentOrTaken = plans.some(p => p.adherence === 'adherent');
    if (!anyAdherentOrTaken) break; // day not yet reconciled, don't count it
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
