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
    
    // Step 1: Get projectId and leancanvasId from our local database
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
            console.log(`Supabase returned data for id=${projectId}`);
            return mapSupabaseData(idResponse.data, ideaId, projectId);
          }
        }
      } catch (supabaseError) {
        console.warn(`Error with Supabase query for lean canvas:`, supabaseError);
      }
    }
    
    // Step 3: If all else fails, try to find by ideaId in case it's stored differently
    try {
      console.log(`Trying to query Supabase with idea_id=${ideaId}`);
      const ideaResponse = await supabase
        .from('lean_canvas')
        .select('*')
        .eq('idea_id', ideaId)
        .single();
        
      if (ideaResponse.error) {
        console.warn(`Error querying Supabase with idea_id=${ideaId}:`, ideaResponse.error);
      } else if (ideaResponse.data) {
        console.log(`Supabase returned data for idea_id ${ideaId}`);
        return mapSupabaseData(ideaResponse.data, ideaId, projectId);
      }
    } catch (ideaQueryError) {
      console.warn(`Error querying by idea_id:`, ideaQueryError);
    }
    
    console.log(`No data found in Supabase for idea ${ideaId}`);
    return null;
  } catch (error) {
    console.error('Error fetching lean canvas from Supabase:', error);
    throw error;
  }
}

/**
 * Fetch Functional Requirements data from Supabase
 * @param functionalId The external ID of the functional requirements document in Supabase
 * @param ideaId The ID of the idea
 * @param requestingUserId Optional user ID for security validation
 */
export async function fetchFunctionalRequirements(functionalId: string, ideaId: number, requestingUserId?: number) {
  try {
    console.log(`[SUPABASE FUNCTIONAL] START: Fetching functional requirements ID ${functionalId} for idea ${ideaId}`);
    
    // Perform security check if requesting user ID is provided
    if (requestingUserId !== undefined) {
      try {
        // Verify user has permission to access this idea 
        const { pool } = await import('./db');
        const result = await pool.query('SELECT user_id FROM ideas WHERE id = $1', [ideaId]);
        
        if (result.rows.length === 0) {
          console.log(`[SECURITY] Idea ${ideaId} not found when fetching functional requirements`);
          return { error: 'Idea not found', data: null };
        }
        
        const ownerId = result.rows[0].user_id;
        if (ownerId !== requestingUserId) {
          console.log(`[SECURITY] Unauthorized: User ${requestingUserId} trying to access functional requirements for idea ${ideaId} owned by user ${ownerId}`);
          return { error: 'Unauthorized access', data: null };
        }
        
        console.log(`[SECURITY] Authorized: User ${requestingUserId} accessing Functional Requirements for idea ${ideaId}`);
      } catch (error) {
        console.error('[SECURITY] Error checking permissions:', error);
        return { error: 'Error verifying permissions', data: null };
      }
    }
    
    // Query Supabase for the functional requirements document
    console.log(`[SUPABASE FUNCTIONAL] Using ID=${functionalId} to query Supabase frd table`);
    
    // First try direct query using the ID
    console.log(`[SUPABASE FUNCTIONAL] Direct query using ID=${functionalId}`);
    const { data, error } = await supabase
      .from('frd')
      .select('*')
      .eq('id', functionalId)
      .single();
    
    if (error) {
      console.log(`[SUPABASE FUNCTIONAL] Error with direct ID query: ${error.message}`);
      
      // Try fallback query using ID as project_id
      console.log(`[SUPABASE FUNCTIONAL] Trying fallback with project_id=${functionalId}`);
      const fallbackResponse = await supabase
        .from('frd')
        .select('*')
        .eq('project_id', functionalId)
        .single();
      
      if (fallbackResponse.error) {
        console.log(`[SUPABASE FUNCTIONAL] Fallback query also failed: ${fallbackResponse.error.message}`);
        
        // Try the legacy table as a last resort
        console.log(`[SUPABASE FUNCTIONAL] Trying legacy 'functional_requirements' table`);
        const legacyResponse = await supabase
          .from('functional_requirements')
          .select('*')
          .eq('id', functionalId)
          .single();
          
        if (legacyResponse.error) {
          console.log(`[SUPABASE FUNCTIONAL] Legacy table query failed: ${legacyResponse.error.message}`);
          return { error: 'Document not found in Supabase', data: null };
        }
        
        if (legacyResponse.data) {
          console.log(`[SUPABASE FUNCTIONAL] ✓ Found record in legacy table`);
          console.log(`[SUPABASE FUNCTIONAL] Available fields: ${Object.keys(legacyResponse.data).join(', ')}`);
          
          // Find the HTML content in the appropriate field
          const htmlContent = legacyResponse.data.functional_html || 
                              legacyResponse.data.html || 
                              null;
          
          if (htmlContent) {
            console.log(`[SUPABASE FUNCTIONAL] ✓ Found HTML content with ${htmlContent.length} characters`);
          } else {
            console.log(`[SUPABASE FUNCTIONAL] No HTML content found in standard fields`);
          }
          
          return {
            source: 'supabase',
            data: {
              ...legacyResponse.data,
              html: htmlContent
            }
          };
        }
        
        return { error: 'Document not found in Supabase', data: null };
      }
      
      if (fallbackResponse.data) {
        console.log(`[SUPABASE FUNCTIONAL] ✓ Found record via project_id lookup`);
        console.log(`[SUPABASE FUNCTIONAL] Available fields: ${Object.keys(fallbackResponse.data).join(', ')}`);
        
        // Find the HTML content in the appropriate field
        const htmlContent = fallbackResponse.data.frd_html || 
                           fallbackResponse.data.html || 
                           fallbackResponse.data.functional_html || 
                           null;
        
        if (htmlContent) {
          console.log(`[SUPABASE FUNCTIONAL] ✓ Found HTML content with ${htmlContent.length} characters`);
        } else {
          console.log(`[SUPABASE FUNCTIONAL] No HTML content found in standard fields`);
        }
        
        return {
          source: 'supabase',
          data: {
            ...fallbackResponse.data,
            html: htmlContent
          }
        };
      }
    }
    
    // We have data from the direct query
    if (data) {
      console.log(`[SUPABASE FUNCTIONAL] ✓ Success! Found record with ID=${functionalId}`);
      console.log(`[SUPABASE FUNCTIONAL] Available fields: ${Object.keys(data).join(', ')}`);
      
      // Check for HTML content in various fields
      const htmlContent = data.frd_html || 
                          data.html || 
                          data.functional_html || 
                          null;
      
      if (htmlContent) {
        console.log(`[SUPABASE FUNCTIONAL] ✓ Found HTML content with ${htmlContent.length} characters`);
        console.log(`[SUPABASE FUNCTIONAL] HTML preview: ${htmlContent.substring(0, 100)}...`);
      } else {
        // Scan for possible HTML content in any string field
        console.log(`[SUPABASE FUNCTIONAL] No HTML content found in standard fields, scanning all fields...`);
        
        for (const [key, value] of Object.entries(data)) {
          if (typeof value === 'string' && 
              (value.includes('<html') || 
               value.includes('<!DOCTYPE') || 
               value.includes('<div') || 
               value.includes('<p>'))) {
            console.log(`[SUPABASE FUNCTIONAL] ✓ Found potential HTML content in field '${key}'`);
            return {
              source: 'supabase',
              data: {
                ...data,
                html: value
              }
            };
          }
        }
        
        console.log(`[SUPABASE FUNCTIONAL] No HTML content found in any field`);
      }
      
      return {
        source: 'supabase',
        data: {
          ...data,
          html: htmlContent
        } 
      };
    }
    
    return { 
      source: 'supabase',
      error: 'Document not found in Supabase', 
      data: null 
    };
  } catch (error) {
    console.error(`[SUPABASE FUNCTIONAL] Unexpected error:`, error);
    return { 
      source: 'supabase',
      error: 'Error fetching functional requirements data', 
      data: null 
    };
  }
}

/**
 * Fetch Business Requirements data from Supabase
 * @param brdId The external ID of the BRD document in Supabase
 * @param ideaId The ID of the idea
 * @param requestingUserId Optional user ID for security validation
 */
export async function fetchBusinessRequirements(brdId: string, ideaId: number, requestingUserId?: number) {
  try {
    console.log(`[SUPABASE BRD] START: Fetching BRD ID ${brdId} for idea ${ideaId}`);
    
    // Security check: If requesting user ID is provided, verify ownership
    if (requestingUserId !== undefined) {
      try {
        // Verify user has permission to access this idea
        const { pool } = await import('./db');
        const result = await pool.query('SELECT user_id FROM ideas WHERE id = $1', [ideaId]);
        
        if (result.rows.length === 0) {
          console.log(`[SECURITY] Idea ${ideaId} not found in security check for BRD access`);
          return null;
        }
        
        const ownerId = parseInt(result.rows[0].user_id);
        if (ownerId !== requestingUserId) {
          console.log(`[SECURITY] Unauthorized: User ${requestingUserId} attempting to access BRD for idea ${ideaId} owned by user ${ownerId}`);
          return null;
        }
        
        console.log(`[SECURITY] Authorized: User ${requestingUserId} accessing BRD for idea ${ideaId}`);
      } catch (dbError) {
        console.error(`[SUPABASE BRD] Error fetching stored BRD ID from database:`, dbError);
        return null;
      }
    }
    
    console.log(`[SUPABASE BRD] Using ID=${brdId} to query Supabase BRD table`);
    
    // We'll make a direct attempt first for the BRD document
    try {
      console.log(`[SUPABASE BRD] Direct query using ID=${brdId}`);
      const { data, error } = await supabase
        .from('brd')
        .select('*')
        .eq('id', brdId)
        .single();
      
      // If we get a direct match by ID, use it immediately
      if (!error && data) {
        console.log(`[SUPABASE BRD] ✓ Success! Found record directly with ID=${brdId}`);
        console.log(`[SUPABASE BRD] Available fields: ${Object.keys(data).join(', ')}`);
        
        // Find HTML content in the response, prioritizing brd_html field
        const htmlContent = data.brd_html || data.html || null;
        
        if (htmlContent) {
          console.log(`[SUPABASE BRD] ✓ Found HTML content with ${htmlContent.length} characters`);
          
          // Make sure to copy the HTML content to the html field
          return {
            source: 'supabase',
            data: {
              ...data,
              html: htmlContent,
              // Ensure the HTML field is populated with the found content
              brd_html: data.brd_html || null
            }
          };
        } else {
          console.log(`[SUPABASE BRD] ⚠️ No direct HTML content found, checking all string fields...`);
          
          // Search all fields for HTML content
          for (const [key, value] of Object.entries(data)) {
            if (typeof value === 'string' && 
                (value.includes('<html') || 
                 value.includes('<!DOCTYPE') || 
                 value.includes('<div') || 
                 value.includes('<p>'))) {
              
              console.log(`[SUPABASE BRD] ✓ Found HTML content in field '${key}' (${value.length} chars)`);
              
              return {
                source: 'supabase',
                data: {
                  ...data,
                  html: value,
                  brd_html: value
                }
              };
            }
          }
          
          // Return the data even without HTML content
          console.log(`[SUPABASE BRD] ⚠️ No HTML content found in any field`);
          return {
            source: 'supabase',
            data: {
              ...data,
              html: null,
              brd_html: null
            }
          };
        }
      }
      
      if (error) {
        console.log(`[SUPABASE BRD] Error querying BRD by ID '${brdId}': ${error.message}`);
      }
      
      // If direct ID lookup fails, try project_id field
      console.log(`[SUPABASE BRD] Trying project_id lookup with ID=${brdId}`);
      const { data: projectData, error: projectError } = await supabase
        .from('brd')
        .select('*')
        .eq('project_id', brdId)
        .single();
        
      if (!projectError && projectData) {
        console.log(`[SUPABASE BRD] ✓ Success! Found record by project_id=${brdId}`);
        console.log(`[SUPABASE BRD] Available fields: ${Object.keys(projectData).join(', ')}`);
        
        // Find HTML content in the response
        const htmlContent = projectData.brd_html || projectData.html || null;
        
        if (htmlContent) {
          console.log(`[SUPABASE BRD] ✓ Found HTML content with ${htmlContent.length} characters`);
          
          return {
            source: 'supabase',
            data: {
              ...projectData,
              html: htmlContent
            }
          };
        } else {
          // Search all fields for HTML content as a last resort
          for (const [key, value] of Object.entries(projectData)) {
            if (typeof value === 'string' && 
                (value.includes('<html') || 
                 value.includes('<!DOCTYPE') || 
                 value.includes('<div') || 
                 value.includes('<p>'))) {
              
              console.log(`[SUPABASE BRD] ✓ Found HTML content in field '${key}' (${value.length} chars)`);
              
              return {
                source: 'supabase',
                data: {
                  ...projectData,
                  html: value
                }
              };
            }
          }
          
          // Return the data even without HTML content
          console.log(`[SUPABASE BRD] ⚠️ No HTML content found in any field`);
          return {
            source: 'supabase',
            data: {
              ...projectData,
              html: null
            }
          };
        }
      }
      
      // If all lookups fail, return error
      console.log(`[SUPABASE BRD] Failed to find BRD document with ID=${brdId} in any field`);
      return {
        source: 'supabase',
        error: `No BRD document found with ID ${brdId}`,
        data: null
      };
      
    } catch (error) {
      console.error(`[SUPABASE BRD] Error fetching BRD data:`, error);
      return {
        source: 'supabase',
        error: `Error fetching BRD data: ${error.message}`,
        data: null
      };
    }
  } catch (error) {
    console.error('Error in fetchBusinessRequirements:', error);
    return {
      source: 'supabase',
      error: `Unexpected error: ${error.message}`,
      data: null
    };
  }
}

function mapSupabaseData(data: any, ideaId: number, projectId: string) {
  return {
    id: ideaId,
    ideaId: ideaId,
    projectId: projectId,
    problem: data.problem_statement || data.problem || null,
    customerSegments: data.customer_segments || data.customers || null,
    uniqueValueProposition: data.unique_value_proposition || data.uvp || data.value_proposition || null,
    solution: data.solution || null,
    channels: data.channels || null,
    revenueStreams: data.revenue_streams || data.revenue || null,
    costStructure: data.cost_structure || data.costs || null,
    keyMetrics: data.key_metrics || data.metrics || null,
    unfairAdvantage: data.unfair_advantage || data.advantage || null,
    createdAt: data.created_at || new Date(),
    updatedAt: data.updated_at || new Date(),
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
      throw new Error('Unauthorized access: You can only view your own ideas');
    }
    
    console.log(`Fetching ideas for user ${userId} from Supabase`);
    
    // Try to query the projects table first (newer structure)
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
