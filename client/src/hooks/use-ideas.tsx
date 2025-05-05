import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Idea, InsertIdea } from "@shared/schema";
import { useToast } from "./use-toast";

export function useIdeas() {
  const { toast } = useToast();

  const { data: ideas, isLoading } = useQuery<Idea[]>({
    queryKey: ["/api/ideas"],
  });

  const createIdeaMutation = useMutation({
    mutationFn: async (newIdea: InsertIdea) => {
      const res = await apiRequest("POST", "/api/ideas", newIdea);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ideas"] });
      toast({
        title: "Success",
        description: "Your idea has been submitted and is being processed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create idea",
        variant: "destructive",
      });
    },
  });

  const generateCanvasMutation = useMutation({
    mutationFn: async (ideaId: number) => {
      const res = await apiRequest("POST", `/api/ideas/${ideaId}/generate`, {});
      return res.json();
    },
    onSuccess: (_, ideaId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ideas"] });
      queryClient.invalidateQueries({ queryKey: [`/api/ideas/${ideaId}`] });
      toast({
        title: "Canvas generation started",
        description: "Your Lean Canvas is being generated. You'll be notified when it's ready.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start canvas generation",
        variant: "destructive",
      });
    },
  });

  const deleteIdeaMutation = useMutation({
    mutationFn: async (ideaId: number) => {
      const res = await apiRequest("DELETE", `/api/ideas/${ideaId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ideas"] });
      toast({
        title: "Idea deleted",
        description: "The idea has been successfully deleted.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete idea",
        variant: "destructive",
      });
    },
  });

  return {
    ideas: ideas || [],
    isLoading,
    createIdea: createIdeaMutation.mutate,
    isCreating: createIdeaMutation.isPending,
    generateCanvas: generateCanvasMutation.mutate,
    isGenerating: generateCanvasMutation.isPending,
    deleteIdea: deleteIdeaMutation.mutate,
    isDeleting: deleteIdeaMutation.isPending,
  };
}

export function useIdea(id: number) {
  const { data: idea, isLoading } = useQuery<Idea>({
    queryKey: [`/api/ideas/${id}`],
    enabled: !!id,
  });

  return {
    idea,
    isLoading,
  };
}
