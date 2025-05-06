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
    
    // In Supabase, the field is 'project_id' not 'idea_id'
    const { data, error } = await supabase
      .from('lean_canvas')
      .select('*')
      .eq('project_id', ideaId.toString()) // Convert to string as project_id appears to be stored as string
      .single();
    
    if (error) {
      throw error;
    }
    
    // Map Supabase column names to our app's expected format
    const mappedData = {
      id: data.id,
      ideaId: parseInt(data.project_id),
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
