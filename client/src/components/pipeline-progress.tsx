import { useEffect, useState, useCallback } from "react";
import { useJobSocket } from "@/hooks/use-job-socket";
import { queryClient } from "@/lib/queryClient";
import { Flame, Hammer } from "lucide-react";

interface PipelineProgressProps {
  ideaId: string;
}

export function PipelineProgress({ ideaId }: PipelineProgressProps) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("Starting pipeline...");

  // Fetch the current active job for this idea
  const fetchCurrentJob = useCallback(async () => {
    try {
      const response = await fetch(`/api/ideas/${ideaId}/current-workflow-job?documentType=LeanCanvas`);
      if (response.ok) {
        const job = await response.json();
        if (job) {
          setJobId(job.id);
          if (job.description) {
            setStatusMessage(job.description);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching current job:", error);
    }
  }, [ideaId]);

  useEffect(() => {
    fetchCurrentJob();
  }, [fetchCurrentJob]);

  // Subscribe to real-time socket events for this job
  const { message, eventType } = useJobSocket({
    jobId,
    onDone: () => {
      // Invalidate queries so tabs refresh with new data
      queryClient.invalidateQueries({ queryKey: [`/api/ideas/${ideaId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/ideas/${ideaId}/canvas`] });
    },
    onError: (msg) => {
      setStatusMessage(msg || "Generation failed");
    },
  });

  // Update status message when socket events arrive
  useEffect(() => {
    if (message) {
      setStatusMessage(message);
    }
  }, [message]);

  if (eventType === "done" || eventType === "error") {
    return null;
  }

  return (
    <div className="mb-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4">
      <div className="flex items-center gap-3">
        <div className="relative w-10 h-10 flex-shrink-0">
          <div className="absolute inset-0 flex items-center justify-center animate-pulse">
            <Flame className="h-8 w-8 text-amber-400" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center animate-spin">
            <Hammer className="h-6 w-6 text-primary" />
          </div>
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-semibold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Pipeline In Progress
          </h4>
          <p className="text-sm text-neutral-600 truncate">
            {statusMessage}
          </p>
        </div>
      </div>
    </div>
  );
}
