import { useState } from "react";
import { useLeanCanvas } from "@/hooks/use-lean-canvas";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw, Copy, Download, Sparkles } from "lucide-react";
import { CanvasSectionComponent } from "@/components/canvas-section";
import { jsonToCSV, downloadCSV, copyHtmlToClipboard } from "@/lib/utils";

interface LeanCanvasTabProps {
    ideaId: string;
}

export function LeanCanvasTab({ ideaId }: LeanCanvasTabProps) {
    const { toast } = useToast();
    const [canvasNotes, setCanvasNotes] = useState('');
    const [isEditingCanvas, setIsEditingCanvas] = useState(false);

    const {
        canvas,
        isLoading: isLoadingCanvas,
        regenerateCanvas,
        isRegenerating: isCanvasRegenerating
    } = useLeanCanvas(ideaId);

    const hasContent = !!canvas?.content;

    const handleRegenerateLeanCanvasClick = () => {
        regenerateCanvas({ notes: canvasNotes });
        toast({
            title: "Canvas regeneration started",
            description: "Your Lean Canvas is now being regenerated. This may take a few moments.",
            variant: "default",
        });
        setCanvasNotes('');
    };

    if (isLoadingCanvas) {
        return (
            <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2 text-lg text-neutral-600">Loading Lean Canvas...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Canvas Header Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-lg border border-neutral-200 shadow-sm">
                <div>
                    <h2 className="text-lg font-bold text-neutral-900">Lean Canvas</h2>
                    <p className="text-sm text-neutral-500">
                        A 1-page business plan template that helps you deconstruct your idea into its key assumptions.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {canvas && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsEditingCanvas(!isEditingCanvas)}
                        >
                            {isEditingCanvas ? "View Mode" : "Edit Mode"}
                        </Button>
                    )}

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            if (canvas) {
                                const csvContent = jsonToCSV([canvas]);
                                downloadCSV(csvContent, `lean-canvas-${ideaId}.csv`);
                                toast({
                                    title: "Canvas downloaded",
                                    description: "Your Lean Canvas has been downloaded as a CSV file.",
                                });
                            }
                        }}
                        disabled={!canvas}
                    >
                        <Download className="mr-2 h-4 w-4" />
                        Export CSV
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                            const success = await copyHtmlToClipboard("lean-canvas-grid");
                            if (success) {
                                toast({
                                    title: "Copied to clipboard",
                                    description: "Lean Canvas copied.",
                                });
                            } else {
                                toast({
                                    title: "Failed to copy",
                                    description: "Could not copy canvas to clipboard.",
                                    variant: "destructive",
                                });
                            }
                        }}
                        disabled={!canvas}
                    >
                        <Copy className="mr-2 h-4 w-4" />
                        Copy
                    </Button>

                    <Dialog>
                        <DialogTrigger asChild>
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={isCanvasRegenerating}
                            >
                                <RefreshCw className={`mr-2 h-4 w-4 ${isCanvasRegenerating ? 'animate-spin' : ''}`} />
                                Regenerate
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Regenerate Lean Canvas</DialogTitle>
                                <DialogDescription>
                                    Provide optional instructions for regenerating your Lean Canvas.
                                    This will overwrite the current canvas.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="py-4">
                                <Textarea
                                    value={canvasNotes}
                                    onChange={(e) => setCanvasNotes(e.target.value)}
                                    placeholder="E.g., Focus more on the B2B market, emphasize the AI features..."
                                    className="min-h-[100px]"
                                />
                            </div>
                            <DialogFooter>
                                <DialogClose asChild>
                                    <Button onClick={handleRegenerateLeanCanvasClick}>
                                        Regenerate Canvas
                                    </Button>
                                </DialogClose>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Canvas Content */}
            {isCanvasRegenerating ? (
                <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-12 text-center">
                    <div className="mx-auto w-16 h-16 mb-4 bg-amber-50 rounded-full flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                    <h3 className="text-lg font-bold text-neutral-900 mb-2">Regenerating Canvas...</h3>
                    <p className="text-neutral-600">
                        Please wait while we update your Lean Canvas based on the new instructions.
                    </p>
                </div>
            ) : canvas ? (
                <div id="lean-canvas-grid" className="grid grid-cols-1 md:grid-cols-5 gap-4 bg-white p-4 rounded-lg border border-neutral-200 shadow-sm">
                    {/* Row 1 */}
                    <div className="md:col-span-1 md:row-span-2">
                        <CanvasSectionComponent
                            section="Problem"
                            content={canvas.problem}
                            isEditing={isEditingCanvas}
                            ideaId={ideaId}
                        />
                    </div>

                    <div className="md:col-span-1">
                        <CanvasSectionComponent
                            section="Solution"
                            content={canvas.solution}
                            isEditing={isEditingCanvas}
                            ideaId={ideaId}
                        />
                    </div>

                    <div className="md:col-span-1 md:row-span-2">
                        <CanvasSectionComponent
                            section="UniqueValueProposition"
                            content={canvas.uniqueValueProposition}
                            isEditing={isEditingCanvas}
                            ideaId={ideaId}
                        />
                    </div>

                    <div className="md:col-span-1">
                        <CanvasSectionComponent
                            section="UnfairAdvantage"
                            content={canvas.unfairAdvantage}
                            isEditing={isEditingCanvas}
                            ideaId={ideaId}
                        />
                    </div>

                    <div className="md:col-span-1 md:row-span-2">
                        <CanvasSectionComponent
                            section="CustomerSegments"
                            content={canvas.customerSegments}
                            isEditing={isEditingCanvas}
                            ideaId={ideaId}
                        />
                    </div>

                    {/* Row 2 (middle columns) */}
                    <div className="md:col-span-1">
                        <CanvasSectionComponent
                            section="KeyMetrics"
                            content={canvas.keyMetrics}
                            isEditing={isEditingCanvas}
                            ideaId={ideaId}
                        />
                    </div>

                    <div className="md:col-span-1">
                        <CanvasSectionComponent
                            section="Channels"
                            content={canvas.channels}
                            isEditing={isEditingCanvas}
                            ideaId={ideaId}
                        />
                    </div>

                    {/* Row 3 */}
                    <div className="md:col-span-2">
                        <CanvasSectionComponent
                            section="CostStructure"
                            content={canvas.costStructure}
                            isEditing={isEditingCanvas}
                            ideaId={ideaId}
                        />
                    </div>

                    <div className="md:col-span-3">
                        <CanvasSectionComponent
                            section="RevenueStreams"
                            content={canvas.revenueStreams}
                            isEditing={isEditingCanvas}
                            ideaId={ideaId}
                        />
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-12 text-center">
                    <div className="mx-auto w-16 h-16 mb-4 bg-neutral-100 rounded-full flex items-center justify-center">
                        <Sparkles className="h-8 w-8 text-neutral-400" />
                    </div>
                    <h3 className="text-lg font-bold text-neutral-900 mb-2">No Canvas Generated</h3>
                    <p className="text-neutral-600 mb-6">
                        Generate a Lean Canvas to visualize your business model.
                    </p>
                    <Button onClick={handleRegenerateLeanCanvasClick}>
                        Generate Lean Canvas
                    </Button>
                </div>
            )}

            {/* HTML Content view */}
            {hasContent && canvas?.content && (
                <div className="bg-white p-4 rounded-lg border border-neutral-200 shadow-sm">
                    <h3 className="text-lg font-bold text-neutral-900 mb-4">Document View</h3>
                    <div id="lean-canvas-content" className="prose max-w-none">
                        <div dangerouslySetInnerHTML={{ __html: canvas.content }} />
                    </div>
                </div>
            )}
        </div>
    );
}
