import { useParams, useLocation } from "wouter";
import { useIdea, useIdeas } from "@/hooks/use-ideas";
import { useLeanCanvas } from "@/hooks/use-lean-canvas";
import { useSupabaseCanvas } from "@/hooks/use-supabase-data";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RotateCcw, ExternalLinkIcon, Database, Info, Hammer, Flame, Sparkles, Download, Pencil, Save, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, jsonToCSV, downloadCSV } from "@/lib/utils";
import { CanvasSection, canvasSections, Idea } from "@shared/schema";
import { CanvasSectionComponent } from "@/components/canvas-section";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { queryClient } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default function IdeaDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const ideaId = parseInt(id);
  const { idea, isLoading: isLoadingIdea } = useIdea(ideaId);
  const { canvas, isLoading: isLoadingCanvas, regenerateCanvas, isRegenerating } = useLeanCanvas(ideaId);
  const { data: supabaseData, isLoading: isLoadingSupabase } = useSupabaseCanvas(ideaId);
  
  // State for editing mode and form
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<Idea>>({});
  const { updateIdea, isUpdating } = useIdeas();
  
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
  
  // Handle toggling edit mode and initializing form data
  const handleToggleEdit = () => {
    if (!isEditing && idea) {
      // Initialize form data with current idea values when entering edit mode
      setFormData({
        title: idea.title || '',
        idea: idea.idea,
        companyName: idea.companyName || '',
        companyStage: idea.companyStage || '',
        founderName: idea.founderName || '',
        founderEmail: idea.founderEmail || '',
        websiteUrl: idea.websiteUrl || ''
      });
    }
    setIsEditing(!isEditing);
  };
  
  // Handle form field changes
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateIdea({ 
      ideaId: ideaId, 
      updates: formData 
    });
    setIsEditing(false);
  };

  if (isLoadingIdea) {
    return (
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col md:ml-64 min-h-screen">
          <main className="flex-1 overflow-y-auto focus:outline-none custom-scrollbar">
            <div className="py-6 max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              <div className="flex items-start mb-6">
                <Button variant="ghost" size="icon" className="mr-4 mt-1" onClick={handleBackClick}>
                  <ArrowLeft className="h-6 w-6" />
                </Button>
                <div>
                  <Skeleton className="h-8 w-64" />
                  <Skeleton className="h-4 w-96 mt-2" />
                </div>
              </div>
              <div className="space-y-6">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-64 w-full" />
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
                <h1 className="text-2xl font-bold text-neutral-900">
                  {idea.title || idea.companyName || idea.idea.split(' ').slice(0, 5).join(' ') + '...'}
                </h1>
                <p className="mt-1 text-neutral-600">{idea.idea}</p>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row lg:space-x-6">
              {/* Left Side */}
              <div className="lg:w-3/4 flex flex-col mb-6 lg:mb-0">
                {/* Lean Canvas Card */}
                <div className="bg-white rounded-lg border border-neutral-200 shadow-sm overflow-hidden mb-6">
                  <div className="p-5 border-b border-neutral-200 flex justify-between items-center">
                    <div className="flex items-center">
                      <h2 className="text-lg font-medium text-neutral-900">Lean Canvas</h2>
                      {idea.status === "Generating" && (
                        <Badge variant="outline" className="ml-3 bg-yellow-50 text-yellow-800 border-yellow-300">
                          <Flame className="h-3 w-3 mr-1 animate-pulse" />
                          Generating
                        </Badge>
                      )}
                      {idea.status === "Completed" && (
                        <Badge variant="outline" className="ml-3 bg-green-50 text-secondary-500 border-secondary-200">
                          <Sparkles className="h-3 w-3 mr-1" />
                          Completed
                        </Badge>
                      )}
                    </div>
                    
                    {(supabaseData && supabaseData.data) ? (
                      <Button
                        onClick={() => {
                          const csvData = jsonToCSV(supabaseData.data);
                          downloadCSV(csvData, `lean-canvas-${ideaId}.csv`);
                        }}
                        size="sm"
                        variant="outline"
                        className="text-xs"
                      >
                        <Download className="h-3.5 w-3.5 mr-1" />
                        Export CSV
                      </Button>
                    ) : (
                      <div className="text-xs text-neutral-500 flex items-center">
                        <Info className="h-3.5 w-3.5 mr-1" />
                        Complete the canvas to enable export
                      </div>
                    )}
                  </div>
                  
                  {isLoadingCanvas ? (
                    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                      {Array(9).fill(0).map((_, i) => (
                        <div key={i} className="border border-neutral-200 rounded-lg p-4">
                          <Skeleton className="h-5 w-24 mb-2" />
                          <Skeleton className="h-4 w-full mb-1" />
                          <Skeleton className="h-4 w-full mb-1" />
                          <Skeleton className="h-4 w-1/2" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                      {canvasSections.map((section) => (
                        <CanvasSectionComponent 
                          key={section} 
                          ideaId={ideaId} 
                          section={section} 
                          content={canvas ? canvas[section.charAt(0).toLowerCase() + section.slice(1)] : ''}
                        />
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Data Source Info */}
                <div className="flex items-center mb-6">
                  <div className="flex-1 h-px bg-neutral-200"></div>
                  <span className="px-3 text-sm text-neutral-500 flex items-center">
                    {isLoadingSupabase ? (
                      <Skeleton className="h-4 w-40" />
                    ) : supabaseData ? (
                      <>
                        <Database className="h-4 w-4 mr-2 text-neutral-400" />
                        Data Source: {supabaseData.source === 'supabase' ? 'Supabase' : 'Local'}
                      </>
                    ) : (
                      <span className="text-neutral-400 italic">No external data available</span>
                    )}
                  </span>
                  <div className="flex-1 h-px bg-neutral-200"></div>
                </div>
              </div>

              {/* Right Side */}
              <div className="lg:w-1/4">
                {/* Project Information Card */}
                <div className="bg-white rounded-lg border border-neutral-200 shadow-sm">
                  <div className="border-b border-neutral-200">
                    <Tabs defaultValue="details" className="px-1">
                      <TabsList className="w-full">
                        <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
                        <TabsTrigger value="history" className="flex-1">History</TabsTrigger>
                        <TabsTrigger value="analytics" className="flex-1">Analytics</TabsTrigger>
                      </TabsList>
                    
                      {/* Details Content */}
                      <TabsContent value="details" className="mt-6">
                        <div className="bg-white rounded-lg border border-neutral-200 shadow-sm overflow-hidden">
                          <div className="p-5">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="font-medium text-neutral-900">Project Details</h3>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handleToggleEdit}
                                disabled={isUpdating || idea.status === 'Generating'}
                                className="flex items-center"
                              >
                                {isEditing ? (
                                  <>
                                    <X className="h-4 w-4 mr-2" />
                                    Cancel
                                  </>
                                ) : (
                                  <>
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Edit
                                  </>
                                )}
                              </Button>
                            </div>
                            
                            {isEditing ? (
                              <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                  {/* Basic Information */}
                                  <div className="col-span-1 md:col-span-3 pb-2 mb-2 border-b border-neutral-100">
                                    <h4 className="font-medium text-neutral-700 mb-1">Basic Information</h4>
                                    <p className="text-xs text-neutral-500">Core details about your project</p>
                                  </div>
                                  
                                  <div>
                                    <Label htmlFor="title" className="text-sm font-medium text-neutral-500">Title</Label>
                                    <Input 
                                      id="title"
                                      name="title"
                                      value={formData.title || ''}
                                      onChange={handleFormChange}
                                      className="mt-1"
                                    />
                                  </div>
                                  
                                  <div className="col-span-1 md:col-span-2">
                                    <Label htmlFor="idea" className="text-sm font-medium text-neutral-500">Description</Label>
                                    <Textarea 
                                      id="idea"
                                      name="idea"
                                      value={formData.idea || ''}
                                      onChange={handleFormChange}
                                      className="mt-1 h-24"
                                    />
                                  </div>
                                  
                                  <div>
                                    <Label className="text-sm font-medium text-neutral-500">Status</Label>
                                    <div className="mt-1 flex items-center">
                                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                                        ${idea.status === 'Completed' ? 'bg-green-100 text-secondary-500' : ''}
                                        ${idea.status === 'Generating' ? 'bg-yellow-100 text-yellow-800' : ''}
                                        ${idea.status === 'Draft' ? 'bg-neutral-100 text-neutral-800' : ''}`}>
                                        {idea.status}
                                      </span>
                                      <span className="text-xs text-neutral-500 ml-2">(not editable)</span>
                                    </div>
                                  </div>
                                  
                                  <div>
                                    <Label htmlFor="companyName" className="text-sm font-medium text-neutral-500">Company</Label>
                                    <Input 
                                      id="companyName"
                                      name="companyName"
                                      value={formData.companyName || ''}
                                      onChange={handleFormChange}
                                      className="mt-1"
                                    />
                                  </div>
                                  
                                  {/* Company Information */}
                                  <div className="col-span-1 md:col-span-3 pt-4 pb-2 mb-2 border-b border-neutral-100">
                                    <h4 className="font-medium text-neutral-700 mb-1">Company Information</h4>
                                    <p className="text-xs text-neutral-500">Details about the company and founders</p>
                                  </div>
                                  
                                  <div>
                                    <Label htmlFor="companyStage" className="text-sm font-medium text-neutral-500">Company Stage</Label>
                                    <Input 
                                      id="companyStage"
                                      name="companyStage"
                                      value={formData.companyStage || ''}
                                      onChange={handleFormChange}
                                      className="mt-1"
                                    />
                                  </div>
                                  
                                  <div>
                                    <Label htmlFor="founderName" className="text-sm font-medium text-neutral-500">Founder Name</Label>
                                    <Input 
                                      id="founderName"
                                      name="founderName"
                                      value={formData.founderName || ''}
                                      onChange={handleFormChange}
                                      className="mt-1"
                                    />
                                  </div>
                                  
                                  <div>
                                    <Label htmlFor="founderEmail" className="text-sm font-medium text-neutral-500">Founder Email</Label>
                                    <Input 
                                      id="founderEmail"
                                      name="founderEmail"
                                      value={formData.founderEmail || ''}
                                      onChange={handleFormChange}
                                      className="mt-1"
                                      type="email"
                                    />
                                  </div>
                                  
                                  <div className="col-span-1 md:col-span-3">
                                    <Label htmlFor="websiteUrl" className="text-sm font-medium text-neutral-500">Website</Label>
                                    <Input 
                                      id="websiteUrl"
                                      name="websiteUrl"
                                      value={formData.websiteUrl || ''}
                                      onChange={handleFormChange}
                                      className="mt-1"
                                      type="url"
                                      placeholder="https://"
                                    />
                                  </div>
                                </div>
                                
                                <div className="flex justify-end space-x-3 mt-6">
                                  <Button 
                                    type="button" 
                                    variant="outline" 
                                    onClick={handleToggleEdit}
                                  >
                                    Cancel
                                  </Button>
                                  <Button 
                                    type="submit" 
                                    disabled={isUpdating}
                                    className="flex items-center"
                                  >
                                    {isUpdating ? 'Saving...' : (
                                      <>
                                        <Save className="mr-2 h-4 w-4" />
                                        Save Changes
                                      </>
                                    )}
                                  </Button>
                                </div>
                              </form>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Basic Information */}
                                <div className="col-span-1 md:col-span-3 pb-2 mb-4 border-b border-neutral-100">
                                  <h4 className="font-medium text-neutral-700 mb-1">Basic Information</h4>
                                  <p className="text-xs text-neutral-500">Core details about your project</p>
                                </div>
                                
                                <div>
                                  <p className="text-sm font-medium text-neutral-500">Title</p>
                                  <p className="mt-1 text-sm text-neutral-900 font-medium">{idea.title || "-"}</p>
                                </div>
                                
                                <div>
                                  <p className="text-sm font-medium text-neutral-500">Description</p>
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
                                
                                <div>
                                  <p className="text-sm font-medium text-neutral-500">Created</p>
                                  <p className="mt-1 text-sm text-neutral-900">{formatDate(idea.createdAt)}</p>
                                </div>
                                
                                <div>
                                  <p className="text-sm font-medium text-neutral-500">ID</p>
                                  <p className="mt-1 text-sm text-neutral-900">{idea.id}</p>
                                </div>
                              </div>
                            )}
                            
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
          </div>
        </main>
      </div>
    </div>
  );
}