import {
  users, ideas, leanCanvas, appSettings, projectDocuments,
  type User, type InsertUser,
  type Idea, type InsertIdea,
  type LeanCanvas, type InsertLeanCanvas, type UpdateLeanCanvas,
  ProjectStatus, DocumentType,
  type AppSetting, type InsertAppSetting,
  type ProjectDocument, type InsertProjectDocument, type UpdateProjectDocument
} from "@shared/schema";
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

  // Lean Canvas
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

  // Project Document operations
  async getDocumentsByIdeaId(ideaId: number): Promise<ProjectDocument[]> {
    try {
      const documents = await db
        .select()
        .from(projectDocuments)
        .where(eq(projectDocuments.ideaId, ideaId));
      return documents;
    } catch (error) {
      console.error("Error fetching documents:", error);
      return [];
    }
  }

  async getDocumentById(id: number): Promise<ProjectDocument | undefined> {
    try {
      const [document] = await db
        .select()
        .from(projectDocuments)
        .where(eq(projectDocuments.id, id));
      return document;
    } catch (error) {
      console.error("Error fetching document by ID:", error);
      return undefined;
    }
  }

  async getDocumentByType(ideaId: number, documentType: DocumentType): Promise<ProjectDocument | undefined> {
    try {
      const [document] = await db
        .select()
        .from(projectDocuments)
        .where(and(
          eq(projectDocuments.ideaId, ideaId),
          eq(projectDocuments.documentType, documentType)
        ));
      return document;
    } catch (error) {
      console.error(`Error fetching document by type (${documentType}):`, error);
      return undefined;
    }
  }

  async createDocument(document: InsertProjectDocument): Promise<ProjectDocument> {
    try {
      const [createdDocument] = await db
        .insert(projectDocuments)
        .values({
          ...document,
          status: document.status as ProjectStatus | undefined,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
      return createdDocument;
    } catch (error) {
      console.error("Error creating document:", error);
      throw error;
    }
  }

  async updateDocument(id: number, updates: Partial<UpdateProjectDocument>): Promise<void> {
    try {
      await db
        .update(projectDocuments)
        .set({
          ...updates,
          status: updates.status as ProjectStatus | undefined,
          updatedAt: new Date()
        })
        .where(eq(projectDocuments.id, id));
    } catch (error) {
      console.error("Error updating document:", error);
      throw error;
    }
  }

  async deleteDocument(id: number): Promise<void> {
    try {
      await db
        .delete(projectDocuments)
        .where(eq(projectDocuments.id, id));
    } catch (error) {
      console.error("Error deleting document:", error);
      throw error;
    }
  }

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
        // Use abstract equality (==) for ID comparison to handle potential string/number mismatches
        // or explicitly convert to Number before comparing
        const isOwner = Number(idea.userId) === Number(userId);
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
        // Ensure both IDs are compared as numbers to avoid string/number mismatch
        if (Number(idea.userId) !== Number(requestingUserId)) {
          console.log(`[SECURITY] Access violation: User ${requestingUserId} attempted to access idea ${id} owned by user ${idea.userId}`);
          // For additional security, log the stack trace to help identify where unauthorized access attempts originate
          console.log(`[SECURITY] Access violation stack trace requestUserId type: ${typeof requestingUserId}, idea.userId type: ${typeof idea.userId}`);
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
    try {
      console.log(`Deleting idea ${id} and related data...`);

      // Delete related documents using Drizzle delete operation
      const deletedDocuments = await db.delete(projectDocuments)
        .where(eq(projectDocuments.ideaId, id))
        .returning();
      console.log(`Deleted ${deletedDocuments.length} project documents for idea ${id}`);

      // Delete related lean canvas using Drizzle
      const deletedCanvas = await db.delete(leanCanvas)
        .where(eq(leanCanvas.ideaId, id))
        .returning();
      console.log(`Deleted ${deletedCanvas.length} lean canvas records for idea ${id}`);

      // Finally delete the idea itself
      const deletedIdeas = await db.delete(ideas)
        .where(eq(ideas.id, id))
        .returning();
      console.log(`Deleted ${deletedIdeas.length} idea records with id ${id}`);

      if (deletedIdeas.length === 0) {
        throw new Error(`No idea found with id ${id} to delete`);
      }
    } catch (error) {
      console.error(`Error deleting idea ${id}:`, error);
      throw error;
    }
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

        // Ensure both IDs are compared as numbers to avoid string/number mismatch
        if (Number(idea.userId) !== Number(requestingUserId)) {
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
    console.log(`Creating lean canvas with data:`, JSON.stringify(canvas));
    const [newCanvas] = await db.insert(leanCanvas).values(canvas).returning();
    console.log(`Created new canvas:`, JSON.stringify(newCanvas));

    // Also create a "project document" entry for the Lean Canvas
    // This allows it to be treated as a regular document
    try {
      // Content is stored as meaningful JSON-escaped string
      const content = JSON.stringify({
        problem: newCanvas.problem,
        customerSegments: newCanvas.customerSegments,
        uniqueValueProposition: newCanvas.uniqueValueProposition,
        solution: newCanvas.solution,
        channels: newCanvas.channels,
        revenueStreams: newCanvas.revenueStreams,
        costStructure: newCanvas.costStructure,
        keyMetrics: newCanvas.keyMetrics,
        unfairAdvantage: newCanvas.unfairAdvantage
      });

      await db.insert(projectDocuments).values({
        ideaId: newCanvas.ideaId,
        documentType: "LeanCanvas",
        title: "Lean Canvas",
        status: "Completed", // Canvas is created complete or in-progress but usable
        content: content,
        html: newCanvas.html,
        externalId: newCanvas.projectId,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log(`Synced Lean Canvas to project_documents table`);
    } catch (docError) {
      console.error(`Failed to sync Lean Canvas to project_documents:`, docError);
      // We don't fail the main request if sync fails, but we log it
    }

    return newCanvas;
  }

  async updateLeanCanvas(ideaId: number, updates: Partial<UpdateLeanCanvas>): Promise<void> {
    console.log(`Updating lean canvas for idea ${ideaId} with:`, JSON.stringify(updates));

    // Update the canvas
    const updateResult = await db.update(leanCanvas)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(leanCanvas.ideaId, ideaId))
      .returning();

    const updatedCanvas = updateResult[0]; // Get the full updated object

    console.log(`Update result:`, JSON.stringify(updateResult));

    // Update the related idea's updatedAt timestamp
    await db.update(ideas)
      .set({ updatedAt: new Date() })
      .where(eq(ideas.id, ideaId));

    // Sync to project_documents table
    if (updatedCanvas) {
      try {
        // Prepare content JSON
        const content = JSON.stringify({
          problem: updatedCanvas.problem,
          customerSegments: updatedCanvas.customerSegments,
          uniqueValueProposition: updatedCanvas.uniqueValueProposition,
          solution: updatedCanvas.solution,
          channels: updatedCanvas.channels,
          revenueStreams: updatedCanvas.revenueStreams,
          costStructure: updatedCanvas.costStructure,
          keyMetrics: updatedCanvas.keyMetrics,
          unfairAdvantage: updatedCanvas.unfairAdvantage
        });

        // Check if document exists
        const existingDoc = await this.getDocumentByType(ideaId, "LeanCanvas");

        if (existingDoc) {
          // Update existing document
          await db.update(projectDocuments)
            .set({
              content: content,
              html: updatedCanvas.html,
              externalId: updatedCanvas.projectId,
              updatedAt: new Date()
            })
            .where(eq(projectDocuments.id, existingDoc.id));
          console.log(`Updated Lean Canvas in project_documents table`);
        } else {
          // Create new document (for legacy cases where it might be missing)
          await db.insert(projectDocuments).values({
            ideaId: ideaId,
            documentType: "LeanCanvas",
            title: "Lean Canvas",
            status: "Completed",
            content: content,
            html: updatedCanvas.html,
            externalId: updatedCanvas.projectId,
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date()
          });
          console.log(`Created missing Lean Canvas in project_documents table during update`);
        }
      } catch (docError) {
        console.error(`Failed to sync updated Lean Canvas to project_documents:`, docError);
      }
    }
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
  private canvases: Map<string, LeanCanvas>; // Changed to string key for UUID
  private documents: Map<number, ProjectDocument>;
  public sessionStore: any;
  private nextUserId: number;
  private nextIdeaId: number;
  private nextCanvasId: number;
  private nextDocumentId: number;

  constructor() {
    this.users = new Map();
    this.ideas = new Map();
    this.canvases = new Map();
    this.documents = new Map();
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // 24 hours
    });
    this.nextUserId = 1;
    this.nextIdeaId = 1;
    this.nextCanvasId = 1;
    this.nextDocumentId = 1;
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
    const id = "canvas-" + this.nextCanvasId++; // Simulating UUID
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

    // Sync to documents map
    // Content is stored as meaningful JSON-escaped string
    const content = JSON.stringify({
      problem: newCanvas.problem,
      customerSegments: newCanvas.customerSegments,
      uniqueValueProposition: newCanvas.uniqueValueProposition,
      solution: newCanvas.solution,
      channels: newCanvas.channels,
      revenueStreams: newCanvas.revenueStreams,
      costStructure: newCanvas.costStructure,
      keyMetrics: newCanvas.keyMetrics,
      unfairAdvantage: newCanvas.unfairAdvantage
    });

    const docId = this.nextDocumentId++;
    const newDoc: ProjectDocument = {
      id: docId,
      ideaId: canvas.ideaId,
      documentType: "LeanCanvas",
      title: "Lean Canvas",
      status: "Completed",
      content: content,
      html: newCanvas.html,
      externalId: newCanvas.projectId,
      generationStartedAt: null,
      version: 1,
      createdAt: now,
      updatedAt: now
    };
    this.documents.set(docId, newDoc);

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

      // Sync to documents map
      const content = JSON.stringify({
        problem: updatedCanvas.problem,
        customerSegments: updatedCanvas.customerSegments,
        uniqueValueProposition: updatedCanvas.uniqueValueProposition,
        solution: updatedCanvas.solution,
        channels: updatedCanvas.channels,
        revenueStreams: updatedCanvas.revenueStreams,
        costStructure: updatedCanvas.costStructure,
        keyMetrics: updatedCanvas.keyMetrics,
        unfairAdvantage: updatedCanvas.unfairAdvantage
      });

      const existingDoc = await this.getDocumentByType(ideaId, "LeanCanvas");
      if (existingDoc) {
        existingDoc.content = content;
        existingDoc.html = updatedCanvas.html;
        existingDoc.externalId = updatedCanvas.projectId;
        existingDoc.updatedAt = new Date();
        this.documents.set(existingDoc.id, existingDoc);
      } else {
        const docId = this.nextDocumentId++;
        const newDoc: ProjectDocument = {
          id: docId,
          ideaId: ideaId,
          documentType: "LeanCanvas",
          title: "Lean Canvas",
          status: "Completed",
          content: content,
          html: updatedCanvas.html,
          externalId: updatedCanvas.projectId,
          generationStartedAt: null,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        this.documents.set(docId, newDoc);
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

  // Project Document operations
  async getDocumentsByIdeaId(ideaId: number): Promise<ProjectDocument[]> {
    return Array.from(this.documents.values()).filter(doc => doc.ideaId === ideaId);
  }

  async getDocumentById(id: number): Promise<ProjectDocument | undefined> {
    return this.documents.get(id);
  }

  async getDocumentByType(ideaId: number, documentType: DocumentType | string): Promise<ProjectDocument | undefined> {
    return Array.from(this.documents.values()).find(
      doc => doc.ideaId === ideaId && doc.documentType === documentType
    );
  }

  async createDocument(document: InsertProjectDocument): Promise<ProjectDocument> {
    const id = this.nextDocumentId++;
    const now = new Date();

    const newDocument: ProjectDocument = {
      id,
      ideaId: document.ideaId,
      documentType: document.documentType,
      title: document.title,
      content: document.content || null,
      html: document.html || null,
      status: (document.status as "Draft" | "Generating" | "Completed") || "Draft",
      generationStartedAt: document.generationStartedAt || null,
      externalId: document.externalId || null,
      version: 1,
      createdAt: now,
      updatedAt: now
    };

    this.documents.set(id, newDocument);
    return newDocument;
  }

  async updateDocument(id: number, updates: Partial<UpdateProjectDocument>): Promise<void> {
    const document = this.documents.get(id);
    if (!document) {
      throw new Error(`Document with ID ${id} not found`);
    }

    const updatedDocument = {
      ...document,
      ...updates,
      updatedAt: new Date()
    } as ProjectDocument;

    this.documents.set(id, updatedDocument);
  }

  async deleteDocument(id: number): Promise<void> {
    this.documents.delete(id);
  }
}

// Use the database storage implementation
export const storage = new DatabaseStorage();
