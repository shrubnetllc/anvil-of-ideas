import { users, type User, type InsertUser, ideas, leanCanvas, appSettings, type Idea, type LeanCanvas, type InsertIdea, type InsertLeanCanvas, type UpdateLeanCanvas, ProjectStatus, type AppSetting, type InsertAppSetting } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import connectPg from "connect-pg-simple";
import { eq, and, ne, lt, desc, isNull } from "drizzle-orm";
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
  getIdeaById(id: number, requestingUserId?: number): Promise<Idea | undefined>;
  createIdea(idea: InsertIdea & { userId: number }): Promise<Idea>;
  updateIdea(id: number, updates: Partial<Idea>): Promise<void>;
  updateIdeaStatus(id: number, status: ProjectStatus): Promise<void>;
  startIdeaGeneration(id: number): Promise<void>;
  checkAndUpdateTimedOutIdeas(timeoutMinutes: number): Promise<number>;
  deleteIdea(id: number): Promise<void>;
  
  // Lean Canvas operations
  getLeanCanvasByIdeaId(ideaId: number, requestingUserId?: number): Promise<LeanCanvas | undefined>;
  createLeanCanvas(canvas: InsertLeanCanvas): Promise<LeanCanvas>;
  updateLeanCanvas(ideaId: number, updates: Partial<UpdateLeanCanvas>): Promise<void>;
  
  // Project Document operations
  getDocumentsByIdeaId(ideaId: number): Promise<ProjectDocument[]>;
  getDocumentById(id: number): Promise<ProjectDocument | undefined>;
  getDocumentByType(ideaId: number, documentType: DocumentType): Promise<ProjectDocument | undefined>;
  createDocument(document: InsertProjectDocument): Promise<ProjectDocument>;
  updateDocument(id: number, updates: Partial<UpdateProjectDocument>): Promise<void>;
  deleteDocument(id: number): Promise<void>;
  
  // App Settings operations
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;
  getAllSettings(): Promise<Record<string, string>>;
  
  // Email verification
  setVerificationToken(userId: number, token: string, expiryDate: Date): Promise<void>;
  verifyEmail(userId: number, token: string): Promise<boolean>;
  isEmailVerified(userId: number): Promise<boolean>;
  
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
    // Set default values for verification fields
    const userData = {
      ...insertUser,
      emailVerified: "false"
    };
    
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }

  // Idea operations
  async getIdeasByUser(userId: number): Promise<Idea[]> {
    console.log(`[SECURITY] Getting ideas for user ${userId} with strict filtering`);
    
    try {
      // Apply stronger filtering by explicitly checking the user ID matches
      const userIdeas = await db.select()
        .from(ideas)
        .where(eq(ideas.userId, userId));
      
      // Additional security check: filter the results again to ensure only the user's ideas are returned
      const filteredIdeas = userIdeas.filter(idea => {
        const isOwner = idea.userId === userId;
        if (!isOwner) {
          console.log(`[CRITICAL SECURITY VIOLATION] Idea ${idea.id} was retrieved but belongs to user ${idea.userId}, not requesting user ${userId}`);
        }
        return isOwner;
      });
      
      console.log(`[SECURITY] Found ${filteredIdeas.length} ideas belonging to user ${userId}`);
      return filteredIdeas;
    } catch (error) {
      console.error(`[SECURITY] Error retrieving ideas for user ${userId}:`, error);
      // In case of any error, return an empty array for security
      return [];
    }
  }

  async getIdeaById(id: number, requestingUserId?: number): Promise<Idea | undefined> {
    try {
      console.log(`[SECURITY] Retrieving idea ${id}${requestingUserId ? ` for user ${requestingUserId}` : ''}`);
      
      // First get the idea from the database
      const [idea] = await db.select().from(ideas).where(eq(ideas.id, id));
      
      if (!idea) {
        console.log(`[SECURITY] Idea with ID ${id} not found`);
        return undefined;
      }
      
      // Enhanced security check: if requesting user ID provided, verify ownership
      if (requestingUserId !== undefined) {
        if (idea.userId !== requestingUserId) {
          console.log(`[SECURITY] Access violation: User ${requestingUserId} attempted to access idea ${id} owned by user ${idea.userId}`);
          // For additional security, log the stack trace to help identify where unauthorized access attempts originate
          console.log(`[SECURITY] Access violation stack trace:`, new Error().stack);
          return undefined; // Return undefined for security, simulating "not found"
        }
        
        console.log(`[SECURITY] Authorized: User ${requestingUserId} owns idea ${id}`);
      } else {
        // Warning: This idea is being accessed without a user context, which is a potential security risk
        console.log(`[SECURITY WARNING] Idea ${id} being accessed without user context. This should only happen in admin functions.`);
      }
      
      return idea;
    } catch (error) {
      console.error(`[SECURITY ERROR] Error retrieving idea ${id}:`, error);
      return undefined; // Return undefined on any error for security
    }
  }

  async createIdea(idea: InsertIdea & { userId: number }): Promise<Idea> {
    const [newIdea] = await db.insert(ideas).values({
      ...idea,
      status: "Draft"
    }).returning();
    return newIdea;
  }

  async updateIdea(id: number, updates: Partial<Idea>): Promise<void> {
    // Remove non-updatable fields
    const { id: _, userId: __, status: ___, createdAt: ____, updatedAt: _____, generationStartedAt: ______, ...validUpdates } = updates;
    
    // Add updated timestamp
    await db.update(ideas)
      .set({
        ...validUpdates,
        updatedAt: new Date()
      })
      .where(eq(ideas.id, id));
  }
  
  async updateIdeaStatus(id: number, status: ProjectStatus): Promise<void> {
    await db.update(ideas)
      .set({
        status,
        updatedAt: new Date()
      })
      .where(eq(ideas.id, id));
  }
  
  async startIdeaGeneration(id: number): Promise<void> {
    const now = new Date();
    await db.update(ideas)
      .set({
        status: "Generating",
        generationStartedAt: now,
        updatedAt: now
      })
      .where(eq(ideas.id, id));
    console.log(`Started generation for idea ${id} at ${now.toISOString()}`);
  }
  
  async checkAndUpdateTimedOutIdeas(timeoutMinutes: number): Promise<number> {
    // Calculate the cutoff time based on timeoutMinutes
    const cutoffTime = new Date();
    cutoffTime.setMinutes(cutoffTime.getMinutes() - timeoutMinutes);
    
    // Find all ideas that are in Generating status
    const generatingIdeas = await db.select()
      .from(ideas)
      .where(eq(ideas.status, "Generating"));
    
    // Filter out the ones that should be updated
    const timedOutIdeas = generatingIdeas.filter(idea => {
      // Case 1: Has generationStartedAt timestamp and it's older than cutoff
      if (idea.generationStartedAt && idea.generationStartedAt < cutoffTime) {
        return true;
      }
      
      // Case 2: No generationStartedAt timestamp but updatedAt is older than cutoff
      if (!idea.generationStartedAt && idea.updatedAt < cutoffTime) {
        return true;
      }
      
      return false;
    });
    
    // Update all timed out ideas to "Completed" status
    let updateCount = 0;
    if (timedOutIdeas.length > 0) {
      const now = new Date();
      for (const idea of timedOutIdeas) {
        await db.update(ideas)
          .set({
            status: "Completed",
            updatedAt: now
          })
          .where(eq(ideas.id, idea.id));
        updateCount++;
        console.log(`Auto-updated timed out idea ${idea.id} from "Generating" to "Completed" after ${timeoutMinutes} minutes`);
      }
    }
    
    return updateCount;
  }

  async deleteIdea(id: number): Promise<void> {
    // First delete any associated canvas
    await db.delete(leanCanvas).where(eq(leanCanvas.ideaId, id));
    
    // Then delete the idea
    await db.delete(ideas).where(eq(ideas.id, id));
  }

  // Lean Canvas operations
  async getLeanCanvasByIdeaId(ideaId: number, requestingUserId?: number): Promise<LeanCanvas | undefined> {
    // First perform ownership check if requesting user ID is provided
    if (requestingUserId !== undefined) {
      try {
        // First check if the idea belongs to the requesting user (direct DB query to avoid loops)
        const [idea] = await db.select({ userId: ideas.userId })
          .from(ideas)
          .where(eq(ideas.id, ideaId));
        
        if (!idea) {
          console.log(`[SECURITY] Canvas access denied: Idea ${ideaId} not found`);
          return undefined;
        }
        
        if (idea.userId !== requestingUserId) {
          console.log(`[SECURITY] Canvas access denied: User ${requestingUserId} attempted to access canvas for idea ${ideaId} owned by user ${idea.userId}`);
          return undefined; // Return undefined for security, simulating "not found"
        }
        
        console.log(`[SECURITY] Canvas access authorized: User ${requestingUserId} owns idea ${ideaId}`);
      } catch (securityError) {
        console.error(`[SECURITY] Error during canvas ownership check:`, securityError);
        return undefined; // Return undefined on any error for security
      }
    }
    
    // Proceed with retrieving the canvas
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
  
  // App Settings operations
  async getSetting(key: string): Promise<string | null> {
    const [setting] = await db.select().from(appSettings).where(eq(appSettings.key, key));
    return setting?.value ?? null;
  }
  
  async setSetting(key: string, value: string): Promise<void> {
    // Try to get the setting first
    const existing = await this.getSetting(key);
    
    if (existing === null) {
      // Create a new setting
      await db.insert(appSettings).values({
        key,
        value
      });
    } else {
      // Update the existing setting
      await db.update(appSettings)
        .set({
          value,
          updatedAt: new Date()
        })
        .where(eq(appSettings.key, key));
    }
  }
  
  async getAllSettings(): Promise<Record<string, string>> {
    const settings = await db.select().from(appSettings);
    const result: Record<string, string> = {};
    
    for (const setting of settings) {
      if (setting.value !== null) {
        result[setting.key] = setting.value;
      }
    }
    
    return result;
  }
  
  // Email verification methods
  async setVerificationToken(userId: number, token: string, expiryDate: Date): Promise<void> {
    await db.update(users)
      .set({
        verificationToken: token,
        verificationTokenExpiry: expiryDate
      })
      .where(eq(users.id, userId));
  }
  
  async verifyEmail(userId: number, token: string): Promise<boolean> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    
    if (!user) {
      return false;
    }
    
    if (user.verificationToken !== token) {
      return false;
    }
    
    if (!user.verificationTokenExpiry || new Date() > new Date(user.verificationTokenExpiry)) {
      return false; // Token expired
    }
    
    // Mark email as verified and clear token
    await db.update(users)
      .set({
        emailVerified: "true",
        verificationToken: null,
        verificationTokenExpiry: null
      })
      .where(eq(users.id, userId));
    
    return true;
  }
  
  async isEmailVerified(userId: number): Promise<boolean> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    return user?.emailVerified === "true";
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
    const user: User = { 
      ...insertUser, 
      id,
      // Ensure email is either the provided value or null (not undefined)
      email: insertUser.email || null,
      // Default values for verification fields
      emailVerified: "false",
      verificationToken: null,
      verificationTokenExpiry: null
    };
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
      title: idea.title || "",
      idea: idea.idea,
      founderName: idea.founderName || null,
      founderEmail: idea.founderEmail || null,
      companyStage: idea.companyStage || null,
      websiteUrl: idea.websiteUrl || null,
      companyName: idea.companyName || null,
      status: "Draft",
      generationStartedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.ideas.set(id, newIdea);
    return newIdea;
  }

  async updateIdea(id: number, updates: Partial<Idea>): Promise<void> {
    const idea = this.ideas.get(id);
    if (idea) {
      // Remove non-updatable fields
      const { id: _, userId: __, status: ___, createdAt: ____, updatedAt: _____, generationStartedAt: ______, ...validUpdates } = updates;
      
      // Update the idea with valid fields
      const updatedIdea = {
        ...idea,
        ...validUpdates,
        updatedAt: new Date()
      };
      
      this.ideas.set(id, updatedIdea);
    }
  }
  
  async updateIdeaStatus(id: number, status: ProjectStatus): Promise<void> {
    const idea = this.ideas.get(id);
    if (idea) {
      idea.status = status;
      idea.updatedAt = new Date();
      this.ideas.set(id, idea);
    }
  }
  
  async startIdeaGeneration(id: number): Promise<void> {
    const idea = this.ideas.get(id);
    if (idea) {
      const now = new Date();
      idea.status = "Generating";
      idea.generationStartedAt = now;
      idea.updatedAt = now;
      this.ideas.set(id, idea);
      console.log(`Started generation for idea ${id} at ${now.toISOString()}`);
    }
  }
  
  async checkAndUpdateTimedOutIdeas(timeoutMinutes: number): Promise<number> {
    // Calculate the cutoff time based on timeoutMinutes
    const cutoffTime = new Date();
    cutoffTime.setMinutes(cutoffTime.getMinutes() - timeoutMinutes);
    
    let updateCount = 0;
    
    // Check all ideas in the map using Array.from to avoid MapIterator issues
    Array.from(this.ideas.keys()).forEach(id => {
      const idea = this.ideas.get(id);
      if (idea) {
        // If the idea is in Generating status and has a generationStartedAt older than the cutoff
        if (
          idea.status === "Generating" && 
          idea.generationStartedAt && 
          idea.generationStartedAt < cutoffTime
        ) {
          // Update to Completed
          idea.status = "Completed";
          idea.updatedAt = new Date();
          this.ideas.set(id, idea);
          updateCount++;
          console.log(`Auto-updated timed out idea ${id} from "Generating" to "Completed" after ${timeoutMinutes} minutes`);
        }
      }
    });
    
    return updateCount;
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
      projectId: canvas.projectId || null,
      problem: canvas.problem || null,
      customerSegments: canvas.customerSegments || null,
      uniqueValueProposition: canvas.uniqueValueProposition || null,
      solution: canvas.solution || null,
      channels: canvas.channels || null,
      revenueStreams: canvas.revenueStreams || null,
      costStructure: canvas.costStructure || null,
      keyMetrics: canvas.keyMetrics || null,
      unfairAdvantage: canvas.unfairAdvantage || null,
      html: canvas.html || null,
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
  
  // App Settings operations
  private settings: Map<string, string> = new Map();
  
  async getSetting(key: string): Promise<string | null> {
    return this.settings.get(key) || null;
  }
  
  async setSetting(key: string, value: string): Promise<void> {
    this.settings.set(key, value);
  }
  
  async getAllSettings(): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    this.settings.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }
  
  // Email verification methods
  async setVerificationToken(userId: number, token: string, expiryDate: Date): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.verificationToken = token;
      user.verificationTokenExpiry = expiryDate;
      this.users.set(userId, user);
    }
  }
  
  async verifyEmail(userId: number, token: string): Promise<boolean> {
    const user = this.users.get(userId);
    
    if (!user) {
      return false;
    }
    
    if (user.verificationToken !== token) {
      return false;
    }
    
    if (!user.verificationTokenExpiry || new Date() > new Date(user.verificationTokenExpiry)) {
      return false; // Token expired
    }
    
    // Mark email as verified and clear token
    user.emailVerified = "true";
    user.verificationToken = null;
    user.verificationTokenExpiry = null;
    this.users.set(userId, user);
    
    return true;
  }
  
  async isEmailVerified(userId: number): Promise<boolean> {
    const user = this.users.get(userId);
    return user?.emailVerified === "true";
  }
}

// Use the database storage implementation
export const storage = new DatabaseStorage();
