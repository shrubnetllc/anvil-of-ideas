  // Get a specific document by type
  app.get("/api/ideas/:id/documents/:type", isAuthenticated, async (req, res, next) => {
    try {
      const ideaId = parseInt(req.params.id);
      const documentType = req.params.type;
      
      // Check if the user has permission to access this idea
      const idea = await storage.getIdeaById(ideaId, req.user!.id);
      if (!idea) {
        return res.status(404).json({ message: "Idea not found or access denied" });
      }
      
      const document = await storage.getDocumentByType(ideaId, documentType);
      
      if (!document) {
        return res.status(200).json(null); // Return null instead of 404 to handle case where document doesn't exist yet
      }
      
      // Special handling for Project Requirements if they're in Generating state with an externalId
      if (documentType === "ProjectRequirements" && document.status === "Generating" && document.externalId) {
        try {
          // Check if we should fetch from Supabase
          if (document.generationStartedAt) {
            const generationStartTime = new Date(document.generationStartedAt).getTime();
            const now = Date.now();
            const secondsElapsed = (now - generationStartTime) / 1000;
            
            // Only check Supabase if enough time has passed since generation started
            if (secondsElapsed >= 10) {
              console.log(`Checking Supabase for Project Requirements ${document.externalId} (${secondsElapsed.toFixed(1)}s elapsed)`);
              
              // Import and fetch the PRD data from Supabase
              const { fetchProjectRequirements } = await import('./supabase');
              const prdData = await fetchProjectRequirements(document.externalId, ideaId, req.user!.id);
              
              if (prdData && prdData.projectReqHtml) {
                console.log(`Found HTML content for PRD ID ${document.externalId}`);
                
                // Update the document with the HTML from Supabase
                await storage.updateDocument(document.id, {
                  html: prdData.projectReqHtml,
                  status: "Completed",
                  updatedAt: new Date()
                });
                
                // Return the updated document with the HTML content
                const updatedDocument = await storage.getDocumentById(document.id);
                return res.status(200).json(updatedDocument);
              }
            }
          }
        } catch (supabaseError) {
          console.error(`Error fetching Project Requirements from Supabase:`, supabaseError);
          // Continue to return the document as is
        }
      }
      
      // Special handling for Business Requirements document with an externalId
      if (documentType === "BusinessRequirements" && document.externalId) {
        try {
          console.log(`BRD Handler: Checking Business Requirements document with externalId ${document.externalId}`);
          
          // If the document should be completed but is missing HTML, try to fetch it
          const shouldFetchContent = 
            (document.status === "Completed" && (!document.html || document.html.length === 0)) || 
            document.status === "Generating";
          
          if (shouldFetchContent) {
            console.log(`BRD Handler: Attempting direct Supabase lookup for BRD ID ${document.externalId}`);
            
            // Direct lookup using our known working method
            const { supabase } = await import('./supabase');
            const { data, error } = await supabase
              .from('brd')
              .select('*')
              .eq('id', document.externalId)
              .single();
            
            if (!error && data && data.brd_html) {
              console.log(`BRD Handler: Found HTML content (${data.brd_html.length} chars)`);
              
              // Update document with the retrieved HTML
              await storage.updateDocument(document.id, {
                html: data.brd_html,
                status: "Completed",
                updatedAt: new Date()
              });
              
              // Return the updated document
              const updatedDocument = await storage.getDocumentById(document.id);
              console.log(`BRD Handler: Returning updated document with HTML content`);
              return res.status(200).json(updatedDocument);
            } else {
              console.log(error ? 
                `BRD Handler: Supabase error: ${error.message}` : 
                `BRD Handler: No HTML content found in Supabase data`);
            }
          }
        } catch (brdError) {
          console.error(`Error fetching Business Requirements from Supabase:`, brdError);
          // Continue to return the document as is
        }
      }
      
      // Check if generation has timed out (2 minutes)
      if (document.status === "Generating" && document.generationStartedAt) {
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
        if (new Date(document.generationStartedAt) < twoMinutesAgo) {
          console.log(`${documentType} generation timed out for document ${document.id}`);
          // Still return the document as is - client will display retry button
        }
      }
      
      res.status(200).json(document);
    } catch (error) {
      console.error(`Error fetching ${req.params.type} document:`, error);
      next(error);
    }
  });