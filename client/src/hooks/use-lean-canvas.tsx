import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CanvasSection } from "@shared/schema";
import { useToast } from "./use-toast";
import { useCallback, useEffect, useRef, useState } from "react";
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  // Check for active generation job
  const canvasRef = useRef(canvas);
  useEffect(() => { canvasRef.current = canvas; }, [canvas]);

  const checkJobStatus = useCallback(async () => {
    try {
      // If canvas already has content, no need to show generating state
      if (canvasRef.current?.content) {
        setIsGenerating(false);
        setIsTimedOut(false);
        return;
      }

      const response = await fetch(`/api/ideas/${ideaId}/current-workflow-job?documentType=LeanCanvas`);
      if (response.ok) {
        const job = await response.json();
        if (job) {
          const isPending = job.status === 'pending' || job.status === 'processing' || job.status === 'starting';

          if (!isPending) {
            // Job is done (completed, failed, etc.) — stop generating
            setIsGenerating(false);
            setIsTimedOut(false);
            queryClient.invalidateQueries({ queryKey: [`/api/ideas/${ideaId}/canvas`] });
            queryClient.invalidateQueries({ queryKey: [`/api/ideas/${ideaId}`] });
            return;
          }

          // Job is still active — check for timeout (2 minutes)
          if (job.createdAt) {
            const createdAt = new Date(job.createdAt);
            const diffMinutes = (Date.now() - createdAt.getTime()) / (1000 * 60);
            if (diffMinutes >= 2) {
              setIsTimedOut(true);
              setIsGenerating(false);
              return;
            }
          }

          setIsGenerating(true);
        } else {
          // No job found — nothing generating
          setIsGenerating(false);
          setIsTimedOut(false);
        }
      }
    } catch (error) {
      console.error("Error checking job status:", error);
    }
  }, [ideaId]);

  // Check for active job on mount
  useEffect(() => {
    checkJobStatus();
  }, [checkJobStatus]);

  // Poll job status while generating
  useEffect(() => {
    if (isGenerating) {
      pollTimerRef.current = setInterval(() => {
        checkJobStatus();
      }, 10000);
    }

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [isGenerating, checkJobStatus]);

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
      // Use raw fetch instead of apiRequest so we can handle 409 before it throws
      let res = await fetch(`/api/ideas/${ideaId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data || {}),
        credentials: "include",
      });
      // If blocked by a stuck job (409), retry with force=true
      if (res.status === 409) {
        res = await fetch(`/api/ideas/${ideaId}/generate?force=true`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data || {}),
          credentials: "include",
        });
      }
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Generation failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      // Start tracking job status
      setIsGenerating(true);
      setIsTimedOut(false);
      queryClient.invalidateQueries({ queryKey: [`/api/ideas/${ideaId}`] });
    },
    onError: (error: Error) => {
      setIsGenerating(false);
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
    isRegenerating: isGenerating || regenerateCanvasMutation.isPending,
    isTimedOut,
  };
}
