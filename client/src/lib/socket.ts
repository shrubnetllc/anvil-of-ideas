export interface JobEvent {
  type: "status" | "progress" | "log" | "done" | "error";
  channel: string;
  timestamp: string;
  data: {
    message?: string;
    progress?: number;
    step?: number;
    substep?: number;
    totalSubsteps?: number;
  };
}

type Handler = (event: JobEvent) => void;

export function subscribe(channel: string, handler: Handler): () => void {
  const jobId = channel.slice("job:".length);
  const source = new EventSource(`/api/jobs/${encodeURIComponent(jobId)}/events`);
  source.onmessage = (message: MessageEvent<string>) => {
    const event: JobEvent = JSON.parse(message.data);
    if (event.channel !== channel) return;
    if (event.type === "done" || event.type === "error") {
      source.close();
    }
    handler(event);
  };
  return () => source.close();
}
