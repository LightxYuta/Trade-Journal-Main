import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { Trade, Settings } from '@shared/schema';
import {
  loadTrades,
  loadSettings,
  saveSettings,
  addTrade as addTradeStorage,
  deleteTrade as deleteTradeStorage,
  updateTrade as updateTradeStorage,
  clearAllTrades as clearAllTradesStorage,
  fullReset as fullResetStorage,
  resetSettings as resetSettingsStorage,
  DEFAULT_SETTINGS,
} from '@/lib/storage';

interface TradeContextType {
  trades: Trade[];
  settings: Omit<Settings, 'id'>;
  loading: boolean;
  addTrade: (trade: Omit<Trade, 'id'>) => Promise<Trade>;
  updateTrade: (id: string, updates: Partial<Trade>) => Promise<Trade | null>;
  deleteTrade: (id: string) => Promise<boolean>;
  updateSettings: (updates: Partial<Omit<Settings, 'id'>>) => Promise<void>;
  resetSettings: () => Promise<void>;
  clearAllTrades: () => Promise<void>;
  fullReset: () => Promise<void>;
  refreshData: () => Promise<void>;
}

const TradeContext = createContext<TradeContextType | undefined>(undefined);

export function TradeProvider({ children }: { children: ReactNode }) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [settings, setSettings] = useState<Omit<Settings, 'id'>>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const refreshData = useCallback(async () => {
    try {
      setLoading(true);
      const [loadedTrades, loadedSettings] = await Promise.all([
        loadTrades(),
        loadSettings(),
      ]);
      setTrades(loadedTrades);
      setSettings(loadedSettings);
    } catch (e) {
      console.error('Failed to load data', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const addTrade = useCallback(async (trade: Omit<Trade, 'id'>): Promise<Trade> => {
    const newTrade = await addTradeStorage(trade);
    setTrades(prev => [newTrade, ...prev]);
    return newTrade;
  }, []);

  const updateTrade = useCallback(async (id: string, updates: Partial<Trade>): Promise<Trade | null> => {
    const updated = await updateTradeStorage(id, updates);
    if (updated) {
      setTrades(prev => prev.map(t => t.id === id ? updated : t));
    }
    return updated;
  }, []);

  const deleteTrade = useCallback(async (id: string): Promise<boolean> => {
    const success = await deleteTradeStorage(id);
    if (success) {
      setTrades(prev => prev.filter(t => t.id !== id));
    }
    return success;
  }, []);

  const updateSettings = useCallback(async (updates: Partial<Omit<Settings, 'id'>>) => {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    await saveSettings(newSettings);
  }, [settings]);

  const resetSettings = useCallback(async () => {
    setSettings({ ...DEFAULT_SETTINGS });
    await resetSettingsStorage();
  }, []);

  const clearAllTrades = useCallback(async () => {
    await clearAllTradesStorage();
    setTrades([]);
  }, []);

  const fullReset = useCallback(async () => {
    await fullResetStorage();
    setTrades([]);
    setSettings({ ...DEFAULT_SETTINGS });
  }, []);

  return (
    <TradeContext.Provider value={{
      trades,
      settings,
      loading,
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
    throw new Error('useTradeContext must be used within a TradeProvider');
  }
  return context;
}