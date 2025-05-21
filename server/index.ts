import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { storage } from "./storage";

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // Create a properly named sendError function to avoid reference errors
  function sendError(err: any, req: Request, res: Response, next: NextFunction) {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    
    console.error('Error caught by server:', err);
    res.status(status).json({ message });
  }
  
  // Global error handler
  app.use(sendError);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    
    // Set up periodic check for timed-out generation tasks
    const TIMEOUT_CHECK_INTERVAL = 30000; // Check every 30 seconds
    const GENERATION_TIMEOUT_MINUTES = 2; // Set timeout to 2 minutes
    
    // Periodic check for timed out generation tasks
    setInterval(async () => {
      try {
        const updatedCount = await storage.checkAndUpdateTimedOutIdeas(GENERATION_TIMEOUT_MINUTES);
        if (updatedCount > 0) {
          log(`Auto-completed ${updatedCount} timed-out canvas generation tasks`);
        }
      } catch (error) {
        console.error("Error checking for timed-out generation tasks:", error);
      }
    }, TIMEOUT_CHECK_INTERVAL);
    
    log(`Initialized periodic check for timed-out generation tasks (every ${TIMEOUT_CHECK_INTERVAL/1000}s with ${GENERATION_TIMEOUT_MINUTES}min timeout)`);
  });
})();
