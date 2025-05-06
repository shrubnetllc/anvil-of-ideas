import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase URL and API key must be provided');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Helper functions for interacting with Supabase tables

/**
 * Fetch lean canvas data from Supabase
 */
export async function fetchLeanCanvasData(ideaId: number) {
  try {
    console.log(`Fetching lean canvas data for idea ${ideaId} from Supabase`);
    
    const { data, error } = await supabase
      .from('lean_canvas')
      .select('*')
      .eq('idea_id', ideaId)
      .single();
    
    if (error) {
      throw error;
    }
    
    console.log(`Supabase returned lean canvas data:`, data);
    return data;
  } catch (error) {
    console.error('Error fetching lean canvas data from Supabase:', error);
    throw error;
  }
}

/**
 * Fetch ideas for a specific user
 */
export async function fetchUserIdeas(userId: number) {
  try {
    console.log(`Fetching ideas for user ${userId} from Supabase`);
    
    const { data, error } = await supabase
      .from('ideas')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      throw error;
    }
    
    console.log(`Supabase returned ${data.length} ideas`);
    return data;
  } catch (error) {
    console.error('Error fetching user ideas from Supabase:', error);
    throw error;
  }
}
