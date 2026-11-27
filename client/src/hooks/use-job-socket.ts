import { useState, useEffect, useRef } from "react";
import { subscribe, type JobEvent } from "@/lib/socket";

interface UseJobSocketOptions {
  jobId: string | null | undefined;
  onDone?: () => void;
  onError?: (message: string) => void;
}

interface UseJobSocketResult {
  message: string | null;
  eventType: JobEvent["type"] | null;
  progress: number | null;
  step: number | null;
  substep: number | null;
  totalSubsteps: number | null;
  isSubscribed: boolean;
}

export function useJobSocket({ jobId, onDone, onError }: UseJobSocketOptions): UseJobSocketResult {
  const [event, setEvent] = useState<JobEvent | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  useEffect(() => {
    if (!jobId) return;
    const unsubscribe = subscribe(`job:${jobId}`, (event: JobEvent) => {
      setEvent(event);
      if (event.type === "done") {
        onDoneRef.current?.();
      } else if (event.type === "error") {
        onErrorRef.current?.(event.data.message ?? "Unknown error");
      }
    });

    return unsubscribe;
  }, [jobId]);

  const snapshot = event?.channel === `job:${jobId}` ? event : null;
  return {
    message: snapshot?.data.message ?? null,
    eventType: snapshot?.type ?? null,
    progress: snapshot?.data.progress ?? null,
    step: snapshot?.data.step ?? null,
    substep: snapshot?.data.substep ?? null,
    totalSubsteps: snapshot?.data.totalSubsteps ?? null,
    isSubscribed: Boolean(jobId && snapshot?.type !== "done" && snapshot?.type !== "error"),
  };
}
