import { type User, type InsertUser, type Trade, type InsertTrade, type Settings, type InsertSettings } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getAllTrades(): Promise<Trade[]>;
  getTrade(id: string): Promise<Trade | undefined>;
  createTrade(trade: InsertTrade): Promise<Trade>;
  updateTrade(id: string, updates: Partial<Trade>): Promise<Trade | undefined>;
  deleteTrade(id: string): Promise<boolean>;
  deleteAllTrades(): Promise<void>;
  
  getSettings(): Promise<Settings | undefined>;
  createOrUpdateSettings(settings: InsertSettings): Promise<Settings>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private trades: Map<string, Trade>;
  private settings: Settings | undefined;

  constructor() {
    this.users = new Map();
    this.trades = new Map();
    this.settings = undefined;
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getAllTrades(): Promise<Trade[]> {
    return Array.from(this.trades.values()).sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
  }

  async getTrade(id: string): Promise<Trade | undefined> {
    return this.trades.get(id);
  }

  async createTrade(insertTrade: InsertTrade): Promise<Trade> {
    const id = randomUUID();
    const { customFieldValues, ...rest } = insertTrade as any;
    const trade: Trade = {
      ...rest,
      id,
      account: rest.account ?? null,
      model: rest.model ?? null,
      session: rest.session ?? null,
      entryTF: rest.entryTF ?? null,
      position: rest.position ?? "Long",
      riskPercent: rest.riskPercent ?? null,
      maxR: rest.maxR ?? insertTrade.realisedR,
      setupGrade: rest.setupGrade ?? null,
      keyLevels: rest.keyLevels ?? null,
      mistakes: rest.mistakes ?? null,
      screenshots: rest.screenshots ?? null,
      notes: rest.notes ?? null,
      protocolId: rest.protocolId ?? null,
      customFieldValues: parseCustomFieldValuesString(customFieldValues),
    };
    this.trades.set(id, trade);
    return trade;
  }

  async updateTrade(id: string, updates: Partial<Trade>): Promise<Trade | undefined> {
    const existing = this.trades.get(id);
    if (!existing) return undefined;
    
    const updated: Trade = { ...existing, ...updates, id };
    this.trades.set(id, updated);
    return updated;
  }

  async deleteTrade(id: string): Promise<boolean> {
    return this.trades.delete(id);
  }

  async deleteAllTrades(): Promise<void> {
    this.trades.clear();
  }

  async getSettings(): Promise<Settings | undefined> {
    return this.settings;
  }

  async createOrUpdateSettings(insertSettings: InsertSettings): Promise<Settings> {
    const id = this.settings?.id || randomUUID();
    const { customFields, ...rest } = insertSettings as any;
    const updated: Settings = {
      ...rest,
      id,
      accounts: rest.accounts ?? null,
      models: rest.models ?? null,
      sessions: rest.sessions ?? null,
      entryTFs: rest.entryTFs ?? null,
      setupGrades: rest.setupGrades ?? null,
      keyLevels: rest.keyLevels ?? null,
      mistakes: rest.mistakes ?? null,
      nonNegotiableMistakes: rest.nonNegotiableMistakes ?? null,
      tiltThreshold: rest.tiltThreshold ?? 2,
      customFields: parseCustomFieldsString(customFields),
    };
    this.settings = updated;
    return updated;
  }
}

function parseCustomFieldValuesString(raw: unknown): Record<string, string | string[]> {
  if (!raw || typeof raw !== "string") return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch { return {}; }
}

function parseCustomFieldsString(raw: unknown): Settings["customFields"] {
  if (!raw || typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export const storage = new MemStorage();
