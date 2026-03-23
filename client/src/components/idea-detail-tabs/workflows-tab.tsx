import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { useWorkflows, WorkflowStep } from "@/hooks/use-workflows";
import { useIdeas } from "@/hooks/use-ideas";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Copy, Sparkles, GitBranch, RefreshCw } from "lucide-react";
import { copyHtmlToClipboard } from "@/lib/utils";
import { MermaidDiagram, parseDiagrams } from "@/components/mermaid-diagram";

interface WorkflowsTabProps {
    ideaId: string;
}

export function WorkflowsTab({ ideaId }: WorkflowsTabProps) {
    const { toast } = useToast();
    const { workflow, steps, isLoading } = useWorkflows(ideaId);
    const { regenerateStep, isRegeneratingStep } = useIdeas();
    const [diagramStepIndex, setDiagramStepIndex] = useState<number | null>(null);

    const formatStepTitle = (key: string) => {
        return key
            .replace(/([A-Z])/g, ' $1')
            .replace(/_/g, ' ')
            .replace(/^./, s => s.toUpperCase())
            .trim();
    };

    const renderStepValue = (value: unknown): string => {
        if (typeof value === 'string') return value;
        if (value == null) return '';
        return JSON.stringify(value, null, 2);
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2 text-lg text-neutral-600">Loading Workflows...</span>
            </div>
        );
    }

    if (steps.length === 0) {
        return (
            <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-12 text-center">
                <div className="mx-auto w-16 h-16 mb-4 bg-neutral-100 rounded-full flex items-center justify-center">
                    <Sparkles className="h-8 w-8 text-neutral-400" />
                </div>
                <h3 className="text-lg font-bold text-neutral-900 mb-2">No Workflows Generated</h3>
                <p className="text-neutral-600">
                    Workflows will appear here once they have been generated for this idea.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white p-4 rounded-lg border border-neutral-200 shadow-sm space-y-4">
                <div>
                    <h3 className="text-lg font-bold text-neutral-900">Workflows</h3>
                    <p className="text-sm text-neutral-500">
                        Step-by-step workflows for building your project.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                            const success = await copyHtmlToClipboard("workflow-steps-content");
                            if (success) {
                                toast({
                                    title: "Content copied to clipboard",
                                    description: "Workflows copied as formatted text",
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
                        Copy
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => regenerateStep({ ideaId, step: "workflows" })}
                        disabled={isRegeneratingStep}
                    >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Regenerate
                    </Button>
                </div>
            </div>

            {/* Steps */}
            <div id="workflow-steps-content" className="space-y-4">
                {steps.map((step: WorkflowStep, index: number) => (
                    <div key={index} className="bg-white rounded-lg border border-neutral-200 shadow-sm p-5 relative">
                        {workflow?.mermaid_code && (
                            <Button
                                size="icon"
                                variant="ghost"
                                className="absolute top-3 right-3 h-8 w-8 text-neutral-400 hover:text-primary"
                                onClick={() => setDiagramStepIndex(index)}
                                title="View workflow diagram"
                            >
                                <GitBranch className="h-4 w-4" />
                            </Button>
                        )}
                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm flex items-center justify-center">
                                {index + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                                {Object.entries(step).map(([key, value]) => {
                                    if (value == null || value === '') return null;
                                    const strValue = renderStepValue(value);
                                    if (!strValue) return null;
                                    return (
                                        <div key={key} className="mb-3 last:mb-0">
                                            <h4 className="font-semibold text-neutral-900 text-sm mb-1">{formatStepTitle(key)}</h4>
                                            <div className="text-sm text-neutral-700 prose prose-sm max-w-none">
                                                <ReactMarkdown>{strValue}</ReactMarkdown>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {workflow?.mermaid_code && diagramStepIndex !== null && (() => {
                const diagrams = parseDiagrams(workflow.mermaid_code);
                const diagram = diagrams[diagramStepIndex] ?? diagrams[0];
                return (
                    <MermaidDiagram
                        code={diagram.code}
                        open={true}
                        onOpenChange={(open) => { if (!open) setDiagramStepIndex(null); }}
                        title={diagram.label ? `Step ${diagramStepIndex + 1}: ${diagram.label}` : "Workflow Diagram"}
                    />
                );
            })()}
        </div>
    );
}
