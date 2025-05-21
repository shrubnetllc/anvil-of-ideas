import { useParams, useLocation } from "wouter";
import { useIdea, useIdeas } from "@/hooks/use-ideas";
import { useLeanCanvas } from "@/hooks/use-lean-canvas";
import { useSupabaseCanvas } from "@/hooks/use-supabase-data";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeft, RotateCcw, ExternalLinkIcon, Database, Info, Hammer, Flame, Sparkles, Download, Pencil, Save, X, Loader2, RefreshCw, Copy, FileText } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, jsonToCSV, downloadCSV, copyHtmlToClipboard } from "@/lib/utils";
import { CanvasSection, canvasSections, Idea, DocumentType, ProjectDocument } from "@shared/schema";
import { CanvasSectionComponent } from "@/components/canvas-section";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function IdeaDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const ideaId = parseInt(id);
  const { idea, isLoading: isLoadingIdea } = useIdea(ideaId);
  const { canvas, isLoading: isLoadingCanvas, regenerateCanvas, isRegenerating } = useLeanCanvas(ideaId);
  const { data: supabaseData, isLoading: isLoadingSupabase } = useSupabaseCanvas(ideaId);
  
  // State for project requirements
  const [projectRequirements, setProjectRequirements] = useState<ProjectDocument | null>(null);
  const [isLoadingRequirements, setIsLoadingRequirements] = useState(false);
  const [isGeneratingRequirements, setIsGeneratingRequirements] = useState(false);
  const [projectRequirementsGenerating, setProjectRequirementsGenerating] = useState(false);
  const [requirementsNotes, setRequirementsNotes] = useState('');
  
  // State for business requirements
  const [businessRequirements, setBusinessRequirements] = useState<ProjectDocument | null>(null);
  const [isLoadingBusinessRequirements, setIsLoadingBusinessRequirements] = useState(false);
  const [isGeneratingBusinessRequirements, setIsGeneratingBusinessRequirements] = useState(false);
  const [businessRequirementsGenerating, setBusinessRequirementsGenerating] = useState(false);
  const [businessRequirementsTimedOut, setBusinessRequirementsTimedOut] = useState(false);
  const [businessRequirementsGenerated, setBusinessRequirementsGenerated] = useState(false);
  const [businessRequirementsHtml, setBusinessRequirementsHtml] = useState("");
  const [businessRequirementsContent, setBusinessRequirementsContent] = useState("");
  const [businessRequirementsNotes, setBusinessRequirementsNotes] = useState('');
  
  // State for lean canvas
  const [canvasNotes, setCanvasNotes] = useState('');
  const [isCanvasGenerated, setIsCanvasGenerated] = useState(false);
  const [canvasGenerating, setCanvasGenerating] = useState(false);
  const [isGeneratingCanvas, setIsGeneratingCanvas] = useState(false);
  
  const { toast } = useToast();
  
  // State for editing mode and form
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<Idea>>({});
  const { updateIdea, isUpdating } = useIdeas();
  
  // Fetch project requirements when component mounts
  useEffect(() => {
    if (ideaId) {
      fetchProjectRequirements();
      fetchBusinessRequirements();
    }
  }, [ideaId]);

  // Fetch the project requirements document
  const fetchProjectRequirements = async () => {
    try {
      setIsLoadingRequirements(true);
      const response = await fetch(`/api/ideas/${ideaId}/documents/ProjectRequirements`);
      if (response.ok) {
        const data = await response.json();
        setProjectRequirements(data);
        
        // Check if requirements are currently generating
        if (data && data.status === 'Generating') {
          setProjectRequirementsGenerating(true);
        } else {
          setProjectRequirementsGenerating(false);
        }
      } else {
        // No requirements exist yet
        setProjectRequirements(null);
      }
    } catch (error) {
      console.error('Error fetching project requirements:', error);
      toast({
        title: "Error",
        description: "Failed to load project requirements",
        variant: "destructive",
      });
    } finally {
      setIsLoadingRequirements(false);
    }
  };
  
  // Fetch the business requirements document
  const fetchBusinessRequirements = async () => {
    try {
      setIsLoadingBusinessRequirements(true);
      
      // First get the local document to check its status and get the externalId
      const response = await fetch(`/api/ideas/${ideaId}/documents/BusinessRequirements`);
      if (response.ok) {
        const data = await response.json();
        setBusinessRequirements(data);
        
        // Check if business requirements are currently generating
        if (data && data.status === 'Generating') {
          setBusinessRequirementsGenerating(true);
          setBusinessRequirementsGenerated(false);
          
          // Check if generation has timed out (2 minutes or more since started)
          if (data.generationStartedAt) {
            const startedAt = new Date(data.generationStartedAt);
            const now = new Date();
            const diffMinutes = (now.getTime() - startedAt.getTime()) / (1000 * 60);
            
            if (diffMinutes >= 2) {
              console.log(`Business requirements generation timed out (started ${diffMinutes.toFixed(1)} minutes ago)`);
              setBusinessRequirementsTimedOut(true);
            } else {
              setBusinessRequirementsTimedOut(false);
              console.log(`Business requirements generation in progress (started ${diffMinutes.toFixed(1)} minutes ago)`);
            }
          }
        } else if (data && data.status === 'Completed') {
          setBusinessRequirementsGenerating(false);
          setBusinessRequirementsGenerated(true);
          setBusinessRequirementsTimedOut(false);
          
          // If document has content, use it
          if (data.content) {
            setBusinessRequirementsContent(data.content);
          }
          
          // If document has HTML, use it
          if (data.html) {
            setBusinessRequirementsHtml(data.html);
          }
          
          // If document is completed and has externalId, try to get enriched content from Supabase
          if (data.externalId) {
            try {
              console.log(`🔍 Fetching BRD data from Supabase with document ID: ${data.externalId} for idea ${ideaId}`);
              
              // First try our direct debug endpoint to verify data is accessible
              const directDebugUrl = `/api/debug/supabase-brd/${data.externalId}`;
              console.log(`🔍 First trying direct debug endpoint: ${directDebugUrl}`);
              
              try {
                const debugResponse = await fetch(directDebugUrl);
                const debugData = await debugResponse.json();
                console.log('🔍 Direct debug response:', debugData);
                
                if (debugResponse.ok && debugData.has_html) {
                  console.log(`🔍 Debug endpoint confirms HTML content exists with length: ${debugData.html_length}`);
                } else {
                  console.warn('🔍 Debug endpoint could not find HTML content');
                }
              } catch (debugError) {
                console.error('🔍 Error using debug endpoint:', debugError);
              }
              
              // Now try the regular endpoint
              console.log(`🔍 Now trying standard endpoint...`);
              const supabaseResponse = await fetch(`/api/supabase/business-requirements/${ideaId}?external_id=${data.externalId}`);
              console.log(`🔍 Response status:`, supabaseResponse.status);
              
              if (supabaseResponse.ok) {
                const supabaseData = await supabaseResponse.json();
                console.log('🔍 Full Supabase response:', supabaseData);
              
              // The updated response format should have HTML content directly in the data.html field
              let htmlContent = null;
              
              // Check for HTML content in the most likely places based on our format
              if (supabaseData.data && supabaseData.data.html) {
                // This is the standard format our server should return now
                htmlContent = supabaseData.data.html;
                console.log('Found HTML in standard html field:', htmlContent.substring(0, 100) + '...');
              } else if (supabaseData.data && supabaseData.data.brd_html) {
                // This is a fallback for direct database format
                htmlContent = supabaseData.data.brd_html;
                console.log('Found HTML in brd_html field:', htmlContent.substring(0, 100) + '...');
              } else if (supabaseData.data) {
                // Check ALL fields for potential HTML content as a last resort
                console.log('Looking for HTML content in all fields of Supabase response...');
                
                for (const [key, value] of Object.entries(supabaseData.data)) {
                  if (typeof value === 'string' && 
                      (value.includes('<html') || 
                       value.includes('<!DOCTYPE') || 
                       value.includes('<div') || 
                       value.includes('<p>'))) {
                    console.log(`Found potential HTML in field '${key}'`);
                    htmlContent = value;
                    break;
                  }
                }
              }
              
              if (htmlContent) {
                console.log(`Found HTML content in Supabase response (${htmlContent.length} characters)`);
                
                // First update the local document with HTML content if it was empty
                if (!data.html) {
                  try {
                    console.log(`Updating document ${data.id} with HTML content of length ${htmlContent.length}`);
                    const updateResponse = await fetch(`/api/ideas/${ideaId}/documents/${data.id}`, {
                      method: 'PATCH',
                      headers: {
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({
                        html: htmlContent,
                        status: "Completed" // Also make sure to set status to completed
                      })
                    });
                    
                    if (updateResponse.ok) {
                      console.log('Successfully updated local document with HTML content from Supabase');
                    } else {
                      console.error('Failed to update document:', await updateResponse.text());
                    }
                  } catch (updateError) {
                    console.error('Error updating local document with Supabase HTML:', updateError);
                  }
                }
                
                // Update the business requirements with the HTML content
                setBusinessRequirementsHtml(htmlContent);
                
                // Update the document in state to include the HTML
                setBusinessRequirements({
                  ...data,
                  html: htmlContent,
                  status: "Completed" // Ensure status is completed since we have content
                });
                
                // Also log the content for debugging
                console.log('HTML content preview:', htmlContent.substring(0, 200) + '...');
                
                // No success toast needed - let's keep behavior consistent with other document types
              } else {
                console.log('No HTML content found in any field of Supabase response');
                
                // Show warning to user
                toast({
                  title: "Limited Content",
                  description: "Could not find HTML content in the Supabase response",
                  variant: "default",
                });
              }
                
                // If we have markdown/content from Supabase, use it
                if (supabaseData.data && (supabaseData.data.markdown || supabaseData.data.content)) {
                  const content = supabaseData.data.markdown || supabaseData.data.content;
                  
                  // First update the local document with content if it was empty
                  if (!data.content) {
                    try {
                      await fetch(`/api/ideas/${ideaId}/documents/${data.id}`, {
                        method: 'PATCH',
                        headers: {
                          'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                          content: content
                        })
                      });
                    } catch (updateError) {
                      console.error('Error updating local document with Supabase content:', updateError);
                    }
                  }
                  
                  // Update the display immediately
                  setBusinessRequirementsContent(content);
                }
              }
            } catch (supabaseError) {
              console.error('Error fetching business requirements from Supabase:', supabaseError);
            }
          }
        } else {
          // If not generating or completed, reset states
          setBusinessRequirementsGenerating(false);
          setBusinessRequirementsTimedOut(false);
        }
      } else {
        // No business requirements exist yet
        setBusinessRequirements(null);
        setBusinessRequirementsGenerating(false);
        setBusinessRequirementsGenerated(false);
        setBusinessRequirementsTimedOut(false);
      }
    } catch (error) {
      console.error('Error fetching business requirements:', error);
      toast({
        title: "Error",
        description: "Failed to load business requirements",
        variant: "destructive",
      });
    } finally {
      setIsLoadingBusinessRequirements(false);
    }
  };

  // Handle generating project requirements
  const handleGenerateRequirementsClick = async () => {
    try {
      setIsGeneratingRequirements(true);
      
      // Get project_id from canvas if it exists, or use the idea ID
      const projectId = ideaId.toString();
      
      console.log(`Starting requirements generation for project ID: ${projectId}`);
      
      // Call to n8n webhook via our backend proxy to handle authentication
      const response = await fetch(`/api/webhook/requirements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          projectId: projectId,
          instructions: requirementsNotes || "Be Brief as possible"
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to start requirements generation: ${errorText}`);
      }
      
      // The document should be created in the webhook endpoint
      const result = await response.json();
      console.log("Requirements generation response:", result);
      
      // Now update the UI to show the generating state
      setProjectRequirementsGenerating(true);
      
      // Fetch the document to get the current state
      const docResponse = await fetch(`/api/ideas/${ideaId}/documents/ProjectRequirements`);
      if (docResponse.ok) {
        const docData = await docResponse.json();
        setProjectRequirements(docData);
      }
      
      // Set up polling to check document status
      const pollTimer = setInterval(async () => {
        try {
          const checkResponse = await fetch(`/api/ideas/${ideaId}/documents/ProjectRequirements`);
          if (checkResponse.ok) {
            const updatedDoc = await checkResponse.json();
            setProjectRequirements(updatedDoc);
            
            if (updatedDoc.status !== 'Generating') {
              clearInterval(pollTimer);
              setProjectRequirementsGenerating(false);
              console.log("Requirements generation completed:", updatedDoc);
              
              toast({
                title: "Success",
                description: "Project requirements have been forged!",
                variant: "default",
              });
            }
          }
        } catch (pollError) {
          console.error('Error polling document status:', pollError);
        }
      }, 10000); // Poll every 10 seconds
      
      // Clear polling after 2 minutes maximum
      setTimeout(() => {
        clearInterval(pollTimer);
        fetchProjectRequirements(); // Fetch final state
      }, 120000);
      
      toast({
        title: "Success",
        description: "Started forging project requirements. This may take a few minutes.",
        variant: "default",
      });
    } catch (error) {
      console.error('Error generating project requirements:', error);
      toast({
        title: "Error",
        description: "Failed to generate project requirements. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingRequirements(false);
    }
  };
  
  // Handle generating business requirements
  const handleGenerateBusinessRequirementsClick = async () => {
    try {
      setIsGeneratingBusinessRequirements(true);
      
      // Get project_id from canvas if it exists
      const projectId = canvas?.projectId || null;
      
      // Retrieve the PRD document to get its externalId if available
      let prdId = null;
      if (projectRequirements?.externalId) {
        prdId = projectRequirements.externalId;
        console.log(`Using existing PRD ID: ${prdId}`);
      }
      
      console.log(`Starting business requirements generation for idea: ${ideaId}, project ID: ${projectId || 'not available'}, using PRD ID: ${prdId || 'not available'}`);
      
      // Build request payload - always include numeric ideaId
      const payload: {
        ideaId: number;
        projectId?: string;
        instructions: string;
      } = {
        ideaId: ideaId, // Always include numeric ID as primary identifier
        instructions: businessRequirementsNotes || "Provide detailed business requirements aligned with the lean canvas and project requirements."
      };
      
      // Add projectId only if it exists
      if (projectId) {
        payload.projectId = projectId;
      }
      
      // Call to n8n webhook via our backend proxy to handle authentication
      let result;
      try {
        const response = await fetch(`/api/ideas/${ideaId}/generate-business-requirements`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to start business requirements generation: ${errorText}`);
        }
        
        result = await response.json();
        console.log('Business requirements generation started:', JSON.stringify(result, null, 2));
        
        // Log the document and especially the external ID if present
        if (result && result.document) {
          console.log(`Received document with ID: ${result.document.id}, status: ${result.document.status}, externalId: ${result.document.externalId || 'none'}`);
        }
      } catch (error) {
        console.error('Error generating business requirements:', error);
        setIsGeneratingBusinessRequirements(false);
        toast({
          title: "Error",
          description: "Failed to start business requirements generation. Please try again.",
          variant: "destructive"
        });
        return; // Exit early
      }
      // Now update the UI to show the generating state
      setBusinessRequirementsGenerating(true);
      
      // Get the document from the response
      if (result && result.document) {
        setBusinessRequirements(result.document);
      } else {
        // If document wasn't returned, fetch it
        const docResponse = await fetch(`/api/ideas/${ideaId}/documents/BusinessRequirements`);
        if (docResponse.ok) {
          const docData = await docResponse.json();
          setBusinessRequirements(docData);
        }
      }
      
      // Set up polling to check document status
      const pollTimer = setInterval(async () => {
        try {
          const checkResponse = await fetch(`/api/ideas/${ideaId}/documents/BusinessRequirements`);
          if (checkResponse.ok) {
            const updatedDoc = await checkResponse.json();
            setBusinessRequirements(updatedDoc);
            
            // Check for timeout during polling
            if (updatedDoc.generationStartedAt) {
              const startTime = new Date(updatedDoc.generationStartedAt);
              const now = new Date();
              const diffMinutes = (now.getTime() - startTime.getTime()) / (1000 * 60);
              
              console.log(`BRD generation running for ${diffMinutes.toFixed(1)} minutes`);
              
              if (diffMinutes >= 2) {
                console.log('BRD generation timed out - showing retry button');
                setBusinessRequirementsTimedOut(true);
              }
            }
            
            if (updatedDoc.status !== 'Generating') {
              clearInterval(pollTimer);
              setBusinessRequirementsGenerating(false);
              setBusinessRequirementsTimedOut(false);
              console.log("Business requirements generation completed:", updatedDoc);
              
              toast({
                title: "Success",
                description: "Business requirements document has been forged!",
                variant: "default",
              });
            }
          }
        } catch (pollError) {
          console.error('Error polling business requirements document status:', pollError);
        }
      }, 10000); // Poll every 10 seconds
      
      // Check for timeout sooner (after 30 seconds)
      const timeoutCheck = setTimeout(() => {
        fetchBusinessRequirements(); // This will check the status and detect timeout if needed
      }, 30000);
      
      // Clear polling after 2 minutes maximum
      const maxTimeout = setTimeout(() => {
        clearInterval(pollTimer);
        clearTimeout(timeoutCheck);
        fetchBusinessRequirements(); // Fetch final state
        
        // Explicitly check for timeout
        if (businessRequirementsGenerating) {
          setBusinessRequirementsTimedOut(true);
        }
      }, 120000);
      
      toast({
        title: "Success",
        description: "Started forging business requirements document. This may take a few minutes.",
        variant: "default",
      });
    } catch (error) {
      console.error('Error generating business requirements:', error);
      toast({
        title: "Error",
        description: "Failed to generate business requirements document. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingBusinessRequirements(false);
    }
  };

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

  // Handle regenerating canvas
  const handleRegenerateCanvasClick = () => {
    handleRegenerateLeanCanvasClick();
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
  
  // Delete a document to allow regeneration
  const deleteDocument = async (documentId: number): Promise<boolean> => {
    try {
      const response = await fetch(`/api/ideas/${ideaId}/documents/${documentId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        return true;
      } else {
        console.error('Failed to delete document:', await response.text());
        return false;
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      return false;
    }
  };
  
  // Regenerate project requirements - first delete current document, then reset to form state
  const handleRegenerateProjectRequirementsClick = async () => {
    if (projectRequirements && projectRequirements.id) {
      setIsGeneratingRequirements(true);
      
      const deleted = await deleteDocument(projectRequirements.id);
      if (deleted) {
        // Reset state to show the empty form
        setProjectRequirements(null);
        setProjectRequirementsGenerating(false);
        setRequirementsNotes(''); // Reset notes field
        
        toast({
          title: "Ready for regeneration",
          description: "You can now generate a new Project Requirements document",
          variant: "default",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to reset document. Please try again.",
          variant: "destructive",
        });
      }
      
      setIsGeneratingRequirements(false);
    } else {
      handleGenerateRequirementsClick();
    }
  };
  
  // Regenerate business requirements - first delete current document, then reset to form state
  const handleRegenerateBusinessRequirementsClick = async () => {
    if (businessRequirements && businessRequirements.id) {
      setIsGeneratingBusinessRequirements(true);
      
      const deleted = await deleteDocument(businessRequirements.id);
      if (deleted) {
        // Reset state to show the empty form
        setBusinessRequirements(null);
        setBusinessRequirementsGenerating(false);
        setBusinessRequirementsTimedOut(false);
        setBusinessRequirementsGenerated(false);
        setBusinessRequirementsHtml("");
        setBusinessRequirementsContent("");
        setBusinessRequirementsNotes(''); // Reset notes field
        
        toast({
          title: "Ready for regeneration",
          description: "You can now generate a new Business Requirements document",
          variant: "default",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to reset document. Please try again.",
          variant: "destructive",
        });
      }
      
      setIsGeneratingBusinessRequirements(false);
    } else {
      handleGenerateBusinessRequirementsClick();
    }
  };
  
  // Lean Canvas regeneration
  const handleGenerateCanvasClick = () => {
    regenerateCanvas({});
  };
  
  // Handle regenerating Lean Canvas with notes - using React Query mutation from the hook
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
                <h1 className="text-2xl font-bold text-neutral-900">
                  {idea.title || idea.companyName || idea.idea.split(' ').slice(0, 5).join(' ') + '...'}
                </h1>
                <p className="mt-1 text-neutral-600">{idea.idea}</p>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row lg:space-x-6">
              {/* Main content */}
              <div className="w-full">
                {/* Tabs */}
                <div className="border-b border-neutral-200">
                  <Tabs defaultValue="canvas">
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
                      <TabsTrigger value="details" className="text-sm">
                        <div className="flex items-center">
                          <Info className="h-4 w-4 mr-1" /> 
                          Details
                        </div>
                      </TabsTrigger>
                    </TabsList>
                  
                    {/* Documents Overview */}
                    <TabsContent value="documents" className="mt-6">
                      <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-6">
                        <h2 className="text-xl font-bold mb-4">Project Documents</h2>
                        <p className="text-neutral-600 mb-6">
                          Create and manage various documents for your business idea. Each document helps
                          you develop different aspects of your project.
                        </p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {/* Lean Canvas Card */}
                          <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-2">
                              <h3 className="font-semibold">Lean Canvas</h3>
                              <Badge variant={canvas ? "default" : "outline"}>
                                {canvas ? "Created" : "Not Created"}
                              </Badge>
                            </div>
                            <p className="text-sm text-neutral-600 mb-3">
                              Business model overview using the Lean Canvas framework
                            </p>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="w-full"
                              onClick={() => {
                                const element = document.querySelector('[data-value="canvas"]') as HTMLElement;
                                element?.click();
                              }}
                            >
                              {canvas ? "View Canvas" : "Create Canvas"}
                            </Button>
                          </div>
                          
                          {/* Project Requirements Card */}
                          <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-2">
                              <h3 className="font-semibold">Project Requirements</h3>
                              {projectRequirements ? (
                                <Badge 
                                  variant={projectRequirements.status === 'Completed' ? 'default' : 'outline'}
                                  className={projectRequirements.status === 'Completed' ? 'bg-green-100 text-green-800 hover:bg-green-100' : 
                                            projectRequirements.status === 'Generating' ? 'bg-amber-100 text-amber-800 hover:bg-amber-100' : ''}
                                >
                                  {projectRequirements.status}
                                </Badge>
                              ) : (
                                <Badge variant="outline">Not Created</Badge>
                              )}
                            </div>
                            <p className="text-sm text-neutral-600 mb-3">
                              High-level project goals and requirements document
                            </p>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="w-full"
                              onClick={() => {
                                const element = document.querySelector('[data-value="requirements"]') as HTMLElement;
                                element?.click();
                              }}
                            >
                              {projectRequirements ? 'View Document' : 'Create Document'}
                            </Button>
                          </div>
                          
                          {/* Business Requirements Card */}
                          <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-2">
                              <h3 className="font-semibold">Business Requirements</h3>
                              {businessRequirements ? (
                                <Badge 
                                  variant={businessRequirements.status === 'Completed' ? 'default' : 'outline'}
                                  className={businessRequirements.status === 'Completed' ? 'bg-green-100 text-green-800 hover:bg-green-100' : 
                                            businessRequirements.status === 'Generating' ? 'bg-amber-100 text-amber-800 hover:bg-amber-100' : ''}
                                >
                                  {businessRequirements.status}
                                </Badge>
                              ) : (
                                <Badge variant="outline">Not Created</Badge>
                              )}
                            </div>
                            <p className="text-sm text-neutral-600 mb-3">
                              Detailed business requirements specification
                            </p>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="w-full"
                              onClick={() => {
                                const element = document.querySelector('[data-value="business"]') as HTMLElement;
                                element?.click();
                              }}
                            >
                              {businessRequirements ? 'View Document' : 'Create Document'}
                            </Button>
                          </div>
                          
                          {/* Additional document cards would follow the same pattern */}
                          {/* You can add more cards for each document type */}
                        </div>
                      </div>
                    </TabsContent>
                    
                    {/* Project Requirements Content */}
                    <TabsContent value="requirements" className="mt-6">
                      <div className="bg-white rounded-lg border border-neutral-200 shadow-sm overflow-hidden p-8">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-bold text-neutral-900">Project Requirements Document</h3>
                          {projectRequirements ? (
                            <Badge variant="outline" className="text-xs">
                              {projectRequirements.status}
                            </Badge>
                          ) : (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={handleGenerateRequirementsClick}
                              disabled={isGeneratingRequirements}
                            >
                              <Hammer className="mr-2 h-4 w-4" />
                              Generate Project Requirements
                            </Button>
                          )}
                        </div>
                        
                        {isLoadingRequirements ? (
                          <div className="text-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                            <p>Loading project requirements document...</p>
                          </div>
                        ) : projectRequirementsGenerating ? (
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
                              Forging Your Project Requirements
                            </h4>
                            <p className="text-neutral-600 mb-2">
                              Please wait while we hammer out the project requirements for your idea...
                            </p>
                            <p className="text-neutral-500 text-sm italic">
                              This process usually takes 1-2 minutes.
                            </p>
                          </div>
                        ) : projectRequirements ? (
                          <div>
                            {projectRequirements.status === 'Completed' ? (
                              <div>
                                <div className="mb-6 flex justify-between items-center">
                                  <div>
                                    <p className="text-sm text-neutral-500">
                                      Last updated: {formatDate(projectRequirements.updatedAt || projectRequirements.createdAt)}
                                    </p>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={async () => {
                                        const success = await copyHtmlToClipboard("project-requirements-content");
                                        if (success) {
                                          toast({
                                            title: "Content copied to clipboard",
                                            description: "Project requirements copied as formatted text",
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
                                      Copy Content
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={handleRegenerateProjectRequirementsClick}
                                      disabled={isGeneratingRequirements}
                                    >
                                      <RefreshCw className="mr-2 h-4 w-4" />
                                      Regenerate
                                    </Button>
                                  </div>
                                </div>
                                
                                {/* Display the project requirements content */}
                                <div id="project-requirements-content" className="prose max-w-none prose-headings:font-semibold prose-h1:text-xl prose-h2:text-lg prose-h3:text-md prose-p:text-neutral-700">
                                  {projectRequirements.html ? (
                                    <div dangerouslySetInnerHTML={{ __html: projectRequirements.html }} />
                                  ) : projectRequirements.content ? (
                                    <div className="whitespace-pre-wrap font-mono text-sm bg-neutral-50 p-4 rounded-md">
                                      {projectRequirements.content}
                                    </div>
                                  ) : (
                                    <div className="p-4 text-center">
                                      <p className="text-neutral-600">
                                        Project requirements content is being processed. Check status to refresh.
                                      </p>
                                    </div>
                                  )}
                                </div>
                                
                                {/* Additional notes panel for regeneration - using a dialog like with lean canvas */}
                                <div className="mt-6 flex">
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
                                          Add specific instructions for regenerating your Project Requirements. These instructions will be used when you click the Regenerate button.
                                        </DialogDescription>
                                      </DialogHeader>
                                      <div className="py-4">
                                        <Textarea 
                                          id="requirementsNotes"
                                          value={requirementsNotes}
                                          onChange={(e) => setRequirementsNotes(e.target.value)}
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
                                </div>
                              </div>
                            ) : (
                              <div className="text-center py-8">
                                <p>Project requirements document is in {projectRequirements.status.toLowerCase()} state.</p>
                              </div>
                            )}
                          </div>
                        ) : !isGeneratingRequirements ? (
                          <div>
                            <div className="text-center py-8">
                              <div className="mx-auto w-16 h-16 mb-4 bg-amber-50 rounded-full flex items-center justify-center">
                                <Hammer className="h-8 w-8 text-amber-600" />
                              </div>
                              <h4 className="text-lg font-medium mb-2">No Project Requirements Yet</h4>
                              <p className="text-neutral-600 max-w-lg mx-auto mb-4">
                                Generate project requirements to define the high-level goals, scope, and constraints of your project.
                              </p>
                            </div>
                            
                            {/* Notes to include for consideration */}
                            <div className="mt-8 border-t border-neutral-200 pt-6">
                              <h4 className="font-medium mb-2">Notes to include for consideration</h4>
                              <p className="text-sm text-neutral-600 mb-4">
                                Add any specific notes or requirements you'd like us to consider when generating the project requirements document.
                              </p>
                              <div className="space-y-4">
                                <Textarea 
                                  placeholder="Example: Include mobile responsive design requirements, focus on security features, etc."
                                  className="h-24"
                                  value={requirementsNotes}
                                  onChange={(e) => setRequirementsNotes(e.target.value)}
                                />
                                <Button 
                                  onClick={handleGenerateRequirementsClick}
                                  disabled={isGeneratingRequirements}
                                  className="bg-gradient-to-r from-primary to-secondary text-white hover:from-primary/90 hover:to-secondary/90"
                                >
                                  <Hammer className="mr-2 h-4 w-4" /> Forge Requirements
                                </Button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <div className="mx-auto w-16 h-16 mb-4 bg-amber-50 rounded-full flex items-center justify-center">
                              <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                            <h4 className="text-lg font-medium mb-2">Preparing to Generate Requirements</h4>
                            <p className="text-neutral-600 max-w-lg mx-auto">
                              Setting up the forge to generate your project requirements...
                            </p>
                          </div>
                        )}
                      </div>
                    </TabsContent>
                    
                    {/* Business Requirements Content */}
                    <TabsContent value="business" className="mt-6">
                      <div className="bg-white rounded-lg border border-neutral-200 shadow-sm overflow-hidden p-8">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-bold text-neutral-900">Business Requirements Document</h3>
                          {businessRequirements ? (
                            <Badge variant="outline" className="text-xs">
                              {businessRequirements.status}
                            </Badge>
                          ) : (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={handleGenerateBusinessRequirementsClick}
                              disabled={isGeneratingBusinessRequirements}
                            >
                              <Flame className="mr-2 h-4 w-4" />
                              Generate Business Requirements
                            </Button>
                          )}
                        </div>
                        
                        {isLoadingBusinessRequirements ? (
                          <div className="text-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                            <p>Loading business requirements document...</p>
                          </div>
                        ) : businessRequirementsGenerating && !businessRequirementsTimedOut ? (
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
                              Forging Your Business Requirements
                            </h4>
                            <p className="text-neutral-600 mb-2">
                              Please wait while we hammer out the business requirements for your idea...
                            </p>
                            <p className="text-neutral-500 text-sm italic">
                              This process usually takes 1-2 minutes.
                            </p>
                          </div>
                        ) : businessRequirementsTimedOut ? (
                          <div className="border border-destructive rounded-md p-6 mb-4 bg-destructive/10">
                            <div className="flex items-start space-x-4">
                              <div className="mt-1">
                                <AlertTriangle className="h-6 w-6 text-destructive" />
                              </div>
                              <div className="flex-1">
                                <h4 className="font-bold text-destructive mb-2">Generation Timed Out</h4>
                                <p className="text-neutral-700 mb-4">
                                  The business requirements document generation is taking longer than expected. 
                                  This could be due to high system load or complexity of your project.
                                </p>
                                <div className="flex items-center space-x-3">
                                  <Button 
                                    onClick={handleGenerateBusinessRequirementsClick}
                                    disabled={isGeneratingBusinessRequirements}
                                    className="bg-gradient-to-r from-amber-500 to-amber-700 hover:from-amber-600 hover:to-amber-800"
                                  >
                                    {isGeneratingBusinessRequirements ? (
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
                                    onClick={fetchBusinessRequirements}
                                  >
                                    <RotateCcw className="mr-2 h-4 w-4" />
                                    Check Status
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : businessRequirements ? (
                          <div>
                            {businessRequirements.status === 'Completed' ? (
                              <div>
                                <div className="mb-6 flex justify-between items-center">
                                  <div>
                                    <p className="text-sm text-neutral-500">
                                      Last updated: {formatDate(businessRequirements.updatedAt || businessRequirements.createdAt)}
                                    </p>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={async () => {
                                        const success = await copyHtmlToClipboard("business-requirements-content");
                                        if (success) {
                                          toast({
                                            title: "Content copied to clipboard",
                                            description: "Business requirements copied as formatted text",
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
                                      Copy Content
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={handleRegenerateBusinessRequirementsClick}
                                      disabled={isGeneratingBusinessRequirements}
                                    >
                                      <RefreshCw className="mr-2 h-4 w-4" />
                                      Regenerate
                                    </Button>
                                  </div>
                                </div>
                                
                                {/* Display the business requirements content */}
                                <div id="business-requirements-content" className="prose max-w-none prose-headings:font-semibold prose-h1:text-xl prose-h2:text-lg prose-h3:text-md prose-p:text-neutral-700">
                                  {/* We'll try to retrieve business requirements HTML content from Supabase */}
                                  {businessRequirements.html ? (
                                    <div dangerouslySetInnerHTML={{ __html: businessRequirements.html }} />
                                  ) : businessRequirements.content ? (
                                    <div className="whitespace-pre-wrap font-mono text-sm bg-neutral-50 p-4 rounded-md">
                                      {businessRequirements.content}
                                    </div>
                                  ) : (
                                    <div className="p-4 text-center">
                                      <p className="text-neutral-600">
                                        Business requirements content is being processed. Check status to refresh.
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="text-center py-8">
                                <p>Business requirements document is in {businessRequirements.status.toLowerCase()} state.</p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="py-8">
                            <div className="mb-6">
                              <p className="mb-2">Provide optional instructions for generating your business requirements document:</p>
                              <Textarea
                                value={businessRequirementsNotes}
                                onChange={(e) => setBusinessRequirementsNotes(e.target.value)}
                                placeholder="e.g., Focus on market differentiation, highlight revenue streams, include stakeholder analysis..."
                                className="h-24"
                              />
                            </div>
                            <div className="flex justify-center">
                              <Button 
                                onClick={handleGenerateBusinessRequirementsClick}
                                disabled={isGeneratingBusinessRequirements}
                                className="bg-gradient-to-r from-amber-500 to-amber-700 hover:from-amber-600 hover:to-amber-800"
                              >
                                <Flame className="mr-2 h-4 w-4" />
                                {isGeneratingBusinessRequirements ? 'Generating...' : 'Generate Business Requirements'}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </TabsContent>
                    
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
                                  <div className="flex space-x-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={handleRegenerateCanvasClick}
                                      disabled={isRegenerating}
                                    >
                                      <RotateCcw className="mr-2 h-4 w-4" />
                                      {isRegenerating ? "Regenerating..." : "Regenerate"}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={async () => {
                                        const success = await copyHtmlToClipboard("lean-canvas-content");
                                        if (success) {
                                          toast({
                                            title: "Content copied to clipboard",
                                            description: "Lean Canvas copied as formatted text",
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
                                      Copy Content
                                    </Button>
                                  </div>
                                </div>
                                <div id="lean-canvas-content" className="prose prose-sm max-w-none overflow-auto mb-8">
                                  <div dangerouslySetInnerHTML={{ __html: supabaseData.data.html }} />
                                </div>
                                
                                {/* Additional notes panel for regeneration - now using a drawer instead */}
                                <div className="mt-6 flex">
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
                                          Add specific instructions for regenerating your Lean Canvas. These instructions will be used when you click the Regenerate button.
                                        </DialogDescription>
                                      </DialogHeader>
                                      <div className="py-4">
                                        <Textarea 
                                          id="canvasNotes"
                                          value={canvasNotes}
                                          onChange={(e) => setCanvasNotes(e.target.value)}
                                          placeholder="E.g., Focus more on the mobile app market, emphasize the subscription revenue model..."
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
                          
                          {/* Removed redundant regenerate button from details tab */}
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
