import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { Trade, Settings } from "@shared/schema";
import { loadTrades, saveTrades, loadSettings, saveSettings, DEFAULT_SETTINGS, addTrade as addTradeStorage, deleteTrade as deleteTradeStorage, updateTrade as updateTradeStorage } from "@/lib/storage";

interface TradeContextType {
  trades: Trade[];
  settings: Omit<Settings, "id">;
  addTrade: (trade: Omit<Trade, "id">) => Trade;
  updateTrade: (id: string, updates: Partial<Trade>) => Trade | null;
  deleteTrade: (id: string) => boolean;
  updateSettings: (updates: Partial<Omit<Settings, "id">>) => void;
  resetSettings: () => void;
  clearAllTrades: () => void;
  fullReset: () => void;
  refreshData: () => void;
}

const TradeContext = createContext<TradeContextType | undefined>(undefined);

export function TradeProvider({ children }: { children: ReactNode }) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [settings, setSettings] = useState<Omit<Settings, "id">>(DEFAULT_SETTINGS);

  const refreshData = useCallback(() => {
    setTrades(loadTrades());
    setSettings(loadSettings());
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const addTrade = useCallback((trade: Omit<Trade, "id">): Trade => {
    const newTrade = addTradeStorage(trade);
    setTrades(prev => [...prev, newTrade]);
    return newTrade;
  }, []);

  const updateTrade = useCallback((id: string, updates: Partial<Trade>): Trade | null => {
    const updated = updateTradeStorage(id, updates);
    if (updated) {
      setTrades(prev => prev.map(t => t.id === id ? updated : t));
    }
    return updated;
  }, []);

  const deleteTrade = useCallback((id: string): boolean => {
    const success = deleteTradeStorage(id);
    if (success) {
      setTrades(prev => prev.filter(t => t.id !== id));
    }
    return success;
  }, []);

  const updateSettings = useCallback((updates: Partial<Omit<Settings, "id">>) => {
    setSettings(prev => {
      const newSettings = { ...prev, ...updates };
      saveSettings(newSettings);
      return newSettings;
    });
  }, []);

  const resetSettings = useCallback(() => {
    setSettings({ ...DEFAULT_SETTINGS });
    saveSettings({ ...DEFAULT_SETTINGS });
  }, []);

  const clearAllTrades = useCallback(() => {
    setTrades([]);
    saveTrades([]);
  }, []);

  const fullReset = useCallback(() => {
    localStorage.removeItem("tj_multi_settings_v1");
    localStorage.removeItem("tj_multi_trades_v1");
    setTrades([]);
    setSettings({ ...DEFAULT_SETTINGS });
  }, []);

  return (
    <TradeContext.Provider value={{
      trades,
      settings,
      addTrade,
      updateTrade,
      deleteTrade,
      updateSettings,
      resetSettings,
      clearAllTrades,
      fullReset,
      refreshData,
    }}>
      {children}
    </TradeContext.Provider>
  );
}

export function useTradeContext() {
  const context = useContext(TradeContext);
  if (!context) {
    throw new Error("useTradeContext must be used within a TradeProvider");
  }
  return context;
}
