import { useState, useEffect, useCallback, useRef } from "react";
import type { Job } from "@shared/schema";

interface UseJobPollingOptions {
    /** The job ID to poll for. If null/undefined, polling is disabled. */
    jobId: string | null | undefined;
    /** Polling interval in milliseconds. Default: 5000 (5 seconds) */
    pollInterval?: number;
    /** Statuses that will stop polling when reached. Default: ["Done", "Completed", "Error", "Failed"] */
    stopOnStatuses?: string[];
    /** Callback fired when job completes (reaches a stop status) */
    onComplete?: (job: Job) => void;
}

interface UseJobPollingResult {
    /** The full job object */
    job: Job | null;
    /** Current job status */
    status: string | null;
    /** Current job description/progress message */
    description: string | null;
    /** Whether the hook is actively polling */
    isPolling: boolean;
    /** Whether the job has completed (reached a stop status) */
    isComplete: boolean;
    /** Any error that occurred during polling */
    error: Error | null;
    /** Manually trigger a fetch */
    refetch: () => Promise<void>;
}

const DEFAULT_STOP_STATUSES = ["Done", "Completed", "complete", "completed", "Error", "Failed", "error", "failed"];

/**
 * Hook to poll a job's status and description from /api/jobs/:id
 * 
 * @example
 * ```tsx
 * const { status, description, isPolling, isComplete } = useJobPolling({
 *   jobId: myJobId,
 *   pollInterval: 3000,
 *   onComplete: (job) => toast({ title: "Job Complete!" })
 * });
 * ```
 */
export function useJobPolling({
    jobId,
    pollInterval = 5000,
    stopOnStatuses = DEFAULT_STOP_STATUSES,
    onComplete
}: UseJobPollingOptions): UseJobPollingResult {
    const [job, setJob] = useState<Job | null>(null);
    const [isPolling, setIsPolling] = useState(false);
    const [isComplete, setIsComplete] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    // Refs to track latest values in callbacks
    const onCompleteRef = useRef(onComplete);
    onCompleteRef.current = onComplete;

    const stopOnStatusesRef = useRef(stopOnStatuses);
    stopOnStatusesRef.current = stopOnStatuses;

    const fetchJob = useCallback(async (): Promise<Job | null> => {
        if (!jobId) return null;

        try {
            const response = await fetch(`/api/jobs/${jobId}`);

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error("Job not found");
                }
                throw new Error(`Failed to fetch job: ${response.statusText}`);
            }

            const data: Job = await response.json();
            console.log(`[useJobPolling] Fetched job data:`, data);
            setJob(data);
            setError(null);

            // Check if job has reached a completion status
            if (data.status && stopOnStatusesRef.current.includes(data.status)) {
                setIsComplete(true);
                setIsPolling(false);
                onCompleteRef.current?.(data);
            }

            return data;
        } catch (err) {
            const error = err instanceof Error ? err : new Error("Unknown error");
            setError(error);
            console.error("[useJobPolling] Error fetching job:", error);
            return null;
        }
    }, [jobId]);

    // Start/stop polling when jobId changes
    useEffect(() => {
        // Reset state when jobId changes
        if (!jobId) {
            setJob(null);
            setIsPolling(false);
            setIsComplete(false);
            setError(null);
            return;
        }

        // Start polling
        console.log(`[useJobPolling] Starting polling for job: ${jobId}, interval: ${pollInterval}`);
        setIsPolling(true);
        setIsComplete(false);
        setError(null);

        // Initial fetch
        fetchJob();

        // Set up polling interval
        const intervalId = setInterval(async () => {
            const data = await fetchJob();

            // Stop polling if job completed
            if (data && data.status && stopOnStatusesRef.current.includes(data.status)) {
                clearInterval(intervalId);
            }
        }, pollInterval);

        // Cleanup on unmount or jobId change
        return () => {
            clearInterval(intervalId);
            setIsPolling(false);
        };
    }, [jobId, pollInterval, fetchJob]);

    const refetch = useCallback(async () => {
        await fetchJob();
    }, [fetchJob]);

    return {
        job,
        status: job?.status ?? null,
        description: job?.description ?? null,
        isPolling,
        isComplete,
        error,
        refetch
    };
}
