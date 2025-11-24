import { useState } from "react";
import { useLeanCanvas } from "@/hooks/use-lean-canvas";
import { useSupabaseCanvas } from "@/hooks/use-supabase-data";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw, Copy, Download, Sparkles, AlertTriangle, RotateCcw } from "lucide-react";
import { CanvasSectionComponent } from "@/components/canvas-section";
import { canvasSections } from "@shared/schema";
import { jsonToCSV, downloadCSV, copyHtmlToClipboard } from "@/lib/utils";

interface LeanCanvasTabProps {
    ideaId: number;
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

    const [viewMode, setViewMode] = useState<'html' | 'grid'>('html');

    // Effect to set initial view mode based on content availability
    useState(() => {
        if (canvas?.html) {
            setViewMode('html');
        } else {
            setViewMode('grid');
        }
    });

    // Update view mode when canvas data loads
    if (canvas?.html && viewMode === 'grid' && !isEditingCanvas && !canvasNotes) {
        // logic to auto-switch could go here if needed, but let's stick to simple state
    }

    const { data: supabaseData, isLoading: isLoadingSupabase } = useSupabaseCanvas(ideaId);

    // Initial check for HTML content to set default view
    if (canvas?.html && viewMode !== 'html' && !isEditingCanvas) {
        // We might want to default to HTML view if it exists and user hasn't explicitly chosen grid
        // but for now, let's keep it simple with the state initialization
    }

    // Combine data sources if needed, prioritizing canvas from hook which merges them
    const htmlContent = canvas?.html;
    const hasHtml = !!htmlContent;

    // Handle regenerating Lean Canvas with notes
    const handleRegenerateLeanCanvasClick = () => {
        // Pass the notes to the regeneration function if they exist
        regenerateCanvas({ notes: canvasNotes });

        toast({
            title: "Canvas regeneration started",
            description: "Your Lean Canvas is now being regenerated. This may take a few moments.",
            variant: "default",
        });

        // Reset the notes field after regeneration starts
        setCanvasNotes('');
    };

    if (isLoadingCanvas || isLoadingSupabase) {
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
                    {hasHtml && (
                        <div className="flex bg-neutral-100 p-1 rounded-md mr-2">
                            <button
                                onClick={() => {
                                    setViewMode('html');
                                    setIsEditingCanvas(false);
                                }}
                                className={`px-3 py-1 text-xs font-medium rounded-sm transition-all ${viewMode === 'html'
                                    ? 'bg-white text-primary shadow-sm'
                                    : 'text-neutral-500 hover:text-neutral-900'
                                    }`}
                            >
                                Document
                            </button>
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`px-3 py-1 text-xs font-medium rounded-sm transition-all ${viewMode === 'grid'
                                    ? 'bg-white text-primary shadow-sm'
                                    : 'text-neutral-500 hover:text-neutral-900'
                                    }`}
                            >
                                Grid
                            </button>
                        </div>
                    )}

                    {viewMode === 'grid' && (
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
                            const targetId = viewMode === 'html' ? "lean-canvas-html-content" : "lean-canvas-grid";
                            const success = await copyHtmlToClipboard(targetId);
                            if (success) {
                                toast({
                                    title: "Copied to clipboard",
                                    description: "Lean Canvas copied as image/html.",
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
                <>
                    {/* HTML View */}
                    {viewMode === 'html' && hasHtml && (
                        <div id="lean-canvas-html-content" className="bg-white p-8 rounded-lg border border-neutral-200 shadow-sm">
                            <div
                                className="prose max-w-none prose-headings:font-semibold prose-h1:text-xl prose-h2:text-lg prose-h3:text-md prose-p:text-neutral-700"
                                dangerouslySetInnerHTML={{ __html: htmlContent || '' }}
                            />
                        </div>
                    )}

                    {/* Grid View */}
                    {(viewMode === 'grid' || !hasHtml) && (
                        <div id="lean-canvas-grid" className="grid grid-cols-1 md:grid-cols-5 gap-4 bg-white p-4 rounded-lg border border-neutral-200 shadow-sm">
                            {/* Row 1 */}
                            <div className="md:col-span-1 md:row-span-2 space-y-4">
                                <CanvasSectionComponent
                                    section="Problem"
                                    content={canvas.problem || ''}
                                    ideaId={ideaId}
                                />
                            </div>

                            <div className="md:col-span-1 space-y-4">
                                <CanvasSectionComponent
                                    section="Solution"
                                    content={canvas.solution || ''}
                                    ideaId={ideaId}
                                />
                            </div>

                            <div className="md:col-span-1 md:row-span-2 space-y-4">
                                <CanvasSectionComponent
                                    section="UniqueValueProposition"
                                    content={canvas.uniqueValueProposition || ''}
                                    ideaId={ideaId}
                                />
                            </div>

                            <div className="md:col-span-1 space-y-4">
                                <CanvasSectionComponent
                                    section="UnfairAdvantage"
                                    content={canvas.unfairAdvantage || ''}
                                    ideaId={ideaId}
                                />
                            </div>

                            <div className="md:col-span-1 md:row-span-2 space-y-4">
                                <CanvasSectionComponent
                                    section="CustomerSegments"
                                    content={canvas.customerSegments || ''}
                                    ideaId={ideaId}
                                />
                            </div>

                            {/* Row 2 (middle columns) */}
                            <div className="md:col-span-1 space-y-4">
                                <CanvasSectionComponent
                                    section="KeyMetrics"
                                    content={canvas.keyMetrics || ''}
                                    ideaId={ideaId}
                                />
                            </div>

                            <div className="md:col-span-1 space-y-4">
                                <CanvasSectionComponent
                                    section="Channels"
                                    content={canvas.channels || ''}
                                    ideaId={ideaId}
                                />
                            </div>

                            {/* Row 3 */}
                            <div className="md:col-span-2.5 space-y-4">
                                <CanvasSectionComponent
                                    section="CostStructure"
                                    content={canvas.costStructure || ''}
                                    ideaId={ideaId}
                                />
                            </div>

                            <div className="md:col-span-2.5 space-y-4">
                                <CanvasSectionComponent
                                    section="RevenueStreams"
                                    content={canvas.revenueStreams || ''}
                                    ideaId={ideaId}
                                />
                            </div>
                        </div>
                    )}
                </>
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
        </div>
    );
}
