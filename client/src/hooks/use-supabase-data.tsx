import { useQuery } from '@tanstack/react-query';
import { getQueryFn } from '../lib/queryClient';
import { useEffect } from 'react';
import { useToast } from './use-toast';
import { LeanCanvas, Idea } from '@shared/schema';

type SupabaseResponse<T> = {
  source: 'supabase' | 'local';
  data: T;
};

/**
 * Hook to fetch Lean Canvas data from Supabase for a specific idea
 */
export function useSupabaseCanvas(ideaId: number) {
  const { toast } = useToast();
  
  const query = useQuery<SupabaseResponse<LeanCanvas>>({ 
    queryKey: ['/api/supabase/canvas', ideaId],
    queryFn: () => fetch(`/api/supabase/canvas/${ideaId}`).then(res => {
      if (!res.ok) throw new Error('Failed to fetch from Supabase');
      return res.json();
    }),
    enabled: Boolean(ideaId),
  });
  
  // Handle errors in useEffect to avoid infinite loops
  useEffect(() => {
    if (query.error) {
      toast({
        title: 'Error fetching canvas data',
        description: query.error.message,
        variant: 'destructive',
      });
    }
  }, [query.error, toast]);
  
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
