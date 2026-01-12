import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Hammer, Flame } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface UltimateWebsiteTabProps {
    ideaId: number;
}

export function UltimateWebsiteTab({ ideaId }: UltimateWebsiteTabProps) {
    const baseGeneratorUrl = `${import.meta.env.VITE_ULTIMATE_WEBSITE_GENERATOR_URL || 'http://localhost:8008'}`;
    const queryClient = useQueryClient();
    const [isWaitingForWebhook, setIsWaitingForWebhook] = useState(false);
    const [businessName, setBusinessName] = useState("");
    const [industry, setIndustry] = useState("");
    const [targetAudience, setTargetAudience] = useState("");
    const [iframeUrl, setIframeUrl] = useState<string | null>(null);

    // Fetch the ultimate website URL
    const { data: response, isError, error } = useQuery({
        queryKey: [`/api/ideas/${ideaId}/ultimate-website`],
        queryFn: async () => {
            try {
                const res = await fetch(`/api/ideas/${ideaId}/ultimate-website`);
                if (res.status === 404) return null; // Not found yet is expected
                if (!res.ok) throw new Error("Failed to fetch");
                return await res.json();
            } catch (e) {
                // treating 404 as null
                return null;
            }
        },
        // Poll every 30 seconds if we are waiting for the webhook
        refetchInterval: isWaitingForWebhook ? 30000 : false,
        // Stop polling if we got a result or if there's a hard error
        enabled: true
    });

    // Effect to stop waiting once we get a URL
    useEffect(() => {
        if (response?.task_id) {
            setIsWaitingForWebhook(false);
            setIframeUrl(`${baseGeneratorUrl}/demo/${response.task_id}`);
        }
    }, [response]);

    const generateMutation = useMutation({
        mutationFn: async () => {
            const res = await apiRequest("POST", `/api/ideas/${ideaId}/generate-ultimate-website`, {
                businessName,
                industry,
                targetAudience
            });
            return res.json();
        },
        onSuccess: () => {
            // Start waiting/polling
            setIsWaitingForWebhook(true);
            // Invalidate to trigger an immediate check
            queryClient.invalidateQueries({ queryKey: [`/api/ideas/${ideaId}/ultimate-website`] });
        },
        onError: (err) => {
            console.error("Error generating ultimate website:", err);
            setIsWaitingForWebhook(false);
        }
    });

    const isLoading = generateMutation.isPending || isWaitingForWebhook;

    return (
        <div className="bg-white rounded-lg border border-neutral-200 shadow-sm overflow-hidden p-8">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-neutral-900">Ultimate Website</h3>
                <Button
                    variant="outline" size="sm"
                    onClick={() => generateMutation.mutate()}
                    disabled={isLoading || !!iframeUrl}
                >
                    <Hammer className="mr-2 h-4 w-4" />
                    {!!iframeUrl ? "Regenerate Website" : "Generate Ultimate Website"}
                </Button>
            </div>

            <div className="flex flex-col min-h-[200px]">
                {!iframeUrl && !isLoading && (
                    <div className="flex flex-col items-left justify-left text-black py-12 space-y-4">
                        <h2>Business Name</h2>
                        <Input
                            type="text"
                            placeholder="Enter your business name"
                            value={businessName}
                            onChange={(e) => setBusinessName(e.target.value)}
                        />
                        <h2>Industry</h2>
                        <Input
                            type="text"
                            placeholder="Enter your industry"
                            value={industry}
                            onChange={(e) => setIndustry(e.target.value)}
                        />
                        <h2>Target Audience</h2>
                        <Input
                            type="text"
                            placeholder="Enter your target audience"
                            value={targetAudience}
                            onChange={(e) => setTargetAudience(e.target.value)}
                        />
                    </div>
                )}

                {isLoading && !iframeUrl && (
                    <div className="flex flex-col items-center justify-center py-12">
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
                        <p className="text-neutral-600 mb-2 text-center">
                            Please wait while we hammer out the Ultimate Website for your idea...
                        </p>
                        <p className="text-neutral-500 text-sm italic">
                            This process usually takes 1-2 minutes.
                        </p>
                    </div>
                )}

                {iframeUrl && (
                    <iframe
                        src={iframeUrl}
                        className="w-full h-[800px] border-0 rounded-md shadow-sm"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        sandbox="allow-scripts allow-forms allow-popups allow-modals allow-downloads"
                    />
                )}
            </div>
        </div>
    );
}