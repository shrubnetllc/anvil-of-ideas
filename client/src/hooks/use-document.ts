import { useState, useEffect, useCallback, useRef } from "react";
import { DocumentType, Document } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useDocument(ideaId: string, documentType: DocumentType) {
    const [document, setDocument] = useState<Document | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isTimedOut, setIsTimedOut] = useState(false);
    const { toast } = useToast();

    const documentRef = useRef(document);
    useEffect(() => {
        documentRef.current = document;
    }, [document]);

    const fetchDocument = useCallback(async () => {
        if (!ideaId) return;

        try {
            setIsLoading(true);
            const response = await fetch(`/api/ideas/${ideaId}/documents/${documentType}`);

            if (response.ok) {
                const data = await response.json();
                setDocument(data);

                // Document existence = generation complete
                if (data) {
                    setIsGenerating(false);
                    setIsTimedOut(false);
                }
            } else {
                setDocument(null);
            }
        } catch (error) {
            console.error(`Error fetching ${documentType}:`, error);
        } finally {
            setIsLoading(false);
        }
    }, [ideaId, documentType]);

    // Check job status for generation tracking
    const checkJobStatus = useCallback(async () => {
        try {
            const response = await fetch(`/api/ideas/${ideaId}/current-workflow-job?documentType=${documentType}`);
            if (response.ok) {
                const job = await response.json();
                if (job) {
                    const isPending = job.status === 'pending' || job.status === 'processing' || job.status === 'starting';
                    setIsGenerating(isPending);

                    // Check timeout (2 minutes)
                    if (isPending && job.createdAt) {
                        const createdAt = new Date(job.createdAt);
                        const diffMinutes = (Date.now() - createdAt.getTime()) / (1000 * 60);
                        setIsTimedOut(diffMinutes >= 2);
                    }

                    if (!isPending) {
                        // Job completed - refetch document
                        await fetchDocument();
                    }
                }
            }
        } catch (error) {
            console.error("Error checking job status:", error);
        }
    }, [ideaId, documentType, fetchDocument]);

    // Polling effect for generation tracking
    useEffect(() => {
        let pollTimer: NodeJS.Timeout;

        if (isGenerating) {
            pollTimer = setInterval(async () => {
                await checkJobStatus();
            }, 10000);
        }

        return () => {
            if (pollTimer) clearInterval(pollTimer);
        };
    }, [isGenerating, checkJobStatus]);

    // Initial fetch
    useEffect(() => {
        fetchDocument();
    }, [fetchDocument]);

    const generate = async (instructions: string = "") => {
        try {
            setIsGenerating(true);
            setIsTimedOut(false);

            let url = "";
            let body: Record<string, any> = {};

            switch (documentType) {
                case "LeanCanvas":
                    url = `/api/ideas/${ideaId}/generate`;
                    body = { notes: instructions };
                    break;
                case "ProjectRequirements":
                    url = `/api/ideas/${ideaId}/generate-functional-requirements`;
                    body = { instructions: instructions || "Be Brief as possible" };
                    break;
                case "BusinessRequirements":
                    url = `/api/ideas/${ideaId}/generate-business-requirements`;
                    body = { instructions: instructions || "Provide detailed business requirements." };
                    break;
                case "FunctionalRequirements":
                    url = `/api/ideas/${ideaId}/generate-functional-requirements`;
                    body = instructions ? { instructions } : {};
                    break;
                case "Workflows":
                    url = `/api/ideas/${ideaId}/workflows`;
                    body = {};
                    break;
                default:
                    throw new Error(`Generation not implemented for ${documentType}`);
            }

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                throw new Error(await response.text());
            }

            const result = await response.json();
            console.log(`[${documentType}] Generation started:`, result);

            toast({
                title: "Generation Started",
                description: `Started forging ${documentType.replace(/([A-Z])/g, ' $1').trim()}. This may take a few minutes.`,
            });

            return result;
        } catch (error) {
            console.error(`Error generating ${documentType}:`, error);
            setIsGenerating(false);
            toast({
                title: "Error",
                description: `Failed to generate ${documentType}. Please try again.`,
                variant: "destructive",
            });
        }
    };

    const deleteDoc = async () => {
        if (documentType === 'LeanCanvas') {
            try {
                const response = await fetch(`/api/ideas/${ideaId}/documents/type/LeanCanvas`, {
                    method: 'DELETE'
                });
                if (response.ok) {
                    setDocument(null);
                    setIsGenerating(false);
                    setIsTimedOut(false);
                    return true;
                }
                return false;
            } catch (error) {
                console.error(`Error deleting ${documentType}:`, error);
                return false;
            }
        }

        if (!document?.id) return false;

        try {
            const response = await fetch(`/api/ideas/${ideaId}/documents/${document.id}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                setDocument(null);
                setIsGenerating(false);
                setIsTimedOut(false);
                return true;
            }
            return false;
        } catch (error) {
            console.error(`Error deleting ${documentType}:`, error);
            return false;
        }
    };

    return {
        document,
        isLoading,
        isGenerating,
        isTimedOut,
        fetchDocument,
        generate,
        deleteDoc
    };
}
