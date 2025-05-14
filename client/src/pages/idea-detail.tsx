import { useParams, useLocation } from "wouter";
import { useIdea } from "@/hooks/use-ideas";
import { useLeanCanvas } from "@/hooks/use-lean-canvas";
import { useSupabaseCanvas } from "@/hooks/use-supabase-data";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RotateCcw, ExternalLinkIcon, Database, Info, Hammer, Flame, Sparkles, Download } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, jsonToCSV, downloadCSV } from "@/lib/utils";
import { CanvasSection, canvasSections } from "@shared/schema";
import { CanvasSectionComponent } from "@/components/canvas-section";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { queryClient } from "@/lib/queryClient";

export default function IdeaDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const ideaId = parseInt(id);
  const { idea, isLoading: isLoadingIdea } = useIdea(ideaId);
  const { canvas, isLoading: isLoadingCanvas, regenerateCanvas, isRegenerating } = useLeanCanvas(ideaId);
  const { data: supabaseData, isLoading: isLoadingSupabase } = useSupabaseCanvas(ideaId);
  
  // Note: Auto-completion is handled server-side, no timer needed here
  // This refreshes data automatically every 10 seconds while generating
  useEffect(() => {
    let timer: number | null = null;
    
    if (idea?.status === "Generating") {
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
    };
  }, [idea?.status, ideaId]);

  const handleBackClick = () => {
    navigate("/");
  };

  const handleRegenerateCanvasClick = () => {
    regenerateCanvas();
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
            <div className="flex items-center mb-6">
              <Button variant="ghost" size="icon" className="mr-4" onClick={handleBackClick}>
                <ArrowLeft className="h-6 w-6" />
              </Button>
              <h1 className="text-2xl font-bold text-neutral-900">{idea.idea}</h1>
            </div>

            <div className="flex flex-col lg:flex-row lg:space-x-6">
              {/* Main content */}
              <div className="w-full">
                {/* Tabs */}
                <div className="border-b border-neutral-200">
                  <Tabs defaultValue="canvas">
                    <TabsList className="w-auto">
                      <TabsTrigger value="canvas" className="text-sm">Lean Canvas</TabsTrigger>
                      <TabsTrigger value="details" className="text-sm">
                        <div className="flex items-center">
                          <Info className="h-4 w-4 mr-1" /> 
                          Details
                        </div>
                      </TabsTrigger>
                      <TabsTrigger value="supabase" className="text-sm">
                        <div className="flex items-center">
                          <Database className="h-4 w-4 mr-1" /> 
                          Supabase Data
                        </div>
                      </TabsTrigger>
                      <TabsTrigger value="history" className="text-sm">History</TabsTrigger>
                      <TabsTrigger value="analytics" className="text-sm">Analytics</TabsTrigger>
                    </TabsList>
                  
                    {/* Lean Canvas Content */}
                    <TabsContent value="canvas" className="mt-6">
                      {isLoadingCanvas ? (
                        <div className="bg-white rounded-lg border border-neutral-200 shadow-sm overflow-hidden p-5">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[...Array(9)].map((_, index) => (
                              <div key={index} className="bg-neutral-50 rounded-lg p-4 border border-neutral-200">
                                <div className="flex justify-between items-start mb-3">
                                  <Skeleton className="h-5 w-24" />
                                  <Skeleton className="h-4 w-4" />
                                </div>
                                <Skeleton className="h-4 w-full mb-2" />
                                <Skeleton className="h-4 w-3/4 mb-2" />
                                <Skeleton className="h-4 w-5/6" />
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : idea.status === 'Draft' ? (
                        <div className="bg-white rounded-lg border border-neutral-200 shadow-sm overflow-hidden p-8 text-center">
                          <h3 className="text-lg font-medium text-neutral-900 mb-2">Canvas not generated yet</h3>
                          <p className="text-neutral-600 mb-4">
                            Generate your Lean Canvas to see the details of your business idea structured in the Lean Canvas format.
                          </p>
                          <Button 
                            onClick={handleRegenerateCanvasClick}
                            disabled={isRegenerating}
                            className="bg-gradient-to-r from-primary to-secondary text-white hover:from-primary/90 hover:to-secondary/90"
                          >
                            <Hammer className="mr-2 h-4 w-4" /> Forge Canvas
                          </Button>
                        </div>
                      ) : idea.status === 'Generating' ? (
                        <div className="bg-white rounded-lg border border-neutral-200 shadow-sm overflow-hidden p-8 text-center">
                          <div className="mb-4 mx-auto relative w-16 h-16">
                            <div className="absolute inset-0 flex items-center justify-center animate-pulse">
                              <Flame className="h-14 w-14 text-amber-400" />
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center animate-spin">
                              <Hammer className="h-10 w-10 text-primary" />
                            </div>
                          </div>
                          <h3 className="text-lg font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-2">Forging Your Canvas</h3>
                          <p className="text-neutral-600 mb-2">
                            Please wait while we hammer out your idea and forge your Lean Canvas. The forge is heating up...
                          </p>
                          <div className="flex items-center justify-center mt-4">
                            <Badge variant="outline" className="px-3 py-1">
                              <span className="text-xs">Auto-completes after 2 minutes</span>
                            </Badge>
                          </div>
                        </div>
                      ) : canvas ? (
                        <div className="bg-white rounded-lg border border-neutral-200 shadow-sm overflow-hidden">
                          <div className="p-5">
                            {/* If we have HTML content from Supabase and it's a valid format, show it */}
                            {!isLoadingSupabase && supabaseData && supabaseData.data && supabaseData.data.html ? (
                              <div>
                                <div className="flex justify-between items-center mb-4">
                                  <div className="flex items-center">
                                    <div className="relative mr-2">
                                      <Hammer className="h-5 w-5 text-primary" />
                                      <Sparkles className="h-2.5 w-2.5 absolute -top-1 -right-1 text-amber-400" />
                                    </div>
                                    <h3 className="font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Forged Lean Canvas</h3>
                                  </div>
                                  <Badge variant="outline" className="flex items-center">
                                    <Database className="h-3 w-3 mr-1 text-primary" />
                                    <span className="text-xs">Supabase</span>
                                  </Badge>
                                </div>
                                <div className="prose prose-sm max-w-none overflow-auto mb-8">
                                  <div dangerouslySetInnerHTML={{ __html: supabaseData.data.html }} />
                                </div>
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <CanvasSectionComponent
                                  ideaId={idea.id}
                                  section="Problem"
                                  content={canvas.problem || ""}
                                />
                                
                                <CanvasSectionComponent
                                  ideaId={idea.id}
                                  section="CustomerSegments"
                                  content={canvas.customerSegments || ""}
                                />
                                
                                <CanvasSectionComponent
                                  ideaId={idea.id}
                                  section="UniqueValueProposition"
                                  content={canvas.uniqueValueProposition || ""}
                                />
                                
                                <CanvasSectionComponent
                                  ideaId={idea.id}
                                  section="Solution"
                                  content={canvas.solution || ""}
                                />
                                
                                <CanvasSectionComponent
                                  ideaId={idea.id}
                                  section="Channels"
                                  content={canvas.channels || ""}
                                />
                                
                                <CanvasSectionComponent
                                  ideaId={idea.id}
                                  section="RevenueStreams"
                                  content={canvas.revenueStreams || ""}
                                />
                                
                                <CanvasSectionComponent
                                  ideaId={idea.id}
                                  section="CostStructure"
                                  content={canvas.costStructure || ""}
                                />
                                
                                <CanvasSectionComponent
                                  ideaId={idea.id}
                                  section="KeyMetrics"
                                  content={canvas.keyMetrics || ""}
                                />
                                
                                <CanvasSectionComponent
                                  ideaId={idea.id}
                                  section="UnfairAdvantage"
                                  content={canvas.unfairAdvantage || ""}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-white rounded-lg border border-neutral-200 shadow-sm overflow-hidden p-8 text-center">
                          <div className="relative w-16 h-16 mx-auto mb-4">
                            <Hammer className="h-12 w-12 text-neutral-300 mx-auto" />
                            <div className="absolute top-0 right-0">
                              <Info className="h-5 w-5 text-amber-400" />
                            </div>
                          </div>
                          <h3 className="text-lg font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-2">Canvas Forging Failed</h3>
                          <p className="text-neutral-600 mb-4">
                            The forge encountered an issue while hammering out your canvas. Try reforging it with the button below.
                          </p>
                          <Button 
                            onClick={handleRegenerateCanvasClick} 
                            disabled={isRegenerating}
                            className="bg-gradient-to-r from-primary to-secondary text-white hover:from-primary/90 hover:to-secondary/90"
                          >
                            <Hammer className="mr-2 h-4 w-4" />
                            {isRegenerating ? "Reforging..." : "Reforge Canvas"}
                          </Button>
                        </div>
                      )}
                    </TabsContent>
                    
                    {/* Supabase Content */}
                    <TabsContent value="supabase" className="mt-6">
                      {isLoadingSupabase ? (
                        <div className="bg-white rounded-lg border border-neutral-200 shadow-sm overflow-hidden p-5">
                          <div className="flex justify-center items-center p-8">
                            <div className="animate-spin mr-3">
                              <RotateCcw className="h-6 w-6 text-primary-500" />
                            </div>
                            <p>Loading data from Supabase...</p>
                          </div>
                        </div>
                      ) : supabaseData ? (
                        <div className="bg-white rounded-lg border border-neutral-200 shadow-sm overflow-hidden">
                          <div className="p-5">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="font-medium text-neutral-900">Supabase Data</h3>
                              <Badge variant="outline" className="flex items-center">
                                <Database className="h-3 w-3 mr-1 text-primary-500" />
                                <span className="text-xs">{supabaseData.source}</span>
                              </Badge>
                            </div>
                            
                            {/* No Data Display */}
                            {!supabaseData.data && (
                              <div className="border border-neutral-200 rounded-md p-8 mb-4 bg-white text-center">
                                <h4 className="font-medium text-neutral-700 mb-3">Waiting for Canvas Data</h4>
                                <p className="text-neutral-600 mb-4">
                                  The Lean Canvas is being generated. This may take a moment to process.
                                </p>
                                <Button
                                  onClick={() => window.location.reload()}
                                  className="bg-gradient-to-r from-primary to-secondary text-white"
                                  size="sm"
                                >
                                  <RotateCcw className="mr-2 h-4 w-4" /> Refresh Data
                                </Button>
                              </div>
                            )}
                            
                            {/* CSV Download Option */}
                            {supabaseData.data && (
                              <div className="border border-neutral-200 rounded-md p-6 mb-4 bg-white">
                                <div className="flex items-center justify-between mb-4">
                                  <h4 className="font-medium text-neutral-700">Download Lean Canvas Data</h4>
                                  <Badge variant="outline" className="text-xs">CSV</Badge>
                                </div>
                                
                                <p className="text-neutral-600 mb-6 text-sm">
                                  Download your Lean Canvas data as a CSV file for easy importing into spreadsheet applications or other tools.
                                </p>
                                
                                <Button
                                  onClick={() => {
                                    const csvContent = jsonToCSV(supabaseData.data);
                                    downloadCSV(csvContent, `lean-canvas-${idea.id}-${new Date().toISOString().split('T')[0]}.csv`);
                                  }}
                                  className="w-full sm:w-auto bg-gradient-to-r from-primary to-secondary text-white flex items-center justify-center"
                                >
                                  <Download className="h-4 w-4 mr-2" />
                                  Download CSV
                                </Button>
                              </div>
                            )}
                            
                            {/* Raw JSON Data (for debugging) */}
                            {supabaseData.data && (
                              <div className="border border-neutral-200 rounded-md p-4 mb-4 bg-neutral-50 hidden md:block">
                                <h4 className="font-medium text-neutral-700 mb-2">Raw Data</h4>
                                <pre className="text-xs overflow-auto whitespace-pre-wrap max-h-[400px] custom-scrollbar">
                                  {JSON.stringify(supabaseData.data, null, 2)}
                                </pre>
                              </div>
                            )}
                            
                            {supabaseData.data && (
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {supabaseData.source === 'supabase' ? (
                                  <div className="col-span-3">
                                    <p className="text-sm text-green-600 font-medium flex items-center">
                                      <Database className="h-4 w-4 mr-1" />
                                      Successfully loaded data from Supabase
                                    </p>
                                  </div>
                                ) : (
                                  <div className="col-span-3">
                                    <p className="text-sm text-amber-600 font-medium">
                                      Fallback to local data - couldn't connect to Supabase
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-white rounded-lg border border-neutral-200 shadow-sm overflow-hidden p-8 text-center">
                          <h3 className="text-lg font-medium text-neutral-900 mb-2">No Supabase data found</h3>
                          <p className="text-neutral-600 mb-4">
                            There was an error connecting to Supabase or no data exists for this idea.
                          </p>
                        </div>
                      )}
                    </TabsContent>
                    
                    {/* Details Content */}
                    <TabsContent value="details" className="mt-6">
                      <div className="bg-white rounded-lg border border-neutral-200 shadow-sm overflow-hidden">
                        <div className="p-5">
                          <h3 className="font-medium text-neutral-900 mb-4">Project Details</h3>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Basic Information */}
                            <div className="col-span-1 md:col-span-3 pb-2 mb-4 border-b border-neutral-100">
                              <h4 className="font-medium text-neutral-700 mb-1">Basic Information</h4>
                              <p className="text-xs text-neutral-500">Core details about your project</p>
                            </div>
                            
                            <div>
                              <p className="text-sm font-medium text-neutral-500">Idea Name</p>
                              <p className="mt-1 text-sm text-neutral-900 font-medium">{idea.idea}</p>
                            </div>
                            
                            <div>
                              <p className="text-sm font-medium text-neutral-500">Status</p>
                              <div className="mt-1 flex items-center">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                                  ${idea.status === 'Completed' ? 'bg-green-100 text-secondary-500' : ''}
                                  ${idea.status === 'Generating' ? 'bg-yellow-100 text-yellow-800' : ''}
                                  ${idea.status === 'Draft' ? 'bg-neutral-100 text-neutral-800' : ''}`}>
                                  {idea.status}
                                </span>
                              </div>
                            </div>
                            
                            {idea.companyName && (
                              <div>
                                <p className="text-sm font-medium text-neutral-500">Company</p>
                                <p className="mt-1 text-sm text-neutral-900 font-medium">{idea.companyName}</p>
                              </div>
                            )}
                            
                            {/* Company Information */}
                            <div className="col-span-1 md:col-span-3 pt-4 pb-2 mb-4 border-b border-neutral-100">
                              <h4 className="font-medium text-neutral-700 mb-1">Company Information</h4>
                              <p className="text-xs text-neutral-500">Details about the company and founders</p>
                            </div>
                            
                            {idea.companyStage && (
                              <div>
                                <p className="text-sm font-medium text-neutral-500">Company Stage</p>
                                <p className="mt-1 text-sm text-neutral-900">{idea.companyStage}</p>
                              </div>
                            )}
                            
                            {idea.founderName && (
                              <div>
                                <p className="text-sm font-medium text-neutral-500">Founder Name</p>
                                <p className="mt-1 text-sm text-neutral-900">{idea.founderName}</p>
                              </div>
                            )}
                            
                            {idea.founderEmail && (
                              <div>
                                <p className="text-sm font-medium text-neutral-500">Founder Email</p>
                                <p className="mt-1 text-sm text-neutral-900">{idea.founderEmail}</p>
                              </div>
                            )}
                            
                            {idea.websiteUrl && (
                              <div className="col-span-1 md:col-span-3">
                                <p className="text-sm font-medium text-neutral-500">Website</p>
                                <a 
                                  href={idea.websiteUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="mt-1 text-sm text-primary-600 hover:text-primary-800 flex items-center"
                                >
                                  {idea.websiteUrl}
                                  <ExternalLinkIcon className="h-3 w-3 ml-1" />
                                </a>
                              </div>
                            )}
                            
                            {/* System Information */}
                            <div className="col-span-1 md:col-span-3 pt-4 pb-2 mb-4 border-b border-neutral-100">
                              <h4 className="font-medium text-neutral-700 mb-1">System Information</h4>
                              <p className="text-xs text-neutral-500">Technical details and timestamps</p>
                            </div>
                            
                            <div>
                              <p className="text-sm font-medium text-neutral-500">Created</p>
                              <p className="mt-1 text-sm text-neutral-900">{formatDate(idea.createdAt)}</p>
                            </div>
                            
                            <div>
                              <p className="text-sm font-medium text-neutral-500">Last Updated</p>
                              <p className="mt-1 text-sm text-neutral-900">{formatDate(idea.updatedAt)}</p>
                            </div>
                            
                            <div>
                              <p className="text-sm font-medium text-neutral-500">ID</p>
                              <p className="mt-1 text-sm text-neutral-900">{idea.id}</p>
                            </div>
                          </div>
                          
                          <div className="mt-8">
                            <Button 
                              className="flex items-center justify-center" 
                              onClick={handleRegenerateCanvasClick}
                              disabled={isRegenerating || idea.status === 'Generating'}
                            >
                              <RotateCcw className="mr-2 h-5 w-5" />
                              Regenerate Canvas
                            </Button>
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="history" className="mt-6">
                      <div className="bg-white rounded-lg border border-neutral-200 shadow-sm overflow-hidden p-8 text-center">
                        <h3 className="text-lg font-medium text-neutral-900">History Coming Soon</h3>
                        <p className="text-neutral-600">
                          Track the history and changes to your Lean Canvas over time. This feature is coming soon.
                        </p>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="analytics" className="mt-6">
                      <div className="bg-white rounded-lg border border-neutral-200 shadow-sm overflow-hidden p-8 text-center">
                        <h3 className="text-lg font-medium text-neutral-900">Analytics Coming Soon</h3>
                        <p className="text-neutral-600">
                          Get insights and analytics about your business idea. This feature is coming soon.
                        </p>
                      </div>
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
