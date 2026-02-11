import {
  users, ideas, leanCanvas, appSettings, projectDocuments,
  type User, type InsertUser,
  type Idea, type InsertIdea,
  type LeanCanvas, type InsertLeanCanvas, type UpdateLeanCanvas,
  ProjectStatus, DocumentType,
  type AppSetting, type InsertAppSetting,
  type ProjectDocument, type InsertProjectDocument, type UpdateProjectDocument,
  jobs, type Job, type InsertJob, type UpdateJob
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import connectPg from "connect-pg-simple";
import { eq, and, ne, lt, desc, isNull } from "drizzle-orm";
import { db, pool } from "./db";
import { v4 as uuidv4 } from "uuid";
import { withRLS } from "./db-security";

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
  updateIdea(id: number, updates: Partial<Idea>, requestingUserId?: number): Promise<void>;
  updateIdeaStatus(id: number, status: ProjectStatus, requestingUserId?: number): Promise<void>;
  startIdeaGeneration(id: number, requestingUserId?: number): Promise<void>;
  checkAndUpdateTimedOutIdeas(timeoutMinutes: number): Promise<number>;
  deleteIdea(id: number, requestingUserId?: number): Promise<void>;

  // Lean Canvas operations
  getLeanCanvasByIdeaId(ideaId: number, requestingUserId?: number): Promise<LeanCanvas | undefined>;
  createLeanCanvas(canvas: InsertLeanCanvas, requestingUserId?: number): Promise<LeanCanvas>;
  updateLeanCanvas(ideaId: number, updates: Partial<UpdateLeanCanvas>, requestingUserId?: number): Promise<void>;
  deleteLeanCanvas(ideaId: number, requestingUserId?: number): Promise<void>;

  // Project Document operations
  getDocumentsByIdeaId(ideaId: number, requestingUserId?: number): Promise<ProjectDocument[]>;
  getDocumentById(id: number, requestingUserId?: number): Promise<ProjectDocument | undefined>;
  getDocumentByType(ideaId: number, documentType: DocumentType | string, requestingUserId?: number): Promise<ProjectDocument | undefined>;
  createDocument(document: InsertProjectDocument, requestingUserId?: number): Promise<ProjectDocument>;
  updateDocument(id: number, updates: Partial<UpdateProjectDocument>, requestingUserId?: number): Promise<void>;
  deleteDocument(id: number, requestingUserId?: number): Promise<void>;
  createJob(job: InsertJob): Promise<Job>;
  updateJob(id: string, updates: Partial<UpdateJob>, requestingUserId?: number): Promise<void>;
  getWorkflowJobById(id: string, requestingUserId?: number): Promise<Job | null>;
  getLatestWorkflowJob(ideaId: number, requestingUserId?: number, documentType?: string): Promise<Job | null>;

  // App Settings operations
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;
  getAllSettings(): Promise<Record<string, string>>;

  // Email verification
  setVerificationToken(userId: number, token: string, expiryDate: Date): Promise<void>;
  verifyEmail(userId: number, token: string): Promise<boolean>;
  isEmailVerified(userId: number): Promise<boolean>;

  //Ultimate Website operations
  getUltimateWebsiteByIdeaId(ideaId: number, requestingUserId?: number): Promise<string | undefined>;

  // Session store
  sessionStore: any; // Using 'any' type for sessionStore to avoid type errors
}

export class DatabaseStorage implements IStorage {
  public sessionStore: any;

  // Project Document operations
  async getDocumentsByIdeaId(ideaId: number, requestingUserId?: number): Promise<ProjectDocument[]> {
    try {
      const execute = async (tx: typeof db) => {
        return await tx
          .select()
          .from(projectDocuments)
          .where(eq(projectDocuments.ideaId, ideaId));
      };

      if (requestingUserId) {
        return withRLS(requestingUserId, execute);
      }
      return execute(db);
    } catch (error) {
      console.error("Error fetching documents:", error);
      return [];
    }
  }

  async getDocumentById(id: number, requestingUserId?: number): Promise<ProjectDocument | undefined> {
    try {
      const execute = async (tx: typeof db) => {
        const [document] = await tx
          .select()
          .from(projectDocuments)
          .where(eq(projectDocuments.id, id));
        return document;
      };

      if (requestingUserId) {
        return withRLS(requestingUserId, execute);
      }
      return execute(db);
    } catch (error) {
      console.error("Error fetching document by ID:", error);
      return undefined;
    }
  }

  async getDocumentByType(ideaId: number, documentType: DocumentType | string, requestingUserId?: number): Promise<ProjectDocument | undefined> {
    try {
      const execute = async (tx: typeof db) => {
        const [document] = await tx
          .select()
          .from(projectDocuments)
          .where(and(
            eq(projectDocuments.ideaId, ideaId),
            eq(projectDocuments.documentType, documentType)
          ));
        return document;
      };

      if (requestingUserId) {
        return withRLS(requestingUserId, execute);
      }
      return execute(db);
    } catch (error) {
      console.error(`Error fetching document by type (${documentType}):`, error);
      return undefined;
    }
  }

  async createDocument(document: InsertProjectDocument, requestingUserId?: number): Promise<ProjectDocument> {
    try {
      const execute = async (tx: typeof db) => {
        const [createdDocument] = await tx
          .insert(projectDocuments)
          .values({
            ...document,
            status: document.status as ProjectStatus | undefined,
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .returning();
        return createdDocument;
      };

      if (requestingUserId) {
        return withRLS(requestingUserId, execute);
      }
      return execute(db);
    } catch (error) {
      console.error("Error creating document:", error);
      throw error;
    }
  }

  async updateDocument(id: number, updates: Partial<UpdateProjectDocument>, requestingUserId?: number): Promise<void> {
    try {
      const execute = async (tx: typeof db) => {
        await tx
          .update(projectDocuments)
          .set({
            ...updates,
            status: updates.status as ProjectStatus | undefined,
            updatedAt: new Date()
          })
          .where(eq(projectDocuments.id, id));
      };

      if (requestingUserId) {
        await withRLS(requestingUserId, execute);
      } else {
        await execute(db);
      }
    } catch (error) {
      console.error("Error updating document:", error);
      throw error;
    }
  }

  async deleteDocument(id: number, requestingUserId?: number): Promise<void> {
    try {
      const execute = async (tx: typeof db) => {
        await tx
          .delete(projectDocuments)
          .where(eq(projectDocuments.id, id));
      };

      if (requestingUserId) {
        await withRLS(requestingUserId, execute);
      } else {
        await execute(db);
      }
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
    try {
      // For getIdeasByUser, strict security is paramount.
      // We always force RLS for this call using the userId itself.
      return withRLS(userId, async (tx) => {
        return await tx.select()
          .from(ideas)
          .where(eq(ideas.userId, userId));
      });
    } catch (error) {
      console.error(`[SECURITY] Error retrieving ideas for user ${userId}:`, error);
      return [];
    }
  }

  async getIdeaById(id: number, requestingUserId?: number): Promise<Idea | undefined> {
    try {
      const execute = async (tx: typeof db) => {
        const [idea] = await tx.select().from(ideas).where(eq(ideas.id, id));
        return idea;
      };

      if (requestingUserId) {
        return withRLS(requestingUserId, execute);
      }
      // If no user context, run as system (legacy behavior)
      return execute(db);
    } catch (error) {
      console.error(`[SECURITY ERROR] Error retrieving idea ${id}:`, error);
      return undefined;
    }
  }

  async createIdea(idea: InsertIdea & { userId: number }): Promise<Idea> {
    return withRLS(idea.userId, async (tx) => {
      const [newIdea] = await tx.insert(ideas).values({
        ...idea,
        status: "Draft"
      }).returning();
      return newIdea;
    });
  }

  async updateIdea(id: number, updates: Partial<Idea>, requestingUserId?: number): Promise<void> {
    const execute = async (tx: typeof db) => {
      // Remove non-updatable fields
      const { id: _, userId: __, status: ___, createdAt: ____, updatedAt: _____, generationStartedAt: ______, ...validUpdates } = updates;

      await tx.update(ideas)
        .set({
          ...validUpdates,
          updatedAt: new Date()
        })
        .where(eq(ideas.id, id));
    };

    if (requestingUserId) {
      await withRLS(requestingUserId, execute);
    } else {
      await execute(db);
    }
  }

  async updateIdeaStatus(id: number, status: ProjectStatus, requestingUserId?: number): Promise<void> {
    const execute = async (tx: typeof db) => {
      await tx.update(ideas)
        .set({
          status,
          updatedAt: new Date()
        })
        .where(eq(ideas.id, id));
    };

    if (requestingUserId) {
      await withRLS(requestingUserId, execute);
    } else {
      await execute(db);
    }
  }

  async startIdeaGeneration(id: number, requestingUserId?: number): Promise<void> {
    const now = new Date();
    const execute = async (tx: typeof db) => {
      await tx.update(ideas)
        .set({
          status: "Generating",
          generationStartedAt: now,
          updatedAt: now
        })
        .where(eq(ideas.id, id));
      console.log(`Started generation for idea ${id} at ${now.toISOString()}`);
    };

    if (requestingUserId) {
      await withRLS(requestingUserId, execute);
    } else {
      await execute(db);
    }
  }

  async checkAndUpdateTimedOutIdeas(timeoutMinutes: number): Promise<number> {
    // Calculate the cutoff time based on timeoutMinutes
    const cutoffTime = new Date();
    cutoffTime.setMinutes(timeoutMinutes);

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

  async deleteIdea(id: number, requestingUserId?: number): Promise<void> {
    try {
      const execute = async (tx: typeof db) => {
        console.log(`Deleting idea ${id} and related data...`);

        // Delete related documents using Drizzle delete operation
        const deletedDocuments = await tx.delete(projectDocuments)
          .where(eq(projectDocuments.ideaId, id))
          .returning();
        console.log(`Deleted ${deletedDocuments.length} project documents for idea ${id}`);

        // Delete related lean canvas using Drizzle
        const deletedCanvas = await tx.delete(leanCanvas)
          .where(eq(leanCanvas.ideaId, id))
          .returning();
        console.log(`Deleted ${deletedCanvas.length} lean canvas records for idea ${id}`);

        // Finally delete the idea itself
        const deletedIdeas = await tx.delete(ideas)
          .where(eq(ideas.id, id))
          .returning();
        console.log(`Deleted ${deletedIdeas.length} idea records with id ${id}`);

        if (deletedIdeas.length === 0) {
          throw new Error(`No idea found with id ${id} to delete`);
        }
      };

      if (requestingUserId) {
        await withRLS(requestingUserId, execute);
      } else {
        await execute(db);
      }
    } catch (error) {
      console.error(`Error deleting idea ${id}:`, error);
      throw error;
    }
  }

  // Lean Canvas operations
  async getLeanCanvasByIdeaId(ideaId: number, requestingUserId?: number): Promise<LeanCanvas | undefined> {
    try {
      const execute = async (tx: typeof db) => {
        const [canvas] = await tx.select().from(leanCanvas).where(eq(leanCanvas.ideaId, ideaId));
        return canvas;
      };

      if (requestingUserId) {
        return withRLS(requestingUserId, execute);
      }
      return execute(db);
    } catch (error) {
      console.error("Error fetching lean canvas:", error);
      return undefined;
    }
  }

  async createLeanCanvas(canvas: InsertLeanCanvas, requestingUserId?: number): Promise<LeanCanvas> {
    console.log(`Creating lean canvas with data:`, JSON.stringify(canvas));

    const execute = async (tx: typeof db) => {
      const [newCanvas] = await tx.insert(leanCanvas).values(canvas).returning();

      // Also create a "project document" entry for the Lean Canvas
      try {
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

        await tx.insert(projectDocuments).values({
          ideaId: newCanvas.ideaId,
          documentType: "LeanCanvas",
          title: "Lean Canvas",
          status: "Completed",
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
      }
      return newCanvas;
    };

    if (requestingUserId) {
      return withRLS(requestingUserId, execute);
    }
    return execute(db);
  }

  async updateLeanCanvas(ideaId: number, updates: Partial<UpdateLeanCanvas>, requestingUserId?: number): Promise<void> {
    console.log(`Updating lean canvas for idea ${ideaId} with:`, JSON.stringify(updates));

    const execute = async (tx: typeof db) => {
      // Update the canvas
      const updateResult = await tx.update(leanCanvas)
        .set({
          ...updates,
          updatedAt: new Date()
        })
        .where(eq(leanCanvas.ideaId, ideaId))
        .returning();

      const updatedCanvas = updateResult[0];

      // Update the related idea's updatedAt timestamp
      await tx.update(ideas)
        .set({ updatedAt: new Date() })
        .where(eq(ideas.id, ideaId));

      // Sync to project_documents table
      if (updatedCanvas) {
        try {
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

          // Check if document exists using internal query to avoid recursion/RLS complexity in helper
          const [existingDoc] = await tx
            .select()
            .from(projectDocuments)
            .where(and(
              eq(projectDocuments.ideaId, ideaId),
              eq(projectDocuments.documentType, "LeanCanvas")
            ));

          if (existingDoc) {
            await tx.update(projectDocuments)
              .set({
                content: content,
                html: updatedCanvas.html,
                externalId: updatedCanvas.projectId,
                updatedAt: new Date()
              })
              .where(eq(projectDocuments.id, existingDoc.id));
            console.log(`Updated Lean Canvas in project_documents table`);
          } else {
            await tx.insert(projectDocuments).values({
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
    };

    if (requestingUserId) {
      await withRLS(requestingUserId, execute);
    } else {
      await execute(db);
    }
  }

  async deleteLeanCanvas(ideaId: number, requestingUserId?: number): Promise<void> {
    const execute = async (tx: typeof db) => {
      await tx.delete(leanCanvas)
        .where(eq(leanCanvas.ideaId, ideaId));
    };
    if (requestingUserId) {
      await withRLS(requestingUserId, execute);
    } else {
      await execute(db);
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
  async getUltimateWebsiteByIdeaId(ideaId: number, requestingUserId?: number): Promise<string | undefined> {
    try {
      const execute = async (tx: typeof db) => {
        const [data] = await tx.select()
          .from(ideas)
          .where(eq(ideas.id, ideaId));
        return data?.websiteUrl || undefined;
      };

      if (requestingUserId) {
        return withRLS(requestingUserId, execute);
      }
      return execute(db);
    } catch (error) {
      console.error("Error fetching ultimate website:", error);
      return undefined;
    }
  }
  async createJob(job: InsertJob): Promise<Job> {
    try {
      const execute = async (tx: typeof db) => {
        const [newJob] = await tx.insert(jobs).values({
          ...job,
          createdAt: new Date(),
          updatedAt: new Date()
        }).returning();
        return newJob;
      };

      if (job.userId) {
        return withRLS(job.userId, execute);
      }
      return execute(db);
    } catch (error) {
      console.error("Error adding job:", error);
      throw error;
    }
  }

  async updateJob(id: string, updates: Partial<UpdateJob>, requestingUserId?: number): Promise<void> {
    try {
      const execute = async (tx: typeof db) => {
        await tx.update(jobs)
          .set({
            ...updates,
            updatedAt: new Date()
          })
          .where(eq(jobs.id, id));
      };

      if (requestingUserId) {
        await withRLS(requestingUserId, execute);
      } else {
        await execute(db);
      }
    } catch (error) {
      console.error("Error updating job:", error);
      throw error;
    }
  }

  async getWorkflowJobById(id: string, requestingUserId?: number): Promise<Job | null> {
    try {
      const execute = async (tx: typeof db) => {
        // id is uuid from schema
        const result = await tx.select().from(jobs).where(eq(jobs.id, id));
        return result[0] || null;
      };

      if (requestingUserId) {
        return withRLS(requestingUserId, execute);
      }
      return execute(db);
    } catch (error) {
      console.error("Error getting job by ID:", error);
      return null;
    }
  }

  async getLatestWorkflowJob(ideaId: number, requestingUserId?: number, documentType?: string): Promise<Job | null> {
    try {
      const execute = async (tx: typeof db) => {
        let query = tx.select().from(jobs)
          .where(eq(jobs.ideaId, ideaId))
          .orderBy(desc(jobs.createdAt))
          .limit(1);

        if (documentType) {
          query = tx.select().from(jobs)
            .where(and(eq(jobs.ideaId, ideaId), eq(jobs.documentType, documentType)))
            .orderBy(desc(jobs.createdAt))
            .limit(1);
        }

        const result = await query;
        return result[0] || null;
      };

      if (requestingUserId) {
        return withRLS(requestingUserId, execute);
      }
      return execute(db);
    } catch (error) {
      console.error("Error getting latest job:", error);
      return null;
    }
  }
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private ideas: Map<number, Idea>;
  private canvases: Map<string, LeanCanvas>; // Changed to string key for UUID
  private documents: Map<number, ProjectDocument>;
  private jobs: Map<string, any>;
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
    this.jobs = new Map();
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

  async updateIdea(id: number, updates: Partial<Idea>, requestingUserId?: number): Promise<void> {
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

  async updateIdeaStatus(id: number, status: ProjectStatus, requestingUserId?: number): Promise<void> {
    const idea = this.ideas.get(id);
    if (idea) {
      idea.status = status;
      idea.updatedAt = new Date();
      this.ideas.set(id, idea);
    }
  }

  async startIdeaGeneration(id: number, requestingUserId?: number): Promise<void> {
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
    cutoffTime.setMinutes(timeoutMinutes);

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

  async deleteIdea(id: number, requestingUserId?: number): Promise<void> {
    this.ideas.delete(id);
    // Also delete associated canvas if exists
    const canvas = await this.getLeanCanvasByIdeaId(id);
    if (canvas) {
      this.canvases.delete(canvas.id);
    }
  }

  // Lean Canvas operations
  async getLeanCanvasByIdeaId(ideaId: number, requestingUserId?: number): Promise<LeanCanvas | undefined> {
    return Array.from(this.canvases.values()).find(
      (canvas) => canvas.ideaId === ideaId,
    );
  }

  async createLeanCanvas(canvas: InsertLeanCanvas, requestingUserId?: number): Promise<LeanCanvas> {
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

  async updateLeanCanvas(ideaId: number, updates: Partial<UpdateLeanCanvas>, requestingUserId?: number): Promise<void> {
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
      }
    }
  }

  async deleteLeanCanvas(ideaId: number, requestingUserId?: number): Promise<void> {
    const canvas = await this.getLeanCanvasByIdeaId(ideaId);
    if (canvas) {
      this.canvases.delete(canvas.id);
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
  async getDocumentsByIdeaId(ideaId: number, requestingUserId?: number): Promise<ProjectDocument[]> {
    return Array.from(this.documents.values()).filter(doc => doc.ideaId === ideaId);
  }

  async getDocumentById(id: number, requestingUserId?: number): Promise<ProjectDocument | undefined> {
    return this.documents.get(id);
  }

  async getDocumentByType(ideaId: number, documentType: DocumentType | string, requestingUserId?: number): Promise<ProjectDocument | undefined> {
    return Array.from(this.documents.values()).find(
      doc => doc.ideaId === ideaId && doc.documentType === documentType
    );
  }

  async createDocument(document: InsertProjectDocument, requestingUserId?: number): Promise<ProjectDocument> {
    const id = this.nextDocumentId++;
    const now = new Date();

    const newDocument: ProjectDocument = {
      id,
      ideaId: document.ideaId,
      documentType: document.documentType,
      title: document.title,
      status: (document.status as ProjectStatus) || "Draft",
      content: document.content || null,
      html: document.html || null,
      externalId: document.externalId || null,
      generationStartedAt: document.generationStartedAt ? new Date(document.generationStartedAt) : null,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    this.documents.set(id, newDocument);
    return newDocument;
  }

  async updateDocument(id: number, updates: Partial<UpdateProjectDocument>, requestingUserId?: number): Promise<void> {
    const document = this.documents.get(id);
    if (document) {
      const updatedDocument: ProjectDocument = {
        ...document,
        ...updates,
        status: (updates.status as ProjectStatus) || document.status,
        updatedAt: new Date()
      };
      this.documents.set(id, updatedDocument);
    }
  }

  async deleteDocument(id: number, requestingUserId?: number): Promise<void> {
    this.documents.delete(id);
  }

  async getUltimateWebsiteByIdeaId(ideaId: number, requestingUserId?: number): Promise<string | undefined> {
    const idea = this.ideas.get(ideaId);
    return idea?.websiteUrl || undefined;
  }

  async createJob(job: InsertJob): Promise<Job> {
    const newJob: Job = {
      id: uuidv4(),
      ideaId: job.ideaId || null,
      userId: job.userId,
      projectId: job.projectId,
      documentType: job.documentType || null,
      description: job.description || null,
      status: job.status || "",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.jobs.set(newJob.id, newJob);
    return newJob;
  }

  async updateJob(id: string, updates: Partial<UpdateJob>): Promise<void> {
    const job = this.jobs.get(id);
    if (job) {
      const updatedJob = {
        ...job,
        ...updates,
        updatedAt: new Date(),
      };
      this.jobs.set(id, updatedJob);
    }
  }

  async getWorkflowJobById(id: string): Promise<Job | null> {
    return this.jobs.get(id) || null;
  }

  async getLatestWorkflowJob(ideaId: number, requestingUserId?: number, documentType?: string): Promise<Job | null> {
    const jobs = Array.from(this.jobs.values())
      .filter(j => j.ideaId === ideaId && (!documentType || j.documentType === documentType))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return jobs[0] || null;
  }


}


// Use the database storage implementation
export const storage = new DatabaseStorage();
