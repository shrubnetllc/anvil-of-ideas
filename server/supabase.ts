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

        const ownerId = Number(securityCheck.rows[0].user_id);
        if (ownerId !== Number(requestingUserId)) {
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

        const ownerId = Number(securityCheck.rows[0].user_id);
        if (ownerId !== Number(requestingUserId)) {
          console.log(`[SECURITY VIOLATION] User ${requestingUserId} attempted to access idea ${ideaId} owned by user ${ownerId}`);
          return null;
        }

        console.log(`[SECURITY] Authorized: User ${requestingUserId} owns idea ${ideaId}`);
      } catch (securityError) {
        console.error(`[SECURITY] Error during ownership verification:`, securityError);
        return null;
      }
    }

    // Step 1: Get the project_id from our local database
    let projectId = null;
    try {
      // Use raw SQL query to reference project_id
      const { pool } = await import('./db');
      const result = await pool.query('SELECT project_id FROM lean_canvas WHERE idea_id = $1', [ideaId]);

      if (result.rows.length > 0) {
        projectId = result.rows[0].project_id;
        console.log(`Found project_id ${projectId} for idea ${ideaId} in local database`);
      } else {
        console.log(`No project_id found for idea ${ideaId} in local database`);
      }
    } catch (dbError) {
      console.warn('Error querying local database for IDs:', dbError);
    }

    // Step 2: Query Supabase using idea_id (User requested to use idea_id/id)
    // We try querying using the idea_id against 'project_id' or 'id' columns in Supabase
    // as the schemas are unified.
    try {
      console.log(`Querying Supabase with idea_id=${ideaId}`);

      // Try querying by idea_id first (assuming column exists as requested)
      const { data: ideaData, error: ideaError } = await supabase
        .from('lean_canvas')
        .select('*')
        .eq('idea_id', ideaId) // Try direct mapping first
        .single();

      if (!ideaError && ideaData) {
        console.log(`Supabase returned data for exact idea_id match: ${ideaId}`);
        return mapSupabaseData(ideaData, ideaId, ideaData.project_id || projectId);
      }

      // Fallback: Query using project_id if we have it locally
      if (projectId) {
        console.log(`Querying Supabase with project_id=${projectId}`);
        const { data: projectData, error: projectError } = await supabase
          .from('lean_canvas')
          .select('*')
          .eq('project_id', projectId)
          .single();

        if (!projectError && projectData) {
          console.log(`Supabase returned data for project_id match: ${projectId}`);
          return mapSupabaseData(projectData, ideaId, projectId);
        }
      }
    } catch (supabaseError) {
      console.warn('Error querying Supabase:', supabaseError);
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
/**
 * Fetch Functional Requirements data from Supabase
 * @param functionalId The external ID of the functional requirements document in Supabase
 * @param ideaId The ID of the idea
 * @param requestingUserId Optional user ID for security validation
 */
export async function fetchFunctionalRequirements(functionalId: string, ideaId: number, requestingUserId?: number) {
  try {
    console.log(`[SUPABASE FUNCTIONAL] START: Fetching Functional Requirements ID ${functionalId} for idea ${ideaId}`);

    // Check if functionalId is valid
    if (!functionalId || functionalId === 'null' || functionalId === 'undefined') {
      console.warn(`[SUPABASE FUNCTIONAL] Invalid FRD ID provided: ${functionalId}`);

      // Try to fetch it from our database
      try {
        const { pool } = await import('./db');
        const docQuery = await pool.query(
          'SELECT external_id FROM project_documents WHERE idea_id = $1 AND document_type = $2',
          [ideaId, 'FunctionalRequirements']
        );

        if (docQuery.rows.length > 0 && docQuery.rows[0].external_id) {
          functionalId = docQuery.rows[0].external_id;
          console.log(`[SUPABASE FUNCTIONAL] Found stored FRD ID in database: ${functionalId}`);
        }
      } catch (dbError) {
        console.error(`[SUPABASE FUNCTIONAL] Error fetching stored FRD ID:`, dbError);
      }
    }

    // Security check: If requesting user ID is provided, verify ownership
    if (requestingUserId !== undefined) {
      try {
        const { pool } = await import('./db');
        const securityCheck = await pool.query('SELECT user_id FROM ideas WHERE id = $1', [ideaId]);

        if (securityCheck.rows.length === 0) {
          console.log(`[SECURITY] Idea ${ideaId} not found in security check`);
          return { error: 'Unauthorized access', data: null };
        }

        const ownerId = Number(securityCheck.rows[0].user_id);
        if (ownerId !== Number(requestingUserId)) {
          console.log(`[SECURITY VIOLATION] User ${requestingUserId} attempted to access idea ${ideaId} owned by user ${ownerId}`);
          return { error: 'Unauthorized access', data: null };
        }

        console.log(`[SECURITY] Authorized: User ${requestingUserId} accessing Functional Requirements for idea ${ideaId}`);
      } catch (error) {
        console.error('[SECURITY] Error checking permissions:', error);
        return { error: 'Error verifying permissions', data: null };
      }
    }

    // Query Supabase for the functional requirements document
    console.log(`[SUPABASE FUNCTIONAL] Using ID=${functionalId} to query Supabase Functional Requirements table`);

    // First try direct query using the ID from the 'frd' table (correct table for functional requirements)
    console.log(`[SUPABASE FUNCTIONAL] Direct query using ID=${functionalId} in frd table`);
    const { data, error } = await supabase
      .from('frd')
      .select('*')
      .eq('id', functionalId)
      .single();

    if (error) {
      console.log(`[SUPABASE FUNCTIONAL] Error with direct ID query in frd table: ${error.message}`);

      // Try fallback query using ID as project_id in frd table
      console.log(`[SUPABASE FUNCTIONAL] Trying fallback with project_id=${functionalId} in frd table`);
      const fallbackResponse = await supabase
        .from('frd')
        .select('*')
        .eq('project_id', functionalId)
        .single();

      if (fallbackResponse.error) {
        console.log(`[SUPABASE FUNCTIONAL] Fallback query failed: ${fallbackResponse.error.message}`);

        // Try the original 'functional_requirements' table as last resort
        console.log(`[SUPABASE FUNCTIONAL] Trying original functional_requirements table with ID=${functionalId}`);
        const originalTableResponse = await supabase
          .from('functional_requirements')
          .select('*')
          .eq('id', functionalId)
          .order('created_at', { ascending: false })
          .limit(1);

        if (originalTableResponse.error) {
          console.log(`[SUPABASE FUNCTIONAL] Original table query failed: ${originalTableResponse.error.message}`);
        } else if (originalTableResponse.data && originalTableResponse.data.length > 0) {
          const frData = originalTableResponse.data[0];
          console.log(`[SUPABASE FUNCTIONAL] ✓ Success! Found record in original table`);

          const originalHtmlContent = frData.html || frData.func_html || null;
          return {
            source: 'supabase',
            error: null,
            data: { ...frData, html: originalHtmlContent }
          };
        }
      } else if (fallbackResponse.data && fallbackResponse.data.length > 0) {
        const frData = fallbackResponse.data[0];
        console.log(`[SUPABASE FUNCTIONAL] ✓ Success! Found record in frd table with project_id=${functionalId}`);
        const htmlContent = frData.frd_html || frData.html || null;
        return {
          source: 'supabase',
          error: null,
          data: { ...frData, html: htmlContent }
        };
      }
    }

    if (data && data.length > 0) {
      const frData = data[0];
      console.log(`[SUPABASE FUNCTIONAL] ✓ Success! Found record directly in frd table`);
      const htmlContent = frData.frd_html || frData.html || frData.func_html || null;
      return {
        source: 'supabase',
        error: null,
        data: { ...frData, html: htmlContent }
      };
    }

    // Last resort: find by project_id or prd_id
    try {
      console.log(`[SUPABASE FUNCTIONAL] Last resort: Trying to find matching FRD for idea ${ideaId}`);
      const { pool } = await import('./db');

      const projectQuery = await pool.query(
        'SELECT project_id FROM lean_canvas WHERE idea_id = $1',
        [ideaId]
      );

      const docQuery = await pool.query(
        'SELECT external_id FROM project_documents WHERE idea_id = $1 AND document_type = $2',
        [ideaId, 'ProjectRequirements']
      );

      let pId = projectQuery.rows.length > 0 ? projectQuery.rows[0].project_id : null;
      let prdId = docQuery.rows.length > 0 ? docQuery.rows[0].external_id : null;

      console.log(`[SUPABASE FUNCTIONAL] Fallback identifiers: project_id=${pId || 'none'}, prd_id=${prdId || 'none'}`);

      if (pId) {
        const { data, error } = await supabase
          .from('frd')
          .select('*')
          .eq('project_id', pId)
          .single();

        if (!error && data) {
          console.log(`[SUPABASE FUNCTIONAL] ✓ Success! Found FRD by project_id=${pId}`);
          return { source: 'supabase', error: null, data: { ...data, html: data.frd_html || data.html || '' } };
        }
      }

      if (prdId) {
        console.log(`[SUPABASE FUNCTIONAL] Trying fallback by prd_id=${prdId}`);
        const { data, error } = await supabase
          .from('frd')
          .select('*')
          .eq('prd_id', prdId)
          .single();

        if (!error && data) {
          console.log(`[SUPABASE FUNCTIONAL] ✓ Success! Found FRD by prd_id=${prdId}`);
          return { source: 'supabase', error: null, data: { ...data, html: data.frd_html || data.html || '' } };
        }
      }
    } catch (broadError) {
      console.error(`[SUPABASE FUNCTIONAL] Error in broad search:`, broadError);
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

export async function fetchBusinessRequirements(brdId: string, ideaId: number, requestingUserId?: number) {
  try {
    console.log(`[SUPABASE BRD] START: Fetching BRD ID ${brdId} for idea ${ideaId}`);

    // Security check: Verify the requesting user owns the idea
    if (requestingUserId !== undefined) {
      try {
        const { pool } = await import('./db');
        const securityCheck = await pool.query('SELECT user_id FROM ideas WHERE id = $1', [ideaId]);

        if (securityCheck.rows.length === 0) {
          console.log(`[SECURITY] Idea ${ideaId} not found in security check`);
          return null;
        }

        const ownerId = Number(securityCheck.rows[0].user_id);
        if (ownerId !== Number(requestingUserId)) {
          console.log(`[SECURITY VIOLATION] User ${requestingUserId} attempted to access idea ${ideaId} owned by user ${ownerId}`);
          return null;
        }

        console.log(`[SECURITY] Authorized: User ${requestingUserId} accessing BRD for idea ${ideaId}`);
      } catch (securityError) {
        console.error(`[SECURITY] Error during ownership verification:`, securityError);
        return null;
      }
    }

    // Check if brdId is valid
    if (!brdId || brdId === 'null' || brdId === 'undefined') {
      console.warn(`[SUPABASE BRD] Invalid BRD ID provided: ${brdId}`);

      // Try to fetch the BRD ID from the document in our database
      try {
        const { pool } = await import('./db');
        const docQuery = await pool.query(
          'SELECT external_id FROM project_documents WHERE idea_id = $1 AND document_type = $2',
          [ideaId, 'BusinessRequirements']
        );

        if (docQuery.rows.length > 0 && docQuery.rows[0].external_id) {
          const storedBrdId = docQuery.rows[0].external_id;
          console.log(`[SUPABASE BRD] Found stored BRD ID in database: ${storedBrdId}`);
          brdId = storedBrdId;
        } else {
          console.warn(`[SUPABASE BRD] No stored BRD ID found for idea ${ideaId}, will attempt broad search`);
        }
      } catch (dbError) {
        console.error(`[SUPABASE BRD] Error fetching stored BRD ID from database:`, dbError);
      }
    }

    if (brdId && brdId !== 'null' && brdId !== 'undefined') {
      console.log(`[SUPABASE BRD] Using ID=${brdId} to query Supabase BRD table`);

      // We'll make a direct attempt first for the BRD document
      try {
        console.log(`[SUPABASE BRD] Direct query using ID=${brdId}`);
        const { data, error } = await supabase
          .from('brd')
          .select('*')
          .eq('id', brdId)
          .order('created_at', { ascending: false })
          .limit(1);

        // If we get a direct match by ID, use it immediately
        if (!error && data && data.length > 0) {
          const brData = data[0];
          console.log(`[SUPABASE BRD] ✓ Success! Found record directly with ID=${brdId}`);
          const htmlContent = brData.brd_html || brData.html || null;

          if (htmlContent) {
            console.log(`[SUPABASE BRD] ✓ Found HTML content with ${htmlContent.length} characters`);
            return {
              source: 'supabase',
              data: { ...brData, html: htmlContent }
            };
          }
        } else {
          console.log(`[SUPABASE BRD] Direct ID lookup failed: ${error?.message || 'No data returned'}`);
        }
      } catch (directError: any) {
        console.error(`[SUPABASE BRD] Exception during direct lookup:`, directError);
      }
    }

    // If direct lookup failed or no brdId provided, try alternative approaches
    console.log(`[SUPABASE BRD] Trying alternative lookup strategies...`);

    // Try queries with different field matches
    const fieldMatches = [
      { field: 'reference_id', name: 'reference_id' },
      { field: 'uuid', name: 'uuid' },
      { field: 'prd_id', name: 'prd_id' }
    ];

    if (brdId) {
      for (const match of fieldMatches) {
        try {
          console.log(`[SUPABASE BRD] Trying ${match.name}=${brdId}`);
          const { data, error } = await supabase
            .from('brd')
            .select('*')
            .eq(match.field, brdId)
            .single();

          if (!error && data) {
            console.log(`[SUPABASE BRD] ✓ Success! Found record with ${match.name}=${brdId}`);

            // Find HTML content in the response
            const htmlContent = data.brd_html || data.html || null;

            if (htmlContent) {
              return {
                source: 'supabase',
                data: {
                  ...data,
                  html: htmlContent,
                  brd_html: data.brd_html || null
                }
              };
            }
          }
        } catch (matchError) {
          console.log(`[SUPABASE BRD] Error with ${match.name} lookup:`, matchError);
        }
      }
    }
    // Last resort: find by project_id or prd_id
    try {
      console.log(`[SUPABASE BRD] Last resort: Trying to find matching BRD for idea ${ideaId}`);
      const { pool } = await import('./db');

      // Get both project_id and prd_id (from ProjectRequirements document)
      const projectQuery = await pool.query(
        'SELECT project_id FROM lean_canvas WHERE idea_id = $1',
        [ideaId]
      );

      const docQuery = await pool.query(
        'SELECT external_id FROM project_documents WHERE idea_id = $1 AND document_type = $2',
        [ideaId, 'ProjectRequirements']
      );

      let pId = projectQuery.rows.length > 0 ? projectQuery.rows[0].project_id : null;
      let prdId = docQuery.rows.length > 0 ? docQuery.rows[0].external_id : null;

      console.log(`[SUPABASE BRD] Fallback identifiers: project_id=${pId || 'none'}, prd_id=${prdId || 'none'}`);

      // Try by project_id first
      if (pId) {
        console.log(`[SUPABASE BRD] Trying fallback by project_id=${pId}`);
        const { data, error } = await supabase
          .from('brd')
          .select('*')
          .eq('project_id', pId)
          .order('created_at', { ascending: false })
          .limit(1);

        if (!error && data && data.length > 0) {
          const brData = data[0];
          console.log(`[SUPABASE BRD] ✓ Success! Found BRD by project_id=${pId}`);
          const htmlContent = brData.brd_html || brData.html;
          return {
            source: 'supabase',
            data: { ...brData, html: htmlContent || '' }
          };
        } else if (error) {
          console.log(`[SUPABASE BRD] Fallback by project_id failed: ${error.message}`);
        }
      }

      // Try by prd_id next
      if (prdId) {
        console.log(`[SUPABASE BRD] Trying fallback by prd_id=${prdId}`);
        const { data, error } = await supabase
          .from('brd')
          .select('*')
          .eq('prd_id', prdId)
          .order('created_at', { ascending: false })
          .limit(1);

        if (!error && data && data.length > 0) {
          const brData = data[0];
          console.log(`[SUPABASE BRD] ✓ Success! Found BRD by prd_id=${prdId}`);
          const htmlContent = brData.brd_html || brData.html;
          return {
            source: 'supabase',
            data: { ...brData, html: htmlContent || '' }
          };
        } else if (error) {
          console.log(`[SUPABASE BRD] Fallback by prd_id failed: ${error.message}`);
        }
      }
    } catch (broadError) {
      console.error(`[SUPABASE BRD] Error in broad search:`, broadError);
    }

    console.warn(`[SUPABASE BRD] ❌ No BRD data found in Supabase with any method`);
    return null;
  } catch (error) {
    console.error('[SUPABASE BRD] Unhandled error in fetchBusinessRequirements:', error);
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
