import {
  users, ideas, documents, appSettings,
  type User, type InsertUser,
  type Idea, type InsertIdea,
  type IdeaStatus, type DocumentType,
  type AppSetting,
  type Document, type InsertDocument, type UpdateDocument,
  type LeanCanvasContent,
  jobs, type Job, type InsertJob, type UpdateJob
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import connectPg from "connect-pg-simple";
import { eq, and, desc } from "drizzle-orm";
import { db, pool } from "./db";
import { v4 as uuidv4 } from "uuid";
import { withRLS } from "./db-security";

const MemoryStore = createMemoryStore(session);
const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Idea operations
  getIdeasByUser(userId: string): Promise<Idea[]>;
  getIdeaById(id: string, requestingUserId?: string): Promise<Idea | undefined>;
  createIdea(idea: InsertIdea & { userId: string }): Promise<Idea>;
  updateIdea(id: string, updates: Partial<Idea>, requestingUserId?: string): Promise<void>;
  updateIdeaStatus(id: string, status: IdeaStatus, requestingUserId?: string): Promise<void>;
  deleteIdea(id: string, requestingUserId?: string): Promise<void>;

  // Document operations (unified table)
  getDocumentsByIdeaId(ideaId: string, requestingUserId?: string): Promise<Document[]>;
  getDocumentById(id: string, requestingUserId?: string): Promise<Document | undefined>;
  getDocumentByType(ideaId: string, documentType: DocumentType | string, requestingUserId?: string): Promise<Document | undefined>;
  createDocument(document: InsertDocument, requestingUserId?: string): Promise<Document>;
  updateDocument(id: string, updates: Partial<UpdateDocument>, requestingUserId?: string): Promise<void>;
  deleteDocument(id: string, requestingUserId?: string): Promise<void>;

  // Job operations
  createJob(job: InsertJob): Promise<Job>;
  updateJob(id: string, updates: Partial<UpdateJob>, requestingUserId?: string): Promise<void>;
  getWorkflowJobById(id: string, requestingUserId?: string): Promise<Job | null>;
  getLatestWorkflowJob(ideaId: string, requestingUserId?: string, documentType?: string): Promise<Job | null>;

  // App Settings operations
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;
  getAllSettings(): Promise<Record<string, string>>;

  // Email verification
  setVerificationToken(userId: string, token: string, expiryDate: Date): Promise<void>;
  verifyEmail(userId: string, token: string): Promise<boolean>;
  isEmailVerified(userId: string): Promise<boolean>;

  // Session store
  sessionStore: any;
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
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const userData = {
      ...insertUser,
      emailVerified: "false"
    };
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }

  // Idea operations
  async getIdeasByUser(userId: string): Promise<Idea[]> {
    try {
      return withRLS(userId, async (tx) => {
        return await tx.select()
          .from(ideas)
          .where(eq(ideas.userId, userId));
      });
    } catch (error) {
      console.error(`Error retrieving ideas for user ${userId}:`, error);
      return [];
    }
  }

  async getIdeaById(id: string, requestingUserId?: string): Promise<Idea | undefined> {
    try {
      const execute = async (tx: typeof db) => {
        const [idea] = await tx.select().from(ideas).where(eq(ideas.id, id));
        return idea;
      };

      if (requestingUserId) {
        return withRLS(requestingUserId, execute);
      }
      return execute(db);
    } catch (error) {
      console.error(`Error retrieving idea ${id}:`, error);
      return undefined;
    }
  }

  async createIdea(idea: InsertIdea & { userId: string }): Promise<Idea> {
    return withRLS(idea.userId, async (tx) => {
      const [newIdea] = await tx.insert(ideas).values({
        ...idea,
        status: "Draft"
      }).returning();
      return newIdea;
    });
  }

  async updateIdea(id: string, updates: Partial<Idea>, requestingUserId?: string): Promise<void> {
    const execute = async (tx: typeof db) => {
      const { id: _, userId: __, status: ___, createdAt: ____, updatedAt: _____, ...validUpdates } = updates;
      await tx.update(ideas)
        .set({ ...validUpdates, updatedAt: new Date() })
        .where(eq(ideas.id, id));
    };

    if (requestingUserId) {
      await withRLS(requestingUserId, execute);
    } else {
      await execute(db);
    }
  }

  async updateIdeaStatus(id: string, status: IdeaStatus, requestingUserId?: string): Promise<void> {
    const execute = async (tx: typeof db) => {
      await tx.update(ideas)
        .set({ status, updatedAt: new Date() })
        .where(eq(ideas.id, id));
    };

    if (requestingUserId) {
      await withRLS(requestingUserId, execute);
    } else {
      await execute(db);
    }
  }

  async deleteIdea(id: string, requestingUserId?: string): Promise<void> {
    try {
      const execute = async (tx: typeof db) => {
        // Delete related jobs first
        await tx.delete(jobs).where(eq(jobs.ideaId, id));
        // Delete related documents
        await tx.delete(documents).where(eq(documents.ideaId, id));
        // Delete the idea
        const deleted = await tx.delete(ideas).where(eq(ideas.id, id)).returning();
        if (deleted.length === 0) {
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

  // Document operations
  async getDocumentsByIdeaId(ideaId: string, requestingUserId?: string): Promise<Document[]> {
    try {
      const execute = async (tx: typeof db) => {
        return await tx.select().from(documents)
          .where(eq(documents.ideaId, ideaId));
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

  async getDocumentById(id: string, requestingUserId?: string): Promise<Document | undefined> {
    try {
      const execute = async (tx: typeof db) => {
        const [document] = await tx.select().from(documents)
          .where(eq(documents.id, id));
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

  async getDocumentByType(ideaId: string, documentType: DocumentType | string, requestingUserId?: string): Promise<Document | undefined> {
    try {
      const execute = async (tx: typeof db) => {
        const [document] = await tx.select().from(documents)
          .where(and(
            eq(documents.ideaId, ideaId),
            eq(documents.documentType, documentType)
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

  async createDocument(document: InsertDocument, requestingUserId?: string): Promise<Document> {
    try {
      const execute = async (tx: typeof db) => {
        const [created] = await tx.insert(documents)
          .values({
            ...document,
            createdAt: new Date(),
            updatedAt: new Date(),
            generatedAt: new Date(),
          })
          .returning();
        return created;
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

  async updateDocument(id: string, updates: Partial<UpdateDocument>, requestingUserId?: string): Promise<void> {
    try {
      const execute = async (tx: typeof db) => {
        await tx.update(documents)
          .set({ ...updates, updatedAt: new Date() })
          .where(eq(documents.id, id));
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

  async deleteDocument(id: string, requestingUserId?: string): Promise<void> {
    try {
      const execute = async (tx: typeof db) => {
        await tx.delete(documents).where(eq(documents.id, id));
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

  // Job operations
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

  async updateJob(id: string, updates: Partial<UpdateJob>, requestingUserId?: string): Promise<void> {
    try {
      const execute = async (tx: typeof db) => {
        await tx.update(jobs)
          .set({ ...updates, updatedAt: new Date() })
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

  async getWorkflowJobById(id: string, requestingUserId?: string): Promise<Job | null> {
    try {
      const execute = async (tx: typeof db) => {
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

  async getLatestWorkflowJob(ideaId: string, requestingUserId?: string, documentType?: string): Promise<Job | null> {
    try {
      const execute = async (tx: typeof db) => {
        const conditions = documentType
          ? and(eq(jobs.ideaId, ideaId), eq(jobs.documentType, documentType))
          : eq(jobs.ideaId, ideaId);

        const result = await tx.select().from(jobs)
          .where(conditions)
          .orderBy(desc(jobs.createdAt))
          .limit(1);

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

  // App Settings operations
  async getSetting(key: string): Promise<string | null> {
    const [setting] = await db.select().from(appSettings).where(eq(appSettings.key, key));
    return setting?.value ?? null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    const existing = await this.getSetting(key);
    if (existing === null) {
      await db.insert(appSettings).values({ key, value });
    } else {
      await db.update(appSettings)
        .set({ value, updatedAt: new Date() })
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
  async setVerificationToken(userId: string, token: string, expiryDate: Date): Promise<void> {
    await db.update(users)
      .set({ verificationToken: token, verificationTokenExpiry: expiryDate })
      .where(eq(users.id, userId));
  }

  async verifyEmail(userId: string, token: string): Promise<boolean> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) return false;
    if (user.verificationToken !== token) return false;
    if (!user.verificationTokenExpiry || new Date() > new Date(user.verificationTokenExpiry)) return false;

    await db.update(users)
      .set({ emailVerified: "true", verificationToken: null, verificationTokenExpiry: null })
      .where(eq(users.id, userId));
    return true;
  }

  async isEmailVerified(userId: string): Promise<boolean> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    return user?.emailVerified === "true";
  }
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private ideas: Map<string, Idea>;
  private documents: Map<string, Document>;
  private jobs: Map<string, Job>;
  public sessionStore: any;

  constructor() {
    this.users = new Map();
    this.ideas = new Map();
    this.documents = new Map();
    this.jobs = new Map();
    this.sessionStore = new MemoryStore({ checkPeriod: 86400000 });
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = uuidv4();
    const user: User = {
      ...insertUser,
      id,
      email: insertUser.email || null,
      emailVerified: "false",
      verificationToken: null,
      verificationTokenExpiry: null
    };
    this.users.set(id, user);
    return user;
  }

  // Idea operations
  async getIdeasByUser(userId: string): Promise<Idea[]> {
    return Array.from(this.ideas.values()).filter(i => i.userId === userId);
  }

  async getIdeaById(id: string): Promise<Idea | undefined> {
    return this.ideas.get(id);
  }

  async createIdea(idea: InsertIdea & { userId: string }): Promise<Idea> {
    const id = uuidv4();
    const now = new Date();
    const newIdea: Idea = {
      id,
      userId: idea.userId,
      title: idea.title || "",
      description: idea.description,
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

  async updateIdea(id: string, updates: Partial<Idea>): Promise<void> {
    const idea = this.ideas.get(id);
    if (idea) {
      const { id: _, userId: __, status: ___, createdAt: ____, updatedAt: _____, ...validUpdates } = updates;
      this.ideas.set(id, { ...idea, ...validUpdates, updatedAt: new Date() });
    }
  }

  async updateIdeaStatus(id: string, status: IdeaStatus): Promise<void> {
    const idea = this.ideas.get(id);
    if (idea) {
      this.ideas.set(id, { ...idea, status, updatedAt: new Date() });
    }
  }

  async deleteIdea(id: string): Promise<void> {
    // Delete related documents
    Array.from(this.documents.entries()).forEach(([docId, doc]) => {
      if (doc.ideaId === id) this.documents.delete(docId);
    });
    // Delete related jobs
    Array.from(this.jobs.entries()).forEach(([jobId, job]) => {
      if (job.ideaId === id) this.jobs.delete(jobId);
    });
    this.ideas.delete(id);
  }

  // Document operations
  async getDocumentsByIdeaId(ideaId: string): Promise<Document[]> {
    return Array.from(this.documents.values()).filter(d => d.ideaId === ideaId);
  }

  async getDocumentById(id: string): Promise<Document | undefined> {
    return this.documents.get(id);
  }

  async getDocumentByType(ideaId: string, documentType: DocumentType | string): Promise<Document | undefined> {
    return Array.from(this.documents.values()).find(
      d => d.ideaId === ideaId && d.documentType === documentType
    );
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    const id = uuidv4();
    const now = new Date();
    const newDoc: Document = {
      id,
      userId: document.userId,
      ideaId: document.ideaId,
      jobId: document.jobId || null,
      documentType: document.documentType,
      content: document.content || null,
      contentSections: document.contentSections || null,
      createdAt: now,
      updatedAt: now,
      generatedAt: now,
    };
    this.documents.set(id, newDoc);
    return newDoc;
  }

  async updateDocument(id: string, updates: Partial<UpdateDocument>): Promise<void> {
    const doc = this.documents.get(id);
    if (doc) {
      this.documents.set(id, { ...doc, ...updates, updatedAt: new Date() });
    }
  }

  async deleteDocument(id: string): Promise<void> {
    this.documents.delete(id);
  }

  // Job operations
  async createJob(job: InsertJob): Promise<Job> {
    const newJob: Job = {
      id: uuidv4(),
      userId: job.userId,
      ideaId: job.ideaId,
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
      this.jobs.set(id, { ...job, ...updates, updatedAt: new Date() });
    }
  }

  async getWorkflowJobById(id: string): Promise<Job | null> {
    return this.jobs.get(id) || null;
  }

  async getLatestWorkflowJob(ideaId: string, _requestingUserId?: string, documentType?: string): Promise<Job | null> {
    const matching = Array.from(this.jobs.values())
      .filter(j => j.ideaId === ideaId && (!documentType || j.documentType === documentType))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return matching[0] || null;
  }

  // App Settings
  private settings: Map<string, string> = new Map();

  async getSetting(key: string): Promise<string | null> {
    return this.settings.get(key) || null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    this.settings.set(key, value);
  }

  async getAllSettings(): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    this.settings.forEach((v, k) => { result[k] = v; });
    return result;
  }

  // Email verification
  async setVerificationToken(userId: string, token: string, expiryDate: Date): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      this.users.set(userId, { ...user, verificationToken: token, verificationTokenExpiry: expiryDate });
    }
  }

  async verifyEmail(userId: string, token: string): Promise<boolean> {
    const user = this.users.get(userId);
    if (!user) return false;
    if (user.verificationToken !== token) return false;
    if (!user.verificationTokenExpiry || new Date() > new Date(user.verificationTokenExpiry)) return false;
    this.users.set(userId, { ...user, emailVerified: "true", verificationToken: null, verificationTokenExpiry: null });
    return true;
  }

  async isEmailVerified(userId: string): Promise<boolean> {
    const user = this.users.get(userId);
    return user?.emailVerified === "true";
  }
}

export const storage = new DatabaseStorage();
