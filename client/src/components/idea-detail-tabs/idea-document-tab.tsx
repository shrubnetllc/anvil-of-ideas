import { useState } from "react";
import { useDocument } from "@/hooks/use-document";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw, Copy, FileText, Hammer, Flame, AlertTriangle, RotateCcw } from "lucide-react";
import { formatDate, copyHtmlToClipboard } from "@/lib/utils";
import { DocumentType } from "@shared/schema";

interface IdeaDocumentTabProps {
    ideaId: number;
    documentType: DocumentType;
}

export function IdeaDocumentTab({ ideaId, documentType }: IdeaDocumentTabProps) {
    const { toast } = useToast();
    const [tabNotes, setTabNotes] = useState('');

    const {
        document: document,
        isLoading: isLoadingDocument,
        isGenerating: documentGenerating,
        isTimedOut: documentTimedOut,
        generate: generateDocument,
        deleteDoc: deleteDocument,
        fetchDocument: fetchDocument
    } = useDocument(ideaId, documentType);

    const formatDocumentType = (type: DocumentType) => {
        return type.replace(/([A-Z])/g, ' $1').trim();
    };

    return (
        <div className="bg-white rounded-lg border border-neutral-200 shadow-sm overflow-hidden p-8">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-neutral-900">{formatDocumentType(documentType)} Document</h3>
                {!document && (
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => generateDocument(tabNotes)}
                        disabled={documentGenerating}
                    >
                        <Hammer className="mr-2 h-4 w-4" />
                        Generate {formatDocumentType(documentType)}
                    </Button>
                )}
            </div>

            {isLoadingDocument ? (
                <div className="text-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                    <p>Loading {formatDocumentType(documentType)} document...</p>
                </div>
            ) : documentGenerating && !documentTimedOut ? (
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
                <div className="border border-destructive rounded-md p-6 mb-4 bg-destructive/10">
                    <div className="flex items-start space-x-4">
                        <div className="mt-1">
                            <AlertTriangle className="h-6 w-6 text-destructive" />
                        </div>
                        <div className="flex-1">
                            <h4 className="font-bold text-destructive mb-2">Generation Timed Out</h4>
                            <p className="text-neutral-700 mb-4">
                                The {formatDocumentType(documentType).toLowerCase()} generation is taking longer than expected.
                                This could be due to high system load or complexity of your project.
                            </p>
                            <div className="flex items-center space-x-3">
                                <Button
                                    onClick={() => generateDocument(tabNotes)}
                                    disabled={documentGenerating}
                                    className="bg-gradient-to-r from-amber-500 to-amber-700 hover:from-amber-600 hover:to-amber-800"
                                >
                                    {documentGenerating ? (
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
                                    onClick={fetchDocument}
                                >
                                    <RotateCcw className="mr-2 h-4 w-4" />
                                    Check Status
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : document ? (
                <div>
                    {document.status === 'Completed' ? (
                        <div>
                            <div className="mb-6 flex justify-between items-center">
                                <div>
                                    <p className="text-sm text-neutral-500">
                                        Last updated: {formatDate(document.updatedAt || document.createdAt)}
                                    </p>
                                </div>
                                <div className="flex gap-2">
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
                                    </Button>
                                </div>
                            </div>

                            {/* Display the document content */}
                            <div id="document-content" className="prose max-w-none prose-headings:font-semibold prose-h1:text-xl prose-h2:text-lg prose-h3:text-md prose-p:text-neutral-700">
                                {document.html ? (
                                    <div dangerouslySetInnerHTML={{ __html: document.html }} /> //TODO: Why isn't the lean canvas html being displayed?
                                ) : document.content ? (
                                    <div className="whitespace-pre-wrap font-mono text-sm bg-neutral-50 p-4 rounded-md">
                                        {document.content}
                                    </div>
                                ) : (
                                    <div className="p-4 text-center">
                                        <p className="text-neutral-600">
                                            Document content is being processed. Check status to refresh.
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Additional notes panel for regeneration - using a dialog like with lean canvas */}
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
                                                Add specific instructions for regenerating your {formatDocumentType(documentType)}. These instructions will be used when you click the Regenerate button.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="py-4">
                                            <Textarea
                                                id="tabNotes"
                                                value={tabNotes}
                                                onChange={(e) => setTabNotes(e.target.value)}
                                                placeholder="E.g., Include more specific user stories, emphasize mobile app requirements, focus on security features..."
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
                                        if (document?.id) {
                                            await deleteDocument();
                                            generateDocument(tabNotes);
                                        }
                                    }}
                                    disabled={documentGenerating}
                                >
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Regenerate
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <p>{formatDocumentType(documentType)} is in {document.status.toLowerCase()} state.</p>
                        </div>
                    )}
                </div>
            ) : !documentGenerating ? (
                <div className="py-8">
                    <div className="mb-6">
                        <p className="mb-2">Provide optional instructions for generating your document:</p>
                        <Textarea
                            value={tabNotes}
                            onChange={(e) => setTabNotes(e.target.value)}
                            placeholder="e.g., Focus on specific features, include technical constraints, specify target platforms..."
                            className="h-24"
                        />
                    </div>
                    <div className="flex justify-center">
                        <Button
                            onClick={() => generateDocument(tabNotes)}
                            disabled={documentGenerating}
                            className="bg-gradient-to-r from-amber-500 to-amber-700 hover:from-amber-600 hover:to-amber-800"
                        >
                            <Hammer className="mr-2 h-4 w-4" />
                            {documentGenerating ? 'Generating...' : 'Generate Document'}
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="text-center py-8">
                    <div className="mx-auto w-16 h-16 mb-4 bg-amber-50 rounded-full flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                    <h4 className="text-lg font-medium mb-2">Preparing to Generate Document</h4>
                    <p className="text-neutral-600 max-w-lg mx-auto">
                        Setting up the forge to generate your document...
                    </p>
                </div>
            )}
        </div>
    );
}