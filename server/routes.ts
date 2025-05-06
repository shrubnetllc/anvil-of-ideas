import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { z } from "zod";
import { insertIdeaSchema, updateLeanCanvasSchema, webhookResponseSchema } from "@shared/schema";

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
      const ideas = await storage.getIdeasByUser(req.user!.id);
      res.json(ideas);
    } catch (error) {
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
      const idea = await storage.getIdeaById(parseInt(req.params.id));
      
      if (!idea) {
        return res.status(404).json({ message: "Idea not found" });
      }
      
      if (idea.userId !== req.user!.id) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      res.json(idea);
    } catch (error) {
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
      
      // Update idea status to Generating
      await storage.updateIdeaStatus(ideaId, "Generating");
      
      // Trigger the webhook to n8n
      try {
        const webhookUrl = process.env.N8N_WEBHOOK_URL;
        const username = process.env.N8N_AUTH_USERNAME;
        const password = process.env.N8N_AUTH_PASSWORD;
        
        if (!webhookUrl) {
          throw new Error("N8N webhook URL not configured");
        }
        
        if (!username || !password) {
          throw new Error("N8N authentication credentials not configured");
        }
        
        // Create basic auth header
        const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
        
        // Send the idea data to n8n with basic auth in the exact format required
        await fetch(webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": authHeader
          },
          body: JSON.stringify({
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
          }),
        });
        
        res.status(200).json({ message: "Canvas generation started" });
      } catch (error) {
        console.error("Error triggering webhook:", error);
        await storage.updateIdeaStatus(ideaId, "Draft");
        throw new Error("Failed to start canvas generation");
      }
    } catch (error) {
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

  const httpServer = createServer(app);

  return httpServer;
}
