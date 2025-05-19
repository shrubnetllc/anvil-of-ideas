import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { z } from "zod";
import { insertIdeaSchema, updateLeanCanvasSchema, webhookResponseSchema, insertProjectDocumentSchema, updateProjectDocumentSchema, DocumentType } from "@shared/schema";
import { fetchLeanCanvasData, fetchUserIdeas } from "./supabase";
import { emailService } from "./email";
import { generateVerificationToken, generateTokenExpiry, buildVerificationUrl } from "./utils/auth-utils";

function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
}

export async function registerRoutes(app: Express): Promise<Server> {
  // sets up /api/register, /api/login, /api/logout, /api/user
  setupAuth(app);

  // Ideas routes
  app.get("/api/ideas", isAuthenticated, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      console.log(`[SECURITY] User ${userId} requesting all their ideas`);
      
      // Get the user's ideas with proper filtering
      const ideas = await storage.getIdeasByUser(userId);
      
      // Add an extra layer of security - double-check each idea belongs to this user
      const verifiedIdeas = ideas.filter(idea => {
        if (idea.userId !== userId) {
          console.log(`[CRITICAL SECURITY VIOLATION] Idea ${idea.id} with userId ${idea.userId} was about to be sent to user ${userId}`);
          return false;
        }
        return true;
      });
      
      console.log(`[SECURITY] Returning ${verifiedIdeas.length} verified ideas to user ${userId}`);
      
      // Return only the verified ideas
      res.json(verifiedIdeas);
    } catch (error) {
      console.error('[SECURITY ERROR] Error retrieving ideas:', error);
      next(error);
    }
  });

  app.post("/api/ideas", isAuthenticated, async (req, res, next) => {
    try {
      // Extract and validate the base idea fields
      const validatedIdeaData = insertIdeaSchema.parse(req.body);
      
      // Create the idea
      const idea = await storage.createIdea({
        ...validatedIdeaData,
        userId: req.user!.id,
      });
      
      // Check if lean canvas data was submitted
      if (req.body.leanCanvas) {
        try {
          // Create the lean canvas
          await storage.createLeanCanvas({
            ideaId: idea.id,
            problem: req.body.leanCanvas.problem || null,
            customerSegments: req.body.leanCanvas.customerSegments || null,
            uniqueValueProposition: req.body.leanCanvas.uniqueValueProposition || null,
            solution: req.body.leanCanvas.solution || null,
            channels: req.body.leanCanvas.channels || null,
            revenueStreams: req.body.leanCanvas.revenueStreams || null,
            costStructure: req.body.leanCanvas.costStructure || null,
            keyMetrics: req.body.leanCanvas.keyMetrics || null,
            unfairAdvantage: req.body.leanCanvas.unfairAdvantage || null,
          });
          
          // Update the idea status to Completed if there's canvas data
          if (Object.values(req.body.leanCanvas).some(val => val)) {
            await storage.updateIdeaStatus(idea.id, "Completed");
          }
        } catch (canvasError) {
          console.error("Error creating lean canvas:", canvasError);
          // We don't fail the entire request if canvas creation fails
          // Just log the error and continue
        }
      }
      
      res.status(201).json(idea);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/ideas/:id", isAuthenticated, async (req, res, next) => {
    try {
      const ideaId = parseInt(req.params.id);
      const userId = req.user!.id;
      
      console.log(`[SECURITY] User ${userId} attempting to access idea ${ideaId}`);
      
      // Pass userId to getIdeaById for security check - this ensures the user can only access their own ideas
      const idea = await storage.getIdeaById(ideaId, userId);
      
      if (!idea) {
        console.log(`[SECURITY] Idea ${ideaId} not found or unauthorized access`);
        return res.status(404).json({ message: "Idea not found" });
      }
      
      console.log(`[SECURITY] Authorized access: User ${userId} accessing their idea ${ideaId}`);
      res.json(idea);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/ideas/:id", isAuthenticated, async (req, res, next) => {
    try {
      const ideaId = parseInt(req.params.id);
      const idea = await storage.getIdeaById(ideaId);
      
      if (!idea) {
        return res.status(404).json({ message: "Idea not found" });
      }
      
      if (idea.userId !== req.user!.id) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      // Only allow updating specific fields
      const allowedFields = ['title', 'idea', 'companyName', 'companyStage', 'founderName', 'founderEmail', 'websiteUrl'];
      const updates: Record<string, any> = {};
      
      for (const field of allowedFields) {
        if (field in req.body) {
          updates[field] = req.body[field];
        }
      }
      
      // Update the idea
      if (Object.keys(updates).length > 0) {
        await storage.updateIdea(ideaId, updates);
        const updatedIdea = await storage.getIdeaById(ideaId);
        res.json(updatedIdea);
      } else {
        res.status(400).json({ message: "No valid fields to update" });
      }
    } catch (error) {
      next(error);
    }
  });

  // Document management routes
  // Create or update a document
  app.post("/api/ideas/:id/documents", isAuthenticated, async (req, res, next) => {
    try {
      const ideaId = parseInt(req.params.id);
      const { documentType, title, status, content, html, externalId } = req.body;
      
      // Validate required fields
      if (!documentType || !title) {
        return res.status(400).json({ message: "Missing required fields: documentType, title" });
      }
      
      // Check if the user has permission to access this idea
      const idea = await storage.getIdeaById(ideaId, req.user!.id);
      if (!idea) {
        return res.status(404).json({ message: "Idea not found or access denied" });
      }
      
      // Check if document already exists for this idea and type
      const existingDocument = await storage.getDocumentByType(ideaId, documentType);
      
      if (existingDocument) {
        // Update the existing document
        await storage.updateDocument(existingDocument.id, {
          title,
          status,
          content: content || existingDocument.content,
          html: html || existingDocument.html,
          externalId: externalId || existingDocument.externalId
        });
        
        const updatedDocument = await storage.getDocumentById(existingDocument.id);
        return res.status(200).json(updatedDocument);
      } else {
        // Create a new document
        const newDocument = await storage.createDocument({
          ideaId,
          documentType,
          title,
          status: status || "Draft",
          content: content || null,
          html: html || null,
          externalId: externalId || null
        });
        
        return res.status(200).json(newDocument);
      }
    } catch (error) {
      console.error("Error creating/updating document:", error);
      next(error);
    }
  });
  
  // Get a specific document by type
  app.get("/api/ideas/:id/documents/:type", isAuthenticated, async (req, res, next) => {
    try {
      const ideaId = parseInt(req.params.id);
      const documentType = req.params.type;
      
      // Check if the user has permission to access this idea
      const idea = await storage.getIdeaById(ideaId, req.user!.id);
      if (!idea) {
        return res.status(404).json({ message: "Idea not found or access denied" });
      }
      
      const document = await storage.getDocumentByType(ideaId, documentType);
      
      if (!document) {
        return res.status(404).json({ message: `No ${documentType} document found for idea ${ideaId}` });
      }
      
      res.status(200).json(document);
    } catch (error) {
      console.error(`Error fetching ${req.params.type} document:`, error);
      next(error);
    }
  });
  
  // Get all documents for an idea
  app.get("/api/ideas/:id/documents", isAuthenticated, async (req, res, next) => {
    try {
      const ideaId = parseInt(req.params.id);
      
      // Check if the user has permission to access this idea
      const idea = await storage.getIdeaById(ideaId, req.user!.id);
      if (!idea) {
        return res.status(404).json({ message: "Idea not found or access denied" });
      }
      
      const documents = await storage.getDocumentsByIdeaId(ideaId);
      
      res.status(200).json(documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
      next(error);
    }
  });
  
  // Update a specific document
  app.patch("/api/ideas/:ideaId/documents/:documentId", isAuthenticated, async (req, res, next) => {
    try {
      const ideaId = parseInt(req.params.ideaId);
      const documentId = parseInt(req.params.documentId);
      
      // Check if the user has permission to access this idea
      const idea = await storage.getIdeaById(ideaId, req.user!.id);
      if (!idea) {
        return res.status(404).json({ message: "Idea not found or access denied" });
      }
      
      // Get the document and verify it belongs to this idea
      const document = await storage.getDocumentById(documentId);
      if (!document || document.ideaId !== ideaId) {
        return res.status(404).json({ message: "Document not found or doesn't belong to this idea" });
      }
      
      await storage.updateDocument(documentId, req.body);
      const updatedDocument = await storage.getDocumentById(documentId);
      
      res.status(200).json(updatedDocument);
    } catch (error) {
      console.error("Error updating document:", error);
      next(error);
    }
  });
  
  app.delete("/api/ideas/:id", isAuthenticated, async (req, res, next) => {
    try {
      const idea = await storage.getIdeaById(parseInt(req.params.id));
      
      if (!idea) {
        return res.status(404).json({ message: "Idea not found" });
      }
      
      if (idea.userId !== req.user!.id) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      await storage.deleteIdea(parseInt(req.params.id));
      res.status(200).json({ message: "Idea deleted successfully" });
    } catch (error) {
      next(error);
    }
  });

  // Canvas generation route
  // Webhook proxy for Project Requirements
  app.post("/api/webhook/requirements", isAuthenticated, async (req, res, next) => {
    try {
      const { projectId, instructions } = req.body;
      
      if (!projectId) {
        return res.status(400).json({ message: "Project ID is required" });
      }
      
      // Use the PRD-specific webhook URL from environment variables
      const webhookUrl = process.env.N8N_PRD_WEBHOOK_URL;
      const username = process.env.N8N_AUTH_USERNAME;
      const password = process.env.N8N_AUTH_PASSWORD;
      
      if (!webhookUrl) {
        return res.status(500).json({ message: "N8N Project Requirements webhook URL not configured" });
      }
      
      if (!username || !password) {
        return res.status(500).json({ message: "N8N authentication credentials not configured" });
      }
      
      // Create basic auth header
      const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
      
      console.log(`Sending project requirements request to n8n for project ${projectId}`);
      console.log(`Using webhook URL: ${webhookUrl}`);
      console.log(`With instructions: ${instructions || "No specific instructions"}`);
      
      // Create a document record before calling N8N to ensure we have a record
      // to update later even if the webhook call to n8n fails
      let document;
      const ideaId = parseInt(projectId.toString());
      const existingDocument = await storage.getDocumentByType(ideaId, "ProjectRequirements");
      
      if (existingDocument) {
        // Update existing document
        await storage.updateDocument(existingDocument.id, {
          status: "Generating",
          generationStartedAt: new Date()
        });
        document = await storage.getDocumentById(existingDocument.id);
        console.log(`Updated existing document ${existingDocument.id} for requirements generation`);
      } else {
        // Create a new document
        document = await storage.createDocument({
          ideaId,
          documentType: "ProjectRequirements",
          title: "Project Requirements",
          status: "Generating",
          generationStartedAt: new Date()
        });
        console.log(`Created new document ${document.id} for requirements generation`);
      }
      
      // Call the n8n webhook with the correct payload structure
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": authHeader
        },
        body: JSON.stringify({
          // The n8n workflow expects just the project_id that matches the Supabase ID
          project_id: projectId,
          // Send user's instructions from the UI form
          instructions: instructions || "Be brief and concise."
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Failed to call requirements webhook: ${response.status} ${errorText}`);
        
        // Even if the webhook fails, we'll return a 200 with the document
        // This allows the UI to show the "generating" state and poll for updates
        // We'll set the document to a "Failed" state after some time if no n8n response arrives
        
        res.status(200).json({ 
          message: "Requirements document created, but webhook failed. Document will remain in Generating state until timeout.",
          document,
          webhookError: errorText
        });
        return;
      }
      
      // Read the response which contains the prd_id
      const responseData = await response.text();
      console.log(`Requirements generation webhook response: ${responseData}`);
      
      // The response should be a prd_id like "29c3941e-6c36-4557-8bc1-ab21a92738d3"
      // This ID will be needed later to match with the completed document
      
      // Update the document with the external ID
      await storage.updateDocument(document.id, {
        externalId: responseData.trim()
      });
      console.log(`Updated document ${document.id} with external ID ${responseData.trim()}`);
      
      // Get the updated document to return
      const updatedDocument = await storage.getDocumentById(document.id);
      
      res.status(200).json({ 
        message: "Requirements generation started",
        document: updatedDocument,
        data: responseData.trim()
      });
    } catch (error) {
      console.error("Error in requirements webhook proxy:", error);
      next(error);
    }
  });
  
  // Canvas generation route
  app.post("/api/ideas/:id/generate", isAuthenticated, async (req, res, next) => {
    try {
      const ideaId = parseInt(req.params.id);
      const idea = await storage.getIdeaById(ideaId);
      
      if (!idea) {
        return res.status(404).json({ message: "Idea not found" });
      }
      
      if (idea.userId !== req.user!.id) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      // Start idea generation with timestamp
      await storage.startIdeaGeneration(ideaId);
      
      // Trigger the webhook to n8n
      try {
        console.log(`Starting canvas generation for idea ${ideaId}`);
        
        const webhookUrl = process.env.N8N_WEBHOOK_URL;
        const username = process.env.N8N_AUTH_USERNAME;
        const password = process.env.N8N_AUTH_PASSWORD;
        
        console.log(`Webhook URL: ${webhookUrl ? 'configured' : 'missing'}`);
        console.log(`Auth credentials: ${username && password ? 'configured' : 'missing'}`);
        
        if (!webhookUrl) {
          throw new Error("N8N webhook URL not configured");
        }
        
        if (!username || !password) {
          throw new Error("N8N authentication credentials not configured");
        }
        
        // Create basic auth header
        const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
        
        // Create the payload
        const payload = {
          title: idea.title || "",
          idea: idea.idea,
          founder_name: idea.founderName || "",
          founder_email: idea.founderEmail || "",
          company_stage: idea.companyStage || "",
          website_url: idea.websiteUrl || "",
          company_name: idea.companyName || "",
          
          lean_canvas: {
            problem: "",
            customer_segments: "",
            unique_value_proposition: "",
            solution: "",
            channels: "",
            revenue_streams: "",
            cost_structure: "",
            key_metrics: "",
            unfair_advantage: ""
          },
          
          traction_evidence: {
            customer_interviews: 0,
            waitlist_signups: 0,
            paying_customers: 0
          },
          
          target_launch_date: "2026-01-15",
          preferred_pricing_model: "",
          additional_notes: "",
          "unique-user-id": `user-${idea.userId}-idea-${ideaId}`
        };
        
        console.log(`Sending payload to n8n:`, JSON.stringify(payload, null, 2));
        
        // Send the idea data to n8n with basic auth in the exact format required
        const response = await fetch(webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": authHeader
          },
          body: JSON.stringify(payload)
        });
        
        const responseStatus = response.status;
        const responseText = await response.text();
        console.log(`N8N webhook response: ${responseStatus} - ${responseText}`);
        
        if (!response.ok) {
          throw new Error(`Failed to call n8n webhook: ${responseStatus} ${responseText}`);
        }
        
        // Extract the project_id from the response text
        const projectId = responseText.trim();
        console.log(`Extracted project_id from response: ${projectId}`);
        
        // Store the project_id in the database
        if (projectId) {
          try {
            // Check if lean canvas already exists for this idea
            const existingCanvas = await storage.getLeanCanvasByIdeaId(ideaId);
            
            if (existingCanvas) {
              // Update the existing canvas with the project_id
              await storage.updateLeanCanvas(ideaId, { projectId });
              console.log(`Updated existing canvas with project_id: ${projectId}`);
            } else {
              // Create a new canvas with the project_id
              await storage.createLeanCanvas({ 
                ideaId,
                projectId,
                problem: null,
                customerSegments: null,
                uniqueValueProposition: null,
                solution: null,
                channels: null,
                revenueStreams: null,
                costStructure: null,
                keyMetrics: null,
                unfairAdvantage: null
              });
              console.log(`Created new canvas with project_id: ${projectId}`);
            }
          } catch (dbError) {
            console.error('Failed to store project_id in database:', dbError);
            // Continue even if database storage fails
          }
        }
        
        res.status(200).json({ 
          message: "Canvas generation started",
          projectId: projectId || null 
        });
      } catch (error) {
        console.error("Error triggering webhook:", error);
        await storage.updateIdeaStatus(ideaId, "Draft");
        throw new Error("Failed to start canvas generation");
      }
    } catch (error) {
      next(error);
    }
  });

  // Webhook endpoint for n8n to send back the generated requirements
  app.post("/api/webhook/requirements-result", async (req, res, next) => {
    // Verify n8n credentials if they are configured
    if (process.env.N8N_AUTH_USERNAME && process.env.N8N_AUTH_PASSWORD) {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Basic ')) {
        return res.status(401).json({ message: "Unauthorized - Missing credentials" });
      }
      
      // Decode and verify the credentials
      const base64Credentials = authHeader.split(' ')[1];
      const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
      const [username, password] = credentials.split(':');
      
      if (username !== process.env.N8N_AUTH_USERNAME || password !== process.env.N8N_AUTH_PASSWORD) {
        return res.status(401).json({ message: "Unauthorized - Invalid credentials" });
      }
    }
    
    try {
      console.log("Received requirements data from n8n:", JSON.stringify(req.body, null, 2));
      
      // Extract data from the webhook payload
      const { ideaId, prd_id, content, html } = req.body;
      
      if (!ideaId || !content) {
        return res.status(400).json({ message: "Missing required fields: ideaId, content" });
      }
      
      // Search for a document with this prd_id as externalId
      // If not found, try to find by ideaId and documentType
      let existingDocument = null;
      
      // First try to find by the external ID (prd_id) if it was provided
      if (prd_id) {
        // We could add a getDocumentByExternalId method to our storage interface
        // For now, we'll get all documents for the idea and filter
        const allDocs = await storage.getDocumentsByIdeaId(parseInt(ideaId));
        existingDocument = allDocs.find(doc => 
          doc.documentType === "ProjectRequirements" && doc.externalId === prd_id
        );
      }
      
      // If not found by external ID, try to find by type
      if (!existingDocument) {
        existingDocument = await storage.getDocumentByType(parseInt(ideaId), "ProjectRequirements");
      }
      
      if (existingDocument) {
        // Update existing document
        await storage.updateDocument(existingDocument.id, {
          content,
          html: html || null,
          status: "Completed",
          externalId: prd_id || existingDocument.externalId // Preserve the external ID if it exists
        });
        console.log(`Updated existing document for idea ${ideaId} with project requirements`);
      } else {
        // Create new document
        await storage.createDocument({
          ideaId: parseInt(ideaId),
          documentType: "ProjectRequirements",
          title: "Project Requirements",
          content,
          html: html || null,
          status: "Completed",
          externalId: prd_id || null
        });
        console.log(`Created new document for idea ${ideaId} with project requirements`);
      }
      
      // Get the idea information to send notification
      try {
        const idea = await storage.getIdeaById(parseInt(ideaId));
        if (idea && idea.founderEmail) {
          // Send email notification that the requirements are generated
          const title = idea.title || idea.idea.substring(0, 30) + '...';
          await emailService.sendCanvasGeneratedEmail(idea.founderEmail, idea.founderName || 'User', title);
          console.log(`Sent requirements generation notification email to ${idea.founderEmail}`);
        }
      } catch (emailError) {
        console.error('Failed to send requirements generation notification:', emailError);
        // Continue even if email sending fails
      }
      
      res.status(200).json({ message: "Requirements document processed successfully" });
    } catch (error) {
      console.error("Error processing requirements webhook:", error);
      next(error);
    }
  });
  
  // Webhook endpoint for n8n to send back the generated canvas
  app.post("/api/webhook/canvas", async (req, res, next) => {
    // Verify n8n credentials if they are configured
    if (process.env.N8N_AUTH_USERNAME && process.env.N8N_AUTH_PASSWORD) {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Basic ')) {
        return res.status(401).json({ message: "Unauthorized - Missing credentials" });
      }
      
      // Decode and verify the credentials
      const base64Credentials = authHeader.split(' ')[1];
      const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
      const [username, password] = credentials.split(':');
      
      if (username !== process.env.N8N_AUTH_USERNAME || password !== process.env.N8N_AUTH_PASSWORD) {
        return res.status(401).json({ message: "Unauthorized - Invalid credentials" });
      }
    }
    try {
      console.log("Received webhook data from n8n:", JSON.stringify(req.body, null, 2));
      
      // Parse and transform the webhook data according to our schema
      // The schema transform will throw if ideaId is missing
      const transformedData = webhookResponseSchema.parse(req.body);
      const { ideaId, ...canvasData } = transformedData;
      
      // Update idea status to Completed
      console.log(`Updating idea ${ideaId} status to Completed`);
      await storage.updateIdeaStatus(ideaId, "Completed");
      
      // Check if a canvas already exists for this idea
      const existingCanvas = await storage.getLeanCanvasByIdeaId(ideaId);
      
      console.log(`Canvas data to save:`, JSON.stringify(canvasData, null, 2));
      
      if (existingCanvas) {
        // Update existing canvas
        console.log(`Updating existing canvas for idea ${ideaId}`);
        await storage.updateLeanCanvas(ideaId, canvasData);
      } else {
        // Create new canvas
        console.log(`Creating new canvas for idea ${ideaId}`);
        await storage.createLeanCanvas({ ideaId, ...canvasData });
      }
      
      // Get the idea information to send notification
      try {
        const idea = await storage.getIdeaById(ideaId);
        if (idea && idea.founderEmail) {
          // Send email notification that the canvas is generated
          const title = idea.title || idea.idea.substring(0, 30) + '...';
          await emailService.sendCanvasGeneratedEmail(idea.founderEmail, idea.founderName || 'User', title);
          console.log(`Sent canvas generation notification email to ${idea.founderEmail}`);
        }
      } catch (emailError) {
        console.error('Failed to send canvas generation notification:', emailError);
        // Continue even if email sending fails
      }
      
      res.status(200).json({ message: "Canvas created successfully" });
    } catch (error) {
      console.error("Error processing webhook:", error);
      next(error);
    }
  });

  // Canvas routes
  app.get("/api/ideas/:id/canvas", isAuthenticated, async (req, res, next) => {
    try {
      const ideaId = parseInt(req.params.id);
      const userId = req.user!.id;
      
      console.log(`[SECURITY] User ${userId} attempting to access canvas for idea ${ideaId}`);
      
      // Pass userId directly to getLeanCanvasByIdeaId which will check ownership
      const canvas = await storage.getLeanCanvasByIdeaId(ideaId, userId);
      
      if (!canvas) {
        console.log(`[SECURITY] Canvas for idea ${ideaId} not found or unauthorized`);
        return res.status(404).json({ message: "Canvas not found" });
      }
      
      console.log(`[SECURITY] Authorized canvas access: User ${userId} accessing canvas for their idea ${ideaId}`);
      res.json(canvas);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/ideas/:id/canvas", isAuthenticated, async (req, res, next) => {
    try {
      const ideaId = parseInt(req.params.id);
      const idea = await storage.getIdeaById(ideaId);
      
      if (!idea) {
        return res.status(404).json({ message: "Idea not found" });
      }
      
      if (idea.userId !== req.user!.id) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const canvas = await storage.getLeanCanvasByIdeaId(ideaId);
      
      if (!canvas) {
        return res.status(404).json({ message: "Canvas not found" });
      }
      
      const validatedData = updateLeanCanvasSchema.partial().parse(req.body);
      await storage.updateLeanCanvas(ideaId, validatedData);
      
      const updatedCanvas = await storage.getLeanCanvasByIdeaId(ideaId);
      res.json(updatedCanvas);
    } catch (error) {
      next(error);
    }
  });
  
  // Supabase integration routes
  app.get("/api/supabase/canvas/:id", isAuthenticated, async (req, res, next) => {
    try {
      const ideaId = parseInt(req.params.id);
      const userId = req.user!.id;
      
      console.log(`[SECURITY] User ${userId} attempting to access Supabase canvas for idea ${ideaId}`);
      
      // First verify the user owns this idea with enhanced security
      const idea = await storage.getIdeaById(ideaId, userId);
      
      if (!idea) {
        console.log(`[SECURITY] Idea ${ideaId} not found or unauthorized for Supabase canvas access`);
        return res.status(404).json({ message: "Idea not found" });
      }
      
      // At this point, we've verified ownership through the storage security check
      console.log(`[SECURITY] Authorization confirmed: User ${userId} owns idea ${ideaId} for Supabase canvas access`);
      
      // Fetch data from Supabase with security context
      try {
        // Add userId as authorization check for fetchLeanCanvasData
        const supabaseCanvas = await fetchLeanCanvasData(ideaId, userId);
        res.json({
          source: "supabase",
          data: supabaseCanvas
        });
      } catch (supabaseError) {
        console.error(`[SECURITY] Error fetching from Supabase for idea ${ideaId} belonging to user ${userId}:`, supabaseError);
        
        // Fallback to local storage if Supabase fails, with security check
        const localCanvas = await storage.getLeanCanvasByIdeaId(ideaId, userId);
        if (!localCanvas) {
          return res.status(404).json({ message: "Canvas not found" });
        }
        
        res.json({
          source: "local",
          data: localCanvas
        });
      }
    } catch (error) {
      next(error);
    }
  });
  
  app.get("/api/supabase/ideas", isAuthenticated, async (req, res, next) => {
    try {
      // Extract authenticated user ID
      const authenticatedUserId = req.user!.id;
      
      // Fetch data from Supabase with authorization check
      try {
        // Pass both the user ID and the authenticated user ID for permission check
        const supabaseIdeas = await fetchUserIdeas(authenticatedUserId, authenticatedUserId);
        res.json({
          source: "supabase",
          data: supabaseIdeas
        });
      } catch (supabaseError) {
        console.error("Error fetching ideas from Supabase:", supabaseError);
        
        // Fallback to local storage if Supabase fails
        const localIdeas = await storage.getIdeasByUser(authenticatedUserId);
        res.json({
          source: "local",
          data: localIdeas
        });
      }
    } catch (error) {
      next(error);
    }
  });

  // Email service routes
  app.post("/api/email/test", isAuthenticated, async (req, res, next) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email address is required" });
      }
      
      const result = await emailService.sendTestEmail(email);
      
      if (result) {
        res.json({ success: true, message: "Test email sent successfully" });
      } else {
        res.status(500).json({ success: false, message: "Failed to send test email" });
      }
    } catch (error) {
      next(error);
    }
  });
  
  // Email verification status endpoint
  app.get("/api/email/verification-status", isAuthenticated, async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const isVerified = await storage.isEmailVerified(req.user.id);
      res.json({ 
        isVerified,
        email: req.user.email || null
      });
    } catch (error) {
      next(error);
    }
  });
  
  // Get email configuration
  app.get("/api/email/config", isAuthenticated, async (req, res, next) => {
    try {
      const fromAddress = await emailService.getFromAddress();
      res.json({ fromAddress });
    } catch (error) {
      next(error);
    }
  });
  
  // Update email configuration
  app.post("/api/email/config", isAuthenticated, async (req, res, next) => {
    try {
      const { fromAddress } = req.body;
      
      if (!fromAddress) {
        return res.status(400).json({ message: "From address is required" });
      }
      
      const result = await emailService.updateFromAddress(fromAddress);
      
      if (result) {
        res.json({ success: true, message: "Email configuration updated successfully" });
      } else {
        res.status(500).json({ success: false, message: "Failed to update email configuration" });
      }
    } catch (error) {
      next(error);
    }
  });
  
  // Send welcome email route
  app.post("/api/email/welcome", isAuthenticated, async (req, res, next) => {
    try {
      const { email, username } = req.body;
      
      if (!email || !username) {
        return res.status(400).json({ message: "Email address and username are required" });
      }
      
      const result = await emailService.sendWelcomeEmail(email, username);
      
      if (result) {
        res.json({ success: true, message: "Welcome email sent successfully" });
      } else {
        res.status(500).json({ success: false, message: "Failed to send welcome email" });
      }
    } catch (error) {
      next(error);
    }
  });
  
  // Send canvas generated notification email
  app.post("/api/email/canvas-generated", isAuthenticated, async (req, res, next) => {
    try {
      const { email, username, ideaTitle } = req.body;
      
      if (!email || !username || !ideaTitle) {
        return res.status(400).json({ message: "Email address, username, and idea title are required" });
      }
      
      const result = await emailService.sendCanvasGeneratedEmail(email, username, ideaTitle);
      
      if (result) {
        res.json({ success: true, message: "Canvas generation notification email sent successfully" });
      } else {
        res.status(500).json({ success: false, message: "Failed to send canvas generation notification email" });
      }
    } catch (error) {
      next(error);
    }
  });

  // App Settings routes
  app.get("/api/settings", isAuthenticated, async (req, res, next) => {
    try {
      const settings = await storage.getAllSettings();
      res.json(settings);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/settings/:key", isAuthenticated, async (req, res, next) => {
    try {
      const key = req.params.key;
      const value = await storage.getSetting(key);
      
      if (value === null) {
        res.status(404).json({ message: `Setting '${key}' not found` });
      } else {
        res.json({ key, value });
      }
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/settings", isAuthenticated, async (req, res, next) => {
    try {
      const { key, value } = req.body;
      
      if (!key || typeof value !== 'string') {
        return res.status(400).json({ message: "Key and value are required" });
      }
      
      await storage.setSetting(key, value);
      res.json({ key, value });
    } catch (error) {
      next(error);
    }
  });
  
  // Email verification endpoints - both legacy query param format and new path-based format
  app.get("/api/verify-email", async (req, res, next) => {
    try {
      const userId = parseInt(req.query.userId as string);
      const token = req.query.token as string;
      
      if (!userId || !token) {
        return res.status(400).json({ message: "Missing userId or token" });
      }
      
      const verified = await storage.verifyEmail(userId, token);
      
      if (verified) {
        // Get the user to send welcome email
        const user = await storage.getUser(userId);
        
        if (user && user.email) {
          try {
            // Send welcome email upon successful verification
            await emailService.sendWelcomeEmail(user.email, user.username);
            console.log(`Welcome email sent to ${user.email} after verification`);
          } catch (emailError) {
            console.error('Failed to send welcome email after verification:', emailError);
            // Continue even if welcome email fails
          }
        }
        
        // Email successfully verified, redirect to success page
        res.redirect('/?verified=true');
      } else {
        // Verification failed, redirect to error page
        res.redirect('/?verified=false');
      }
    } catch (error) {
      next(error);
    }
  });
  
  // Add a server route to handle the new path-based URLs for email verification
  app.get("/confirm-email/:userId/:token", async (req, res, next) => {
    try {
      const userId = parseInt(req.params.userId);
      const token = req.params.token;
      
      if (isNaN(userId) || !token) {
        return res.status(400).json({ message: "Invalid verification link" });
      }
      
      const verified = await storage.verifyEmail(userId, token);
      
      if (verified) {
        // Get the user to send welcome email
        const user = await storage.getUser(userId);
        
        if (user && user.email) {
          try {
            // Send welcome email upon successful verification
            await emailService.sendWelcomeEmail(user.email, user.username);
            console.log(`Welcome email sent to ${user.email} after verification`);
          } catch (emailError) {
            console.error('Failed to send welcome email after verification:', emailError);
            // Continue even if welcome email fails
          }
        }
        
        // Email successfully verified, redirect to success page
        res.redirect('/?verified=true');
      } else {
        // Verification failed, redirect to error page
        res.redirect('/?verified=false');
      }
    } catch (error) {
      next(error);
    }
  });
  
  app.post("/api/resend-verification", isAuthenticated, async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const user = req.user;
      
      // Check if user email is already verified
      const isVerified = await storage.isEmailVerified(user.id);
      if (isVerified) {
        return res.status(400).json({ message: "Email is already verified" });
      }
      
      // Generate new verification token
      const token = generateVerificationToken();
      const expiryDate = generateTokenExpiry(24); // 24 hours
      
      // Store token in database
      await storage.setVerificationToken(user.id, token, expiryDate);
      
      // Determine base URL for verification link
      const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
      const verificationUrl = buildVerificationUrl(baseUrl, user.id, token);
      
      // Send verification email
      const success = await emailService.sendVerificationEmail(user.email!, user.username, verificationUrl);
      
      if (success) {
        res.json({ success: true, message: "Verification email sent successfully" });
      } else {
        res.status(500).json({ success: false, message: "Failed to send verification email" });
      }
    } catch (error) {
      next(error);
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
