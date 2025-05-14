import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const projectStatuses = ["Draft", "Generating", "Completed"] as const;
export type ProjectStatus = typeof projectStatuses[number];

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

// Define schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
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

// Export types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Idea = typeof ideas.$inferSelect;
export type InsertIdea = z.infer<typeof insertIdeaSchema>;

export type LeanCanvas = typeof leanCanvas.$inferSelect;
export type InsertLeanCanvas = z.infer<typeof insertLeanCanvasSchema>;
export type UpdateLeanCanvas = z.infer<typeof updateLeanCanvasSchema>;

export const webhookResponseSchema = z.object({
  // ID fields
  ideaId: z.number().optional(), // Might be part of unique-user-id
  "unique-user-id": z.string().optional(), // Format: user-{userId}-idea-{ideaId}
  projectId: z.string().optional(), // Project ID from n8n response
  
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
  
  // Filter out the lean_canvas and unique-user-id properties to avoid DB issues
  // Ensure ideaId is a number and exists (this is a required field for our database)
  if (!data.ideaId) {
    throw new Error("Could not determine ideaId from webhook data");
  }
  
  return {
    ideaId: data.ideaId,
    projectId: data.projectId, // Include project_id from response
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
