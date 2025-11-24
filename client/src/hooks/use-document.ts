import { useState, useEffect, useCallback, useRef } from "react";
import { DocumentType, ProjectDocument } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useDocument(ideaId: number, documentType: DocumentType) {
    const [document, setDocument] = useState<ProjectDocument | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isTimedOut, setIsTimedOut] = useState(false);
    const { toast } = useToast();

    // Refs to prevent stale closures in intervals
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

                // Check status
                if (data.status === 'Generating') {
                    setIsGenerating(true);
                    checkTimeout(data.generationStartedAt);
                } else {
                    setIsGenerating(false);
                    setIsTimedOut(false);
                }

                // Auto-fix logic: If we have HTML but status is not Completed
                if (data.html && data.status !== 'Completed') {
                    console.log(`[${documentType}] Found HTML but status is ${data.status} - fixing...`);
                    await updateStatus(data.id, 'Completed');
                    // Refetch to get clean state
                    const retryResponse = await fetch(`/api/ideas/${ideaId}/documents/${documentType}`);
                    if (retryResponse.ok) {
                        setDocument(await retryResponse.json());
                    }
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

    const updateStatus = async (docId: number, status: string) => {
        try {
            await fetch(`/api/ideas/${ideaId}/documents/${documentType}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });
        } catch (e) {
            console.error("Error updating status:", e);
        }
    };

    const checkTimeout = (startedAtStr?: string | Date) => {
        if (!startedAtStr) return;
        const startedAt = new Date(startedAtStr);
        const now = new Date();
        const diffMinutes = (now.getTime() - startedAt.getTime()) / (1000 * 60);

        if (diffMinutes >= 2) {
            console.log(`[${documentType}] Generation timed out (${diffMinutes.toFixed(1)} mins)`);
            setIsTimedOut(true);
        } else {
            setIsTimedOut(false);
        }
    };

    // Polling effect
    useEffect(() => {
        let pollTimer: NodeJS.Timeout;

        if (isGenerating) {
            pollTimer = setInterval(async () => {
                try {
                    const response = await fetch(`/api/ideas/${ideaId}/documents/${documentType}`);
                    if (response.ok) {
                        const data = await response.json();
                        setDocument(data);

                        checkTimeout(data.generationStartedAt);

                        if (data.status !== 'Generating') {
                            setIsGenerating(false);
                            setIsTimedOut(false);
                            toast({
                                title: "Success",
                                description: `${documentType.replace(/([A-Z])/g, ' $1').trim()} has been forged!`,
                            });
                        }
                    }
                } catch (e) {
                    console.error("Polling error:", e);
                }
            }, 10000);
        }

        return () => {
            if (pollTimer) clearInterval(pollTimer);
        };
    }, [isGenerating, ideaId, documentType, toast]);

    // Initial fetch
    useEffect(() => {
        fetchDocument();
    }, [fetchDocument]);

    const generate = async (instructions: string = "", projectId?: string) => {
        try {
            setIsGenerating(true);
            setIsTimedOut(false);

            let url = "";
            let body = {};

            // Determine endpoint and body based on document type
            switch (documentType) {
                case "ProjectRequirements":
                    url = `/api/webhook/requirements`;
                    body = {
                        projectId: projectId || ideaId.toString(),
                        instructions: instructions || "Be Brief as possible"
                    };
                    break;
                case "BusinessRequirements":
                    url = `/api/ideas/${ideaId}/generate-business-requirements`;
                    body = {
                        ideaId,
                        projectId,
                        instructions: instructions || "Provide detailed business requirements aligned with the lean canvas and project requirements."
                    };
                    break;
                case "FunctionalRequirements":
                    url = `/api/ideas/${ideaId}/generate-functional-requirements`;
                    body = instructions ? { instructions } : {};
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

            // Immediately fetch to update state
            fetchDocument();

            toast({
                title: "Generation Started",
                description: `Started forging ${documentType.replace(/([A-Z])/g, ' $1').trim()}. This may take a few minutes.`,
            });

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
