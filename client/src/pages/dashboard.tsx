import { useState, useEffect } from "react";
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
import { useLocation } from "wouter";

export default function Dashboard() {
  const { user } = useAuth();
  const { ideas, isLoading, generateCanvas } = useIdeas();
  const [showNewIdeaModal, setShowNewIdeaModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "All">("All");
  const [sortOrder, setSortOrder] = useState<string>("newest");

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
                <svg className="mx-auto h-12 w-12 text-neutral-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-neutral-900">No ideas yet</h3>
                <p className="mt-1 text-sm text-neutral-500">
                  {searchQuery || statusFilter !== "All" 
                    ? "No ideas match your filters. Try adjusting your search."
                    : "Get started by creating a new business idea."}
                </p>
                <div className="mt-6">
                  <Button onClick={handleNewIdea}>
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
