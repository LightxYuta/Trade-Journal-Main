import type { Trade, Settings } from "@shared/schema";

const STORAGE_KEY = "tj_multi_trades_v1";
const SETTINGS_KEY = "tj_multi_settings_v1";

export const DEFAULT_SETTINGS: Omit<Settings, "id"> = {
  accounts: [
    "5K Evaluation",
    "5K Funded",
    "10K Challenge",
    "25K Challenge",
    "50K Challenge",
    "100K Challenge",
    "Demo"
  ],
  models: [
    "Continuation Model",
    "Retracement Model"
  ],
  sessions: [
    "London",
    "Asia",
    "London Lunch",
    "NY"
  ],
  entryTFs: [
    "5 Min",
    "15 Min",
    "3 Min"
  ],
  setupGrades: [
    "A+",
    "A",
    "B",
    "Retard"
  ],
  keyLevels: [
    "1H",
    "4H",
    "M30"
  ],
  mistakes: [
    "Against 1H OF",
    "1H Consolidation",
    "Trapped OF",
    "Overextended Prev Session/Day"
  ],
  tiltThreshold: 2,
};

function normalizeTrade(t: any): Trade {
  const realisedR =
    typeof t.realisedR === "number"
      ? t.realisedR
      : typeof t.rr === "number"
      ? t.rr
      : 0;

  const maxR =
    typeof t.maxR === "number"
      ? t.maxR
      : realisedR;

  return {
    id: t.id || crypto.randomUUID(),
    date: t.date || "",
    symbol: t.symbol || "",
    account: t.account || "",
    model: t.model || "",
    session: t.session || "",
    entryTF: t.entryTF || "",
    position: t.position || t.direction || "Long",
    riskPercent:
      typeof t.riskPercent === "number"
        ? t.riskPercent
        : typeof t.risk === "number"
        ? t.risk
        : null,
    realisedR,
    maxR,
    setupGrade: t.setupGrade || t.setup || "",
    keyLevels: Array.isArray(t.keyLevels) ? t.keyLevels : [],
    mistakes: Array.isArray(t.mistakes) ? t.mistakes : [],
    screenshots: t.screenshots || "",
    notes: t.notes || "",
    createdAt: t.createdAt || Date.now()
  };
}

export function loadSettings(): Omit<Settings, "id"> {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch (e) {
    console.error("Failed to load settings", e);
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Omit<Settings, "id">): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error("Failed to save settings", e);
  }
}

export function loadTrades(): Trade[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeTrade);
  } catch (e) {
    console.error("Failed to load trades", e);
    return [];
  }
}

export function saveTrades(trades: Trade[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
  } catch (e) {
    console.error("Failed to save trades", e);
  }
}

export function addTrade(trade: Omit<Trade, "id">): Trade {
  const trades = loadTrades();
  const newTrade: Trade = {
    ...trade,
    id: crypto.randomUUID(),
  };
  trades.push(newTrade);
  saveTrades(trades);
  return newTrade;
}

export function updateTrade(id: string, updates: Partial<Trade>): Trade | null {
  const trades = loadTrades();
  const index = trades.findIndex(t => t.id === id);
  if (index === -1) return null;
  
  trades[index] = { ...trades[index], ...updates };
  saveTrades(trades);
  return trades[index];
}

export function deleteTrade(id: string): boolean {
  const trades = loadTrades();
  const index = trades.findIndex(t => t.id === id);
  if (index === -1) return false;
  
  trades.splice(index, 1);
  saveTrades(trades);
  return true;
}

export function clearAllTrades(): void {
  saveTrades([]);
}

export function resetSettings(): void {
  saveSettings({ ...DEFAULT_SETTINGS });
}

export function fullReset(): void {
  localStorage.removeItem(SETTINGS_KEY);
  localStorage.removeItem(STORAGE_KEY);
}
