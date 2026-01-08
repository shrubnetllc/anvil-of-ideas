import { useState, useEffect } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import ReactMarkdown from 'react-markdown';

interface BackendTabProps {
    ideaId: number;
}

export function BackendTab({ ideaId }: BackendTabProps) {
    const [jobStatus, setJobStatus] = useState<string | null>(null);
    const [steps, setSteps] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Initial check and polling
    useEffect(() => {
        let intervalId: NodeJS.Timeout;

        const checkStatus = async () => {
            try {
                // Check latest job status
                const jobRes = await fetch(`/api/ideas/${ideaId}/current-workflow-job`);
                if (!jobRes.ok) {
                    throw new Error("Failed to check job status");
                }
                const job = await jobRes.json();

                if (!job) {
                    setJobStatus("None");
                    setLoading(false);
                    return;
                }

                setJobStatus(job.status);

                if (job.status === 'Done' || job.status === 'Completed') {
                    // Fetch data
                    const workflowRes = await fetch(`/api/ideas/${ideaId}/project-workflows`);
                    if (workflowRes.ok) {
                        const data = await workflowRes.json();
                        setSteps(data);
                    }
                    setLoading(false);
                    // Stop polling
                    if (intervalId) clearInterval(intervalId);
                } else {
                    setLoading(false);
                }

            } catch (e) {
                console.error("Error checking status:", e);
                setError("Failed to load status");
                setLoading(false);
            }
        };

        checkStatus();

        // Poll every minute if not done
        intervalId = setInterval(() => {
            if (jobStatus !== 'Done' && jobStatus !== 'Completed') {
                checkStatus();
            }
        }, 60000);

        return () => clearInterval(intervalId);
    }, [ideaId, jobStatus]);

    if (loading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 text-center text-red-500">
                <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                <p>{error}</p>
            </div>
        );
    }

    if (jobStatus === "None" || !jobStatus) {
        return (
            <div className="p-12 text-center text-neutral-500">
                <p className="text-lg">Generate workflows to begin</p>
            </div>
        );
    }

    if (jobStatus === "Started" || jobStatus === "Pending" || jobStatus === "Generating") {
        return (
            <div className="p-12 text-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
                <h3 className="text-lg font-medium text-neutral-900">Generating Backend Specs...</h3>
                <p className="text-neutral-500 mt-2">This may take a few minutes.</p>
            </div>
        );
    }

    // Display Data
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-neutral-900">Backend Logic</h3>
            </div>

            {steps.length === 0 ? (
                <p className="text-neutral-500">No backend steps found.</p>
            ) : (
                <div className="space-y-4">
                    {steps.map((step, idx) => (
                        <div key={idx} className="bg-white border rounded-lg p-6 shadow-sm">
                            <div className="mb-4">
                                <span className="bg-neutral-100 text-neutral-600 text-sm font-mono px-2 py-1 rounded inline-block">
                                    Step {step.step_number}
                                </span>
                            </div>
                            <div className="pl-0 prose max-w-none text-neutral-600">
                                <ReactMarkdown>
                                    {step.backend || "No backend details provided."}
                                </ReactMarkdown>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
