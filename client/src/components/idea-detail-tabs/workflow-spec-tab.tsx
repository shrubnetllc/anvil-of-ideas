import ReactMarkdown from "react-markdown";
import { useWorkflows } from "@/hooks/use-workflows";
import { useIdeas } from "@/hooks/use-ideas";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Copy, Sparkles, RefreshCw } from "lucide-react";
import { copyHtmlToClipboard } from "@/lib/utils";
import { WorkflowData } from "@/hooks/use-workflows";

type WorkflowSpecField = "homepage_spec" | "backend_spec" | "swagger" | "estimate";

interface WorkflowSpecTabProps {
    ideaId: string;
    field: WorkflowSpecField;
    title: string;
    description: string;
}

export function WorkflowSpecTab({ ideaId, field, title, description }: WorkflowSpecTabProps) {
    const { toast } = useToast();
    const { workflow, isLoading } = useWorkflows(ideaId);
    const { regenerateStep, isRegeneratingStep } = useIdeas();

    const content = workflow?.[field] as string | null | undefined;

    if (isLoading) {
        return (
            <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2 text-lg text-neutral-600">Loading {title}...</span>
            </div>
        );
    }

    if (!content) {
        return (
            <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-12 text-center">
                <div className="mx-auto w-16 h-16 mb-4 bg-neutral-100 rounded-full flex items-center justify-center">
                    <Sparkles className="h-8 w-8 text-neutral-400" />
                </div>
                <h3 className="text-lg font-bold text-neutral-900 mb-2">No {title} Generated</h3>
                <p className="text-neutral-600">
                    {description}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white p-4 rounded-lg border border-neutral-200 shadow-sm space-y-4">
                <div>
                    <h3 className="text-lg font-bold text-neutral-900">{title}</h3>
                    <p className="text-sm text-neutral-500">{description}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                            const success = await copyHtmlToClipboard(`spec-content-${field}`);
                            if (success) {
                                toast({
                                    title: "Content copied to clipboard",
                                    description: `${title} copied as formatted text`,
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
                        onClick={() => regenerateStep({ ideaId, step: "specs" })}
                        disabled={isRegeneratingStep}
                    >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Regenerate
                    </Button>
                </div>
            </div>

            {/* Content */}
            <div className="bg-white p-4 rounded-lg border border-neutral-200 shadow-sm">
                <div id={`spec-content-${field}`} className="prose max-w-none prose-headings:font-semibold prose-h1:text-xl prose-h2:text-lg prose-h3:text-md prose-p:text-neutral-700">
                    {field === "swagger" ? (
                        <pre className="bg-white text-neutral-900 p-4 rounded-md overflow-x-auto text-sm"><code>{content}</code></pre>
                    ) : (
                        <ReactMarkdown>{content}</ReactMarkdown>
                    )}
                </div>
            </div>
        </div>
    );
}
