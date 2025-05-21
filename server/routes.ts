import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { z } from "zod";
import { insertIdeaSchema, updateLeanCanvasSchema, webhookResponseSchema, insertProjectDocumentSchema, updateProjectDocumentSchema, DocumentType } from "@shared/schema";
import { fetchLeanCanvasData, fetchUserIdeas, fetchBusinessRequirements, fetchFunctionalRequirements } from "./supabase";
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

  // Generate Business Requirements Document for an idea
  // Functional Requirements Document generation API
  app.post("/api/ideas/:id/generate-functional-requirements", isAuthenticated, async (req, res, next) => {
    try {
      const ideaId = parseInt(req.params.id);
      const userId = req.user!.id;
      const { instructions } = req.body;
      
      console.log(`[FUNCTIONAL REQUIREMENTS] User ${userId} requesting functional requirements generation for idea ${ideaId}`);
      
      // Verify the idea exists and belongs to the user
      const idea = await storage.getIdeaById(ideaId, userId);
      if (!idea) {
        return res.status(404).json({ error: "Idea not found or you don't have access to it" });
      }
      
      // Check if a functional requirements document already exists
      const existingDoc = await storage.getDocumentByType(ideaId, 'FunctionalRequirements');
      if (existingDoc) {
        return res.status(409).json({ 
          error: 'Functional requirements document already exists', 
          document: existingDoc 
        });
      }
      
      // Step 1: Create the document with Generating status
      const document = await storage.createDocument({
        ideaId,
        title: "Functional Requirements Document",
        documentType: "FunctionalRequirements",
        status: "Generating",
        generationStartedAt: new Date()
      });
      
      console.log(`Created functional requirements document with ID ${document.id}`);
      
      // Step 2: Collect and verify the IDs for related documents
      let canvasId = null;
      let prdId = null;
      let brdId = null;
      let projectId = null;
      
      // Get the lean canvas ID
      try {
        const canvas = await storage.getLeanCanvasByIdeaId(ideaId);
        if (canvas && canvas.leancanvasId) {
          canvasId = canvas.leancanvasId;
          console.log(`Found canvas ID: ${canvasId}`);
        }
        if (canvas && canvas.projectId) {
          projectId = canvas.projectId;
          console.log(`Found project ID: ${projectId}`);
        }
      } catch (canvasError) {
        console.error("Error getting canvas ID:", canvasError);
      }
      
      // Get the PRD external ID
      try {
        const prdDoc = await storage.getDocumentByType(ideaId, 'ProjectRequirements');
        if (prdDoc && prdDoc.externalId) {
          prdId = prdDoc.externalId;
          console.log(`Found PRD ID: ${prdId}`);
        }
      } catch (prdError) {
        console.error("Error getting PRD ID:", prdError);
      }
      
      // Get the BRD external ID
      try {
        const brdDoc = await storage.getDocumentByType(ideaId, 'BusinessRequirements');
        if (brdDoc && brdDoc.externalId) {
          brdId = brdDoc.externalId;
          console.log(`Found BRD ID: ${brdId}`);
        }
      } catch (brdError) {
        console.error("Error getting BRD ID:", brdError);
      }
      
      // Step 3: Prepare the request body for the webhook
      const webhookUrl = process.env.N8N_FUNCTIONAL_WEBHOOK_URL;
      if (!webhookUrl) {
        throw new Error('Functional Requirements webhook URL not configured');
      }
      
      console.log(`Calling functional requirements webhook: ${webhookUrl.substring(0, 20)}...`);
      
      const webhookBody = {
        ideaId,
        documentId: document.id,
        leancanvas_id: canvasId,
        prd_id: prdId,
        project_id: projectId,
        brd_id: brdId,
        title: idea.title,
        description: idea.idea,
        instructions: instructions || ""
      };
      
      console.log(`Webhook request body: ${JSON.stringify(webhookBody)}`);
      
      // Step 4: Call the webhook with authentication
      const username = process.env.N8N_AUTH_USERNAME;
      const password = process.env.N8N_AUTH_PASSWORD;
      
      if (!username || !password) {
        throw new Error('N8N authentication credentials not configured');
      }
      
      // Create Basic Auth header
      const auth = Buffer.from(`${username}:${password}`).toString('base64');
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${auth}`
        },
        body: JSON.stringify(webhookBody)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Webhook error (${response.status}): ${errorText}`);
        throw new Error(`Webhook returned ${response.status}: ${errorText}`);
      }
      
      console.log(`Webhook response status: ${response.status}`);
      
      // Step 5: Process the response
      const responseText = await response.text();
      console.log(`Webhook response: ${responseText}`);
      
      // Try to parse the response to get the external ID
      let functionalId = null;
      
      try {
        const responseJson = JSON.parse(responseText);
        // Look for various possible ID fields in the response
        if (responseJson.id) {
          functionalId = responseJson.id;
          console.log(`Parsed functional ID from JSON response 'id' field: ${functionalId}`);
        } else if (responseJson.functional_id) {
          functionalId = responseJson.functional_id;
          console.log(`Parsed functional ID from JSON response 'functional_id' field: ${functionalId}`);
        } else if (responseJson.functionalId) {
          functionalId = responseJson.functionalId;
          console.log(`Parsed functional ID from JSON response 'functionalId' field: ${functionalId}`);
        } else if (responseJson.functional_requirements_id) {
          functionalId = responseJson.functional_requirements_id;
          console.log(`Parsed functional ID from JSON response 'functional_requirements_id' field: ${functionalId}`);
        } else {
          // Log the full response to help debug
          console.log('Full webhook response JSON:', responseJson);
          
          // Try to find any field that might contain an ID (containing 'id' in the key name)
          const possibleIdFields = Object.keys(responseJson).filter(key => 
            key.toLowerCase().includes('id') && typeof responseJson[key] === 'string'
          );
          
          if (possibleIdFields.length > 0) {
            functionalId = responseJson[possibleIdFields[0]];
            console.log(`Using field '${possibleIdFields[0]}' as functionalId: ${functionalId}`);
          }
        }
      } catch (jsonError) {
        console.error('Error parsing webhook response JSON:', jsonError);
        // If not JSON, treat as plain text if it looks like a UUID
        const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
        const match = responseText.match(uuidRegex);
        
        if (match) {
          functionalId = match[0];
          console.log(`Extracted UUID from text response: ${functionalId}`);
        } else if (responseText.trim().length < 100) {  // Only use as ID if it's reasonably short
          functionalId = responseText.trim();
          console.log(`Using plain text response as functional ID: ${functionalId}`);
        } else {
          console.log('Response text too long to be an ID, not using as external ID');
        }
      }
      
      // Step 6: Store the external ID with the document
      if (functionalId) {
        await storage.updateDocument(document.id, {
          externalId: functionalId
        });
        
        // Get the updated document
        const updatedDocument = await storage.getDocumentById(document.id);
        
        return res.status(200).json({
          message: "Functional requirements generation started successfully",
          document: updatedDocument
        });
      } else {
        console.warn("No functional ID received from webhook response");
        return res.status(202).json({
          message: "Functional requirements generation started but no ID was received",
          document: document
        });
      }
    } catch (error) {
      console.error("Error generating functional requirements:", error);
      next(error);
    }
  });

  app.post("/api/ideas/:id/generate-business-requirements", isAuthenticated, async (req, res, next) => {
    try {
      const ideaId = parseInt(req.params.id);
      const { instructions } = req.body;
      
      // Check if the user has permission to access this idea
      const idea = await storage.getIdeaById(ideaId, req.user!.id);
      if (!idea) {
        return res.status(404).json({ message: "Idea not found or access denied" });
      }
      
      console.log(`Starting business requirements generation for idea ID: ${ideaId}`);
      
      // Check for an existing document first
      let document;
      const existingDocument = await storage.getDocumentByType(ideaId, "BusinessRequirements");
      
      if (existingDocument) {
        // Update existing document to generating state with timestamp
        const generationStartedAt = new Date();
        await storage.updateDocument(existingDocument.id, {
          status: "Generating",
          generationStartedAt: generationStartedAt
        });
        document = await storage.getDocumentById(existingDocument.id);
        console.log(`Updated existing business requirements document ${existingDocument.id} to Generating state at ${generationStartedAt.toISOString()}`);
      } else {
        // Create a new document in generating state with timestamp
        const generationStartedAt = new Date();
        document = await storage.createDocument({
          ideaId,
          documentType: "BusinessRequirements",
          title: "Business Requirements Document",
          status: "Generating",
          generationStartedAt: generationStartedAt
        });
        console.log(`Created new business requirements document ${document.id} in Generating state at ${generationStartedAt.toISOString()}`);
      }
      
      // Get data from lean canvas
      let projectId;
      let leancanvasId;
      try {
        const canvas = await storage.getLeanCanvasByIdeaId(ideaId);
        if (canvas) {
          projectId = canvas.projectId;
          leancanvasId = canvas.leancanvasId;
          console.log(`Found projectId ${projectId} and leancanvasId ${leancanvasId} for idea ${ideaId}`);
        }
      } catch (error) {
        console.error('Error getting canvas data:', error);
      }
      
      // Get PRD document for its externalId
      let prdId;
      try {
        const prdDocument = await storage.getDocumentByType(ideaId, "ProjectRequirements");
        if (prdDocument) {
          prdId = prdDocument.externalId;
          console.log(`Found PRD with externalId ${prdId} for idea ${ideaId}`);
        }
      } catch (error) {
        console.error('Error getting PRD document:', error);
      }
      
      // Call the business requirements webhook in the background
      const webhookUrl = process.env.N8N_BRD_WEBHOOK_URL;
      const username = process.env.N8N_AUTH_USERNAME;
      const password = process.env.N8N_AUTH_PASSWORD;
      
      if (!webhookUrl) {
        throw new Error("N8N_BRD_WEBHOOK_URL environment variable is not set");
      }
      
      if (!username || !password) {
        throw new Error("N8N authentication credentials are not set");
      }
      
      // Create basic auth header
      const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
      
      // Log the payload we're about to send
      const webhookPayload = {
        ideaId,
        project_id: projectId,
        leancanvas_id: leancanvasId,
        prd_id: prdId,
        instructions: instructions || "Be comprehensive and detailed."
      };
      console.log(`Sending BRD webhook payload:`, JSON.stringify(webhookPayload, null, 2));
      console.log(`To webhook URL: ${webhookUrl}`);
      
      // Call the webhook and store the response with potential BRD ID
      try {
        const response = await fetch(webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": authHeader
          },
          body: JSON.stringify(webhookPayload)
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Failed to call business requirements webhook: ${response.status} ${errorText}`);
        } else {
          console.log(`Successful response from business requirements webhook for idea ${ideaId}`);
          
          // Try to get the BRD ID from the response
          try {
            const responseText = await response.text();
            console.log(`N8N BRD webhook raw response: ${responseText}`);
            
            let brdId = null;
            
            // First try as JSON
            try {
              const responseData = JSON.parse(responseText);
              if (responseData.brd_id || responseData.id) {
                brdId = responseData.brd_id || responseData.id;
                console.log(`Found BRD ID in JSON response: ${brdId}`);
              }
            } catch (jsonError) {
              // If not JSON, treat as plain text (which might be just the ID)
              if (responseText && responseText.trim()) {
                brdId = responseText.trim();
                console.log(`Using raw text as BRD ID: ${brdId}`);
              }
            }
            
            // If we got a BRD ID, store it in the document
            if (brdId && document) {
              console.log(`Storing BRD ID ${brdId} in document ${document.id}`);
              await storage.updateDocument(document.id, {
                externalId: brdId
              });
            }
          } catch (responseError) {
            console.error(`Error processing webhook response: ${responseError.message}`);
          }
        }
      } catch (error) {
        console.error(`Error calling business requirements webhook: ${error.message}`);
      }
      
      // Return immediate success with the document
      return res.status(200).json({ 
        message: "Business requirements document generation started",
        document 
      });
    } catch (error) {
      console.error("Error starting business requirements generation:", error);
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
        return res.status(200).json(null); // Return null instead of 404 to handle case where document doesn't exist yet
      }
      
      // Special handling for Project Requirements if they're in Generating state with an externalId
      if (documentType === "ProjectRequirements" && document.status === "Generating" && document.externalId) {
        try {
          // Check if we should fetch from Supabase
          if (document.generationStartedAt) {
            const generationStartTime = new Date(document.generationStartedAt).getTime();
            const now = Date.now();
            const secondsElapsed = (now - generationStartTime) / 1000;
            
            // Only check Supabase if enough time has passed since generation started
            if (secondsElapsed >= 10) {
              console.log(`Checking Supabase for Project Requirements ${document.externalId} (${secondsElapsed.toFixed(1)}s elapsed)`);
              
              // Import and fetch the PRD data from Supabase
              const { fetchProjectRequirements } = await import('./supabase');
              const prdData = await fetchProjectRequirements(document.externalId, ideaId, req.user!.id);
              
              if (prdData && prdData.projectReqHtml) {
                console.log(`Found HTML content for PRD ID ${document.externalId}`);
                
                // Update the document with the HTML from Supabase
                await storage.updateDocument(document.id, {
                  html: prdData.projectReqHtml,
                  status: "Completed",
                  updatedAt: new Date()
                });
                
                // Return the updated document with the HTML content
                const updatedDocument = await storage.getDocumentById(document.id);
                return res.status(200).json(updatedDocument);
              }
            }
          }
        } catch (supabaseError) {
          console.error(`Error fetching Project Requirements from Supabase:`, supabaseError);
          // Continue to return the document as is
        }
        
        // Check if generation has timed out (2 minutes)
        if (document.generationStartedAt) {
          const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
          if (new Date(document.generationStartedAt) < twoMinutesAgo) {
            console.log(`Project Requirements generation timed out for document ${document.id}`);
            // Still return the document as is - client will display retry button
          }
        }
      }
      
      // Special handling for Business Requirements document with an externalId
      if (documentType === "BusinessRequirements" && document.externalId) {
        try {
          console.log(`BRD Handler: Checking Business Requirements document with externalId ${document.externalId}`);
          
          // If the document should be completed but is missing HTML, try to fetch it
          // Also fetch if still generating but some time has passed
          const shouldFetchContent = 
            (document.status === "Completed" && (!document.html || document.html.length === 0)) || 
            (document.status === "Generating" && document.generationStartedAt && 
             ((Date.now() - new Date(document.generationStartedAt).getTime()) / 1000 >= 10));
          
          if (shouldFetchContent) {
            console.log(`BRD Handler: Attempting direct Supabase lookup for BRD ID ${document.externalId}`);
            
            // Direct lookup using our known working method
            const { supabase } = await import('./supabase');
            const { data, error } = await supabase
              .from('brd')
              .select('*')
              .eq('id', document.externalId)
              .single();
            
            if (!error && data && data.brd_html) {
              console.log(`BRD Handler: Found HTML content (${data.brd_html.length} chars)`);
              
              // Update document with the retrieved HTML
              await storage.updateDocument(document.id, {
                html: data.brd_html,
                status: "Completed",
                updatedAt: new Date()
              });
              
              // Return the updated document
              const updatedDocument = await storage.getDocumentById(document.id);
              console.log(`BRD Handler: Returning updated document with HTML content`);
              return res.status(200).json(updatedDocument);
            } else {
              console.log(error ? 
                `BRD Handler: Supabase error: ${error.message}` : 
                `BRD Handler: No HTML content found in Supabase data`);
            }
          }
        } catch (brdError) {
          console.error(`Error fetching Business Requirements from Supabase:`, brdError);
          // Continue to return the document as is
        }
        
        // Check if generation has timed out (2 minutes)
        if (document.status === "Generating" && document.generationStartedAt) {
          const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
          if (new Date(document.generationStartedAt) < twoMinutesAgo) {
            console.log(`Business Requirements generation timed out for document ${document.id}`);
            // Still return the document as is - client will display retry button
          }
        }
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
  
  // Delete a specific document (for regeneration)
  app.delete("/api/ideas/:ideaId/documents/:documentId", isAuthenticated, async (req, res, next) => {
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
      
      await storage.deleteDocument(documentId);
      
      res.status(200).json({ message: "Document deleted successfully" });
    } catch (error) {
      console.error("Error deleting document:", error);
      next(error);
    }
  });
  
  app.delete("/api/ideas/:id", isAuthenticated, async (req, res, next) => {
    try {
      const ideaId = parseInt(req.params.id);
      
      // Get the idea and verify ownership
      const idea = await storage.getIdeaById(ideaId);
      
      if (!idea) {
        return res.status(404).json({ message: "Idea not found" });
      }
      
      if (idea.userId !== req.user!.id) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      console.log(`Attempting to delete idea ${ideaId} requested by user ${req.user!.id}`);
      
      try {
        // First manually delete all related project documents for this idea
        const documents = await storage.getDocumentsByIdeaId(ideaId);
        console.log(`Found ${documents.length} documents to delete for idea ${ideaId}`);
        
        for (const doc of documents) {
          try {
            console.log(`Deleting document ${doc.id} of type ${doc.documentType} for idea ${ideaId}`);
            await storage.deleteDocument(doc.id);
          } catch (docError) {
            console.error(`Error deleting document ${doc.id}:`, docError);
            // Continue with other documents even if one fails
          }
        }
        
        // Now try to delete the idea itself
        await storage.deleteIdea(ideaId);
        return res.status(200).json({ message: "Idea deleted successfully" });
      } catch (deleteError) {
        console.error(`Error during deletion process for idea ${ideaId}:`, deleteError);
        return res.status(500).json({ 
          message: "Failed to delete idea", 
          error: deleteError.message || "Unknown error"
        });
      }
    } catch (error) {
      console.error("Error in delete idea route:", error);
      next(error);
    }
  });

  // Canvas generation route
  // Webhook proxy for Business Requirements
  app.post("/api/webhook/business-requirements", isAuthenticated, async (req, res, next) => {
    try {
      console.log("BRD webhook received with body:", JSON.stringify(req.body, null, 2));
      
      const { projectId, instructions, ideaId: requestIdeaId } = req.body;
      
      if (!projectId && !requestIdeaId) {
        return res.status(400).json({ message: "Project ID or Idea ID is required" });
      }
      
      // If direct ideaId is provided, we should use that
      if (requestIdeaId) {
        console.log(`BRD: Direct ideaId provided in request: ${requestIdeaId}`);
      }
      
      // Use the BRD-specific webhook URL from environment variables
      const webhookUrl = process.env.N8N_BRD_WEBHOOK_URL;
      const username = process.env.N8N_AUTH_USERNAME;
      const password = process.env.N8N_AUTH_PASSWORD;
      
      if (!webhookUrl) {
        return res.status(500).json({ message: "N8N Business Requirements webhook URL not configured" });
      }
      
      if (!username || !password) {
        return res.status(500).json({ message: "N8N authentication credentials not configured" });
      }
      
      // Create basic auth header
      const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
      
      // Get the numeric idea ID - ensure we're working with a valid integer
      let ideaId;
      try {
        // First check if projectId is a uuid format from Supabase
        if (typeof projectId === 'string' && (projectId.includes('-') || !Number.isInteger(Number(projectId)))) {
          // If it's a uuid format, we need to look up the corresponding idea
          const { pool } = await import('./db');
          const result = await pool.query('SELECT idea_id FROM lean_canvas WHERE project_id = $1', [projectId]);
          
          if (result.rows.length > 0) {
            ideaId = result.rows[0].idea_id;
            console.log(`Found idea_id ${ideaId} for project_id ${projectId}`);
          } else {
            // Fallback to the request parameters - the :id in the URL
            ideaId = parseInt(req.body.ideaId?.toString() || '0');
            console.log(`Using fallback ideaId ${ideaId} from request body`);
          }
        } else {
          // If it's a plain number, use it directly
          ideaId = parseInt(projectId.toString());
        }
        
        // Validate that we have a legitimate ideaId
        if (!ideaId || ideaId <= 0 || isNaN(ideaId)) {
          return res.status(400).json({ message: "Invalid Idea ID. Could not determine the correct idea for this document." });
        }
        
        console.log(`Resolved ideaId: ${ideaId} from projectId: ${projectId}`);
      } catch (error) {
        console.error('Error resolving idea ID:', error);
        return res.status(400).json({ message: "Failed to resolve idea ID from project ID" });
      }
      
      // Get the project_id and leancanvas_id from lean_canvas table
      let supabaseProjectId;
      let leancanvasId;
      try {
        // First try to get from local database
        const { pool } = await import('./db');
        const result = await pool.query('SELECT project_id, leancanvas_id FROM lean_canvas WHERE idea_id = $1', [ideaId]);
        
        if (result.rows.length > 0) {
          supabaseProjectId = result.rows[0].project_id;
          leancanvasId = result.rows[0].leancanvas_id;
          console.log(`Found project_id ${supabaseProjectId} and leancanvas_id ${leancanvasId} for idea ${ideaId}`);
        } else {
          console.log(`No IDs found for idea ${ideaId} in local database`);
          
          // If leancanvas_id is null, try to fetch from Supabase directly
          try {
            // Try to get the canvas data from Supabase to find the real leancanvas_id
            const { supabase } = await import('./supabase');
            console.log(`Querying Supabase lean_canvas table with ideaId=${ideaId}`);
            
            // First try to find via Supabase by idea_id
            let { data: canvasData } = await supabase
              .from('lean_canvas')
              .select('*')
              .eq('idea_id', ideaId)
              .single();
            
            if (!canvasData) {
              // If no result, try getting the idea first to get its project_id
              const idea = await storage.getIdeaById(ideaId);
              if (idea) {
                supabaseProjectId = idea.projectId;
                console.log(`Found project_id ${supabaseProjectId} from idea ${ideaId}`);
                
                // Then look up the canvas using the idea's project_id
                if (supabaseProjectId) {
                  let { data: canvasByProject } = await supabase
                    .from('lean_canvas')
                    .select('*')
                    .eq('project_id', supabaseProjectId)
                    .single();
                    
                  if (canvasByProject) {
                    canvasData = canvasByProject;
                  }
                }
              }
            }
            
            if (canvasData) {
              // We have the canvas data from Supabase
              supabaseProjectId = canvasData.project_id;
              leancanvasId = canvasData.id; // Use the Supabase ID as leancanvas_id
              console.log(`Found data in Supabase: project_id=${supabaseProjectId}, leancanvas_id=${leancanvasId}`);
            } else {
              // Fallback to using ideaId as the project_id
              supabaseProjectId = ideaId.toString();
              console.log(`No canvas data found in Supabase. Using fallback project_id=${supabaseProjectId}`);
            }
          } catch (supabaseError) {
            console.error('Error getting canvas from Supabase:', supabaseError);
            supabaseProjectId = ideaId.toString();
          }
        }
      } catch (error) {
        console.error('Error getting Supabase IDs:', error);
        supabaseProjectId = projectId.toString();
      }
      
      // Make sure we have valid values and not undefined
      supabaseProjectId = supabaseProjectId || ideaId.toString();
      
      console.log(`Sending business requirements request to n8n with project_id=${supabaseProjectId}, leancanvas_id=${leancanvasId}`);
      console.log(`Using webhook URL: ${webhookUrl}`);
      console.log(`With instructions: ${instructions || "No specific instructions"}`);
      
      // Create a document record before calling N8N
      let document;
      const existingDocument = await storage.getDocumentByType(ideaId, "BusinessRequirements");
      
      if (existingDocument) {
        // Update existing document
        await storage.updateDocument(existingDocument.id, {
          status: "Generating",
          generationStartedAt: new Date()
        });
        document = await storage.getDocumentById(existingDocument.id);
        console.log(`Updated existing document ${existingDocument.id} for business requirements`);
      } else {
        // Create a new document
        document = await storage.createDocument({
          ideaId,
          documentType: "BusinessRequirements",
          title: "Business Requirements Document",
          status: "Generating",
          generationStartedAt: new Date()
        });
        console.log(`Created new document ${document.id} for business requirements`);
      }
      
      // Get prd_id if available from documents
      let prdId = null;
      try {
        const prdDocument = await storage.getDocumentByType(ideaId, "ProjectRequirements");
        if (prdDocument) {
          prdId = prdDocument.externalId;
          console.log(`Found existing PRD document with external ID: ${prdId}`);
        }
      } catch (error) {
        console.error('Error getting PRD document:', error);
      }
      
      // Call the n8n webhook with the payload
      // Ensure we use the exact payload structure expected by the API
      const payload = {
        leancanvas_id: leancanvasId,
        prd_id: prdId,
        project_id: supabaseProjectId,
        instructions: instructions || "Be comprehensive and detailed."
      };
      
      console.log(`Sending BRD webhook with payload:`, payload);
      
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": authHeader
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Failed to call business requirements webhook: ${response.status} ${errorText}`);
        
        res.status(200).json({ 
          message: "Business requirements document created, but webhook failed. Document will remain in Generating state until timeout.",
          document,
          webhookError: errorText
        });
        return;
      }
      
      // Get webhook response
      const responseText = await response.text();
      console.log(`N8N BRD webhook response: ${responseText}`);
      
      try {
        // Try to parse response as JSON if possible
        let brdId = null;
        
        try {
          // First attempt as JSON
          const responseData = JSON.parse(responseText);
          if (responseData.external_id || responseData.brd_id) {
            brdId = responseData.external_id || responseData.brd_id;
            console.log(`Parsed BRD ID from JSON response: ${brdId}`);
          }
        } catch (jsonError) {
          // If not JSON, try to extract ID from plain text
          console.log(`N8N response is not valid JSON, treating as plain text: ${responseText}`);
          // Assume response might be just the ID string
          if (responseText && responseText.trim()) {
            brdId = responseText.trim();
            console.log(`Using plain text response as BRD ID: ${brdId}`);
          }
        }
        
        // If we have an ID, store it with the document
        if (brdId) {
          console.log(`Storing BRD ID with document: ${brdId}`);
          await storage.updateDocument(document.id, {
            externalId: brdId
          });
          
          // Get the updated document to include in the response
          const updatedDocument = await storage.getDocumentById(document.id);
          document = updatedDocument;
          
          console.log(`Successfully updated document ${document.id} with external ID ${brdId}`);
        } else {
          console.warn(`WARNING: No BRD ID received from n8n webhook response. This may prevent accessing the document in Supabase later.`);
        }
      } catch (e) {
        console.error(`Error processing N8N response: ${e.message}`);
      }
      
      // Return success
      res.status(200).json({ 
        message: "Business requirements document generation started",
        document 
      });
    } catch (error) {
      next(error);
    }
  });

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
      
      // Get the numeric idea ID - ensure we're working with a valid integer
      let ideaId;
      try {
        // First check if projectId is a uuid format from Supabase
        if (typeof projectId === 'string' && (projectId.includes('-') || !Number.isInteger(Number(projectId)))) {
          // If it's a uuid format, we need to look up the corresponding idea
          const { pool } = await import('./db');
          const result = await pool.query('SELECT idea_id FROM lean_canvas WHERE project_id = $1', [projectId]);
          
          if (result.rows.length > 0) {
            ideaId = result.rows[0].idea_id;
            console.log(`Found idea_id ${ideaId} for project_id ${projectId}`);
          } else {
            // Fallback to the request parameters - the :id in the URL
            ideaId = parseInt(req.body.ideaId?.toString() || '0');
            console.log(`Using fallback ideaId ${ideaId} from request body`);
          }
        } else {
          // If it's a plain number, use it directly
          ideaId = parseInt(projectId.toString());
        }
        
        // Validate that we have a legitimate ideaId
        if (!ideaId || ideaId <= 0 || isNaN(ideaId)) {
          return res.status(400).json({ message: "Invalid Idea ID. Could not determine the correct idea for this document." });
        }
        
        console.log(`Resolved ideaId: ${ideaId} from projectId: ${projectId}`);
      } catch (error) {
        console.error('Error resolving idea ID:', error);
        return res.status(400).json({ message: "Failed to resolve idea ID from project ID" });
      }
      
      // Get the Supabase project ID from lean_canvas table
      let supabaseProjectId;
      try {
        // First try to get it from our lean_canvas table which should have stored the project_id
        const { pool } = await import('./db');
        const result = await pool.query('SELECT project_id FROM lean_canvas WHERE idea_id = $1', [ideaId]);
        
        if (result.rows.length > 0 && result.rows[0].project_id) {
          supabaseProjectId = result.rows[0].project_id;
          console.log(`Using Supabase project ID: ${supabaseProjectId} from lean_canvas table`);
        } else {
          // If not found, use the ideaId as a default (but this likely won't work with Supabase)
          supabaseProjectId = projectId;
          console.log(`No Supabase project ID found in database, defaulting to ${projectId}`);
        }
      } catch (error) {
        console.error('Error getting Supabase project ID:', error);
        supabaseProjectId = projectId; // Default fallback
      }
      
      console.log(`Sending project requirements request to n8n for Supabase project ${supabaseProjectId}`);
      console.log(`Using webhook URL: ${webhookUrl}`);
      console.log(`With instructions: ${instructions || "No specific instructions"}`);
      
      // Create a document record before calling N8N to ensure we have a record
      // to update later even if the webhook call to n8n fails
      let document;
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
      
      // Get the leancanvas_id from our database
      let leancanvasId = null;
      try {
        const { pool } = await import('./db');
        const result = await pool.query('SELECT leancanvas_id FROM lean_canvas WHERE idea_id = $1', [ideaId]);
        
        if (result.rows.length > 0 && result.rows[0].leancanvas_id) {
          leancanvasId = result.rows[0].leancanvas_id;
          console.log(`Found leancanvas_id ${leancanvasId} for idea ${ideaId} in local database`);
        } else {
          console.log(`No leancanvas_id found for idea ${ideaId} in local database`);
        }
      } catch (dbError) {
        console.warn('Error querying local database for leancanvas_id:', dbError);
      }
      
      // Call the n8n webhook with the updated payload structure
      console.log(`Sending webhook with project_id=${supabaseProjectId}, leancanvas_id=${leancanvasId}`);
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": authHeader
        },
        body: JSON.stringify({
          // The n8n workflow expects the Supabase UUID format project_id from the Lean Canvas
          project_id: supabaseProjectId,
          // Include the leancanvas_id as well
          leancanvas_id: leancanvasId,
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
        
        // Parse the response JSON to extract project_id and leancanvas_id
        let projectId = '';
        let leancanvasId = '';
        
        try {
          // Parse the JSON response
          const responseData = JSON.parse(responseText);
          
          // Extract the individual fields
          projectId = responseData.project_id || '';
          leancanvasId = responseData.leancanvas_id || '';
          
          console.log(`Extracted from response: project_id=${projectId}, leancanvas_id=${leancanvasId}`);
          console.log(`Full response data:`, JSON.stringify(responseData));
        } catch (jsonError) {
          // Fallback to using the entire response as projectId for backward compatibility
          console.error('Failed to parse webhook response as JSON:', jsonError);
          projectId = responseText.trim();
          console.log(`Using entire response as project_id: ${projectId}`);
        }
        
        // Store the project_id and leancanvas_id in the database
        if (projectId) {
          try {
            // Check if lean canvas already exists for this idea
            const existingCanvas = await storage.getLeanCanvasByIdeaId(ideaId);
            
            if (existingCanvas) {
              // Update the existing canvas with the project_id and leancanvas_id
              await storage.updateLeanCanvas(ideaId, { 
                projectId,
                leancanvasId
              });
              console.log(`Updated existing canvas with project_id: ${projectId} and leancanvas_id: ${leancanvasId}`);
            } else {
              // Create a new canvas with the project_id and leancanvas_id
              await storage.createLeanCanvas({ 
                ideaId,
                projectId,
                leancanvasId,
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
              console.log(`Created new canvas with project_id: ${projectId} and leancanvas_id: ${leancanvasId}`);
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

  // Webhook endpoint for n8n to send back the generated business requirements
  // Webhook endpoint for n8n to return business requirements document generation results
  app.post("/api/webhook/business-requirements-result", async (req, res, next) => {
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
      console.log("Received business requirements data from n8n:", JSON.stringify(req.body, null, 2));
      
      // Extract data from the webhook payload
      const { ideaId, brd_id, content, html, project_id, leancanvas_id, prd_id } = req.body;
      
      console.log(`Received business requirements with: ideaId=${ideaId}, brd_id=${brd_id}, project_id=${project_id}, leancanvas_id=${leancanvas_id}, prd_id=${prd_id}`);
      console.log(`Content length: ${content ? content.length : 'missing'}, HTML length: ${html ? html.length : 'missing'}`);
      
      if (!ideaId) {
        return res.status(400).json({ message: "Missing required field: ideaId" });
      }
      
      if (!content) {
        console.warn("Warning: Received webhook without content");
      }
      
      // Search for a document with this brd_id as externalId
      // If not found, try to find by ideaId and documentType
      let existingDocument = null;
      
      if (brd_id) {
        const documents = await storage.getDocumentsByIdeaId(parseInt(ideaId));
        existingDocument = documents.find(doc => 
          doc.documentType === "BusinessRequirements" && doc.externalId === brd_id
        );
      }
      
      if (!existingDocument) {
        existingDocument = await storage.getDocumentByType(parseInt(ideaId), "BusinessRequirements");
      }
      
      if (existingDocument) {
        // Update existing document with the content from n8n
        // Use a properly typed object to avoid TypeScript errors
        const updates: {
          content?: string;
          html?: string | null;
          status: string;
          externalId?: string;
        } = {
          status: "Completed"
        };
        
        // Only add fields if they are provided
        if (content) updates.content = content;
        if (html !== undefined) updates.html = html;
        if (brd_id) updates.externalId = brd_id;
        
        await storage.updateDocument(existingDocument.id, updates);
        console.log(`Updated existing document ID ${existingDocument.id} for idea ${ideaId} with business requirements`);
        
        // Log the updated document for debugging
        const updatedDoc = await storage.getDocumentById(existingDocument.id);
        console.log(`Updated document details: ${JSON.stringify(updatedDoc)}`);
      } else {
        // Create new document
        const newDoc: {
          ideaId: number;
          documentType: "BusinessRequirements";
          title: string;
          content?: string;
          html?: string | null;
          status: string;
          externalId?: string;
        } = {
          ideaId: parseInt(ideaId),
          documentType: "BusinessRequirements",
          title: "Business Requirements Document",
          status: "Completed"
        };
        
        // Only add fields if they are provided
        if (content) newDoc.content = content;
        if (html !== undefined) newDoc.html = html;
        if (brd_id) newDoc.externalId = brd_id;
        
        const document = await storage.createDocument(newDoc);
        console.log(`Created new document ID ${document.id} for idea ${ideaId} with business requirements`);
      }
      
      // Get the idea information to send notification
      try {
        const idea = await storage.getIdeaById(parseInt(ideaId));
        if (idea && idea.founderEmail) {
          // Send email notification that the requirements are generated
          const title = idea.title || idea.idea.substring(0, 30) + '...';
          await emailService.sendCanvasGeneratedEmail(idea.founderEmail, idea.founderName || 'User', title);
          console.log(`Sent business requirements generation notification email to ${idea.founderEmail}`);
        }
      } catch (emailError) {
        console.error('Failed to send business requirements generation notification:', emailError);
        // Continue even if email sending fails
      }
      
      res.status(200).json({ message: "Business requirements document updated successfully" });
    } catch (error) {
      console.error("Error processing business requirements webhook:", error);
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
  
  // Direct BRD viewer endpoint with HTML embedded for visualization
  app.get("/api/debug/brd-viewer/:external_id", isAuthenticated, async (req, res) => {
    try {
      const externalId = req.params.external_id;
      const { supabase } = await import('./supabase');
      
      console.log(`🔬 BRD VIEWER: Direct access for ID ${externalId}`);
      
      // Attempt direct lookup by ID, which we know works from our test
      const { data, error } = await supabase
        .from('brd')
        .select('*')
        .eq('id', externalId)
        .single();
      
      if (error) {
        console.log(`🔬 BRD VIEWER: Error fetching BRD - ${error.message}`);
        return res.send(`
          <html>
            <head><title>BRD Viewer - Error</title></head>
            <body>
              <h1>Error Retrieving BRD</h1>
              <p>Failed to retrieve BRD with ID: ${externalId}</p>
              <p>Error: ${error.message}</p>
            </body>
          </html>
        `);
      }
      
      // Extract HTML content
      const htmlContent = data.brd_html || data.html || '';
      const contentLength = htmlContent.length;
      
      console.log(`🔬 BRD VIEWER: Found BRD content with ${contentLength} characters`);
      
      if (contentLength === 0) {
        // If no HTML content found, show diagnostic info
        return res.send(`
          <html>
            <head><title>BRD Viewer - No Content</title></head>
            <body>
              <h1>No HTML Content Found</h1>
              <p>BRD record exists but has no HTML content.</p>
              <h2>Available Fields:</h2>
              <pre>${JSON.stringify(Object.keys(data), null, 2)}</pre>
              <h2>Data Preview:</h2>
              <pre>${JSON.stringify(data, null, 2)}</pre>
            </body>
          </html>
        `);
      }
      
      // Return the actual HTML content
      console.log(`🔬 BRD VIEWER: Sending ${contentLength} characters of HTML content`);
      return res.send(htmlContent);
      
    } catch (error) {
      console.error('🔬 BRD VIEWER: Unhandled error', error);
      return res.status(500).send(`
        <html>
          <head><title>BRD Viewer - Error</title></head>
          <body>
            <h1>Unhandled Error</h1>
            <p>An unexpected error occurred while fetching the BRD.</p>
            <pre>${error.message}\n${error.stack}</pre>
          </body>
        </html>
      `);
    }
  });
  
  // Direct debug endpoint for Supabase FRD
  app.get("/api/debug/supabase-frd/:external_id", isAuthenticated, async (req, res) => {
    try {
      const externalId = req.params.external_id;
      const { supabase } = await import('./supabase');
      
      console.log(`=== DIRECT SUPABASE FRD DEBUG ===`);
      console.log(`Debugging Supabase FRD with ID: ${externalId}`);
      
      // Log all FRD records (for debugging only)
      try {
        const allRecords = await supabase
          .from('frd')
          .select('id')
          .limit(10);
        
        console.log(`Available FRD records: ${JSON.stringify(allRecords.data || [])}`);
      } catch (err) {
        console.log('Could not list FRD records', err);
      }
      
      // Try to query the FRD table directly using ID field
      console.log('Attempting primary query using id field on FRD table...');
      const { data, error } = await supabase
        .from('frd')
        .select('*')
        .eq('id', externalId)
        .single();
      
      if (error) {
        console.log(`Error in direct FRD lookup by id: ${error.message}`);
        
        // Try project_id field
        console.log('Attempting query using project_id field...');
        const projectIdResult = await supabase
          .from('frd')
          .select('*')
          .eq('project_id', externalId)
          .single();
        
        if (projectIdResult.error) {
          console.log(`project_id lookup failed: ${projectIdResult.error.message}`);
          
          // Try the original table as fallback
          console.log('Attempting query on functional_requirements table...');
          const originalTable = await supabase
            .from('functional_requirements')
            .select('*')
            .eq('id', externalId)
            .single();
          
          if (originalTable.error) {
            console.log(`Original table lookup failed: ${originalTable.error.message}`);
            return res.status(404).json({
              success: false,
              error: 'Document not found in Supabase',
              attempts: ['frd.id', 'frd.project_id', 'functional_requirements.id'],
              externalId
            });
          } else {
            console.log(`Found FRD in original table lookup`);
            
            // Log available fields
            console.log(`Fields: ${Object.keys(originalTable.data).join(', ')}`);
            
            // Check for HTML content
            const hasHtml = originalTable.data.html || originalTable.data.func_html;
            console.log(`Has HTML content: ${!!hasHtml}`);
            
            // Log a sample of the HTML if it exists
            if (hasHtml) {
              const htmlContent = originalTable.data.html || originalTable.data.func_html;
              console.log(`HTML content length: ${htmlContent.length}`);
              console.log(`Sample: ${htmlContent.substring(0, 200)}...`);
            }
            
            return res.json({
              success: true,
              source: 'functional_requirements',
              data: originalTable.data
            });
          }
        } else {
          console.log(`Found FRD by project_id lookup`);
          
          // Log available fields
          console.log(`Fields: ${Object.keys(projectIdResult.data).join(', ')}`);
          
          // Check for HTML content
          const hasHtml = projectIdResult.data.frd_html || projectIdResult.data.html;
          console.log(`Has HTML content: ${!!hasHtml}`);
          
          // Log a sample of the HTML if it exists
          if (hasHtml) {
            const htmlContent = projectIdResult.data.frd_html || projectIdResult.data.html;
            console.log(`HTML content length: ${htmlContent.length}`);
            console.log(`Sample: ${htmlContent.substring(0, 200)}...`);
          }
          
          return res.json({
            success: true,
            source: 'project_id',
            data: projectIdResult.data
          });
        }
      } else {
        console.log(`Found FRD by direct id lookup`);
        
        // Log available fields
        console.log(`Fields: ${Object.keys(data).join(', ')}`);
        
        // Check for HTML content
        const hasHtml = data.frd_html || data.html;
        console.log(`Has HTML content: ${!!hasHtml}`);
        
        // Log a sample of the HTML if it exists
        if (hasHtml) {
          const htmlContent = data.frd_html || data.html;
          console.log(`HTML content length: ${htmlContent.length}`);
          console.log(`Sample: ${htmlContent.substring(0, 200)}...`);
        }
        
        return res.json({
          success: true,
          source: 'id',
          data
        });
      }
    } catch (error) {
      console.error('Debug endpoint error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error: ' + (error.message || 'Unknown error')
      });
    }
  });
  
  // Direct debug endpoint for Supabase BRD
  app.get("/api/debug/supabase-brd/:external_id", isAuthenticated, async (req, res) => {
    try {
      const externalId = req.params.external_id;
      const { supabase } = await import('./supabase');
      
      console.log(`=== DIRECT SUPABASE BRD DEBUG ===`);
      console.log(`Debugging Supabase BRD with ID: ${externalId}`);
      
      // Log all BRD records (for debugging only)
      try {
        const allRecords = await supabase
          .from('brd')
          .select('id, uuid, reference_id')
          .limit(10);
        
        console.log(`Available BRD records: ${JSON.stringify(allRecords.data || [])}`);
      } catch (err) {
        console.log('Could not list BRD records', err);
      }
      
      // Try to query the BRD table directly using ID field
      console.log('Attempting primary query using id field...');
      const { data, error } = await supabase
        .from('brd')
        .select('*')
        .eq('id', externalId)
        .single();
      
      if (error) {
        console.log(`Error in direct BRD lookup by id: ${error.message}`);
        
        // Try alternative fields - reference_id
        console.log('Attempting query using reference_id field...');
        const alt = await supabase
          .from('brd')
          .select('*')
          .eq('reference_id', externalId)
          .single();
        
        if (alt.error) {
          console.log(`Reference_id lookup failed: ${alt.error.message}`);
          
          // Try uuid field
          console.log('Attempting query using uuid field...');
          const uuid = await supabase
            .from('brd')
            .select('*')
            .eq('uuid', externalId)
            .single();
          
          if (uuid.error) {
            console.log(`UUID lookup failed: ${uuid.error.message}`);
            
            // Try a raw query to see field names
            console.log('Attempting raw query to inspect schema...');
            try {
              const { data: tableInfo } = await supabase.rpc('get_schema_info', { table_name: 'brd' });
              console.log('Table schema info:', tableInfo);
            } catch (e) {
              console.log('Schema inspection failed:', e);
            }
            
            return res.status(404).json({ 
              message: "BRD not found in any table/column",
              checked_fields: ['id', 'reference_id', 'uuid'],
              external_id: externalId
            });
          }
          
          console.log(`Found BRD by uuid lookup`);
          console.log(`Fields: ${Object.keys(uuid.data).join(', ')}`);
          
          // Check for HTML content
          const hasContent = !!uuid.data.brd_html || !!uuid.data.html || !!uuid.data.content;
          console.log(`Has HTML content: ${hasContent}`);
          
          if (hasContent) {
            const htmlField = uuid.data.brd_html ? 'brd_html' : (uuid.data.html ? 'html' : 'content');
            const htmlContent = uuid.data[htmlField];
            console.log(`HTML content from ${htmlField} field, length: ${htmlContent.length}`);
            console.log(`Sample: ${htmlContent.substring(0, 100)}...`);
          }
          
          return res.json({
            success: true,
            source: 'uuid',
            data: uuid.data,
            has_html: hasContent,
            fields: Object.keys(uuid.data)
          });
        }
        
        console.log(`Found BRD by reference_id lookup`);
        console.log(`Fields: ${Object.keys(alt.data).join(', ')}`);
        
        // Check for HTML content
        const hasContent = !!alt.data.brd_html || !!alt.data.html || !!alt.data.content;
        console.log(`Has HTML content: ${hasContent}`);
        
        if (hasContent) {
          const htmlField = alt.data.brd_html ? 'brd_html' : (alt.data.html ? 'html' : 'content');
          const htmlContent = alt.data[htmlField];
          console.log(`HTML content from ${htmlField} field, length: ${htmlContent.length}`);
          console.log(`Sample: ${htmlContent.substring(0, 100)}...`);
        }
        
        return res.json({
          success: true,
          source: 'reference_id',
          data: alt.data,
          has_html: hasContent,
          fields: Object.keys(alt.data)
        });
      }
      
      console.log(`Found BRD by direct id lookup`);
      console.log(`Fields: ${Object.keys(data).join(', ')}`);
      
      // Check for HTML content
      const hasContent = !!data.brd_html || !!data.html || !!data.content;
      console.log(`Has HTML content: ${hasContent}`);
      
      if (hasContent) {
        const htmlField = data.brd_html ? 'brd_html' : (data.html ? 'html' : 'content');
        const htmlContent = data[htmlField];
        console.log(`HTML content from ${htmlField} field, length: ${htmlContent.length}`);
        console.log(`Sample: ${htmlContent.substring(0, 100)}...`);
      }
      
      return res.json({
        success: true,
        source: 'id',
        data,
        has_html: hasContent,
        fields: Object.keys(data)
      });
    } catch (error) {
      console.error('Error in debug endpoint:', error);
      res.status(500).json({ 
        error: 'Error accessing Supabase',
        message: error.message,
        stack: error.stack
      });
    }
  });
  
  // Supabase integration routes
  // Get Business Requirements Document from Supabase
  // API endpoint to fetch functional requirements content from Supabase
  app.get("/api/supabase/functional-requirements/:id", isAuthenticated, async (req, res, next) => {
    try {
      console.log("==== FUNCTIONAL REQUIREMENTS API ACCESS ====");
      const { id: ideaId } = req.params;
      const userId = req.user!.id;
      
      console.log(`User ${userId} is requesting Functional Requirements data for idea ${ideaId}`);
      
      // First check if we have the document in our database
      const document = await storage.getDocumentByType(parseInt(ideaId), 'FunctionalRequirements');
      
      if (!document || !document.externalId) {
        return res.status(404).json({ error: 'Functional Requirements document not found or has no external ID' });
      }
      
      console.log(`External ID provided in query: ${document.externalId}`);
      console.log(`✓ Document found with ID ${document.id}, status ${document.status}, externalId: ${document.externalId}`);
      
      // If document exists and has an external ID, fetch from Supabase
      console.log(`🔍 Using external ID ${document.externalId} to fetch Functional Requirements from Supabase`);
      
      const supabaseResponse = await fetchFunctionalRequirements(document.externalId, parseInt(ideaId), userId);
      
      if (supabaseResponse.error) {
        return res.status(500).json({ 
          error: `Failed to retrieve functional requirements data: ${supabaseResponse.error}` 
        });
      }
      
      // Update the document with the HTML content if it doesn't already have it
      if (supabaseResponse.data && supabaseResponse.data.html && (!document.html || document.status !== 'Completed')) {
        console.log(`✓ Updating document ${document.id} with HTML content from Supabase`);
        
        await storage.updateDocument(document.id, {
          html: supabaseResponse.data.html,
          status: 'Completed',
          updatedAt: new Date()
        });
      }
      
      res.json(supabaseResponse);
    } catch (error) {
      console.error('Error fetching functional requirements:', error);
      next(error);
    }
  });
  
  app.get("/api/supabase/business-requirements/:id", isAuthenticated, async (req, res, next) => {
    try {
      const ideaId = parseInt(req.params.id);
      const userId = req.user!.id;
      // Check if external_id was explicitly provided in the query
      const externalIdFromQuery = req.query.external_id as string;
      
      console.log(`==== BUSINESS REQUIREMENTS API ACCESS ====`);
      console.log(`User ${userId} is requesting BRD data for idea ${ideaId}`);
      if (externalIdFromQuery) {
        console.log(`External ID provided in query: ${externalIdFromQuery}`);
      }
      
      // First get the document from our database to get the external ID if not provided
      const document = await storage.getDocumentByType(ideaId, "BusinessRequirements");
      
      if (!document) {
        console.log(`⚠️ ERROR: No Business Requirements Document found for idea ${ideaId}`);
        return res.status(404).json({ message: "Business Requirements Document not found" });
      }
      
      console.log(`✓ Document found with ID ${document.id}, status ${document.status}, externalId: ${document.externalId || 'none'}`);
      
      // If document is still generating, return early
      if (document.status === 'Generating') {
        console.log(`⏳ Document is still in generating state, returning as-is`);
        return res.json({
          source: "local",
          data: document,
          message: "Document is still generating"
        });
      }
      
      // Use the external ID from the query if provided, otherwise use the one from the document
      const externalIdToUse = externalIdFromQuery || document.externalId;
      
      // Check for external ID which is needed for Supabase lookup
      if (!externalIdToUse) {
        console.log(`⚠️ ERROR: No external ID available, cannot fetch from Supabase`);
        return res.status(400).json({ 
          message: "No external ID available to fetch Business Requirements from Supabase", 
          document
        });
      }
      
      // Log that we're using this external ID to fetch from Supabase
      console.log(`🔍 Using external ID ${externalIdToUse} to fetch BRD from Supabase`);
      
      try {
        const { fetchBusinessRequirements } = await import('./supabase');
        console.log(`Calling fetchBusinessRequirements with ID: ${externalIdToUse}, ideaId: ${ideaId}, userId: ${userId}`);
        const brdData = await fetchBusinessRequirements(externalIdToUse, ideaId, userId);
        
        if (!brdData) {
          console.log(`⚠️ ERROR: No BRD data found in Supabase for external ID ${externalIdToUse}`);
          return res.status(404).json({ 
            message: "Business Requirements not found in Supabase",
            document
          });
        }
        
        console.log(`✓ Successfully retrieved BRD data from Supabase with keys: ${Object.keys(brdData.data).join(', ')}`);
        
        // Check if the BRD data actually has HTML content
        if (brdData.data.html) {
          console.log(`✓ BRD data contains HTML content (${brdData.data.html.length} characters)`);
          console.log(`HTML preview: ${brdData.data.html.substring(0, 100)}...`);
          
          // Update our local document with the HTML content from Supabase if it doesn't already have it
          if (!document.html) {
            console.log(`Updating local document ${document.id} with HTML content from Supabase`);
            try {
              await storage.updateDocument(document.id, {
                html: brdData.data.html,
                status: "Completed" // Ensure status is completed since we have the content
              });
              console.log(`✓ Successfully updated local document with HTML content`);
            } catch (updateError) {
              console.error(`⚠️ ERROR: Failed to update local document with HTML:`, updateError);
            }
          }
        } else {
          console.log(`⚠️ WARNING: No HTML content found in Supabase BRD data`);
          
          // Check all data fields to debug
          for (const [key, value] of Object.entries(brdData.data)) {
            if (typeof value === 'string' && value.includes('<')) {
              console.log(`Found potential HTML in field '${key}':`, value.substring(0, 100));
            }
          }
        }
        
        // Return the combined data
        res.json(brdData);
      } catch (supabaseError) {
        console.error(`⚠️ ERROR: Error fetching Business Requirements from Supabase:`, supabaseError);
        // Continue to return the document as is
        res.json({
          source: "local",
          data: document,
          error: "Failed to fetch from Supabase"
        });
      }
    } catch (error) {
      console.error(`⚠️ CRITICAL ERROR in /api/supabase/business-requirements/:id endpoint:`, error);
      next(error);
    }
  });
  
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
