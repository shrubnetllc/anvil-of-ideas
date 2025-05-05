import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CanvasSection, LeanCanvas, UpdateLeanCanvas } from "@shared/schema";
import { useToast } from "./use-toast";
import { useCallback } from "react";

export function useLeanCanvas(ideaId: number) {
  const { toast } = useToast();

  const { data: canvas, isLoading } = useQuery<LeanCanvas>({
    queryKey: [`/api/ideas/${ideaId}/canvas`],
    enabled: !!ideaId,
  });

  const updateSectionMutation = useMutation({
    mutationFn: async ({
      section,
      content,
    }: {
      section: CanvasSection;
      content: string;
    }) => {
      const payload = { [section.charAt(0).toLowerCase() + section.slice(1)]: content } as Partial<UpdateLeanCanvas>;
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
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/ideas/${ideaId}/generate`, {});
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

  return {
    canvas,
    isLoading,
    updateSection,
    isUpdating: updateSectionMutation.isPending,
    regenerateCanvas: regenerateCanvasMutation.mutate,
    isRegenerating: regenerateCanvasMutation.isPending,
  };
}
