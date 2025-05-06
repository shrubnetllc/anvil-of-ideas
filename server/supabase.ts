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
    
    // Step 1: Try to get the lean canvas from our local database to get the project_id
    try {
      const { db } = await import('./db');
      const { leanCanvas, eq } = await import('@shared/schema');
      
      // Query our local database for the project_id
      const [localCanvas] = await db.select().from(leanCanvas).where(eq(leanCanvas.ideaId, ideaId));
      
      if (localCanvas && localCanvas.projectId) {
        console.log(`Found project_id ${localCanvas.projectId} for idea ${ideaId} in local database`);
        
        // Step 2: Use the project_id to query Supabase
        const { data, error } = await supabase
          .from('lean_canvas')
          .select('*')
          .eq('id', localCanvas.projectId)
          .single();
        
        if (error) {
          console.warn(`Error querying Supabase with project_id ${localCanvas.projectId}:`, error);
          // Fall back to querying by idea_id below
        } else if (data) {
          console.log(`Supabase returned data for project_id ${localCanvas.projectId}:`, data);
          
          // Map Supabase column names to our app's expected format
          return {
            id: data.id,
            ideaId: ideaId,
            projectId: localCanvas.projectId,
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
            html: data.html,
            llmOutput: data.llm_output,
            llmInput: data.llm_input
          };
        }
      }
    } catch (dbError) {
      console.warn('Error querying local database for project_id:', dbError);
      // Continue with fallback logic
    }
    
    // Fallback: try to query using idea_id directly
    console.log(`Falling back to querying Supabase by project_id=${ideaId}`);
    const { data, error } = await supabase
      .from('lean_canvas')
      .select('*')
      .eq('project_id', ideaId.toString()) // Convert to string as project_id appears to be stored as string
      .single();
    
    if (error) {
      throw error;
    }
    
    if (!data) {
      console.log(`No data found for project_id ${ideaId} in Supabase`);
      return null;
    }
    
    // Map Supabase column names to our app's expected format
    const mappedData = {
      id: data.id,
      ideaId: ideaId,
      projectId: data.id.toString(),
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
      html: data.html,
      llmOutput: data.llm_output,
      llmInput: data.llm_input
    };
    
    console.log(`Supabase returned and mapped lean canvas data:`, mappedData);
    return mappedData;
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
      idea: item.name || item.idea || item.title || '',
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
