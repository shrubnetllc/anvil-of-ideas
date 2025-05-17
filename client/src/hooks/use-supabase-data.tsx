import { useQuery } from '@tanstack/react-query';
import { getQueryFn } from '../lib/queryClient';
import { useEffect } from 'react';
import { useToast } from './use-toast';
import { LeanCanvas, Idea } from '@shared/schema';
import { useLocation } from 'wouter';

type SupabaseResponse<T> = {
  source: 'supabase' | 'local';
  data: T;
};

/**
 * Hook to fetch Lean Canvas data from Supabase for a specific idea
 */
export function useSupabaseCanvas(ideaId: number) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  
  const query = useQuery<SupabaseResponse<LeanCanvas>>({ 
    queryKey: ['/api/supabase/canvas', ideaId],
    queryFn: () => fetch(`/api/supabase/canvas/${ideaId}`).then(res => {
      // Handle authorization errors explicitly
      if (res.status === 403) {
        throw new Error('You do not have permission to view this canvas');
      } else if (res.status === 404) {
        throw new Error('Canvas not found');
      } else if (!res.ok) {
        throw new Error('Failed to fetch canvas data');
      }
      return res.json();
    }),
    enabled: Boolean(ideaId),
    retry: (failureCount, error: any) => {
      // Don't retry on permission errors
      if (error?.message?.includes('permission') || error?.message?.includes('not found')) {
        return false;
      }
      return failureCount < 3;
    }
  });
  
  // Handle errors in useEffect to avoid infinite loops
  useEffect(() => {
    if (query.error) {
      const errorMsg = query.error.message || '';
      
      if (errorMsg.includes('permission')) {
        toast({
          title: 'Access Denied',
          description: 'You do not have permission to view this canvas',
          variant: 'destructive',
        });
        // Redirect to dashboard on permission errors
        navigate('/');
      } else if (errorMsg.includes('not found')) {
        toast({
          title: 'Canvas Not Found',
          description: 'The requested canvas could not be found',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error Fetching Canvas Data',
          description: errorMsg,
          variant: 'destructive',
        });
      }
    }
  }, [query.error, toast, navigate]);
  
  return query;
}

/**
 * Hook to fetch user's ideas from Supabase
 */
export function useSupabaseIdeas() {
  const { toast } = useToast();
  
  const query = useQuery<SupabaseResponse<Idea[]>>({ 
    queryKey: ['/api/supabase/ideas'],
    queryFn: () => fetch('/api/supabase/ideas').then(res => {
      if (!res.ok) throw new Error('Failed to fetch from Supabase');
      return res.json();
    }),
  });
  
  // Handle errors in useEffect to avoid infinite loops
  useEffect(() => {
    if (query.error) {
      toast({
        title: 'Error fetching ideas',
        description: query.error instanceof Error ? query.error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  }, [query.error, toast]);
  
  return query;
}
