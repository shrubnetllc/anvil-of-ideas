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
  const [message, setMessage] = useState<string | null>(null);
  const [eventType, setEventType] = useState<JobEvent["type"] | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [step, setStep] = useState<number | null>(null);
  const [substep, setSubstep] = useState<number | null>(null);
  const [totalSubsteps, setTotalSubsteps] = useState<number | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);

  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const lastStepRef = useRef<number | null>(null);

  useEffect(() => {
    if (!jobId) {
      setMessage(null);
      setEventType(null);
      setProgress(null);
      setStep(null);
      setSubstep(null);
      setTotalSubsteps(null);
      setIsSubscribed(false);
      lastStepRef.current = null;
      return;
    }

    const channel = `job:${jobId}`;

    const unsubscribe = subscribe(channel, (event: JobEvent) => {
      setMessage(event.data.message ?? null);
      setEventType(event.type);
      if (event.data.progress != null) {
        setProgress(event.data.progress);
      }
      if (event.data.step != null) {
        if (event.data.step !== lastStepRef.current) {
          lastStepRef.current = event.data.step;
          setSubstep(null);
          setTotalSubsteps(null);
        }

        setStep(event.data.step);
      }
      if (event.data.substep != null) {
        setSubstep(event.data.substep);
      }
      if (event.data.totalSubsteps != null) {
        setTotalSubsteps(event.data.totalSubsteps);
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

  return { message, eventType, progress, step, substep, totalSubsteps, isSubscribed };
}
