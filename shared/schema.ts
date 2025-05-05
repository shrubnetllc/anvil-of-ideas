import { pgTable, text, serial, integer, boolean, json, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const projectStatuses = ["Draft", "Generating", "Completed"] as const;
export type ProjectStatus = typeof projectStatuses[number];

export const ideas = pgTable("ideas", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  idea: text("idea").notNull(),
  founderName: text("founder_name"),
  founderEmail: text("founder_email"),
  companyStage: text("company_stage"),
  websiteUrl: text("website_url"),
  companyName: text("company_name"),
  status: text("status").notNull().default("Draft"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertIdeaSchema = createInsertSchema(ideas).omit({
  id: true,
  userId: true,
  status: true,
  createdAt: true,
  updatedAt: true,
});

export const canvasSections = [
  "Problem",
  "CustomerSegments",
  "UniqueValueProposition",
  "Solution",
  "Channels",
  "RevenueStreams",
  "CostStructure",
  "KeyMetrics",
  "UnfairAdvantage",
] as const;
export type CanvasSection = typeof canvasSections[number];

export const leanCanvas = pgTable("lean_canvas", {
  id: serial("id").primaryKey(),
  ideaId: integer("idea_id").notNull(),
  problem: text("problem"),
  customerSegments: text("customer_segments"),
  uniqueValueProposition: text("unique_value_proposition"),
  solution: text("solution"),
  channels: text("channels"),
  revenueStreams: text("revenue_streams"),
  costStructure: text("cost_structure"),
  keyMetrics: text("key_metrics"),
  unfairAdvantage: text("unfair_advantage"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertLeanCanvasSchema = createInsertSchema(leanCanvas).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateLeanCanvasSchema = createInsertSchema(leanCanvas).pick({
  problem: true,
  customerSegments: true,
  uniqueValueProposition: true,
  solution: true,
  channels: true,
  revenueStreams: true,
  costStructure: true,
  keyMetrics: true,
  unfairAdvantage: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Idea = typeof ideas.$inferSelect;
export type InsertIdea = z.infer<typeof insertIdeaSchema>;

export type LeanCanvas = typeof leanCanvas.$inferSelect;
export type InsertLeanCanvas = z.infer<typeof insertLeanCanvasSchema>;
export type UpdateLeanCanvas = z.infer<typeof updateLeanCanvasSchema>;

export const webhookResponseSchema = z.object({
  ideaId: z.number(),
  problem: z.string().optional(),
  customerSegments: z.string().optional(),
  uniqueValueProposition: z.string().optional(),
  solution: z.string().optional(),
  channels: z.string().optional(),
  revenueStreams: z.string().optional(),
  costStructure: z.string().optional(),
  keyMetrics: z.string().optional(),
  unfairAdvantage: z.string().optional(),
});

export type WebhookResponse = z.infer<typeof webhookResponseSchema>;
