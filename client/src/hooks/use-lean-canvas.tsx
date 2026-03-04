import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CanvasSection } from "@shared/schema";
import { useToast } from "./use-toast";
import { useCallback, useEffect } from "react";
import { useLocation } from "wouter";

// Canvas data shape returned from the API (from content_sections)
interface CanvasData {
  id: string;
  ideaId: string;
  problem: string | null;
  customerSegments: string | null;
  uniqueValueProposition: string | null;
  solution: string | null;
  channels: string | null;
  revenueStreams: string | null;
  costStructure: string | null;
  keyMetrics: string | null;
  unfairAdvantage: string | null;
  content: string | null;
  createdAt: string;
  updatedAt: string;
}

export function useLeanCanvas(ideaId: string) {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { data: canvas, isLoading, error } = useQuery<CanvasData>({
    queryKey: [`/api/ideas/${ideaId}/canvas`],
    enabled: !!ideaId,
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
          description: "You don't have permission to view this canvas",
          variant: "destructive"
        });
        navigate('/');
      } else if (status === 404 && ideaId) {
        toast({
          title: "Canvas Not Found",
          description: "The requested canvas could not be found",
          variant: "destructive"
        });
      }
    }
  }, [error, ideaId, navigate, toast]);

  const updateSectionMutation = useMutation({
    mutationFn: async ({
      section,
      content,
    }: {
      section: CanvasSection;
      content: string;
    }) => {
      const payload = { [section.charAt(0).toLowerCase() + section.slice(1)]: content };
      const res = await apiRequest("PATCH", `/api/ideas/${ideaId}/canvas`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/ideas/${ideaId}/canvas`] });
      toast({
        title: "Section updated",
        description: "The canvas section has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update canvas section",
        variant: "destructive",
      });
    },
  });

  const regenerateCanvasMutation = useMutation({
    mutationFn: async (data?: { notes?: string }) => {
      const res = await apiRequest("POST", `/api/ideas/${ideaId}/generate`, data || {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/ideas/${ideaId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/ideas/${ideaId}/canvas`] });
      toast({
        title: "Canvas regeneration started",
        description: "Your Lean Canvas is being regenerated. You'll be notified when it's ready.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to regenerate canvas",
        variant: "destructive",
      });
    },
  });

  const updateSection = useCallback(
    (section: CanvasSection, content: string) => {
      updateSectionMutation.mutate({ section, content });
    },
    [updateSectionMutation]
  );

  const regenerateCanvas = useCallback((data?: { notes?: string }) => {
    regenerateCanvasMutation.mutate(data);
  }, [regenerateCanvasMutation]);

  return {
    canvas,
    isLoading,
    updateSection,
    isUpdating: updateSectionMutation.isPending,
    regenerateCanvas,
    isRegenerating: regenerateCanvasMutation.isPending,
  };
}
