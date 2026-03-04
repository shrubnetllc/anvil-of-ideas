import { useParams, useLocation } from "wouter";
import { useIdea } from "@/hooks/use-ideas";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Hammer, Info } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect } from "react";
import { queryClient } from "@/lib/queryClient";

import { LeanCanvasTab } from "@/components/idea-detail-tabs/lean-canvas-tab";
import { IdeaDocumentTab } from "@/components/idea-detail-tabs/idea-document-tab";
import { IdeaDetailsTab } from "@/components/idea-detail-tabs/idea-details-tab";

export default function IdeaDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { idea, isLoading: isLoadingIdea } = useIdea(id);

  // URL-based tab state management
  const getTabFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get("tab") || "canvas";
  };

  const [activeTab, setActiveTabState] = useState(getTabFromUrl());

  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    const params = new URLSearchParams(window.location.search);
    params.set("tab", tab);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({}, "", newUrl);
  };

  useEffect(() => {
    const handlePopState = () => {
      setActiveTabState(getTabFromUrl());
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Polling for idea status when generating
  useEffect(() => {
    let timer: number | null = null;

    if (idea?.status === "Generating") {
      timer = window.setInterval(() => {
        queryClient.invalidateQueries({ queryKey: [`/api/ideas/${id}`] });
        queryClient.invalidateQueries({ queryKey: [`/api/ideas/${id}/canvas`] });
      }, 10000);
    }

    return () => {
      if (timer !== null) {
        clearInterval(timer);
      }
    };
  }, [idea?.status, id]);

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
                  {idea.title || idea.companyName || idea.description.split(' ').slice(0, 5).join(' ') + '...'}
                </h1>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row lg:space-x-6">
              <div className="w-full">
                <div className="border-b border-neutral-200">
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="w-auto flex flex-wrap">
                      <TabsTrigger value="canvas" className="text-sm">Lean Canvas</TabsTrigger>
                      <TabsTrigger value="requirements" className="text-sm">Project Requirements</TabsTrigger>
                      <TabsTrigger value="business" className="text-sm">Business Requirements</TabsTrigger>
                      <TabsTrigger value="functional" className="text-sm">Functional Requirements</TabsTrigger>
                      <TabsTrigger value="workflows" className="text-sm">Workflows</TabsTrigger>
                      <TabsTrigger value="frontend" className="text-sm">Front End Spec</TabsTrigger>
                      <TabsTrigger value="backend" className="text-sm">Back End Spec</TabsTrigger>
                      <TabsTrigger value="estimate" className="text-sm">Estimate</TabsTrigger>
                      <TabsTrigger value="details" className="text-sm">
                        <div className="flex items-center">
                          <Info className="h-4 w-4 mr-1" />
                          Details
                        </div>
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="canvas" className="mt-6">
                      <LeanCanvasTab ideaId={id} />
                    </TabsContent>

                    <TabsContent value="requirements" className="mt-6">
                      <IdeaDocumentTab ideaId={id} documentType="ProjectRequirements" />
                    </TabsContent>

                    <TabsContent value="business" className="mt-6">
                      <IdeaDocumentTab ideaId={id} documentType="BusinessRequirements" />
                    </TabsContent>

                    <TabsContent value="functional" className="mt-6">
                      <IdeaDocumentTab ideaId={id} documentType="FunctionalRequirements" />
                    </TabsContent>

                    <TabsContent value="workflows" className="mt-6">
                      <IdeaDocumentTab ideaId={id} documentType="Workflows" />
                    </TabsContent>

                    <TabsContent value="frontend" className="mt-6">
                      <IdeaDocumentTab ideaId={id} documentType="FrontEndSpecification" />
                    </TabsContent>

                    <TabsContent value="backend" className="mt-6">
                      <IdeaDocumentTab ideaId={id} documentType="BackEndSpecification" />
                    </TabsContent>

                    <TabsContent value="estimate" className="mt-6">
                      <IdeaDocumentTab ideaId={id} documentType="Estimate" />
                    </TabsContent>

                    <TabsContent value="details" className="mt-6">
                      <IdeaDetailsTab idea={idea} />
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
