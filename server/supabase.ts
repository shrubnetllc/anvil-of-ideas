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
    
    // Step 1: Get the project_id from our local database
    let projectId = null;
    try {
      // Use raw SQL query to get the project_id since we're seeing issues with Drizzle ORM imports
      const { pool } = await import('./db');
      const result = await pool.query('SELECT project_id FROM lean_canvas WHERE idea_id = $1', [ideaId]);
      
      if (result.rows.length > 0 && result.rows[0].project_id) {
        projectId = result.rows[0].project_id;
        console.log(`Found project_id ${projectId} for idea ${ideaId} in local database`);
      } else {
        console.log(`No project_id found for idea ${ideaId} in local database`);
      }
    } catch (dbError) {
      console.warn('Error querying local database for project_id:', dbError);
    }
    
    // Step 2: If we have a project_id, use it to query Supabase
    if (projectId) {
      try {
        // Try to query using the project_id
        const { data, error } = await supabase
          .from('lean_canvas')
          .select('*')
          .eq('id', projectId)
          .single();
        
        if (error) {
          console.warn(`Error querying Supabase with id=${projectId}:`, error);
          
          // Try using 'project_id' column instead
          const response = await supabase
            .from('lean_canvas')
            .select('*')
            .eq('project_id', projectId)
            .single();
            
          if (response.error) {
            console.warn(`Error querying Supabase with project_id=${projectId}:`, response.error);
          } else if (response.data) {
            console.log(`Supabase returned data for project_id ${projectId}:`, response.data);
            return mapSupabaseData(response.data, ideaId, projectId);
          }
        } else if (data) {
          console.log(`Supabase returned data for id ${projectId}:`, data);
          return mapSupabaseData(data, ideaId, projectId);
        }
      } catch (supabaseError) {
        console.warn(`Error with Supabase query for project_id ${projectId}:`, supabaseError);
      }
    }
    
    // Step 3: Fallback to using the idea_id as a direct lookup
    console.log(`Trying direct lookup with project_id=${ideaId} in Supabase`);
    try {
      const { data, error } = await supabase
        .from('lean_canvas')
        .select('*')
        .eq('project_id', ideaId.toString())
        .single();
      
      if (error) {
        console.warn(`Error querying Supabase with project_id=${ideaId}:`, error);
      } else if (data) {
        console.log(`Supabase returned data for project_id ${ideaId}:`, data);
        return mapSupabaseData(data, ideaId, data.id.toString());
      }
    } catch (finalError) {
      console.warn(`Final Supabase query attempt failed:`, finalError);
    }
    
    // No data found after all attempts
    console.log(`No data found in Supabase for idea ${ideaId} after all attempts`);
    return null;
  } catch (error) {
    console.error('Error fetching lean canvas data from Supabase:', error);
    throw error;
  }
}

// Helper function to map Supabase data to our app's format
function mapSupabaseData(data: any, ideaId: number, projectId: string) {
  return {
    id: data.id,
    ideaId: ideaId,
    projectId: projectId,
    problem: data.problem,
    customerSegments: data.customer_segments,
    uniqueValueProposition: data.unique_value_proposition,
    solution: data.solution,
    channels: data.channels,
    revenueStreams: data.revenue_streams,
    costStructure: data.cost_structure,
    keyMetrics: data.key_metrics,
    unfairAdvantage: data.unfair_advantage,
    createdAt: data.created_at,
    // Additional data available in Supabase
    markdown: data.markdown,
    html: data.html || '',  // Ensure HTML is always available, even if empty
    llmOutput: data.llm_output,
    llmInput: data.llm_input
  };
}

/**
 * Fetch ideas for a specific user
 * @param userId The user ID whose ideas we want to fetch
 * @param requestingUserId Optional parameter to verify the requesting user has permission
 */
export async function fetchUserIdeas(userId: number, requestingUserId?: number) {
  try {
    // Security check: enforce user can only see their own ideas
    if (requestingUserId !== undefined && userId !== requestingUserId) {
      console.error(`Security violation: User ${requestingUserId} attempted to access ideas of user ${userId}`);
      throw new Error('Forbidden: You can only access your own ideas');
    }
    
    console.log(`Authorized: Fetching ideas for user ${userId} from Supabase`);
    
    // First check if the 'projects' table exists (more likely table name in Supabase)
    let response;
    try {
      response = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId.toString())
        .order('created_at', { ascending: false });
    } catch (e) {
      console.log('Error querying projects table, falling back to ideas table:', e);
      // Fallback to ideas table if projects doesn't exist
      response = await supabase
        .from('ideas')
        .select('*')
        .eq('user_id', userId.toString())
        .order('created_at', { ascending: false });
    }
    
    const { data, error } = response;
    
    if (error) {
      throw error;
    }
    
    if (!data || data.length === 0) {
      console.log(`No ideas/projects found for user ${userId} in Supabase`);
      return [];
    }
    
    // Map the data to match our app's structure
    const mappedData = data.map(item => ({
      id: parseInt(item.id),
      userId: parseInt(item.user_id),
      title: item.title || '',
      idea: item.name || item.idea || item.description || '',
      status: item.status || 'Draft',
      companyName: item.company_name || '',
      companyStage: item.company_stage || '',
      founderName: item.founder_name || '',
      founderEmail: item.founder_email || '',
      websiteUrl: item.website_url || '',
      createdAt: item.created_at,
      updatedAt: item.updated_at || item.created_at
    }));
    
    console.log(`Supabase returned ${mappedData.length} ideas/projects`);
    return mappedData;
  } catch (error) {
    console.error('Error fetching user ideas from Supabase:', error);
    throw error;
  }
}
