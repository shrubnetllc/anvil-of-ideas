import { useEffect, useState, useCallback } from "react";
import { useJobSocket } from "@/hooks/use-job-socket";
import { queryClient } from "@/lib/queryClient";
import { Progress } from "@/components/ui/progress";
import { Flame, Hammer } from "lucide-react";

const PIPELINE_STEPS = [
  { name: "Lean Canvas", substeps: 9 },
  { name: "Project Requirements", substeps: 13 },
  { name: "Business Requirements", substeps: 13 },
  { name: "Functional Requirements", substeps: 32 },
  { name: "Workflow Vectorizer", substeps: 10 },
  { name: "Workflow Interrogation", substeps: 27 },
  { name: "Workflow Parsing", substeps: 10 },
  { name: "Mermaid", substeps: 10 },
  { name: "Vibe Coder", substeps: 29 },
  { name: "Estimate", substeps: 10 },
] as const;

const TOTAL_SUBSTEPS = PIPELINE_STEPS.reduce((sum, s) => sum + s.substeps, 0);

/** Compute weighted progress (0–100), interpolating within a step using substep data. */
function computeProgress(step: number, substep?: number | null, totalSubsteps?: number | null): number {
  if (step <= 0) return 0;
  if (step > PIPELINE_STEPS.length) return 100;

  // Sum weights of fully completed steps (before current step)
  let completedWeight = 0;
  for (let i = 0; i < step - 1; i++) {
    completedWeight += PIPELINE_STEPS[i].substeps;
  }

  // Interpolate within current step if substep data is available
  const currentStepWeight = PIPELINE_STEPS[step - 1].substeps;
  let fraction = 0;
  if (substep != null && totalSubsteps != null && totalSubsteps > 0) {
    fraction = Math.min(substep / totalSubsteps, 1);
  }

  return Math.round(((completedWeight + currentStepWeight * fraction) / TOTAL_SUBSTEPS) * 100);
}

/** Parse step number from description like "Starting PRD (2/10)" or "BRD complete. Starting FRD (4/10)". */
function parseStepFromDescription(description: string): number | null {
  const match = description.match(/\((\d+)\/10\)/);
  return match ? parseInt(match[1], 10) : null;
}

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
  const { message, eventType, step, substep, totalSubsteps } = useJobSocket({
    jobId,
    onDone: () => {
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

  const currentStep = step ?? parseStepFromDescription(statusMessage) ?? 1;
  const progressPercent = computeProgress(currentStep, substep, totalSubsteps);
  const stepName = PIPELINE_STEPS[currentStep - 1]?.name ?? "Processing";

  return (
    <div className="mb-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="relative w-10 h-10 flex-shrink-0">
          <div className="absolute inset-0 flex items-center justify-center animate-pulse">
            <Flame className="h-8 w-8 text-amber-400" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center animate-spin">
            <Hammer className="h-6 w-6 text-primary" />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Pipeline In Progress
            </h4>
            <span className="text-xs text-neutral-500">
              Step {currentStep}/{PIPELINE_STEPS.length}
            </span>
          </div>
          <p className="text-sm text-neutral-600 truncate">
            {stepName} — {statusMessage}
          </p>
        </div>
      </div>
      <Progress value={progressPercent} className="h-2" />
      <p className="text-xs text-neutral-400 mt-1 text-right">{progressPercent}%</p>
    </div>
  );
}
