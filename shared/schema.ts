import { pgTable, text, serial, integer, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const projectStatuses = ["Draft", "Generating", "Completed"] as const;
export type ProjectStatus = typeof projectStatuses[number];

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

// Define tables
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email"),
  emailVerified: text("email_verified").default("false"),
  verificationToken: text("verification_token"),
  verificationTokenExpiry: timestamp("verification_token_expiry"),
});

export const ideas = pgTable("ideas", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  title: text("title").notNull().default(""),
  idea: text("idea").notNull(),
  founderName: text("founder_name"),
  founderEmail: text("founder_email"),
  companyStage: text("company_stage"),
  websiteUrl: text("website_url"),
  companyName: text("company_name"),
  status: text("status").notNull().default("Draft"),
  generationStartedAt: timestamp("generation_started_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const leanCanvas = pgTable("lean_canvas", {
  id: serial("id").primaryKey(),
  ideaId: integer("idea_id").notNull().references(() => ideas.id),
  projectId: text("project_id"),  // Store the project_id returned from n8n
  leancanvasId: text("leancanvas_id"),  // Store the leancanvas_id returned from n8n (new format)
  problem: text("problem"),
  customerSegments: text("customer_segments"),
  uniqueValueProposition: text("unique_value_proposition"),
  solution: text("solution"),
  channels: text("channels"),
  revenueStreams: text("revenue_streams"),
  costStructure: text("cost_structure"),
  keyMetrics: text("key_metrics"),
  unfairAdvantage: text("unfair_advantage"),
  html: text("html"),  // HTML formatted version of the canvas from Supabase
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Table for storing all types of project documents
export const projectDocuments = pgTable("project_documents", {
  id: serial("id").primaryKey(),
  ideaId: integer("idea_id").notNull().references(() => ideas.id),
  documentType: text("document_type").notNull(), // One of the DocumentType values
  title: text("title").notNull(),
  content: text("content"), // Markdown or structured content
  html: text("html"), // Rendered HTML version 
  status: text("status").$type<ProjectStatus>().notNull().default("Draft"),
  generationStartedAt: timestamp("generation_started_at"),
  externalId: text("external_id"), // For external system integration
  version: integer("version").notNull().default(1), // Document version
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
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

export const insertLeanCanvasSchema = createInsertSchema(leanCanvas).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateLeanCanvasSchema = createInsertSchema(leanCanvas).pick({
  projectId: true,
  leancanvasId: true,
  problem: true,
  customerSegments: true,
  uniqueValueProposition: true,
  solution: true,
  channels: true,
  revenueStreams: true,
  costStructure: true,
  keyMetrics: true,
  unfairAdvantage: true,
  html: true,
});

// Define schemas for project documents
export const insertProjectDocumentSchema = createInsertSchema(projectDocuments).omit({
  id: true,
  createdAt: true, 
  updatedAt: true,
  version: true
});

export const updateProjectDocumentSchema = createInsertSchema(projectDocuments).pick({
  title: true,
  content: true,
  html: true,
  status: true,
  externalId: true,
  generationStartedAt: true,
});

// Export types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Idea = typeof ideas.$inferSelect;
export type InsertIdea = z.infer<typeof insertIdeaSchema>;

export type LeanCanvas = typeof leanCanvas.$inferSelect;
export type InsertLeanCanvas = z.infer<typeof insertLeanCanvasSchema>;
export type UpdateLeanCanvas = z.infer<typeof updateLeanCanvasSchema>;

export type ProjectDocument = typeof projectDocuments.$inferSelect;
export type InsertProjectDocument = z.infer<typeof insertProjectDocumentSchema>;
export type UpdateProjectDocument = z.infer<typeof updateProjectDocumentSchema>;

export const insertAppSettingSchema = createInsertSchema(appSettings).pick({
  key: true,
  value: true
});
export type AppSetting = typeof appSettings.$inferSelect;
export type InsertAppSetting = z.infer<typeof insertAppSettingSchema>;

export const webhookResponseSchema = z.object({
  // ID fields
  ideaId: z.number().optional(), // Might be part of unique-user-id
  "unique-user-id": z.string().optional(), // Format: user-{userId}-idea-{ideaId}
  project_id: z.string().optional(), // Project ID from n8n response
  leancanvas_id: z.string().optional(), // New! Lean Canvas ID from n8n response
  projectId: z.string().optional(), // Legacy project ID from n8n response
  
  // Canvas fields - using our internal property names
  problem: z.string().optional(),
  customerSegments: z.string().optional(),
  uniqueValueProposition: z.string().optional(),
  solution: z.string().optional(),
  channels: z.string().optional(),
  revenueStreams: z.string().optional(),
  costStructure: z.string().optional(),
  keyMetrics: z.string().optional(),
  unfairAdvantage: z.string().optional(),
  html: z.string().optional(), // HTML content from Supabase
  
  // Canvas fields - using the n8n-expected naming convention
  lean_canvas: z.object({
    problem: z.string().optional(),
    customer_segments: z.string().optional(),
    unique_value_proposition: z.string().optional(),
    solution: z.string().optional(),
    channels: z.string().optional(),
    revenue_streams: z.string().optional(),
    cost_structure: z.string().optional(),
    key_metrics: z.string().optional(),
    unfair_advantage: z.string().optional()
  }).optional(),
}).transform(data => {
  // Extract ideaId from unique-user-id if it's present and ideaId is not
  if (!data.ideaId && data["unique-user-id"]) {
    const match = data["unique-user-id"].match(/user-\d+-idea-(\d+)/);
    if (match && match[1]) {
      data.ideaId = parseInt(match[1], 10);
    }
  }
  
  // Handle the new response format where project_id and leancanvas_id are provided
  if (data.project_id && !data.projectId) {
    data.projectId = data.project_id;
  }
  
  // Map n8n's response format to our format if lean_canvas is present
  if (data.lean_canvas) {
    if (data.lean_canvas.problem) data.problem = data.lean_canvas.problem;
    if (data.lean_canvas.customer_segments) data.customerSegments = data.lean_canvas.customer_segments;
    if (data.lean_canvas.unique_value_proposition) data.uniqueValueProposition = data.lean_canvas.unique_value_proposition;
    if (data.lean_canvas.solution) data.solution = data.lean_canvas.solution;
    if (data.lean_canvas.channels) data.channels = data.lean_canvas.channels;
    if (data.lean_canvas.revenue_streams) data.revenueStreams = data.lean_canvas.revenue_streams;
    if (data.lean_canvas.cost_structure) data.costStructure = data.lean_canvas.cost_structure;
    if (data.lean_canvas.key_metrics) data.keyMetrics = data.lean_canvas.key_metrics;
    if (data.lean_canvas.unfair_advantage) data.unfairAdvantage = data.lean_canvas.unfair_advantage;
  }
  
  // If leancanvas_id is provided, store it for reference
  if (data.leancanvas_id) {
    console.log(`Received leancanvas_id: ${data.leancanvas_id}`);
  }

  // Filter out the lean_canvas and unique-user-id properties to avoid DB issues
  // Ensure ideaId is a number and exists (this is a required field for our database)
  if (!data.ideaId) {
    throw new Error("Could not determine ideaId from webhook data");
  }
  
  return {
    ideaId: data.ideaId,
    projectId: data.project_id || data.projectId, // Use project_id from new format if available
    leancanvasId: data.leancanvas_id, // Include new leancanvas_id if available
    problem: data.problem,
    customerSegments: data.customerSegments,
    uniqueValueProposition: data.uniqueValueProposition,
    solution: data.solution,
    channels: data.channels,
    revenueStreams: data.revenueStreams,
    costStructure: data.costStructure,
    keyMetrics: data.keyMetrics,
    unfairAdvantage: data.unfairAdvantage,
    html: data.html // Include HTML content if available
  };
});

export type WebhookResponse = z.infer<typeof webhookResponseSchema>;
