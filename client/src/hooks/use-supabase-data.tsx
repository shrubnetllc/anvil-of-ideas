import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useToast } from './use-toast';
import { useLocation } from 'wouter';

// This hook is deprecated - Supabase data is now served through the unified documents API.
// Keeping it as a stub for backward compatibility with any remaining references.

export function useSupabaseCanvas(ideaId: string) {
  return useQuery({
    queryKey: ['/api/ideas', ideaId, 'canvas-stub'],
    queryFn: async () => null,
    enabled: false,
  });
}

export function useSupabaseIdeas() {
  return useQuery({
    queryKey: ['/api/ideas-supabase-stub'],
    queryFn: async () => null,
    enabled: false,
  });
}
