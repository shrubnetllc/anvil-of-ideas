import { pgTable, text, serial, timestamp, varchar, uuid, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const ideaStatuses = ["Draft", "Generating", "Completed"] as const;
export type IdeaStatus = typeof ideaStatuses[number];

// Document types that can be created for each idea
export const documentTypes = [
  "LeanCanvas",
  "ProjectRequirements",
  "BusinessRequirements",
  "FunctionalRequirements",
  "Workflows",
  "FrontEndSpecification",
  "BackEndSpecification",
  "MarketingCollateral",
  "PitchDeck",
  "Estimate"
] as const;
export type DocumentType = typeof documentTypes[number];

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

// Lean Canvas content_sections JSONB shape
export interface LeanCanvasContent {
  problem?: string | null;
  customerSegments?: string | null;
  uniqueValueProposition?: string | null;
  solution?: string | null;
  channels?: string | null;
  revenueStreams?: string | null;
  costStructure?: string | null;
  keyMetrics?: string | null;
  unfairAdvantage?: string | null;
}

// Define tables
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email"),
  emailVerified: text("email_verified").default("false"),
  verificationToken: text("verification_token"),
  verificationTokenExpiry: timestamp("verification_token_expiry"),
});

export const ideas = pgTable("ideas", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  title: text("title").notNull().default(""),
  description: text("description").notNull(),
  founderName: text("founder_name"),
  founderEmail: text("founder_email"),
  companyStage: text("company_stage"),
  websiteUrl: text("website_url"),
  companyName: text("company_name"),
  status: text("status").notNull().default("Draft"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  ideaId: uuid("idea_id").notNull().references(() => ideas.id),
  status: text("status").default(""),
  documentType: text("document_type"),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Unified documents table - replaces both lean_canvas and project_documents
export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  ideaId: uuid("idea_id").notNull().references(() => ideas.id),
  jobId: uuid("job_id").references(() => jobs.id),
  documentType: text("document_type").notNull(),
  content: text("content"),
  contentSections: jsonb("content_sections"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  generatedAt: timestamp("generated_at").defaultNow(),
});

export const appSettings = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 50 }).notNull().unique(),
  value: text("value"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Define schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
});

export const insertIdeaSchema = createInsertSchema(ideas).omit({
  id: true,
  userId: true,
  status: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  generatedAt: true,
});

export const updateDocumentSchema = createInsertSchema(documents).pick({
  content: true,
  contentSections: true,
  updatedAt: true,
});

export const insertJobSchema = createInsertSchema(jobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Export types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Idea = typeof ideas.$inferSelect;
export type InsertIdea = z.infer<typeof insertIdeaSchema>;

export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type UpdateDocument = z.infer<typeof updateDocumentSchema>;

export type Job = typeof jobs.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;
export type UpdateJob = Partial<InsertJob>;

export const insertAppSettingSchema = createInsertSchema(appSettings).pick({
  key: true,
  value: true
});
export type AppSetting = typeof appSettings.$inferSelect;
export type InsertAppSetting = z.infer<typeof insertAppSettingSchema>;
