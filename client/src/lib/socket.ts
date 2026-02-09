import { io, Socket } from "socket.io-client";

export interface JobEvent {
  type: "status" | "progress" | "log" | "done" | "error";
  channel: string;
  timestamp: string;
  data: {
    message?: string;
    progress?: number;
  };
}

type Handler = (event: JobEvent) => void;

let socket: Socket | null = null;
const handlers = new Map<string, Set<Handler>>();

function debugLog(...args: unknown[]) {
  if (typeof localStorage !== "undefined" && localStorage.getItem("DEBUG_SOCKET") === "true") {
    console.log("[socket]", ...args);
  }
}

function ensureConnected() {
  if (socket) return;

  socket = io({
    path: "/socket.io",
    withCredentials: true,
    transports: ["websocket", "polling"],
  });

  socket.on("connect", () => debugLog("connected", socket!.id));
  socket.on("disconnect", (reason) => debugLog("disconnected", reason));
  socket.on("connect_error", (err) => debugLog("connect_error", err.message));

  socket.on("job:event", (event: JobEvent) => {
    debugLog("event", event);
    const channelHandlers = handlers.get(event.channel);
    if (channelHandlers) {
      channelHandlers.forEach((h) => h(event));
    }
  });
}

function disconnectIfIdle() {
  if (handlers.size === 0 && socket) {
    debugLog("no subscriptions, disconnecting");
    socket.disconnect();
    socket = null;
  }
}

export function subscribe(channel: string, handler: Handler): () => void {
  ensureConnected();

  let channelHandlers = handlers.get(channel);
  const isFirst = !channelHandlers || channelHandlers.size === 0;

  if (!channelHandlers) {
    channelHandlers = new Set();
    handlers.set(channel, channelHandlers);
  }
  channelHandlers.add(handler);

  if (isFirst) {
    debugLog("subscribing to", channel);
    socket!.emit("subscribe", channel);
  }

  return () => {
    channelHandlers!.delete(handler);
    if (channelHandlers!.size === 0) {
      handlers.delete(channel);
      debugLog("unsubscribing from", channel);
      socket?.emit("unsubscribe", channel);
      disconnectIfIdle();
    }
  };
}
