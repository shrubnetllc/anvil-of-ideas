import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, sessionMiddleware } from "./auth";
import { setupSocketIO, publishJobEvent } from "./socket";
import { z } from "zod";
import { type InsertJob, type UpdateJob, type LeanCanvasContent } from "@shared/schema";
import { insertIdeaSchema, insertDocumentSchema, DocumentType } from "@shared/schema";
import { fetchProjectWorkflows, fetchProjectEstimate } from "./supabase";
import { emailService } from "./email";
import { generateVerificationToken, generateTokenExpiry, buildVerificationUrl } from "./utils/auth-utils";
import { triggerGeneration, triggerStepGeneration } from "./anvil-api";
import { setupAdminRoutes } from "./admin";

function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
}

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);
  setupAdminRoutes(app);

  // ==================== IDEAS ROUTES ====================

  app.get("/api/ideas", isAuthenticated, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const ideas = await storage.getIdeasByUser(userId);
      const verifiedIdeas = ideas.filter(idea => idea.userId === userId);
      res.json(verifiedIdeas);
    } catch (error: any) {
      next(error);
    }
  });

  app.post("/api/ideas", isAuthenticated, async (req, res, next) => {
    try {
      const validatedIdeaData = insertIdeaSchema.parse(req.body);

      if (process.env.NODE_ENV === "production") {
        const ideas = await storage.getIdeasByUser(req.user!.id);
        if (ideas.length >= 5) {
          return res.status(403).json({ message: "You have reached the maximum number of ideas allowed" });
        }
      }

      const idea = await storage.createIdea({
        ...validatedIdeaData,
        userId: req.user!.id,
      });

      res.status(201).json(idea);
    } catch (error: any) {
      next(error);
    }
  });

  app.get("/api/ideas/:id", isAuthenticated, async (req, res, next) => {
    try {
      const ideaId = req.params.id;
      const userId = req.user!.id;
      const idea = await storage.getIdeaById(ideaId, userId);

      if (!idea) {
        return res.status(404).json({ message: "Idea not found" });
      }

      res.json(idea);
    } catch (error: any) {
      next(error);
    }
  });

  app.patch("/api/ideas/:id", isAuthenticated, async (req, res, next) => {
    try {
      const ideaId = req.params.id;
      const idea = await storage.getIdeaById(ideaId, req.user!.id);

      if (!idea) {
        return res.status(404).json({ message: "Idea not found" });
      }

      if (idea.userId !== req.user!.id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const allowedFields = ['title', 'description', 'companyName', 'companyStage', 'founderName', 'founderEmail', 'websiteUrl'];
      const updates: Record<string, any> = {};

      for (const field of allowedFields) {
        if (field in req.body) {
          updates[field] = req.body[field];
        }
      }

      if (Object.keys(updates).length > 0) {
        await storage.updateIdea(ideaId, updates, req.user!.id);
        const updatedIdea = await storage.getIdeaById(ideaId, req.user!.id);
        res.json(updatedIdea);
      } else {
        res.json(idea);
      }
    } catch (error: any) {
      next(error);
    }
  });

  app.delete("/api/ideas/:id", isAuthenticated, async (req, res, next) => {
    try {
      const ideaId = req.params.id;
      const idea = await storage.getIdeaById(ideaId, req.user!.id);

      if (!idea) {
        return res.status(404).json({ message: "Idea not found" });
      }

      if (idea.userId !== req.user!.id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      await storage.deleteIdea(ideaId, req.user!.id);
      res.status(200).json({ message: "Idea deleted" });
    } catch (error: any) {
      next(error);
    }
  });

  // ==================== DOCUMENT ROUTES ====================

  // Create or update a document
  app.post("/api/ideas/:id/documents", isAuthenticated, async (req, res, next) => {
    try {
      const ideaId = req.params.id;
      const { documentType, content, contentSections } = req.body;

      if (!documentType) {
        return res.status(400).json({ message: "Missing required field: documentType" });
      }

      const idea = await storage.getIdeaById(ideaId, req.user!.id);
      if (!idea) {
        return res.status(404).json({ message: "Idea not found or access denied" });
      }

      const existingDocument = await storage.getDocumentByType(ideaId, documentType, req.user!.id);

      // Determine status: if content is provided, mark as completed; otherwise generating
      const hasContent = !!(content || contentSections);
      const docStatus = hasContent ? "completed" : "generating";

      if (existingDocument) {
        await storage.updateDocument(existingDocument.id, {
          content: content || existingDocument.content,
          contentSections: contentSections || existingDocument.contentSections,
          status: hasContent ? "completed" : existingDocument.status,
        }, req.user!.id);
        const updatedDocument = await storage.getDocumentById(existingDocument.id, req.user!.id);
        return res.status(200).json(updatedDocument);
      } else {
        const newDocument = await storage.createDocument({
          userId: req.user!.id,
          ideaId,
          documentType,
          content: content || null,
          contentSections: contentSections || null,
          status: docStatus,
        }, req.user!.id);
        return res.status(201).json(newDocument);
      }
    } catch (error: any) {
      console.error("Error creating/updating document:", error);
      next(error);
    }
  });

  // Get a specific document by type
  app.get("/api/ideas/:id/documents/:type", isAuthenticated, async (req, res, next) => {
    try {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');

      const ideaId = req.params.id;
      const documentType = req.params.type as DocumentType;

      const idea = await storage.getIdeaById(ideaId, req.user!.id);
      if (!idea) {
        return res.status(404).json({ message: "Idea not found or access denied" });
      }

      const document = await storage.getDocumentByType(ideaId, documentType, req.user!.id);

      if (!document) {
        return res.status(200).json(null);
      }

      return res.status(200).json(document);
    } catch (error: any) {
      next(error);
    }
  });

  // Get all documents for an idea
  app.get("/api/ideas/:id/documents", isAuthenticated, async (req, res, next) => {
    try {
      const ideaId = req.params.id;
      const idea = await storage.getIdeaById(ideaId, req.user!.id);
      if (!idea) {
        return res.status(404).json({ message: "Idea not found or access denied" });
      }

      const docs = await storage.getDocumentsByIdeaId(ideaId, req.user!.id);
      return res.status(200).json(docs);
    } catch (error: any) {
      next(error);
    }
  });

  // Update a specific document
  app.patch("/api/ideas/:ideaId/documents/:documentId", isAuthenticated, async (req, res, next) => {
    try {
      const { ideaId, documentId } = req.params;
      const idea = await storage.getIdeaById(ideaId, req.user!.id);
      if (!idea) {
        return res.status(404).json({ message: "Idea not found or access denied" });
      }

      const document = await storage.getDocumentById(documentId, req.user!.id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      const updates: Record<string, any> = {};
      if ('content' in req.body) updates.content = req.body.content;
      if ('contentSections' in req.body) updates.contentSections = req.body.contentSections;

      await storage.updateDocument(documentId, updates, req.user!.id);
      const updatedDocument = await storage.getDocumentById(documentId, req.user!.id);
      return res.status(200).json(updatedDocument);
    } catch (error: any) {
      next(error);
    }
  });

  // Delete a specific document
  app.delete("/api/ideas/:ideaId/documents/:documentId", isAuthenticated, async (req, res, next) => {
    try {
      const { ideaId, documentId } = req.params;
      const idea = await storage.getIdeaById(ideaId, req.user!.id);
      if (!idea) {
        return res.status(404).json({ message: "Idea not found or access denied" });
      }

      await storage.deleteDocument(documentId, req.user!.id);
      return res.status(200).json({ message: "Document deleted" });
    } catch (error: any) {
      next(error);
    }
  });

  // Delete document by type
  app.delete("/api/ideas/:id/documents/type/:type", isAuthenticated, async (req, res, next) => {
    try {
      const ideaId = req.params.id;
      const documentType = req.params.type;

      const idea = await storage.getIdeaById(ideaId, req.user!.id);
      if (!idea) {
        return res.status(404).json({ message: "Idea not found or access denied" });
      }

      const document = await storage.getDocumentByType(ideaId, documentType, req.user!.id);
      if (document) {
        await storage.deleteDocument(document.id, req.user!.id);
      }

      return res.status(200).json({ message: "Document deleted" });
    } catch (error: any) {
      next(error);
    }
  });

  // ==================== CANVAS ROUTES ====================

  // Get lean canvas (from unified documents table)
  app.get("/api/ideas/:id/canvas", isAuthenticated, async (req, res, next) => {
    try {
      const ideaId = req.params.id;
      const idea = await storage.getIdeaById(ideaId, req.user!.id);
      if (!idea) {
        return res.status(404).json({ message: "Idea not found or access denied" });
      }

      const document = await storage.getDocumentByType(ideaId, "LeanCanvas", req.user!.id);

      if (!document) {
        return res.status(200).json(null);
      }

      // Return canvas data from content_sections
      const sections = (document.contentSections as LeanCanvasContent) || {};
      return res.status(200).json({
        id: document.id,
        ideaId: document.ideaId,
        problem: sections.problem || null,
        customerSegments: sections.customerSegments || null,
        uniqueValueProposition: sections.uniqueValueProposition || null,
        solution: sections.solution || null,
        channels: sections.channels || null,
        revenueStreams: sections.revenueStreams || null,
        costStructure: sections.costStructure || null,
        keyMetrics: sections.keyMetrics || null,
        unfairAdvantage: sections.unfairAdvantage || null,
        content: document.content,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
      });
    } catch (error: any) {
      next(error);
    }
  });

  // Update lean canvas
  app.patch("/api/ideas/:id/canvas", isAuthenticated, async (req, res, next) => {
    try {
      const ideaId = req.params.id;
      const idea = await storage.getIdeaById(ideaId, req.user!.id);
      if (!idea) {
        return res.status(404).json({ message: "Idea not found or access denied" });
      }

      const canvasFields: (keyof LeanCanvasContent)[] = [
        'problem', 'customerSegments', 'uniqueValueProposition', 'solution',
        'channels', 'revenueStreams', 'costStructure', 'keyMetrics', 'unfairAdvantage'
      ];

      // Build updated sections from request body
      const sectionUpdates: Partial<LeanCanvasContent> = {};
      for (const field of canvasFields) {
        if (field in req.body) {
          sectionUpdates[field] = req.body[field];
        }
      }

      const existingDoc = await storage.getDocumentByType(ideaId, "LeanCanvas", req.user!.id);

      if (existingDoc) {
        const currentSections = (existingDoc.contentSections as LeanCanvasContent) || {};
        const mergedSections = { ...currentSections, ...sectionUpdates };
        await storage.updateDocument(existingDoc.id, {
          contentSections: mergedSections as any,
          content: req.body.content || existingDoc.content,
        }, req.user!.id);
      } else {
        // Create new LeanCanvas document
        await storage.createDocument({
          userId: req.user!.id,
          ideaId,
          documentType: "LeanCanvas",
          content: req.body.content || null,
          contentSections: sectionUpdates as any,
        }, req.user!.id);
      }

      // Update the idea's updatedAt
      await storage.updateIdea(ideaId, {}, req.user!.id);

      // Return the updated canvas
      const updated = await storage.getDocumentByType(ideaId, "LeanCanvas", req.user!.id);
      if (updated) {
        const sections = (updated.contentSections as LeanCanvasContent) || {};
        return res.status(200).json({
          id: updated.id,
          ideaId: updated.ideaId,
          problem: sections.problem || null,
          customerSegments: sections.customerSegments || null,
          uniqueValueProposition: sections.uniqueValueProposition || null,
          solution: sections.solution || null,
          channels: sections.channels || null,
          revenueStreams: sections.revenueStreams || null,
          costStructure: sections.costStructure || null,
          keyMetrics: sections.keyMetrics || null,
          unfairAdvantage: sections.unfairAdvantage || null,
          content: updated.content,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
        });
      }
      return res.status(200).json(null);
    } catch (error: any) {
      next(error);
    }
  });

  // ==================== GENERATION ROUTES (STUBBED) ====================

  // Generate canvas - triggers full pipeline via anvil-api
  app.post("/api/ideas/:id/generate", isAuthenticated, async (req, res, next) => {
    try {
      const ideaId = req.params.id;
      const userId = req.user!.id;
      const idea = await storage.getIdeaById(ideaId, userId);

      if (!idea) {
        return res.status(404).json({ message: "Idea not found" });
      }

      // Guard: check if there's already a pending/processing job for this idea
      const existingJob = await storage.getLatestWorkflowJob(ideaId, userId);
      if (existingJob) {
        const jobStatus = (existingJob.status || "").toLowerCase();
        if (jobStatus === "pending" || jobStatus === "processing" || jobStatus === "starting") {
          // Check if the anvil-api is actually still working on this job.
          // If no progress update in 5 minutes, it's stuck (e.g. container restart).
          const jobAge = Date.now() - new Date(existingJob.updatedAt).getTime();
          const STUCK_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes since last progress update
          if (jobAge > STUCK_THRESHOLD_MS) {
            console.warn(`[generate] Job ${existingJob.id} stuck at '${jobStatus}' for ${Math.round(jobAge / 60000)}m — marking as failed`);
            await storage.updateJob(existingJob.id, {
              status: "failed",
              description: "Job timed out — no progress update received within 5 minutes",
            });
            await storage.updateIdeaStatus(ideaId, "Draft", userId);
          } else {
            // Allow the user to force-override by passing ?force=true
            const force = req.query.force === "true" || req.body?.force === true;
            if (force) {
              console.warn(`[generate] Force-overriding stuck job ${existingJob.id} at '${jobStatus}'`);
              await storage.updateJob(existingJob.id, {
                status: "failed",
                description: "Manually overridden by user — starting new generation",
              });
              await storage.updateIdeaStatus(ideaId, "Draft", userId);
            } else {
              return res.status(409).json({
                message: "Generation is already in progress for this idea",
                jobId: existingJob.id,
              });
            }
          }
        }
      }

      // Create a job to track the generation
      const job = await storage.createJob({
        userId,
        ideaId,
        documentType: "LeanCanvas",
        description: "Full document generation pipeline started",
        status: "pending",
      });

      // Update idea status
      await storage.updateIdeaStatus(ideaId, "Generating", userId);

      // Fire-and-forget: trigger anvil-api generation pipeline
      triggerGeneration(ideaId, job.id).catch(async (err) => {
        console.error(`[generate] anvil-api trigger failed for idea ${ideaId}:`, err);
        try {
          await storage.updateJob(job.id, {
            status: "failed",
            description: `anvil-api trigger failed: ${err.message || err}`,
          });
          await storage.updateIdeaStatus(ideaId, "Draft", userId);
        } catch (cleanupErr) {
          console.error(`[generate] failed to clean up after trigger failure:`, cleanupErr);
        }
      });

      return res.status(200).json({
        message: "Document generation started",
        jobId: job.id,
      });
    } catch (error: any) {
      next(error);
    }
  });

  // Per-document generation endpoints — all route through the full pipeline.
  // The pipeline skips already-completed documents, so this effectively
  // resumes from wherever it left off.
  for (const { path, docType } of [
    { path: "/api/ideas/:id/generate-functional-requirements", docType: "FunctionalRequirements" },
    { path: "/api/ideas/:id/generate-business-requirements", docType: "BusinessRequirements" },
    { path: "/api/ideas/:id/workflows", docType: "Workflows" },
  ] as const) {
    app.post(path, isAuthenticated, async (req, res, next) => {
      try {
        const ideaId = req.params.id;
        const userId = req.user!.id;
        const idea = await storage.getIdeaById(ideaId, userId);

        if (!idea) {
          return res.status(404).json({ message: "Idea not found" });
        }

        // Check for stuck jobs (same logic as the main generate endpoint)
        const existingJob = await storage.getLatestWorkflowJob(ideaId, userId);
        if (existingJob) {
          const jobStatus = (existingJob.status || "").toLowerCase();
          if (jobStatus === "pending" || jobStatus === "processing" || jobStatus === "starting") {
            const jobAge = Date.now() - new Date(existingJob.updatedAt).getTime();
            const STUCK_THRESHOLD_MS = 5 * 60 * 1000;
            const force = req.query.force === "true" || req.body?.force === true;
            if (jobAge > STUCK_THRESHOLD_MS || force) {
              console.warn(`[generate:${docType}] Clearing stuck job ${existingJob.id} (age=${Math.round(jobAge / 60000)}m, force=${force})`);
              await storage.updateJob(existingJob.id, {
                status: "failed",
                description: force
                  ? "Manually overridden by user — starting new generation"
                  : "Job timed out — marked as failed automatically",
              });
            } else {
              return res.status(409).json({
                message: "Generation is already in progress for this idea",
                jobId: existingJob.id,
              });
            }
          }
        }

        const job = await storage.createJob({
          userId,
          ideaId,
          documentType: docType,
          description: `${docType} generation requested — running full pipeline (completed steps will be skipped)`,
          status: "pending",
        });

        await storage.updateIdeaStatus(ideaId, "Generating", userId);

        triggerGeneration(ideaId, job.id).catch(async (err) => {
          console.error(`[generate:${docType}] anvil-api trigger failed for idea ${ideaId}:`, err);
          try {
            await storage.updateJob(job.id, {
              status: "failed",
              description: `anvil-api trigger failed: ${err.message || err}`,
            });
            await storage.updateIdeaStatus(ideaId, "Draft", userId);
          } catch (cleanupErr) {
            console.error(`[generate:${docType}] failed to clean up after trigger failure:`, cleanupErr);
          }
        });

        return res.status(200).json({
          message: `${docType} generation started`,
          jobId: job.id,
        });
      } catch (error: any) {
        next(error);
      }
    });
  }

  // ==================== PER-STEP REGENERATION ====================

  const VALID_STEPS = ["lean_canvas", "prd", "brd", "frd", "workflows", "specs"];

  app.post("/api/ideas/:id/regenerate/:step", isAuthenticated, async (req, res, next) => {
    try {
      const ideaId = req.params.id;
      const step = req.params.step;
      const userId = req.user!.id;

      if (!VALID_STEPS.includes(step)) {
        return res.status(400).json({ message: `Invalid step: ${step}. Must be one of: ${VALID_STEPS.join(", ")}` });
      }

      const idea = await storage.getIdeaById(ideaId, userId);
      if (!idea) {
        return res.status(404).json({ message: "Idea not found" });
      }

      // Guard: check if there's already a pending/processing job for this idea
      const existingJob = await storage.getLatestWorkflowJob(ideaId, userId);
      if (existingJob) {
        const jobStatus = (existingJob.status || "").toLowerCase();
        if (jobStatus === "pending" || jobStatus === "processing" || jobStatus === "starting") {
          const jobAge = Date.now() - new Date(existingJob.updatedAt).getTime();
          const STUCK_THRESHOLD_MS = 5 * 60 * 1000;
          const force = req.query.force === "true" || req.body?.force === true;
          if (jobAge > STUCK_THRESHOLD_MS || force) {
            console.warn(`[regenerate:${step}] Clearing stuck job ${existingJob.id} (age=${Math.round(jobAge / 60000)}m, force=${force})`);
            await storage.updateJob(existingJob.id, {
              status: "failed",
              description: force
                ? "Manually overridden by user — starting step regeneration"
                : "Job timed out — marked as failed automatically",
            });
          } else {
            return res.status(409).json({
              message: "Generation is already in progress for this idea",
              jobId: existingJob.id,
            });
          }
        }
      }

      const job = await storage.createJob({
        userId,
        ideaId,
        documentType: "LeanCanvas",
        description: `Step '${step}' regeneration started`,
        status: "pending",
      });

      await storage.updateIdeaStatus(ideaId, "Generating", userId);

      // Fire-and-forget: trigger step-specific generation
      triggerStepGeneration(ideaId, job.id, step).catch(async (err) => {
        console.error(`[regenerate:${step}] anvil-api trigger failed for idea ${ideaId}:`, err);
        try {
          await storage.updateJob(job.id, {
            status: "failed",
            description: `anvil-api trigger failed: ${err.message || err}`,
          });
          await storage.updateIdeaStatus(ideaId, "Draft", userId);
        } catch (cleanupErr) {
          console.error(`[regenerate:${step}] failed to clean up after trigger failure:`, cleanupErr);
        }
      });

      return res.status(200).json({
        message: `Step '${step}' regeneration started`,
        jobId: job.id,
      });
    } catch (error: any) {
      next(error);
    }
  });

  // ==================== ULTIMATE WEBSITE GENERATION ====================

  const ULTIMATE_WEBSITE_GENERATOR_URL = process.env.ULTIMATE_WEBSITE_GENERATOR_URL || "http://localhost:8008";

  app.post("/api/ideas/:id/generate-ultimate-website", isAuthenticated, async (req, res, next) => {
    try {
      const ideaId = req.params.id;
      const userId = req.user!.id;
      const idea = await storage.getIdeaById(ideaId, userId);

      if (!idea) {
        return res.status(404).json({ message: "Idea not found" });
      }

      const { businessName, industry, targetAudience, businessDescription } = req.body;

      // Call the ultimate website generator FastAPI app directly
      const response = await fetch(`${ULTIMATE_WEBSITE_GENERATOR_URL}/api/development/ultimate-homepage-v9-2`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_name: businessName,
          industry,
          target_audience: targetAudience,
          business_description: businessDescription,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Ultimate website generator failed (${response.status}): ${text}`);
      }

      const result = await response.json();

      // Store the task_id on the idea for later retrieval
      await storage.updateIdea(ideaId, { websiteUrl: result.task_id }, userId);

      return res.status(200).json({
        message: "Ultimate website generation started",
        taskId: result.task_id,
      });
    } catch (error: any) {
      next(error);
    }
  });

  // ==================== INTERNAL WEBHOOK (anvil-api callbacks) ====================

  const ANVIL_WEBHOOK_SECRET = process.env.ANVIL_WEBHOOK_SECRET;

  app.post("/api/internal/jobs/:id/progress", async (req, res, next) => {
    try {
      // Validate shared secret
      if (!ANVIL_WEBHOOK_SECRET) {
        return res.status(503).json({ message: "Webhook not configured" });
      }
      const secret = req.headers["x-webhook-secret"];
      if (secret !== ANVIL_WEBHOOK_SECRET) {
        return res.status(401).json({ message: "Invalid webhook secret" });
      }

      const jobId = req.params.id;
      const { status, description, step } = req.body;

      if (!status) {
        return res.status(400).json({ message: "status is required" });
      }

      const job = await storage.getWorkflowJobById(jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      // Update job in database (no RLS — internal call)
      const updates: Partial<UpdateJob> = { status, description };
      await storage.updateJob(jobId, updates);

      // Map description keywords to document types for status updates
      // Descriptions from anvil-api: "Lean Canvas complete. Starting PRD (2/10)", etc.
      const DOC_COMPLETE_PATTERNS: Record<string, string> = {
        "lean canvas complete": "LeanCanvas",
        "prd complete": "ProjectRequirements",
        "brd complete": "BusinessRequirements",
        "frd complete": "FunctionalRequirements",
      };

      // Check if any document was marked complete in this progress update
      if (description && job.ideaId) {
        const lowerDesc = description.toLowerCase();
        for (const [pattern, docType] of Object.entries(DOC_COMPLETE_PATTERNS)) {
          if (lowerDesc.includes(pattern)) {
            const doc = await storage.getDocumentByType(job.ideaId, docType);
            if (doc && doc.status !== "completed") {
              await storage.updateDocument(doc.id, { status: "completed" });
              console.log(`[webhook] Marked ${docType} document as completed for idea ${job.ideaId}`);
            }
            break;
          }
        }
      }

      // Publish Socket.IO event based on status
      const stepNum = typeof step === "number" ? step : undefined;
      const lowerStatus = status.toLowerCase();
      if (lowerStatus === "completed" || lowerStatus === "done") {
        publishJobEvent(jobId, "done", { message: description || "Completed", step: stepNum });
        // Update idea status
        if (job.ideaId) {
          await storage.updateIdeaStatus(job.ideaId, "Completed");
          // Mark any remaining documents for this idea as completed
          const docs = await storage.getDocumentsByIdeaId(job.ideaId);
          for (const doc of docs) {
            if (doc.status !== "completed" && (doc.content || doc.contentSections)) {
              await storage.updateDocument(doc.id, { status: "completed" });
              console.log(`[webhook] Marked ${doc.documentType} document as completed (job done) for idea ${job.ideaId}`);
            }
          }
        }
      } else if (lowerStatus === "failed" || lowerStatus === "error") {
        publishJobEvent(jobId, "error", { message: description || "Generation failed" });
        if (job.ideaId) {
          await storage.updateIdeaStatus(job.ideaId, "Draft");
        }
      } else {
        publishJobEvent(jobId, "progress", { message: description, step: stepNum });
      }

      return res.status(200).json({ ok: true });
    } catch (error: any) {
      next(error);
    }
  });

  // ==================== JOB ROUTES ====================

  app.get("/api/jobs/:id", isAuthenticated, async (req, res, next) => {
    try {
      const jobId = req.params.id;
      const job = await storage.getWorkflowJobById(jobId, req.user!.id);

      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      if (job.userId !== req.user!.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      return res.status(200).json(job);
    } catch (error: any) {
      next(error);
    }
  });

  app.put("/api/jobs/:id", isAuthenticated, async (req, res, next) => {
    try {
      const jobId = req.params.id;
      const { status, description } = req.body;

      if (!status && !description) {
        return res.status(400).json({ message: "No updates provided" });
      }

      const job = await storage.getWorkflowJobById(jobId, req.user!.id);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      if (job.userId !== req.user!.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const updates: Partial<UpdateJob> = {};
      if (status) updates.status = status;
      if (description) updates.description = description;

      await storage.updateJob(jobId, updates, req.user!.id);
      publishJobEvent(jobId, "status", { message: description || status });

      const updatedJob = await storage.getWorkflowJobById(jobId, req.user!.id);
      return res.status(200).json(updatedJob);
    } catch (error: any) {
      next(error);
    }
  });

  app.post("/api/jobs/:id/progress", isAuthenticated, async (req, res, next) => {
    try {
      const jobId = req.params.id;
      const { progress } = req.body;

      const job = await storage.getWorkflowJobById(jobId, req.user!.id);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      if (job.userId !== req.user!.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const updates: Partial<UpdateJob> = {};
      if (progress) {
        updates.description = progress.description;
        updates.status = progress.status;
      }

      await storage.updateJob(jobId, updates, req.user!.id);

      const isCompleted = progress?.status?.toLowerCase() === 'completed';
      if (isCompleted) {
        publishJobEvent(jobId, "done", { message: progress?.description || "Completed" });
      } else {
        publishJobEvent(jobId, "progress", { message: progress?.description });
      }

      const updatedJob = await storage.getWorkflowJobById(jobId, req.user!.id);
      return res.status(200).json(updatedJob);
    } catch (error: any) {
      next(error);
    }
  });

  app.get("/api/ideas/:id/current-workflow-job", isAuthenticated, async (req, res, next) => {
    try {
      const ideaId = req.params.id;
      const documentType = req.query.documentType as string;
      const job = await storage.getLatestWorkflowJob(ideaId, req.user!.id, documentType);
      return res.status(200).json(job || null);
    } catch (error: any) {
      next(error);
    }
  });

  // ==================== SUPABASE INTEGRATION ROUTES ====================

  app.get("/api/ideas/:id/project-workflows", isAuthenticated, async (req, res, next) => {
    try {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      const ideaId = req.params.id;
      const workflows = await fetchProjectWorkflows(ideaId, req.user!.id);
      return res.status(200).json(workflows);
    } catch (error: any) {
      next(error);
    }
  });

  app.get("/api/ideas/:id/project-estimate", isAuthenticated, async (req, res, next) => {
    try {
      const ideaId = req.params.id;
      const estimate = await fetchProjectEstimate(ideaId, req.user!.id);
      return res.status(200).json(estimate);
    } catch (error: any) {
      next(error);
    }
  });

  app.get("/api/ideas/:id/ultimate-website", isAuthenticated, async (req, res, next) => {
    try {
      const ideaId = req.params.id;
      const idea = await storage.getIdeaById(ideaId, req.user!.id);
      return res.status(200).json({ task_id: idea?.websiteUrl || null });
    } catch (error: any) {
      next(error);
    }
  });

  // ==================== EMAIL ROUTES ====================

  app.post("/api/email/test", isAuthenticated, async (req, res, next) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email address is required" });
      }
      const success = await emailService.sendTestEmail(email);
      if (success) {
        return res.status(200).json({ message: "Test email sent successfully" });
      }
      return res.status(500).json({ message: "Failed to send test email" });
    } catch (error: any) {
      next(error);
    }
  });

  app.get("/api/email/verification-status", isAuthenticated, async (req, res, next) => {
    try {
      const isVerified = await storage.isEmailVerified(req.user!.id);
      return res.status(200).json({ verified: isVerified, email: req.user!.email });
    } catch (error: any) {
      next(error);
    }
  });

  app.get("/api/email/config", isAuthenticated, async (req, res, next) => {
    try {
      const fromAddress = await emailService.getFromAddress();
      return res.status(200).json({ fromAddress });
    } catch (error: any) {
      next(error);
    }
  });

  app.post("/api/email/config", isAuthenticated, async (req, res, next) => {
    try {
      const { fromAddress } = req.body;
      if (!fromAddress) {
        return res.status(400).json({ message: "fromAddress is required" });
      }
      const success = await emailService.updateFromAddress(fromAddress);
      if (success) {
        return res.status(200).json({ message: "Email config updated" });
      }
      return res.status(500).json({ message: "Failed to update email config" });
    } catch (error: any) {
      next(error);
    }
  });

  app.post("/api/email/welcome", isAuthenticated, async (req, res, next) => {
    try {
      const { email, username } = req.body;
      if (!email || !username) {
        return res.status(400).json({ message: "Email and username required" });
      }
      const success = await emailService.sendWelcomeEmail(email, username);
      return res.status(success ? 200 : 500).json({
        message: success ? "Welcome email sent" : "Failed to send"
      });
    } catch (error: any) {
      next(error);
    }
  });

  app.post("/api/email/canvas-generated", isAuthenticated, async (req, res, next) => {
    try {
      const { email, username, ideaTitle } = req.body;
      if (!email || !username || !ideaTitle) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      const success = await emailService.sendCanvasGeneratedEmail(email, username, ideaTitle);
      return res.status(success ? 200 : 500).json({
        message: success ? "Notification sent" : "Failed to send"
      });
    } catch (error: any) {
      next(error);
    }
  });

  // ==================== SETTINGS ROUTES ====================

  app.get("/api/settings", isAuthenticated, async (req, res, next) => {
    try {
      const settings = await storage.getAllSettings();
      return res.status(200).json(settings);
    } catch (error: any) {
      next(error);
    }
  });

  app.get("/api/settings/:key", isAuthenticated, async (req, res, next) => {
    try {
      const value = await storage.getSetting(req.params.key);
      return res.status(200).json({ key: req.params.key, value });
    } catch (error: any) {
      next(error);
    }
  });

  app.post("/api/settings", isAuthenticated, async (req, res, next) => {
    try {
      const { key, value } = req.body;
      if (!key) {
        return res.status(400).json({ message: "key is required" });
      }
      await storage.setSetting(key, value);
      return res.status(200).json({ message: "Setting saved" });
    } catch (error: any) {
      next(error);
    }
  });

  // ==================== EMAIL VERIFICATION ROUTES ====================

  app.get("/api/verify-email", async (req, res, next) => {
    try {
      const { userId, token } = req.query;
      if (!userId || !token) {
        return res.status(400).json({ message: "Missing userId or token" });
      }
      const success = await storage.verifyEmail(userId as string, token as string);
      if (success) {
        return res.redirect("/?verified=true");
      }
      return res.redirect("/?verified=false");
    } catch (error: any) {
      next(error);
    }
  });

  app.get("/confirm-email/:userId/:token", async (req, res, next) => {
    try {
      const { userId, token } = req.params;
      const success = await storage.verifyEmail(userId, token);
      if (success) {
        return res.redirect("/?verified=true");
      }
      return res.redirect("/?verified=false");
    } catch (error: any) {
      next(error);
    }
  });

  app.post("/api/resend-verification", isAuthenticated, async (req, res, next) => {
    try {
      const user = req.user!;
      if (!user.email) {
        return res.status(400).json({ message: "No email address on file" });
      }

      const isVerified = await storage.isEmailVerified(user.id);
      if (isVerified) {
        return res.status(400).json({ message: "Email already verified" });
      }

      const token = generateVerificationToken();
      const expiryDate = generateTokenExpiry(24);
      await storage.setVerificationToken(user.id, token, expiryDate);

      const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
      const verificationUrl = buildVerificationUrl(baseUrl, user.id, token);
      await emailService.sendVerificationEmail(user.email, user.username, verificationUrl);

      return res.status(200).json({ message: "Verification email sent" });
    } catch (error: any) {
      next(error);
    }
  });

  // ==================== SERVER SETUP ====================

  const httpServer = createServer(app);
  setupSocketIO(httpServer, sessionMiddleware);

  return httpServer;
}
