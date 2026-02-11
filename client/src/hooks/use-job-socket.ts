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
  isSubscribed: boolean;
}

export function useJobSocket({ jobId, onDone, onError }: UseJobSocketOptions): UseJobSocketResult {
  const [message, setMessage] = useState<string | null>(null);
  const [eventType, setEventType] = useState<JobEvent["type"] | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);

  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    if (!jobId) {
      setMessage(null);
      setEventType(null);
      setProgress(null);
      setIsSubscribed(false);
      return;
    }

    const channel = `job:${jobId}`;

    const unsubscribe = subscribe(channel, (event: JobEvent) => {
      setMessage(event.data.message ?? null);
      setEventType(event.type);
      if (event.data.progress != null) {
        setProgress(event.data.progress);
      }

      if (event.type === "done") {
        onDoneRef.current?.();
      } else if (event.type === "error") {
        onErrorRef.current?.(event.data.message ?? "Unknown error");
      }
    });

    setIsSubscribed(true);

    return () => {
      unsubscribe();
      setIsSubscribed(false);
    };
  }, [jobId]);

  return { message, eventType, progress, isSubscribed };
}
