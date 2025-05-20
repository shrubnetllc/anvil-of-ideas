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
 * Fetch project requirements data from Supabase
 * @param prdId The ID of the PRD document to fetch
 * @param ideaId The ID of the related idea
 * @param requestingUserId Optional user ID for security validation
 */
export async function fetchProjectRequirements(prdId: string, ideaId: number, requestingUserId?: number) {
  try {
    console.log(`[SECURITY] Fetching project requirements for PRD ID ${prdId} from Supabase`);
    
    // Security check: If requesting user ID is provided, verify ownership
    if (requestingUserId !== undefined) {
      try {
        const { pool } = await import('./db');
        const securityCheck = await pool.query('SELECT user_id FROM ideas WHERE id = $1', [ideaId]);
        
        if (securityCheck.rows.length === 0) {
          console.log(`[SECURITY] Idea ${ideaId} not found in security check`);
          return null;
        }
        
        const ownerId = parseInt(securityCheck.rows[0].user_id);
        if (ownerId !== requestingUserId) {
          console.log(`[SECURITY VIOLATION] User ${requestingUserId} attempted to access idea ${ideaId} owned by user ${ownerId}`);
          return null;
        }
        
        console.log(`[SECURITY] Authorized: User ${requestingUserId} owns idea ${ideaId}`);
      } catch (securityError) {
        console.error(`[SECURITY] Error during ownership verification:`, securityError);
        return null;
      }
    }
    
    // Query the Supabase PRD table with the provided PRD ID
    try {
      console.log(`Querying Supabase for PRD ID ${prdId}`);
      const { data, error } = await supabase
        .from('prd')
        .select('*')
        .eq('id', prdId)
        .single();
      
      if (error) {
        console.warn(`Error querying Supabase PRD table with id=${prdId}:`, error);
        return null;
      }
      
      if (data) {
        console.log(`Supabase returned data for PRD ID ${prdId}`);
        // Map and return the PRD data with the HTML content
        return {
          id: data.id,
          ideaId: ideaId,
          projectReqHtml: data.project_req_html || '',
          createdAt: data.created_at,
          updatedAt: data.updated_at
        };
      }
    } catch (supabaseError) {
      console.warn(`Error with Supabase query for PRD ID ${prdId}:`, supabaseError);
    }
    
    console.log(`No data found in Supabase for PRD ID ${prdId}`);
    return null;
  } catch (error) {
    console.error('Error fetching project requirements from Supabase:', error);
    throw error;
  }
}

/**
 * Fetch lean canvas data from Supabase
 * @param ideaId The ID of the idea to fetch canvas data for
 * @param requestingUserId Optional user ID for security validation
 */
export async function fetchLeanCanvasData(ideaId: number, requestingUserId?: number) {
  try {
    console.log(`[SECURITY] Fetching lean canvas data for idea ${ideaId} from Supabase`);
    
    // Security check: If requesting user ID is provided, verify ownership
    if (requestingUserId !== undefined) {
      try {
        const { pool } = await import('./db');
        const securityCheck = await pool.query('SELECT user_id FROM ideas WHERE id = $1', [ideaId]);
        
        if (securityCheck.rows.length === 0) {
          console.log(`[SECURITY] Idea ${ideaId} not found in security check`);
          return null;
        }
        
        const ownerId = parseInt(securityCheck.rows[0].user_id);
        if (ownerId !== requestingUserId) {
          console.log(`[SECURITY VIOLATION] User ${requestingUserId} attempted to access idea ${ideaId} owned by user ${ownerId}`);
          return null;
        }
        
        console.log(`[SECURITY] Authorized: User ${requestingUserId} owns idea ${ideaId}`);
      } catch (securityError) {
        console.error(`[SECURITY] Error during ownership verification:`, securityError);
        return null;
      }
    }
    
    // Step 1: Get the project_id and leancanvas_id from our local database
    let projectId = null;
    let leancanvasId = null;
    try {
      // Use raw SQL query to get both IDs since we're seeing issues with Drizzle ORM imports
      const { pool } = await import('./db');
      const result = await pool.query('SELECT project_id, leancanvas_id FROM lean_canvas WHERE idea_id = $1', [ideaId]);
      
      if (result.rows.length > 0) {
        projectId = result.rows[0].project_id;
        leancanvasId = result.rows[0].leancanvas_id;
        console.log(`Found project_id ${projectId} and leancanvas_id ${leancanvasId} for idea ${ideaId} in local database`);
      } else {
        console.log(`No IDs found for idea ${ideaId} in local database`);
      }
    } catch (dbError) {
      console.warn('Error querying local database for IDs:', dbError);
    }
    
    // Step 2: If we have leancanvas_id (preferred) or project_id, use it to query Supabase
    if (leancanvasId || projectId) {
      try {
        let data, error;
        
        // Try to query using the leancanvas_id first (preferred method)
        if (leancanvasId) {
          console.log(`Querying Supabase with leancanvas_id=${leancanvasId}`);
          const response = await supabase
            .from('lean_canvas')
            .select('*')
            .eq('id', leancanvasId)
            .single();
            
          data = response.data;
          error = response.error;
          
          if (error) {
            console.warn(`Error querying Supabase with id (leancanvas_id)=${leancanvasId}:`, error);
          } else if (data) {
            console.log(`Supabase returned data for leancanvas_id ${leancanvasId}`);
            return mapSupabaseData(data, ideaId, projectId);
          }
        }
        
        // If leancanvas_id query failed or wasn't available, fall back to project_id
        if ((!data || error) && projectId) {
          console.log(`Falling back to project_id query with ${projectId}`);
          // Try to query using the project_id as id
          const idResponse = await supabase
            .from('lean_canvas')
            .select('*')
            .eq('id', projectId)
            .single();
          
          if (idResponse.error) {
            console.warn(`Error querying Supabase with id=${projectId}:`, idResponse.error);
            
            // Try using 'project_id' column instead
            const projectResponse = await supabase
              .from('lean_canvas')
              .select('*')
              .eq('project_id', projectId)
              .single();
              
            if (projectResponse.error) {
              console.warn(`Error querying Supabase with project_id=${projectId}:`, projectResponse.error);
            } else if (projectResponse.data) {
              console.log(`Supabase returned data for project_id ${projectId}`);
              return mapSupabaseData(projectResponse.data, ideaId, projectId);
            }
          } else if (idResponse.data) {
            console.log(`Supabase returned data for id ${projectId}`);
            return mapSupabaseData(idResponse.data, ideaId, projectId);
          }
        }
      } catch (supabaseError) {
        console.warn(`Error with Supabase query:`, supabaseError);
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

/**
 * Fetch Business Requirements Document data from Supabase
 * @param brdId The external ID of the BRD document in Supabase
 * @param ideaId The ID of the idea
 * @param requestingUserId Optional user ID for security validation
 */
export async function fetchBusinessRequirements(brdId: string, ideaId: number, requestingUserId?: number) {
  try {
    console.log(`[SECURITY] Fetching business requirements for BRD ID ${brdId} from Supabase`);
    
    // Security check: Verify the requesting user owns the idea
    if (requestingUserId !== undefined) {
      try {
        const { pool } = await import('./db');
        const securityCheck = await pool.query('SELECT user_id FROM ideas WHERE id = $1', [ideaId]);
        
        if (securityCheck.rows.length === 0) {
          console.log(`[SECURITY] Idea ${ideaId} not found in security check`);
          return null;
        }
        
        const ownerId = parseInt(securityCheck.rows[0].user_id);
        if (ownerId !== requestingUserId) {
          console.log(`[SECURITY VIOLATION] User ${requestingUserId} attempted to access idea ${ideaId} owned by user ${ownerId}`);
          return null;
        }
        
        console.log(`[SECURITY] Authorized: User ${requestingUserId} accessing BRD for idea ${ideaId}`);
      } catch (securityError) {
        console.error(`[SECURITY] Error during ownership verification:`, securityError);
        return null;
      }
    }
    
    // Query the Supabase BRD table with the provided external ID
    console.log(`Querying Supabase BRD table with ID: ${brdId}`);
    
    try {
      const { data, error } = await supabase
        .from('brd')
        .select('*')
        .eq('id', brdId)
        .single();
      
      if (error) {
        console.error('Error fetching BRD from Supabase:', error);
        return null;
      }
      
      if (!data) {
        console.log(`No BRD found in Supabase with ID ${brdId}`);
        return null;
      }
      
      console.log(`Successfully retrieved BRD from Supabase with ID ${brdId}`);
      
      return {
        source: 'supabase',
        data
      };
    } catch (error) {
      console.error('Error querying Supabase for BRD:', error);
      return null;
    }
  } catch (error) {
    console.error('Error in fetchBusinessRequirements:', error);
    return null;
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
