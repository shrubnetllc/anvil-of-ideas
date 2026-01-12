import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Workflow, CheckCircle, Clock } from "lucide-react";

interface WorkflowsTabProps {
    ideaId: number;
}

export function WorkflowsTab({ ideaId }: WorkflowsTabProps) {
    const { toast } = useToast();
    const [jobId, setJobId] = useState<string | null>(null);
    const [jobStatus, setJobStatus] = useState<string | null>(null);
    const [isStarting, setIsStarting] = useState(false);
    const [steps, setSteps] = useState<any[]>([]);

    const checkStatus = async () => {
        try {
            const res = await fetch(`/api/ideas/${ideaId}/current-workflow-job`);
            if (res.ok) {
                const data = await res.json();
                setJobId(data.id);
                setJobStatus(data.status);

                if (data.status === 'Done' || data.status === 'Completed') {
                    toast({
                        title: "Workflows Generated",
                        description: "The workflow generation is complete."
                    });
                }
            }
        } catch (e) {
            console.error("Error polling job status", e);
        }
    };

    async function getSteps() {
        //When a job is completed, we will query the project workflows table and get the steps which will be rendered as bootstrap cards
        try {
            const res = await fetch(`/api/ideas/${ideaId}/project-workflows`);
            if (res.ok) {
                const data = await res.json();
                //Parse steps by taking the workflow_step field and parsing it as json
                const stepsString = data[0].workflow_step;
                const parsedSteps = JSON.parse(stepsString);
                const steps = parsedSteps.map((step: any) => { return step.output; });
                setSteps(steps);
            }
        } catch (e) {
            console.error("Error getting steps", e);
        }
    }

    // Poll for status every minute
    useEffect(() => {
        //Check status
        checkStatus();

        //If job is done, stop polling
        if (!jobId) {
            return;
        }
        if (jobStatus === 'Done' || jobStatus === 'Completed') {
            getSteps();
            return;
        }

        // Poll every 60 seconds (1 minute)
        const intervalId = setInterval(checkStatus, 60000);

        return () => clearInterval(intervalId);
    }, [jobId, jobStatus, toast]);

    async function generateWorkflows() {
        setIsStarting(true);
        try {
            const res = await fetch(`/api/ideas/${ideaId}/workflows`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    workflowType: "default",
                    title: "Workflows"
                })
            });

            if (!res.ok) {
                const err = await res.text();
                throw new Error(err || "Failed to start generation");
            }

            const data = await res.json();
            setJobId(data.jobId);
            setJobStatus("Started");

            toast({
                title: "Generation Started",
                description: "Workflows are being generated. This may take 10-15 minutes."
            });

        } catch (e) {
            console.error(e);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to start workflow generation."
            });
        } finally {
            setIsStarting(false);
        }
    }

    const isDone = jobStatus === 'Done' || jobStatus === 'Completed';

    return (
        <div className="bg-white rounded-lg border border-neutral-200 shadow-sm overflow-hidden p-8">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-neutral-900">Workflows</h3>
            </div>

            <div className="flex flex-col items-center justify-center py-12">
                {!jobId ? (
                    <div className="text-center">
                        <div className="mb-4 mx-auto w-16 h-16 flex items-center justify-center rounded-full bg-neutral-100">
                            <Workflow className="h-8 w-8 text-neutral-500" />
                        </div>
                        <h4 className="text-lg font-medium text-neutral-900 mb-2">Generate Workflows</h4>
                        <p className="text-neutral-500 mb-6 max-w-md mx-auto">
                            Click below to start generating workflows. This process runs in the background and takes approximately 10-15 minutes.
                        </p>
                        <Button
                            onClick={generateWorkflows}
                            disabled={isStarting}
                            className="bg-primary hover:bg-primary/90"
                        >
                            {isStarting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Starting...
                                </>
                            ) : (
                                <>
                                    <Workflow className="mr-2 h-4 w-4" />
                                    Generate Workflows
                                </>
                            )}
                        </Button>
                    </div>
                ) : !isDone ? (
                    <div className="text-center">
                        <div className="mb-4 mx-auto relative w-16 h-16">
                            <div className="absolute inset-0 flex items-center justify-center animate-spin">
                                <Loader2 className="h-10 w-10 text-primary" />
                            </div>
                        </div>
                        <h4 className="text-lg font-bold text-neutral-900 mb-2">
                            Generating Workflows
                        </h4>
                        <div className="flex items-center justify-center space-x-2 text-neutral-600 mb-2">
                            <Clock className="h-4 w-4" />
                            <span>Status: {jobStatus || "Started"}</span>
                        </div>
                        <p className="text-neutral-500 text-sm italic">
                            This process takes 10-15 minutes. We'll check the status every minute.
                        </p>
                    </div>
                ) : (
                    steps.length === 0 ? (
                        <p className="text-neutral-500">No workflows found.</p>
                    ) : (
                        <div className="space-y-4">
                            {steps.map((step, idx) => (
                                <div key={idx} className="bg-white border rounded-lg p-6 shadow-sm">
                                    <div className="mb-4">
                                        <span className="bg-neutral-100 text-neutral-600 text-sm font-mono px-2 py-1 rounded inline-block">
                                            Step {step.step_number}
                                        </span>
                                        <span className="bg-neutral-100 text-neutral-600 text-sm font-mono px-2 py-1 rounded inline-block">
                                            {step.step_name}
                                        </span>
                                        {step.substeps && Array.isArray(step.substeps) && (
                                            <div className="mt-4">
                                                <h5 className="text-sm font-bold text-neutral-700 mb-2">Substeps:</h5>
                                                <ol className="list-decimal pl-5 space-y-1">
                                                    {step.substeps.map((substep: any, sIdx: number) => (
                                                        <li key={sIdx} className="text-sm text-neutral-600">
                                                            <span className="font-medium mr-1">{substep.substep_number}.</span>
                                                            {substep.substep_description}
                                                        </li>
                                                    ))}
                                                </ol>
                                            </div>
                                        )}
                                    </div>
                                    <div className="pl-0 prose max-w-none text-neutral-600">
                                        {step.workflow_step}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                )}
            </div>
        </div>
    );
}
