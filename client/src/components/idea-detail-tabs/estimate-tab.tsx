import { useState, useEffect } from "react";
import { Loader2, AlertCircle, DollarSign } from "lucide-react";
import ReactMarkdown from 'react-markdown';

interface EstimateTabProps {
    ideaId: number;
}

export function EstimateTab({ ideaId }: EstimateTabProps) {
    const [jobStatus, setJobStatus] = useState<string | null>(null);
    const [estimateData, setEstimateData] = useState<any>(null);
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
                    const estRes = await fetch(`/api/ideas/${ideaId}/project-estimate`);
                    if (estRes.ok) {
                        const data = await estRes.json();
                        setEstimateData(data);
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
                <h3 className="text-lg font-medium text-neutral-900">Generating Estimate...</h3>
                <p className="text-neutral-500 mt-2">This may take a few minutes.</p>
            </div>
        );
    }

    // Display Data
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-neutral-900 flex items-center">
                    <DollarSign className="mr-2 h-5 w-5 text-green-600" />
                    Project Estimate
                </h3>
            </div>

            {!estimateData ? (
                <p className="text-neutral-500">No estimate data found.</p>
            ) : (
                <div className="bg-white border rounded-lg p-8 shadow-sm prose max-w-none">
                    {estimateData.estimate_md ? (
                        <ReactMarkdown>{estimateData.estimate_md}</ReactMarkdown>
                    ) : (
                        <div className="whitespace-pre-wrap">{estimateData.estimate}</div>
                    )}
                </div>
            )}
        </div>
    );
}
