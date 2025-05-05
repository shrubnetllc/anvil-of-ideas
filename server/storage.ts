import { users, type User, type InsertUser, ideas, leanCanvas, type Idea, type LeanCanvas, type InsertIdea, type InsertLeanCanvas, type UpdateLeanCanvas, ProjectStatus } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import connectPg from "connect-pg-simple";
import { eq, and } from "drizzle-orm";
import { db, pool } from "./db";

const MemoryStore = createMemoryStore(session);
const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Idea operations
  getIdeasByUser(userId: number): Promise<Idea[]>;
  getIdeaById(id: number): Promise<Idea | undefined>;
  createIdea(idea: InsertIdea & { userId: number }): Promise<Idea>;
  updateIdeaStatus(id: number, status: ProjectStatus): Promise<void>;
  deleteIdea(id: number): Promise<void>;
  
  // Lean Canvas operations
  getLeanCanvasByIdeaId(ideaId: number): Promise<LeanCanvas | undefined>;
  createLeanCanvas(canvas: InsertLeanCanvas): Promise<LeanCanvas>;
  updateLeanCanvas(ideaId: number, updates: Partial<UpdateLeanCanvas>): Promise<void>;
  
  // Session store
  sessionStore: any; // Using 'any' type for sessionStore to avoid type errors
}

export class DatabaseStorage implements IStorage {
  public sessionStore: any;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    });
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Idea operations
  async getIdeasByUser(userId: number): Promise<Idea[]> {
    return await db.select().from(ideas).where(eq(ideas.userId, userId));
  }

  async getIdeaById(id: number): Promise<Idea | undefined> {
    const [idea] = await db.select().from(ideas).where(eq(ideas.id, id));
    return idea;
  }

  async createIdea(idea: InsertIdea & { userId: number }): Promise<Idea> {
    const [newIdea] = await db.insert(ideas).values({
      ...idea,
      status: "Draft"
    }).returning();
    return newIdea;
  }

  async updateIdeaStatus(id: number, status: ProjectStatus): Promise<void> {
    await db.update(ideas)
      .set({
        status,
        updatedAt: new Date()
      })
      .where(eq(ideas.id, id));
  }

  async deleteIdea(id: number): Promise<void> {
    // First delete any associated canvas
    await db.delete(leanCanvas).where(eq(leanCanvas.ideaId, id));
    
    // Then delete the idea
    await db.delete(ideas).where(eq(ideas.id, id));
  }

  // Lean Canvas operations
  async getLeanCanvasByIdeaId(ideaId: number): Promise<LeanCanvas | undefined> {
    const [canvas] = await db.select().from(leanCanvas).where(eq(leanCanvas.ideaId, ideaId));
    return canvas;
  }

  async createLeanCanvas(canvas: InsertLeanCanvas): Promise<LeanCanvas> {
    const [newCanvas] = await db.insert(leanCanvas).values(canvas).returning();
    return newCanvas;
  }

  async updateLeanCanvas(ideaId: number, updates: Partial<UpdateLeanCanvas>): Promise<void> {
    // Update the canvas
    await db.update(leanCanvas)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(leanCanvas.ideaId, ideaId));
    
    // Update the related idea's updatedAt timestamp
    await db.update(ideas)
      .set({ updatedAt: new Date() })
      .where(eq(ideas.id, ideaId));
  }
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private ideas: Map<number, Idea>;
  private canvases: Map<number, LeanCanvas>;
  public sessionStore: any;
  private nextUserId: number;
  private nextIdeaId: number;
  private nextCanvasId: number;

  constructor() {
    this.users = new Map();
    this.ideas = new Map();
    this.canvases = new Map();
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // 24 hours
    });
    this.nextUserId = 1;
    this.nextIdeaId = 1;
    this.nextCanvasId = 1;
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.nextUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Idea operations
  async getIdeasByUser(userId: number): Promise<Idea[]> {
    return Array.from(this.ideas.values()).filter(
      (idea) => idea.userId === userId,
    );
  }

  async getIdeaById(id: number): Promise<Idea | undefined> {
    return this.ideas.get(id);
  }

  async createIdea(idea: InsertIdea & { userId: number }): Promise<Idea> {
    const id = this.nextIdeaId++;
    const now = new Date();
    const newIdea: Idea = {
      id,
      userId: idea.userId,
      idea: idea.idea,
      founderName: idea.founderName || null,
      founderEmail: idea.founderEmail || null,
      companyStage: idea.companyStage || null,
      websiteUrl: idea.websiteUrl || null,
      companyName: idea.companyName || null,
      status: "Draft",
      createdAt: now,
      updatedAt: now,
    };
    this.ideas.set(id, newIdea);
    return newIdea;
  }

  async updateIdeaStatus(id: number, status: ProjectStatus): Promise<void> {
    const idea = this.ideas.get(id);
    if (idea) {
      idea.status = status;
      idea.updatedAt = new Date();
      this.ideas.set(id, idea);
    }
  }

  async deleteIdea(id: number): Promise<void> {
    this.ideas.delete(id);
    // Also delete associated canvas if exists
    const canvas = await this.getLeanCanvasByIdeaId(id);
    if (canvas) {
      this.canvases.delete(canvas.id);
    }
  }

  // Lean Canvas operations
  async getLeanCanvasByIdeaId(ideaId: number): Promise<LeanCanvas | undefined> {
    return Array.from(this.canvases.values()).find(
      (canvas) => canvas.ideaId === ideaId,
    );
  }

  async createLeanCanvas(canvas: InsertLeanCanvas): Promise<LeanCanvas> {
    const id = this.nextCanvasId++;
    const now = new Date();
    const newCanvas: LeanCanvas = {
      id,
      ideaId: canvas.ideaId,
      problem: canvas.problem || null,
      customerSegments: canvas.customerSegments || null,
      uniqueValueProposition: canvas.uniqueValueProposition || null,
      solution: canvas.solution || null,
      channels: canvas.channels || null,
      revenueStreams: canvas.revenueStreams || null,
      costStructure: canvas.costStructure || null,
      keyMetrics: canvas.keyMetrics || null,
      unfairAdvantage: canvas.unfairAdvantage || null,
      createdAt: now,
      updatedAt: now,
    };
    this.canvases.set(id, newCanvas);
    return newCanvas;
  }

  async updateLeanCanvas(ideaId: number, updates: Partial<UpdateLeanCanvas>): Promise<void> {
    const canvas = await this.getLeanCanvasByIdeaId(ideaId);
    if (canvas) {
      const updatedCanvas: LeanCanvas = {
        ...canvas,
        ...updates,
        updatedAt: new Date(),
      };
      this.canvases.set(canvas.id, updatedCanvas);
      
      // Also update the related idea's updatedAt timestamp
      const idea = this.ideas.get(ideaId);
      if (idea) {
        idea.updatedAt = new Date();
        this.ideas.set(ideaId, idea);
      }
    }
  }
}

// Use the database storage implementation
export const storage = new DatabaseStorage();
