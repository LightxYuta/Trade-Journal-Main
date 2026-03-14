import { pgTable, text, varchar, real, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const trades = pgTable("trades", {
  id: varchar("id", { length: 36 }).primaryKey(),
  date: text("date").notNull(),
  symbol: text("symbol").notNull(),
  account: text("account"),
  model: text("model"),
  session: text("session"),
  entryTF: text("entry_tf"),
  position: text("position").default("Long"),
  riskPercent: real("risk_percent"),
  realisedR: real("realised_r").notNull(),
  maxR: real("max_r"),
  setupGrade: text("setup_grade"),
  keyLevels: text("key_levels").array(),
  mistakes: text("mistakes").array(),
  screenshots: text("screenshots"),
  notes: text("notes"),
  createdAt: integer("created_at").notNull(),
});

export const settings = pgTable("settings", {
  id: varchar("id", { length: 36 }).primaryKey(),
  accounts: text("accounts").array(),
  models: text("models").array(),
  sessions: text("sessions").array(),
  entryTFs: text("entry_tfs").array(),
  setupGrades: text("setup_grades").array(),
  keyLevels: text("key_levels").array(),
  mistakes: text("mistakes").array(),
  tiltThreshold: integer("tilt_threshold").default(2),
});

export const insertTradeSchema = createInsertSchema(trades).omit({ id: true });
export const insertSettingsSchema = createInsertSchema(settings).omit({ id: true });

export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type Trade = typeof trades.$inferSelect;
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settings.$inferSelect;

export interface TradeStats {
  n: number;
  totalR: number;
  wins: number;
  losses: number;
  bes: number;
  winrate: number;
  avgR: number;
  bestR: number;
  worstR: number;
  maxDrawdown: number;
  bestDay: number;
  worstDay: number;
  avgPerDay: number;
  profitFactor: number;
  expR: number;
  avgWin: number;
  avgLoss: number;
  winLossRatio: number;
  bestWinStreak: number;
  worstLossStreak: number;
  activeDays: number;
  sharpeRatio: number;
  currentStreak: { type: 'win' | 'loss' | 'none'; count: number };
}

export interface DayStats {
  date: string;
  totalR: number;
  trades: number;
  wins: number;
  losses: number;
}

export interface PerformanceByPeriod {
  label: string;
  totalR: number;
  trades: number;
  winRate: number;
  avgR: number;
}

export interface StrategyPerformance {
  name: string;
  trades: number;
  totalR: number;
  winRate: number;
  avgR: number;
  profitFactor: number;
  expectancy: number;
}

export interface HeatMapCell {
  day: number;
  hour: number;
  value: number;
  trades: number;
}

export interface DistributionData {
  range: string;
  count: number;
  percentage: number;
}

export const users = pgTable("users", {
  id: varchar("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
