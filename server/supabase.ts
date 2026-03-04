import { createClient } from '@supabase/supabase-js';
import { signSupabaseToken } from './db-security';

// Initialize Supabase client with environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase URL and API key must be provided');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

function getAuthenticatedSupabase(userId?: string) {
  if (!userId) return supabase;

  const anonKey = process.env.SUPABASE_ANON_KEY || supabaseKey;
  const token = signSupabaseToken(userId);

  return createClient(supabaseUrl!, anonKey!, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  });
}

/**
 * Fetch project workflows data from Supabase
 */
export async function fetchProjectWorkflows(ideaId: string, requestingUserId?: string) {
  try {
    console.log(`Fetching project workflows for idea ${ideaId} from Supabase`);

    const client = getAuthenticatedSupabase(requestingUserId);
    const { data, error } = await client
      .from('documents')
      .select('content, content_sections')
      .eq('idea_id', ideaId)
      .eq('document_type', 'Workflows')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      console.log(`No workflows found for idea ${ideaId} in Supabase`);
      return [];
    }

    // If content_sections has workflow steps, return them
    const doc = data[0];
    if (doc.content_sections && Array.isArray(doc.content_sections)) {
      return doc.content_sections;
    }

    return [];
  } catch (error) {
    console.error('Error fetching project workflows from Supabase:', error);
    throw error;
  }
}

/**
 * Fetch project estimate data from Supabase
 */
export async function fetchProjectEstimate(ideaId: string, requestingUserId?: string) {
  try {
    console.log(`Fetching project estimate for idea ${ideaId} from Supabase`);

    const client = getAuthenticatedSupabase(requestingUserId);
    const { data, error } = await client
      .from('documents')
      .select('content, content_sections')
      .eq('idea_id', ideaId)
      .eq('document_type', 'Estimate')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      console.log(`No estimate found for idea ${ideaId} in Supabase`);
      return null;
    }

    return data[0];
  } catch (error) {
    console.error('Error fetching project estimate from Supabase:', error);
    throw error;
  }
}
