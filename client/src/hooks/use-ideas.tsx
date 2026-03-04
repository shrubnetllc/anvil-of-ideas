import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Idea, InsertIdea } from "@shared/schema";
import { useToast } from "./use-toast";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { useAuth } from "./use-auth";

export function useIdeas() {
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: ideas, isLoading } = useQuery<Idea[]>({
    queryKey: ["/api/ideas"],
    enabled: !!user,
    staleTime: 0,
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
        description: "Your idea has been submitted.",
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
    mutationFn: async (ideaId: string) => {
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
    mutationFn: async (ideaId: string) => {
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

  const updateIdeaMutation = useMutation({
    mutationFn: async ({ ideaId, updates }: { ideaId: string, updates: Partial<Idea> }) => {
      const res = await apiRequest("PATCH", `/api/ideas/${ideaId}`, updates);
      return res.json();
    },
    onSuccess: (_, { ideaId }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ideas"] });
      queryClient.invalidateQueries({ queryKey: [`/api/ideas/${ideaId}`] });
      toast({
        title: "Success",
        description: "Your idea details have been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update idea",
        variant: "destructive",
      });
    },
  });

  return {
    ideas: ideas || [],
    isLoading,
    createIdea: createIdeaMutation.mutate,
    isCreating: createIdeaMutation.isPending,
    updateIdea: updateIdeaMutation.mutate,
    isUpdating: updateIdeaMutation.isPending,
    generateCanvas: generateCanvasMutation.mutate,
    isGenerating: generateCanvasMutation.isPending,
    deleteIdea: deleteIdeaMutation.mutate,
    isDeleting: deleteIdeaMutation.isPending,
  };
}

export function useIdea(id: string) {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const {
    data: idea,
    isLoading,
    error
  } = useQuery<Idea>({
    queryKey: [`/api/ideas/${id}`],
    enabled: !!id,
    retry: (failureCount, error: any) => {
      if (error?.status === 403 || error?.status === 404) {
        return false;
      }
      return failureCount < 3;
    },
    throwOnError: false
  });

  useEffect(() => {
    if (error) {
      const status = (error as any)?.status;
      if (status === 403) {
        toast({
          title: "Access Denied",
          description: "You don't have permission to view this idea",
          variant: "destructive"
        });
        navigate('/');
      } else if (status === 404) {
        toast({
          title: "Idea Not Found",
          description: "The requested idea could not be found",
          variant: "destructive"
        });
        navigate('/');
      }
    }
  }, [error, navigate, toast]);

  return {
    idea,
    isLoading,
    error
  };
}
