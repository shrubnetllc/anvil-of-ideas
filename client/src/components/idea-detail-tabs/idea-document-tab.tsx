import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { useDocument } from "@/hooks/use-document";
import { useIdeas } from "@/hooks/use-ideas";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw, Copy, FileText, Hammer, Flame, AlertTriangle, RotateCcw } from "lucide-react";
import { formatDate, copyHtmlToClipboard } from "@/lib/utils";
import { DocumentType } from "@shared/schema";

interface IdeaDocumentTabProps {
    ideaId: string;
    documentType: DocumentType;
}

const DOC_TYPE_TO_STEP: Record<string, string> = {
    ProjectRequirements: "prd",
    BusinessRequirements: "brd",
    FunctionalRequirements: "frd",
};

export function IdeaDocumentTab({ ideaId, documentType }: IdeaDocumentTabProps) {
    const { toast } = useToast();
    const [tabNotes, setTabNotes] = useState('');
    const [view, setView] = useState<'document' | 'sections'>('document');
    const { regenerateStep, isRegeneratingStep } = useIdeas();

    const stepName = DOC_TYPE_TO_STEP[documentType];

    const {
        document,
        isLoading: isLoadingDocument,
        isGenerating: documentGenerating,
        isTimedOut: documentTimedOut,
        generate: generateDocument,
        deleteDoc: deleteDocument,
        fetchDocument
    } = useDocument(ideaId, documentType);

    const handleGenerate = async (notes: string) => {
        await generateDocument(notes);
    };

    const formatDocumentType = (type: DocumentType) => {
        return type.replace(/([A-Z])/g, ' $1').trim();
    };

    const formatSectionTitle = (key: string) => {
        return key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
    };

    const sections = document?.contentSections as Record<string, string | null> | null;
    const hasSections = sections && Object.keys(sections).length > 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white p-4 rounded-lg border border-neutral-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-neutral-900">{formatDocumentType(documentType)} Document</h3>
                    </div>
                    {!document && !documentGenerating && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleGenerate(tabNotes)}
                            disabled={documentGenerating}
                        >
                            <Hammer className="mr-2 h-4 w-4" />
                            Generate {formatDocumentType(documentType)}
                        </Button>
                    )}
                </div>

                {document && (
                    <div className="flex flex-wrap items-center gap-2">
                        {hasSections && (
                            <div className="flex rounded-md border border-neutral-200 overflow-hidden">
                                <button
                                    className={`px-3 py-1.5 text-sm font-medium ${view === 'document' ? 'bg-primary text-white' : 'bg-white text-neutral-600 hover:bg-neutral-50'}`}
                                    onClick={() => setView('document')}
                                >
                                    Document
                                </button>
                                <button
                                    className={`px-3 py-1.5 text-sm font-medium border-l border-neutral-200 ${view === 'sections' ? 'bg-primary text-white' : 'bg-white text-neutral-600 hover:bg-neutral-50'}`}
                                    onClick={() => setView('sections')}
                                >
                                    Sections
                                </button>
                            </div>
                        )}

                        <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                                const success = await copyHtmlToClipboard("document-content");
                                if (success) {
                                    toast({
                                        title: "Content copied to clipboard",
                                        description: "Document copied as formatted text",
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

                        <Dialog>
                            <DialogTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                >
                                    <FileText className="mr-2 h-4 w-4" />
                                    Regeneration Instructions
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[550px]">
                                <DialogHeader>
                                    <DialogTitle>Add Regeneration Instructions</DialogTitle>
                                    <DialogDescription>
                                        Add specific instructions for regenerating your {formatDocumentType(documentType)}.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="py-4">
                                    <Textarea
                                        id="tabNotes"
                                        value={tabNotes}
                                        onChange={(e) => setTabNotes(e.target.value)}
                                        placeholder="E.g., Include more specific user stories, emphasize mobile app requirements..."
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
                            onClick={() => {
                                if (stepName) {
                                    regenerateStep({ ideaId, step: stepName });
                                }
                            }}
                            disabled={documentGenerating || isRegeneratingStep}
                        >
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Regenerate
                        </Button>

                        <span className="text-sm text-neutral-500 ml-auto">
                            Last updated: {formatDate(document.updatedAt || document.createdAt)}
                        </span>
                    </div>
                )}
            </div>

            {/* Content */}
            {isLoadingDocument ? (
                <div className="text-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                    <p>Loading {formatDocumentType(documentType)} document...</p>
                </div>
            ) : documentGenerating && !documentTimedOut ? (
                <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-12 text-center">
                    <div className="mb-4 mx-auto relative w-16 h-16">
                        <div className="absolute inset-0 flex items-center justify-center animate-pulse">
                            <Flame className="h-14 w-14 text-amber-400" />
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center animate-spin">
                            <Hammer className="h-10 w-10 text-primary" />
                        </div>
                    </div>
                    <h4 className="text-lg font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-2">
                        Forging Your {formatDocumentType(documentType)}
                    </h4>
                    <p className="text-neutral-600 mb-2">
                        Please wait while we hammer out the {formatDocumentType(documentType).toLowerCase()} for your idea...
                    </p>
                    <p className="text-neutral-500 text-sm italic">
                        This process usually takes 1-2 minutes.
                    </p>
                </div>
            ) : documentTimedOut ? (
                <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-6">
                    <div className="border border-destructive rounded-md p-6 bg-destructive/10">
                        <div className="flex items-start space-x-4">
                            <div className="mt-1">
                                <AlertTriangle className="h-6 w-6 text-destructive" />
                            </div>
                            <div className="flex-1">
                                <h4 className="font-bold text-destructive mb-2">Generation Timed Out</h4>
                                <p className="text-neutral-700 mb-4">
                                    The {formatDocumentType(documentType).toLowerCase()} generation is taking longer than expected.
                                </p>
                                <div className="flex items-center space-x-3">
                                    <Button
                                        onClick={() => handleGenerate(tabNotes)}
                                        disabled={documentGenerating}
                                        className="bg-gradient-to-r from-amber-500 to-amber-700 hover:from-amber-600 hover:to-amber-800"
                                    >
                                        <RefreshCw className="mr-2 h-4 w-4" />
                                        Retry Generation
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={fetchDocument}
                                    >
                                        <RotateCcw className="mr-2 h-4 w-4" />
                                        Check Status
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : document ? (
                <>
                    {view === 'document' && (
                        <div className="bg-white p-4 rounded-lg border border-neutral-200 shadow-sm">
                            <div id="document-content" className="prose max-w-none prose-headings:font-semibold prose-h1:text-xl prose-h2:text-lg prose-h3:text-md prose-p:text-neutral-700">
                                {document.content ? (
                                    <ReactMarkdown>{document.content}</ReactMarkdown>
                                ) : (
                                    <div className="p-4 text-center">
                                        <p className="text-neutral-600">
                                            Document content is being processed. Check status to refresh.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {view === 'sections' && hasSections && sections && (
                        <div id="document-sections-grid" className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-4 rounded-lg border border-neutral-200 shadow-sm">
                            {Object.entries(sections).map(([key, value]) => (
                                value && (
                                    <div key={key} className="bg-neutral-50 rounded-lg p-4 border border-neutral-200">
                                        <h3 className="font-semibold text-neutral-900 mb-3">{formatSectionTitle(key)}</h3>
                                        <div className="text-sm text-neutral-700 prose prose-sm max-w-none">
                                            <ReactMarkdown>{value}</ReactMarkdown>
                                        </div>
                                    </div>
                                )
                            ))}
                        </div>
                    )}
                </>
            ) : !documentGenerating ? (
                <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-8">
                    <div className="mb-6">
                        <p className="mb-2">Provide optional instructions for generating your document:</p>
                        <Textarea
                            value={tabNotes}
                            onChange={(e) => setTabNotes(e.target.value)}
                            placeholder="e.g., Focus on specific features, include technical constraints..."
                            className="h-24"
                        />
                    </div>
                    <div className="flex justify-center">
                        <Button
                            onClick={() => handleGenerate(tabNotes)}
                            disabled={documentGenerating}
                            className="bg-gradient-to-r from-amber-500 to-amber-700 hover:from-amber-600 hover:to-amber-800"
                        >
                            <Hammer className="mr-2 h-4 w-4" />
                            Generate Document
                        </Button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
