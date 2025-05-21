# Functional Requirements Implementation Guide

This document combines our learnings from implementing the Functional Requirements tab in the Anvil of Ideas platform, providing a comprehensive guide for implementing document tabs with external data integration.

## Key Insights from Functional Requirements Implementation

The Functional Requirements document type presented unique challenges that required special handling:

1. **HTML Content Priority**: Always check for HTML content in the local document first and prioritize displaying it when available.
2. **Status Verification**: Ensure the document status is set to "Completed" when HTML content exists, even if the status field indicates otherwise.
3. **Multi-Source Fallback**: Implement multiple fallback mechanisms to retrieve HTML content from various sources in the Supabase database.
4. **Aggressive Synchronization**: Keep local database in sync with Supabase data to ensure the most up-to-date content is always available.
5. **Resilient Error Handling**: Implement error handling that still allows content to display when available, even if update operations fail.

## Standard Document Tab Implementation

### Database Structure

The document data is stored in the `projectDocuments` table with this structure:

```typescript
export const projectDocuments = pgTable("project_documents", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  ideaId: integer("idea_id").notNull().references(() => ideas.id, { onDelete: "cascade" }),
  documentType: text("document_type").notNull(),
  status: text("status", { enum: projectStatuses }).notNull().default("Draft"),
  generationStartedAt: timestamp("generation_started_at", { mode: 'date' }),
  html: text("html"),
  content: text("content"),
  externalId: text("external_id"),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: 'date' }).notNull().defaultNow(),
});
```

### N8N Integration

The platform uses n8n for document generation, configured through environment variables:

```
N8N_WEBHOOK_URL=...              # For Lean Canvas
N8N_PRD_WEBHOOK_URL=...          # For Project Requirements
N8N_BRD_WEBHOOK_URL=...          # For Business Requirements
N8N_FUNCTIONAL_WEBHOOK_URL=...   # For Functional Requirements
N8N_AUTH_USERNAME=...            # For webhook authentication
N8N_AUTH_PASSWORD=...
```

### Document Generation Flow

1. **Initiation**: User clicks "Generate" button, triggering a POST request to create a document
2. **Creation**: Document record is created with status="Generating" and current timestamp
3. **Webhook Call**: N8N webhook is called with project data and returns an external ID
4. **Polling**: Client-side polling checks document status every 10 seconds
5. **Completion**: When content is found in Supabase, status is updated to "Completed"

## Implementing Robust Content Fetching

The Functional Requirements implementation revealed the need for a more resilient approach to content fetching:

```typescript
// Fetch the document from local database
const fetchDocument = async () => {
  try {
    setIsLoading(true);
    
    const response = await fetch(`/api/ideas/${ideaId}/documents/${documentType}`);
    if (response.ok) {
      const data = await response.json();
      
      // If we have HTML content in the local document, always show it first
      if (data.html) {
        console.log(`Found HTML content in local document (${data.html.length} characters)`);
        
        // If document has HTML but status isn't completed, fix it
        if (data.status !== 'Completed') {
          try {
            console.log('Fixing document status to Completed since HTML content exists');
            await fetch(`/api/ideas/${ideaId}/documents/${documentType}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'Completed' })
            });
            
            // Update local data with the corrected status
            data.status = 'Completed';
          } catch (updateError) {
            console.error('Error updating document status:', updateError);
            // Continue with existing data even if update fails
          }
        }
        
        // Update UI state to show the document is completed
        setDocument(data);
        setDocumentGenerating(false);
        setDocumentTimedOut(false);
        setIsLoading(false);
        return; // Exit early since we have HTML content
      }
      
      // Continue with normal flow if no HTML content in local document
      setDocument(data);
      
      // Check if document is currently generating
      if (data && data.status === 'Generating') {
        setDocumentGenerating(true);
        
        // Check if generation has timed out (2 minutes or more since started)
        if (data.generationStartedAt) {
          const startedAt = new Date(data.generationStartedAt);
          const now = new Date();
          const diffMinutes = (now.getTime() - startedAt.getTime()) / (1000 * 60);
          
          if (diffMinutes >= 2) {
            console.log(`Document generation timed out (started ${diffMinutes.toFixed(1)} minutes ago)`);
            setDocumentTimedOut(true);
          } else {
            setDocumentTimedOut(false);
            console.log(`Document generation in progress (started ${diffMinutes.toFixed(1)} minutes ago)`);
          }
        }
      } else {
        setDocumentGenerating(false);
        setDocumentTimedOut(false);
      }
      
      // Always check Supabase for the latest content regardless of status
      if (data.externalId) {
        try {
          // Fetch from Supabase
          const supabaseResponse = await fetch(`/api/supabase/${documentTypeEndpoint}/${ideaId}`);
          
          if (supabaseResponse.ok) {
            const supabaseData = await supabaseResponse.json();
            let htmlContent = null;
            
            // Check for HTML content in standard field
            if (supabaseData.data && supabaseData.data.html) {
              htmlContent = supabaseData.data.html;
            } 
            // Check for HTML content in document-specific fields
            else if (supabaseData.data) {
              // Try known field variations
              const possibleFields = [
                `${documentType.toLowerCase()}_html`, 
                `${documentType.toLowerCase()}Html`,
                'html_content',
                'content_html'
              ];
              
              // Check each possible field
              for (const field of possibleFields) {
                if (supabaseData.data[field]) {
                  htmlContent = supabaseData.data[field];
                  break;
                }
              }
              
              // Last resort: check all fields for HTML-like content
              if (!htmlContent) {
                for (const [key, value] of Object.entries(supabaseData.data)) {
                  if (typeof value === 'string' && 
                     (value.includes('<html') || 
                      value.includes('<!DOCTYPE') || 
                      value.includes('<div') || 
                      value.includes('<p>'))) {
                    htmlContent = value;
                    break;
                  }
                }
              }
            }
            
            // If HTML content found, update local document
            if (htmlContent) {
              try {
                await fetch(`/api/ideas/${ideaId}/documents/${data.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    html: htmlContent,
                    status: "Completed"
                  })
                });
                
                // Update the document in state
                setDocument({
                  ...data,
                  html: htmlContent,
                  status: "Completed"
                });
                setDocumentGenerating(false);
                setDocumentTimedOut(false);
              } catch (updateError) {
                console.error('Error updating document with HTML:', updateError);
                
                // Even if update fails, still update UI state with HTML
                setDocument({
                  ...data,
                  html: htmlContent,
                  status: "Completed"
                });
                setDocumentGenerating(false);
                setDocumentTimedOut(false);
              }
            }
          }
        } catch (supabaseError) {
          console.error(`Error fetching from Supabase:`, supabaseError);
        }
      }
    } else {
      // No document exists yet
      setDocument(null);
      setDocumentGenerating(false);
      setDocumentTimedOut(false);
    }
  } catch (error) {
    console.error(`Error fetching ${documentType}:`, error);
    toast({
      title: "Error",
      description: `Failed to load ${documentType}`,
      variant: "destructive",
    });
  } finally {
    setIsLoading(false);
  }
};
```

## Handling Document Timeouts

When a document generation process times out (takes longer than 2 minutes), display a standardized timeout component:

```jsx
{documentTimedOut && (
  <div className="border border-destructive rounded-md p-6 mb-4 bg-destructive/10">
    <div className="flex items-start space-x-4">
      <div className="mt-1">
        <AlertTriangle className="h-6 w-6 text-destructive" />
      </div>
      <div className="flex-1">
        <h4 className="font-bold text-destructive mb-2">Generation Timed Out</h4>
        <p className="text-neutral-700 mb-4">
          The {documentType} document generation is taking longer than expected. 
          This could be due to high system load or complexity of your project.
        </p>
        <div className="flex items-center space-x-3">
          <Button 
            onClick={handleRegenerateClick}
            disabled={isGenerating}
            className="bg-gradient-to-r from-amber-500 to-amber-700 hover:from-amber-600 hover:to-amber-800"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Retrying...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry Generation
              </>
            )}
          </Button>
          <Button 
            variant="outline" 
            onClick={checkStatus}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Check Status
          </Button>
        </div>
      </div>
    </div>
  </div>
)}
```

## Content Display Pattern

For document content display, use the following pattern:

```jsx
{document?.html ? (
  <div 
    className="prose prose-neutral max-w-none"
    dangerouslySetInnerHTML={{ __html: document.html }}
  />
) : (
  <div className="text-center py-12">
    <SpinnerIcon className="h-8 w-8 mx-auto text-primary animate-spin" />
    <p className="mt-2 text-neutral-500">Loading document content...</p>
  </div>
)}
```

## Regeneration Pattern

When implementing document regeneration functionality, follow this pattern to ensure proper cleanup:

```typescript
// Handle regeneration of a document
const handleRegenerateClick = async () => {
  // First confirm with the user
  const confirmed = window.confirm(
    `Are you sure you want to regenerate the ${documentType} document? This will delete the current version.`
  );
  
  if (!confirmed) return;
  
  try {
    setIsGenerating(true);
    
    // Step 1: Delete the existing document
    const deleteResponse = await fetch(`/api/ideas/${ideaId}/documents/${documentType}`, {
      method: 'DELETE'
    });
    
    if (!deleteResponse.ok) {
      throw new Error(`Failed to delete existing ${documentType}`);
    }
    
    // Step 2: Reset UI state
    setDocument(null);
    setDocumentGenerating(false);
    setDocumentTimedOut(false);
    
    // Step 3: Notify user
    toast({
      title: "Document deleted",
      description: `The ${documentType} has been deleted and is ready for regeneration.`,
      duration: 3000
    });
    
    // Note: We don't automatically regenerate - wait for user to click Generate again
  } catch (error) {
    console.error(`Error regenerating ${documentType}:`, error);
    toast({
      title: "Error",
      description: `Failed to regenerate ${documentType}`,
      variant: "destructive",
    });
  } finally {
    setIsGenerating(false);
  }
};
```

## Best Practices

1. **Always Check Local HTML First**: Prioritize displaying HTML content from the local database first before making additional API calls.

2. **Status Consistency**: Ensure document status is always "Completed" when HTML content exists, automatically correcting inconsistencies.

3. **Multiple Fallbacks**: Implement fallback mechanisms to find HTML content in various fields and formats.

4. **Resilient UI Updates**: Even if database updates fail, make sure the UI displays the available content to the user.

5. **Clear Timeout Handling**: Use a standard timeout threshold (2 minutes) and provide consistent UI for timeout scenarios.

6. **Intentional Regeneration**: For regeneration, always delete the existing document first, then allow the user to explicitly initiate the new generation.

7. **Debug Logging**: Include comprehensive logging, particularly for external service interactions, to aid troubleshooting.

## Common Issues and Solutions

Based on our experience with the Functional Requirements implementation, here are some common issues and their solutions:

1. **Status/Content Mismatch**: Document has HTML content but status is not "Completed"
   - Solution: Check for HTML content first and update status if needed

2. **Field Name Inconsistency**: HTML content is stored in different field names in Supabase tables
   - Solution: Check multiple possible field names and implement a fallback mechanism

3. **Timing Issues**: Content exists in Supabase but hasn't been synced to local database
   - Solution: Implement aggressive synchronization with Supabase on each tab view

4. **Timeout UI Inconsistency**: Different document types show different timeout UIs
   - Solution: Standardize the timeout component across all document types

5. **Failed Updates**: Database updates fail but UI should still display content
   - Solution: Update UI state even if database updates fail

By following these patterns and best practices, we can ensure a consistent and reliable experience for users across all document types in the Anvil of Ideas platform.