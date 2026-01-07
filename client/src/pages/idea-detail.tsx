import { useParams, useLocation } from "wouter";
import { useIdea } from "@/hooks/use-ideas";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Hammer, Info } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect } from "react";
import { queryClient } from "@/lib/queryClient";

// Import new tab components
import { ProjectRequirementsTab } from "@/components/idea-detail-tabs/project-requirements-tab";
import { BusinessRequirementsTab } from "@/components/idea-detail-tabs/business-requirements-tab";
import { FunctionalRequirementsTab } from "@/components/idea-detail-tabs/functional-requirements-tab";
import { LeanCanvasTab } from "@/components/idea-detail-tabs/lean-canvas-tab";
import { WorkflowsTab } from "@/components/idea-detail-tabs/workflows-tab";
import { DocumentsOverviewTab } from "@/components/idea-detail-tabs/documents-overview-tab";
import { IdeaDocumentTab } from "@/components/idea-detail-tabs/idea-document-tab";
import { IdeaDetailsTab } from "@/components/idea-detail-tabs/idea-details-tab";
import { UltimateWebsiteTab } from "@/components/idea-detail-tabs/ultimate-website-tab";

export default function IdeaDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const ideaId = parseInt(id);
  const { idea, isLoading: isLoadingIdea } = useIdea(ideaId);

  // URL-based tab state management
  const getTabFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get("tab") || "documents";
  };

  const [activeTab, setActiveTabState] = useState(getTabFromUrl());

  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    const params = new URLSearchParams(window.location.search);
    params.set("tab", tab);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({}, "", newUrl);
  };

  // Sync state with URL on back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      setActiveTabState(getTabFromUrl());
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Polling for idea generation status
  useEffect(() => {
    let timer: number | null = null;
    let timeoutTimer: number | null = null;

    if (idea?.status === "Generating") {
      // Check if generation has timed out (2 minutes or more since started)
      if (idea.generationStartedAt) {
        const startedAt = new Date(idea.generationStartedAt);
        const now = new Date();
        const diffMinutes = (now.getTime() - startedAt.getTime()) / (1000 * 60);

        if (diffMinutes >= 2) {
          console.log(`Canvas generation timed out (started ${diffMinutes.toFixed(1)} minutes ago)`);
          // We could set a timeout state here if needed, but for now we just log
        } else {
          console.log(`Canvas generation in progress (started ${diffMinutes.toFixed(1)} minutes ago)`);

          // Set a timer to check for timeout after the 2-minute mark
          const remainingMs = Math.max(0, (2 * 60 * 1000) - (now.getTime() - startedAt.getTime()));
          if (remainingMs > 0) {
            timeoutTimer = window.setTimeout(() => {
              if (idea?.status === "Generating") {
                console.log('Timeout check triggered: Canvas generation has exceeded 2 minutes');
              }
            }, remainingMs);
          }
        }
      }

      // Regular polling every 10 seconds
      timer = window.setTimeout(() => {
        // Refresh data every 10 seconds if still in generating state
        queryClient.invalidateQueries({ queryKey: [`/api/ideas/${ideaId}`] });
        queryClient.invalidateQueries({ queryKey: [`/api/ideas/${ideaId}/canvas`] });
        queryClient.invalidateQueries({ queryKey: [`/api/supabase/canvas/${ideaId}`] });
      }, 10000);
    }

    return () => {
      if (timer !== null) {
        clearTimeout(timer);
      }
      if (timeoutTimer !== null) {
        clearTimeout(timeoutTimer);
      }
    };
  }, [idea?.status, idea?.generationStartedAt, ideaId]);

  const handleBackClick = () => {
    navigate("/");
  };

  if (isLoadingIdea) {
    return (
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col md:ml-64 min-h-screen">
          <main className="flex-1 overflow-y-auto focus:outline-none custom-scrollbar">
            <div className="py-6 max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              <div className="flex items-center mb-6">
                <Button variant="ghost" size="icon" className="mr-4" onClick={handleBackClick}>
                  <ArrowLeft className="h-6 w-6" />
                </Button>
                <Skeleton className="h-8 w-80" />
              </div>
              <div className="animate-pulse">Loading...</div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!idea) {
    return (
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col md:ml-64 min-h-screen">
          <main className="flex-1 overflow-y-auto focus:outline-none custom-scrollbar">
            <div className="py-6 max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              <div className="text-center py-12">
                <h1 className="text-2xl font-bold text-neutral-900">Idea not found</h1>
                <p className="mt-2 text-neutral-600">The idea you're looking for doesn't exist or you don't have access to it.</p>
                <Button className="mt-4" onClick={handleBackClick}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Dashboard
                </Button>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col md:ml-64 min-h-screen">
        <main className="flex-1 overflow-y-auto focus:outline-none custom-scrollbar">
          <div className="py-6 max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
            {/* Header with back button */}
            <div className="flex items-start mb-6">
              <Button variant="ghost" size="icon" className="mr-4 mt-1" onClick={handleBackClick}>
                <ArrowLeft className="h-6 w-6" />
              </Button>
              <div>
                <div className="mb-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                    ${idea.status === 'Completed' ? 'bg-green-100 text-green-800' : ''}
                    ${idea.status === 'Generating' ? 'bg-amber-100 text-amber-800' : ''}
                    ${idea.status === 'Draft' ? 'bg-neutral-100 text-neutral-800' : ''}`}>
                    {idea.status}
                  </span>
                </div>
                <h1 className="text-2xl font-bold text-neutral-900">
                  {idea.title || idea.companyName || idea.idea.split(' ').slice(0, 5).join(' ') + '...'}
                </h1>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row lg:space-x-6">
              {/* Main content */}
              <div className="w-full">
                {/* Tabs */}
                <div className="border-b border-neutral-200">
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="w-auto flex flex-wrap">
                      <TabsTrigger value="documents" className="text-sm">
                        <div className="flex items-center">
                          <Hammer className="h-4 w-4 mr-1" />
                          Documents
                        </div>
                      </TabsTrigger>
                      <TabsTrigger value="canvas" className="text-sm">Lean Canvas</TabsTrigger>
                      <TabsTrigger value="requirements" className="text-sm">Project Requirements</TabsTrigger>
                      <TabsTrigger value="business" className="text-sm">Business Requirements</TabsTrigger>
                      <TabsTrigger value="functional" className="text-sm">Functional Requirements</TabsTrigger>
                      <TabsTrigger value="workflows" className="text-sm">Workflows</TabsTrigger>
                      <TabsTrigger value="frontend" className="text-sm">Front End Spec</TabsTrigger>
                      <TabsTrigger value="backend" className="text-sm">Back End Spec</TabsTrigger>
                      <TabsTrigger value="marketing" className="text-sm">Marketing</TabsTrigger>
                      <TabsTrigger value="pitchdeck" className="text-sm">Pitch Deck</TabsTrigger>
                      <TabsTrigger value="estimate" className="text-sm">Estimate</TabsTrigger>
                      <TabsTrigger value="ultimate-website" className="text-sm">Ultimate Website</TabsTrigger>
                      <TabsTrigger value="details" className="text-sm">
                        <div className="flex items-center">
                          <Info className="h-4 w-4 mr-1" />
                          Details
                        </div>
                      </TabsTrigger>
                    </TabsList>

                    {/* Documents Overview */}
                    <TabsContent value="documents" className="mt-6">
                      <DocumentsOverviewTab ideaId={ideaId} setActiveTab={setActiveTab} />
                    </TabsContent>

                    {/* Lean Canvas */}
                    <TabsContent value="canvas" className="mt-6">
                      <IdeaDocumentTab ideaId={ideaId} documentType='LeanCanvas' />
                    </TabsContent>
                    {/* Project Requirements */}
                    <TabsContent value='requirements'>
                      <IdeaDocumentTab ideaId={ideaId} documentType='ProjectRequirements' />
                    </TabsContent>

                    {/* Business Requirements */}
                    {/* <TabsContent value="business" className="mt-6">
                      <BusinessRequirementsTab ideaId={ideaId} />
                    </TabsContent> */}
                    <TabsContent value='business'>
                      <IdeaDocumentTab ideaId={ideaId} documentType='BusinessRequirements' />
                    </TabsContent>

                    {/* Functional Requirements */}
                    {/* <TabsContent value="functional" className="mt-6">
                      <FunctionalRequirementsTab ideaId={ideaId} />
                    </TabsContent> */}
                    <TabsContent value='functional'>
                      <IdeaDocumentTab ideaId={ideaId} documentType='FunctionalRequirements' />
                    </TabsContent>

                    {/* Idea Details */}
                    <TabsContent value="details" className="mt-6">
                      <IdeaDetailsTab idea={idea} />
                    </TabsContent>

                    {/* Placeholders for other tabs */}
                    <TabsContent value="workflows" className="mt-6">
                      <WorkflowsTab ideaId={ideaId} />
                    </TabsContent>
                    <TabsContent value="frontend" className="mt-6">
                      <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-12 text-center">
                        <h3 className="text-lg font-bold text-neutral-900 mb-2">Front End Specification</h3>
                        <p className="text-neutral-600">Coming soon...</p>
                      </div>
                    </TabsContent>
                    <TabsContent value="backend" className="mt-6">
                      <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-12 text-center">
                        <h3 className="text-lg font-bold text-neutral-900 mb-2">Back End Specification</h3>
                        <p className="text-neutral-600">Coming soon...</p>
                      </div>
                    </TabsContent>
                    <TabsContent value="marketing" className="mt-6">
                      <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-12 text-center">
                        <h3 className="text-lg font-bold text-neutral-900 mb-2">Marketing Plan</h3>
                        <p className="text-neutral-600">Coming soon...</p>
                      </div>
                    </TabsContent>
                    <TabsContent value="pitchdeck" className="mt-6">
                      <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-12 text-center">
                        <h3 className="text-lg font-bold text-neutral-900 mb-2">Pitch Deck</h3>
                        <p className="text-neutral-600">Coming soon...</p>
                      </div>
                    </TabsContent>
                    <TabsContent value="estimate" className="mt-6">
                      <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-12 text-center">
                        <h3 className="text-lg font-bold text-neutral-900 mb-2">Cost Estimate</h3>
                        <p className="text-neutral-600">Coming soon...</p>
                      </div>
                    </TabsContent>
                    <TabsContent value="ultimate-website" className="mt-6">
                      <UltimateWebsiteTab ideaId={ideaId} />
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
