import { useState, useEffect } from "react";
import { useDocument } from "@/hooks/use-document";
import { useJobPolling } from "@/hooks/use-job-polling";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw, Copy, FileText, Flame, Hammer, AlertTriangle, RotateCcw, Database } from "lucide-react";
import { formatDate, copyHtmlToClipboard } from "@/lib/utils";

interface FunctionalRequirementsTabProps {
    ideaId: number;
}

export function FunctionalRequirementsTab({ ideaId }: FunctionalRequirementsTabProps) {
    const { toast } = useToast();
    const [functionalRequirementsNotes, setFunctionalRequirementsNotes] = useState('');

    const {
        document: functionalRequirements,
        isLoading: isLoadingFunctionalRequirements,
        isGenerating: functionalRequirementsGenerating,
        isTimedOut: functionalRequirementsTimedOut,
        generate: generateFunctionalRequirements,
        deleteDoc: deleteFunctionalRequirements,
        fetchDocument: fetchFunctionalRequirements
    } = useDocument(ideaId, "FunctionalRequirements");

    const [jobId, setJobId] = useState<string | null>(null);

    // Poll for job status
    const { status: jobStatus, description: jobDescription } = useJobPolling({
        jobId,
        pollInterval: 3000,
        stopOnStatuses: ["Done", "Completed", "Error", "Failed"],
        onComplete: () => {
            fetchFunctionalRequirements();
        }
    });

    // Check for existing job on mount
    useEffect(() => {
        async function fetchCurrentJob() {
            try {
                const res = await fetch(`/api/ideas/${ideaId}/current-workflow-job?documentType=FunctionalRequirements`);
                if (res.ok) {
                    const data = await res.json();
                    if (data?.id && (data.status !== 'Done' && data.status !== 'Completed' && data.status !== 'Error' && data.status !== 'Failed')) {
                        setJobId(data.id);
                    }
                }
            } catch (e) {
                console.error("Error fetching current job", e);
            }
        }
        fetchCurrentJob();
    }, [ideaId]);

    // Debug logging
    useEffect(() => {
        console.log("[FunctionalRequirementsTab] State:", {
            jobId,
            jobStatus,
            jobDescription,
            functionalRequirementsGenerating
        });
    }, [jobId, jobStatus, jobDescription, functionalRequirementsGenerating]);

    const handleGenerate = async (notes: string) => {
        const res = await generateFunctionalRequirements(notes);
        if (res?.jobId) {
            setJobId(res.jobId);
        }
    };

    return (
        <div className="bg-white rounded-lg border border-neutral-200 shadow-sm overflow-hidden p-8">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-neutral-900">Functional Requirements Document</h3>
                {!functionalRequirements && (
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleGenerate(functionalRequirementsNotes)}
                        disabled={functionalRequirementsGenerating}
                    >
                        <Database className="mr-2 h-4 w-4" />
                        Generate Functional Requirements
                    </Button>
                )}
            </div>

            {isLoadingFunctionalRequirements ? (
                <div className="text-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                    <p>Loading functional requirements document...</p>
                </div>
            ) : functionalRequirementsGenerating && !functionalRequirementsTimedOut ? (
                <div className="text-center py-8">
                    <div className="mb-4 mx-auto relative w-16 h-16">
                        <div className="absolute inset-0 flex items-center justify-center animate-pulse">
                            <Flame className="h-14 w-14 text-amber-400" />
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center animate-spin">
                            <Hammer className="h-10 w-10 text-primary" />
                        </div>
                    </div>
                    <h4 className="text-lg font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-2">
                        Forging Your Functional Requirements
                    </h4>
                    <p className="text-neutral-600 mb-2">
                        {jobDescription || "Please wait while we hammer out the functional requirements for your idea..."}
                    </p>
                    <p className="text-neutral-500 text-sm italic">
                        {jobStatus ? `Status: ${jobStatus}` : "This process usually takes 1-2 minutes."}
                    </p>
                </div>
            ) : functionalRequirementsTimedOut ? (
                <div className="border border-destructive rounded-md p-6 mb-4 bg-destructive/10">
                    <div className="flex items-start space-x-4">
                        <div className="mt-1">
                            <AlertTriangle className="h-6 w-6 text-destructive" />
                        </div>
                        <div className="flex-1">
                            <h4 className="font-bold text-destructive mb-2">Generation Timed Out</h4>
                            <p className="text-neutral-700 mb-4">
                                The functional requirements document generation is taking longer than expected.
                                This could be due to high system load or complexity of your project.
                            </p>
                            <div className="flex items-center space-x-3">
                                <Button
                                    onClick={() => handleGenerate(functionalRequirementsNotes)}
                                    disabled={functionalRequirementsGenerating}
                                    className="bg-gradient-to-r from-amber-500 to-amber-700 hover:from-amber-600 hover:to-amber-800"
                                >
                                    {functionalRequirementsGenerating ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Retrying...
                                        </>
                                    ) : (
                                        <>
                                            <RefreshCw className="mr-2 h-4 w-4" />
                                            Retry Generation
                                        </>
                                    )}
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={fetchFunctionalRequirements}
                                >
                                    <RotateCcw className="mr-2 h-4 w-4" />
                                    Check Status
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : functionalRequirements ? (
                <div>
                    {functionalRequirements.status === 'Completed' ? (
                        <div>
                            <div className="mb-6 flex justify-between items-center">
                                <div>
                                    <p className="text-sm text-neutral-500">
                                        Last updated: {formatDate(functionalRequirements.updatedAt || functionalRequirements.createdAt)}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={async () => {
                                            const success = await copyHtmlToClipboard("functional-requirements-content");
                                            if (success) {
                                                toast({
                                                    title: "Content copied to clipboard",
                                                    description: "Functional requirements copied as formatted text",
                                                    duration: 3000
                                                });
                                            } else {
                                                toast({
                                                    title: "Failed to copy content",
                                                    description: "Please try again or select and copy manually",
                                                    variant: "destructive",
                                                    duration: 3000
                                                });
                                            }
                                        }}
                                    >
                                        <Copy className="mr-2 h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            {/* Display the functional requirements content */}
                            <div id="functional-requirements-content" className="prose max-w-none prose-headings:font-semibold prose-h1:text-xl prose-h2:text-lg prose-h3:text-md prose-p:text-neutral-700">
                                {functionalRequirements.html ? (
                                    <div dangerouslySetInnerHTML={{ __html: functionalRequirements.html }} />
                                ) : functionalRequirements.content ? (
                                    <div className="whitespace-pre-wrap font-mono text-sm bg-neutral-50 p-4 rounded-md">
                                        {functionalRequirements.content}
                                    </div>
                                ) : (
                                    <div className="p-4 text-center">
                                        <p className="text-neutral-600">
                                            Functional requirements content is being processed. Check status to refresh.
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Add regeneration instructions and regenerate button */}
                            <div className="mt-6 flex justify-between items-center">
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-sm text-neutral-500 inline-flex items-center"
                                        >
                                            <FileText className="mr-1 h-4 w-4" />
                                            Add regeneration instructions
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-[550px]">
                                        <DialogHeader>
                                            <DialogTitle>Add Regeneration Instructions</DialogTitle>
                                            <DialogDescription>
                                                Add specific instructions for regenerating your Functional Requirements. These instructions will be used when you click the Regenerate button.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="py-4">
                                            <Textarea
                                                id="functionalRequirementsNotes"
                                                value={functionalRequirementsNotes}
                                                onChange={(e) => setFunctionalRequirementsNotes(e.target.value)}
                                                placeholder="E.g., Detail the API endpoints, specify database schema requirements, outline authentication flows..."
                                                className="min-h-[150px]"
                                            />
                                        </div>
                                        <DialogFooter>
                                            <DialogClose asChild>
                                                <Button type="button">Save Instructions</Button>
                                            </DialogClose>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>

                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={async () => {
                                        if (functionalRequirements?.id) {
                                            await deleteFunctionalRequirements();
                                            handleGenerate(functionalRequirementsNotes);
                                        }
                                    }}
                                    disabled={functionalRequirementsGenerating}
                                >
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Regenerate
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <p>Functional requirements document is in {functionalRequirements.status.toLowerCase()} state.</p>
                        </div>
                    )}
                </div>
            ) : (
                <div className="py-8">
                    <div className="mb-6">
                        <p className="mb-2">Provide optional instructions for generating your functional requirements document:</p>
                        <Textarea
                            value={functionalRequirementsNotes}
                            onChange={(e) => setFunctionalRequirementsNotes(e.target.value)}
                            placeholder="e.g., Detail user authentication, specify API endpoints, define database schema..."
                            className="h-24"
                        />
                    </div>
                    <div className="flex justify-center">
                        <Button
                            onClick={() => handleGenerate(functionalRequirementsNotes)}
                            disabled={functionalRequirementsGenerating}
                            className="bg-gradient-to-r from-amber-500 to-amber-700 hover:from-amber-600 hover:to-amber-800"
                        >
                            <Database className="mr-2 h-4 w-4" />
                            {functionalRequirementsGenerating ? 'Generating...' : 'Generate Functional Requirements'}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
