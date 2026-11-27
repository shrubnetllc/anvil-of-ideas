import { useQuery } from "@tanstack/react-query";
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

const REGENERATION_STEPS: Record<string, readonly (typeof PIPELINE_STEPS)[number][]> = {
  lean_canvas: [PIPELINE_STEPS[0]],
  prd: [PIPELINE_STEPS[1]],
  brd: [PIPELINE_STEPS[2]],
  frd: [PIPELINE_STEPS[3]],
  workflows: PIPELINE_STEPS.slice(4, 8),
  specs: [PIPELINE_STEPS[8]],
};

function computeProgress(
  steps: readonly (typeof PIPELINE_STEPS)[number][],
  step: number,
  substep?: number | null,
  totalSubsteps?: number | null,
): number {
  const totalWeight = steps.reduce((sum, s) => sum + s.substeps, 0);
  if (step <= 0) return 0;
  if (step > steps.length) return 100;

  // Sum weights of fully completed steps (before current step)
  let completedWeight = 0;
  for (let i = 0; i < step - 1; i++) {
    completedWeight += steps[i].substeps;
  }

  // Interpolate within current step if substep data is available
  const currentStepWeight = steps[step - 1].substeps;
  let fraction = 0;
  if (substep != null && totalSubsteps != null && totalSubsteps > 0) {
    fraction = Math.min(substep / totalSubsteps, 1);
  }

  return Math.round(((completedWeight + currentStepWeight * fraction) / totalWeight) * 100);
}

/** Parse step number from description like "Starting PRD (2/10)" or "BRD complete. Starting FRD (4/10)". */
function parseStepFromDescription(description: string): number | null {
  const match = description.match(/\((\d+)\/\d+\)/);
  return match ? parseInt(match[1], 10) : null;
}

interface PipelineProgressProps {
  ideaId: string;
}

export function PipelineProgress({ ideaId }: PipelineProgressProps) {
  const { data: job, refetch } = useQuery<{
    id: string;
    description: string | null;
    generationStep: string | null;
  } | null>({
    queryKey: [`/api/ideas/${ideaId}/current-workflow-job`],
    staleTime: 0,
    retry: 2,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: [`/api/ideas/${ideaId}`] });
    void queryClient.invalidateQueries({ queryKey: [`/api/ideas/${ideaId}/canvas`] });
    // A superseded job can finish after its replacement has started.
    void refetch();
  };

  const { message, eventType, step, substep, totalSubsteps } = useJobSocket({
    jobId: job?.id,
    onDone: refresh,
    onError: refresh,
  });
  const statusMessage = message ?? job?.description ?? "Starting pipeline...";
  const steps = REGENERATION_STEPS[job?.generationStep ?? ""] ?? PIPELINE_STEPS;

  if (eventType === "done" || eventType === "error") {
    return null;
  }

  const currentStep = step ?? parseStepFromDescription(statusMessage) ?? 1;
  const progressPercent = computeProgress(steps, currentStep, substep, totalSubsteps);
  const stepName = steps[currentStep - 1]?.name ?? "Processing";

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
              Step {currentStep}/{steps.length}
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
