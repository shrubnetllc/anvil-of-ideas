import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw, Copy, FileText, Hammer, Flame, AlertTriangle, RotateCcw } from "lucide-react";
import { formatDate, copyHtmlToClipboard } from "@/lib/utils";

interface UltimateWebsiteTabProps {
    ideaId: number;
}

export function UltimateWebsiteTab({ ideaId }: UltimateWebsiteTabProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [iframeUrl, setIframeUrl] = useState<string | null>(null);

    async function generateUltimateWebsite() {
        try {
            setIsLoading(true);
            const response = await fetch(`/api/ideas/${ideaId}/generate-ultimate-website`, {
                method: "POST",
            });
            const data = await response.json();
            setIframeUrl(`${process.env.ULTIMATE_WEBSITE_GENERATOR_URL}/demo/${data.task_id}`);
        } catch (error) {
            console.error("Error generating ultimate website:", error);
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="bg-white rounded-lg border border-neutral-200 shadow-sm overflow-hidden p-8">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-neutral-900">Ultimate Website</h3>
                <Button
                    variant="outline" size="sm"
                    onClick={generateUltimateWebsite}
                    disabled={isLoading}
                >
                    <Hammer className="mr-2 h-4 w-4" /> Generate Ultimate Website </Button>
            </div>
            <div className="flex items-center justify-between mb-4">
                <p>Your Website will be generated here</p>
            </div>
            <div className="flex items-center justify-between mb-4">
                {isLoading && (
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
                            Forging Your Ultimate Website
                        </h4>
                        <p className="text-neutral-600 mb-2">
                            Please wait while we hammer out the Ultimate Website for your idea...
                        </p>
                        <p className="text-neutral-500 text-sm italic">
                            This process usually takes 1-2 minutes.
                        </p>
                    </div>
                )}
            </div>
            <div className="flex items-center justify-between mb-4">
                {iframeUrl && (
                    <iframe
                        src={iframeUrl}
                        style={{ width: "100%", height: "100vh", border: "none" }}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        sandbox="allow-scripts allow-forms allow-popups allow-modals allow-downloads"
                    ></iframe>
                )}
            </div>
        </div>
    );
}