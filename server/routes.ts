import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { z } from "zod";
import { insertIdeaSchema, updateLeanCanvasSchema, webhookResponseSchema } from "@shared/schema";
import { fetchLeanCanvasData, fetchUserIdeas } from "./supabase";
import { emailService } from "./email";

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
  
  // Supabase integration routes
  app.get("/api/supabase/canvas/:id", isAuthenticated, async (req, res, next) => {
    try {
      const ideaId = parseInt(req.params.id);
      const idea = await storage.getIdeaById(ideaId);
      
      if (!idea) {
        return res.status(404).json({ message: "Idea not found" });
      }
      
      if (idea.userId !== req.user!.id) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      // Fetch data from Supabase
      try {
        const supabaseCanvas = await fetchLeanCanvasData(ideaId);
        res.json({
          source: "supabase",
          data: supabaseCanvas
        });
      } catch (supabaseError) {
        console.error("Error fetching from Supabase:", supabaseError);
        
        // Fallback to local storage if Supabase fails
        const localCanvas = await storage.getLeanCanvasByIdeaId(ideaId);
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
      // Fetch data from Supabase
      try {
        const supabaseIdeas = await fetchUserIdeas(req.user!.id);
        res.json({
          source: "supabase",
          data: supabaseIdeas
        });
      } catch (supabaseError) {
        console.error("Error fetching ideas from Supabase:", supabaseError);
        
        // Fallback to local storage if Supabase fails
        const localIdeas = await storage.getIdeasByUser(req.user!.id);
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

  const httpServer = createServer(app);

  return httpServer;
}
