import { useState, useEffect, useCallback } from "react";
import { useIdeas } from "@/hooks/use-ideas";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProjectStatus, projectStatuses } from "@shared/schema";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { IdeaCard } from "@/components/idea-card";
import { NewIdeaModal } from "@/components/new-idea-modal";
import { SearchIcon, Hammer, Sparkles, CheckCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { useToast } from "@/hooks/use-toast";
import { useSafeNavigation } from "@/hooks/use-safe-navigation";

export default function Dashboard() {
  const { user } = useAuth();
  const { ideas, isLoading, generateCanvas } = useIdeas();
  // We only use the local ideas hook - not the Supabase ideas - to avoid any cross-user data leakage
  const { toast } = useToast();
  const { location } = useSafeNavigation();
  const [showNewIdeaModal, setShowNewIdeaModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "All">("All");
  const [sortOrder, setSortOrder] = useState<string>("newest");
  
  // Check for verification success from URL params
  useEffect(() => {
    let mounted = true;
    
    const checkVerificationStatus = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const verified = urlParams.get('verified');
      
      if (!mounted) return;
      
      if (verified === 'true') {
        toast({
          title: "Email Verified Successfully",
          description: "Your email has been verified. Welcome to Anvil of Ideas!",
          variant: "default"
        });
        
        // Clear the URL parameter after showing the toast
        try {
          const currentPath = location || '/';
          window.history.replaceState({}, document.title, currentPath.split('?')[0]);
        } catch (error) {
          console.error('Error updating URL state:', error);
        }
      } else if (verified === 'false') {
        toast({
          title: "Email Verification Failed",
          description: "There was a problem verifying your email. Please try again or contact support.",
          variant: "destructive"
        });
        
        // Clear the URL parameter after showing the toast
        try {
          const currentPath = location || '/';
          window.history.replaceState({}, document.title, currentPath.split('?')[0]);
        } catch (error) {
          console.error('Error updating URL state:', error);
        }
      }
    };
    
    // Small delay to ensure component is fully mounted
    const timer = setTimeout(checkVerificationStatus, 100);
    
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [toast, location]);

  // Filter ideas based on search and status
  const filteredIdeas = ideas
    .filter(idea => 
      (statusFilter === "All" || idea.status === statusFilter) &&
      (idea.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
       idea.idea.toLowerCase().includes(searchQuery.toLowerCase()) || 
       (idea.companyName && idea.companyName.toLowerCase().includes(searchQuery.toLowerCase())))
    )
    .sort((a, b) => {
      if (sortOrder === "newest") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      } else if (sortOrder === "oldest") {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortOrder === "a-z") {
        const aTitle = a.title || a.idea;
        const bTitle = b.title || b.idea;
        return aTitle.localeCompare(bTitle);
      }
      return 0;
    });

  // Handle new idea button click
  const handleNewIdea = () => {
    setShowNewIdeaModal(true);
  };
  
  // Add event listener for opening the modal from sidebar
  useEffect(() => {
    const handleOpenModal = () => setShowNewIdeaModal(true);
    window.addEventListener('open-new-idea-modal', handleOpenModal);
    
    return () => {
      window.removeEventListener('open-new-idea-modal', handleOpenModal);
    };
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      
      <div className="flex-1 flex flex-col md:ml-64 min-h-screen">
        <Header />
        
        <main className="flex-1 overflow-y-auto focus:outline-none custom-scrollbar">
          <div className="py-6 max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
            {/* Dashboard Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary-500 to-amber-500 bg-clip-text text-transparent">Your Idea Forge</h1>
                <p className="mt-1 text-sm text-neutral-500">Craft and refine your business ideas in the anvil</p>
              </div>
              <div className="mt-4 sm:mt-0">
                <Button 
                  onClick={handleNewIdea}
                  className="inline-flex items-center"
                >
                  <Hammer className="-ml-1 mr-2 h-5 w-5" />
                  Forge New Idea
                </Button>
              </div>
            </div>

            {/* Filters */}
            <div className="mb-6 p-4 bg-white rounded-lg shadow-sm border border-neutral-200">
              <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
                <div className="relative rounded-md">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <SearchIcon className="h-5 w-5 text-neutral-400" />
                  </div>
                  <Input
                    type="text"
                    placeholder="Search ideas..."
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                
                <div className="flex space-x-3">
                  <Select
                    value={statusFilter}
                    onValueChange={(value) => setStatusFilter(value as ProjectStatus | "All")}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Statuses</SelectItem>
                      {projectStatuses.map((status) => (
                        <SelectItem key={status} value={status}>{status}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Select
                    value={sortOrder}
                    onValueChange={setSortOrder}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Sort: Newest" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Sort: Newest</SelectItem>
                      <SelectItem value="oldest">Sort: Oldest</SelectItem>
                      <SelectItem value="a-z">Sort: A-Z</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Ideas Grid */}
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-white rounded-lg border border-neutral-200 shadow-sm overflow-hidden p-5">
                    <div className="flex items-center justify-between mb-3">
                      <Skeleton className="h-6 w-20" />
                      <Skeleton className="h-6 w-6 rounded-full" />
                    </div>
                    <Skeleton className="h-6 w-full mb-2" />
                    <Skeleton className="h-4 w-full mb-1" />
                    <Skeleton className="h-4 w-3/4 mb-4" />
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredIdeas.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredIdeas.map((idea) => (
                  <IdeaCard 
                    key={idea.id} 
                    idea={idea}
                    onGenerate={() => generateCanvas(idea.id)} 
                  />
                ))}
              </div>
            ) : (
              <div className="mt-8 text-center py-12 bg-white rounded-lg border border-neutral-200">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                    <Hammer className="h-8 w-8 text-amber-600" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-neutral-900">No ideas found in your account</h3>
                <p className="mt-3 text-neutral-600 max-w-lg mx-auto">
                  {searchQuery || statusFilter !== "All" 
                    ? "No ideas match your current filters. Try adjusting your search or filter settings."
                    : "Your ideas dashboard is currently empty. Create your first idea to start using the Anvil of Ideas platform."}
                </p>

                <div className="mt-6">
                  <Button 
                    onClick={handleNewIdea} 
                    className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                  >
                    <Hammer className="-ml-1 mr-2 h-5 w-5" />
                    Forge New Idea
                  </Button>
                </div>
              </div>
            )}

            {/* Pagination */}
            {filteredIdeas.length > 0 && (
              <div className="mt-6">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious href="#" />
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationLink href="#" isActive>1</PaginationLink>
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext href="#" />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </div>
        </main>
      </div>
      
      <NewIdeaModal 
        open={showNewIdeaModal} 
        onClose={() => setShowNewIdeaModal(false)} 
      />
    </div>
  );
}
