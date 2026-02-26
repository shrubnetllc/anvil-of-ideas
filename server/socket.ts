import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import type { RequestHandler } from "express";
import { storage } from "./storage";
import { log } from "./vite";

let io: Server | null = null;

export function setupSocketIO(httpServer: HttpServer, sessionMiddleware: RequestHandler) {
  io = new Server(httpServer, {
    path: "/socket.io",
  });

  // Share express-session so socket connections are authenticated via the same cookie
  io.engine.use(sessionMiddleware);

  io.on("connection", (socket) => {
    const session = (socket.request as any).session;
    const userId = session?.passport?.user;

    if (!userId) {
      log("Socket rejected: unauthenticated", "socket.io");
      socket.disconnect(true);
      return;
    }

    log(`Socket connected: user=${userId} sid=${socket.id}`, "socket.io");

    socket.on("subscribe", async (channel: string) => {
      // Validate channel format: job:<uuid>
      const match = channel.match(/^job:([0-9a-f-]+)$/i);
      if (!match) {
        socket.emit("error", { message: "Invalid channel format" });
        return;
      }

      const jobId = match[1];
      try {
        const job = await storage.getWorkflowJobById(jobId);
        if (!job || job.userId !== userId) {
          socket.emit("error", { message: "Unauthorized channel" });
          return;
        }

        socket.join(channel);
        log(`Socket ${socket.id} subscribed to ${channel}`, "socket.io");
      } catch (err) {
        log(`Subscribe error for ${channel}: ${err}`, "socket.io");
        socket.emit("error", { message: "Subscription failed" });
      }
    });

    socket.on("unsubscribe", (channel: string) => {
      socket.leave(channel);
      log(`Socket ${socket.id} unsubscribed from ${channel}`, "socket.io");
    });

    socket.on("disconnect", () => {
      log(`Socket disconnected: user=${userId} sid=${socket.id}`, "socket.io");
    });
  });

  return io;
}

export function publishJobEvent(
  jobId: string,
  type: "status" | "progress" | "log" | "done" | "error",
  data: { message?: string; progress?: number }
) {
  if (!io) return;

  const channel = `job:${jobId}`;
  const event = {
    type,
    channel,
    timestamp: new Date().toISOString(),
    data,
  };

  io.to(channel).emit("job:event", event);
}
