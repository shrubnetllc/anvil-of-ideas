import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

export interface WorkflowStep {
    [key: string]: unknown;
}

export interface WorkflowData {
    id?: string;
    idea_id?: string;
    workflow_steps?: WorkflowStep[];
    mermaid_code?: string | null;
    workflow_result?: unknown;
    homepage_spec?: string | null;
    workflow_spec?: string | null;
    backend_spec?: string | null;
    swagger?: string | null;
    status?: string;
    created_at?: string;
    updated_at?: string;
}

export function useWorkflows(ideaId: string) {
    const [workflow, setWorkflow] = useState<WorkflowData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const fetchWorkflows = useCallback(async () => {
        if (!ideaId) return;

        try {
            setIsLoading(true);
            const response = await fetch(`/api/ideas/${ideaId}/project-workflows`);

            if (response.ok) {
                const data = await response.json();
                setWorkflow(data);
            } else {
                setWorkflow(null);
            }
        } catch (error) {
            console.error("Error fetching workflows:", error);
        } finally {
            setIsLoading(false);
        }
    }, [ideaId]);

    useEffect(() => {
        fetchWorkflows();
    }, [fetchWorkflows]);

    return {
        workflow,
        steps: (workflow?.workflow_steps as WorkflowStep[]) || [],
        isLoading,
        fetchWorkflows
    };
}
