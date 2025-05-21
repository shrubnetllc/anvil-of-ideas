# Document Tab Implementation Standards

This document outlines the standardized approach for implementing new document tabs in the Anvil of Ideas platform. Following these guidelines ensures a consistent user experience across all document types.

## Tab Structure

Each document type should follow this tab implementation pattern:

1. Add a new tab to the main tab list
2. Create a card in the Documents overview tab
3. Implement the document tab content following the standard layout
4. Add necessary state variables and API endpoints

## Database Structure

### projectDocuments Table

The document data is stored in the `projectDocuments` table with the following key structure:

```typescript
// From shared/schema.ts
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

### Key Fields:

- **documentType**: Identifies the type of document (e.g., 'ProjectRequirements', 'BusinessRequirements', 'FunctionalRequirements')
- **status**: One of 'Draft', 'Generating', or 'Completed'
- **externalId**: References the ID in the external system (Supabase) where the full document content is stored
- **html**: Contains HTML content for immediate rendering (may be updated from Supabase later)
- **content**: Contains plain text/JSON content if not using HTML

## N8N Integration

The platform uses n8n for document generation, and each document type has its own webhook endpoint.

### Environment Configuration

For each document type, a corresponding webhook URL must be configured:

```
N8N_WEBHOOK_URL=...              # For Lean Canvas
N8N_PRD_WEBHOOK_URL=...          # For Project Requirements
N8N_BRD_WEBHOOK_URL=...          # For Business Requirements
N8N_FUNCTIONAL_WEBHOOK_URL=...   # For Functional Requirements
```

### Authentication

Authentication to n8n is handled through environment variables:

```
N8N_AUTH_USERNAME=...
N8N_AUTH_PASSWORD=...
```

The API calls include these credentials in the webhook calls.

### Webhook Request Payload

When generating a document, the following standard payload is sent to the n8n webhook:

```json
{
  "ideaId": 123,                       // The ID of the idea
  "documentId": 456,                   // The ID of the newly created document 
  "instructions": "Optional notes...",  // Any user-provided instruction notes
  "title": "Project Title"             // The title of the idea project
}
```

### Webhook Response

The n8n webhook should respond with a JSON object containing:

```json
{
  "id": "external-id-string",  // The ID to store as externalId in the database
  "status": "success"          // Confirmation that generation has started
}
```

This `id` field is stored in the `externalId` column of the document record and is used for retrieving the document content from Supabase later.

### Supabase Integration

For document types that store their content in Supabase:

1. The document is initially created in our local database with status "Generating"
2. The n8n webhook returns an external ID that links to the Supabase record
3. We store this external ID in our document record
4. We periodically check Supabase for content updates using the external ID
5. When content is found, we update our local record and set status to "Completed"

#### Database Lookup Structure

The external system uses different table structures for different document types:

- Lean Canvas: Stored in the `lean_canvas` table, referenced by `leancanvas_id`
- Business Requirements: Stored in the `business_requirements` table, referenced by `id`
- Project Requirements: Stored in the `project_requirements` table, referenced by `id`

For each document type, we need to implement a specific lookup function in the `server/supabase.ts` file.

### Implementing Supabase Content Retrieval

To implement the content retrieval for a new document type (e.g., Functional Requirements), follow this pattern in `server/supabase.ts`:

```typescript
/**
 * Fetch Functional Requirements data from Supabase
 * @param functionalId The external ID of the functional requirements document in Supabase
 * @param ideaId The ID of the idea
 * @param requestingUserId Optional user ID for security validation
 */
export async function fetchFunctionalRequirements(functionalId: string, ideaId: number, requestingUserId?: number) {
  try {
    console.log(`[SUPABASE FUNCTIONAL] START: Fetching Functional ID ${functionalId} for idea ${ideaId}`);
    
    // Security check
    if (requestingUserId) {
      const idea = await storage.getIdeaById(ideaId, requestingUserId);
      if (!idea) {
        console.log('[SECURITY] Not authorized: User does not own this idea');
        throw new Error('Not authorized to access this idea');
      } else {
        console.log(`[SECURITY] Authorized: User ${requestingUserId} accessing Functional Requirements for idea ${ideaId}`);
      }
    }
    
    // Query Supabase directly using the ID
    console.log(`[SUPABASE FUNCTIONAL] Using ID=${functionalId} to query Supabase functional_requirements table`);
    
    const { data, error } = await supabase
      .from('functional_requirements')  // Use the appropriate table name
      .select('*')
      .eq('id', functionalId)
      .single();
    
    if (error) {
      console.error('[SUPABASE FUNCTIONAL] Error:', error.message);
      throw new Error(`Failed to fetch functional requirements data: ${error.message}`);
    }
    
    if (!data) {
      console.error(`[SUPABASE FUNCTIONAL] No data found for ID=${functionalId}`);
      return { 
        source: 'supabase', 
        data: null,
        error: 'No functional requirements data found' 
      };
    }
    
    // Debug available fields
    console.log(`[SUPABASE FUNCTIONAL] Available fields: ${Object.keys(data).join(', ')}`);
    
    // Look for HTML content
    let html = null;
    
    // Check standard HTML fields
    if (data.html) {
      console.log(`[SUPABASE FUNCTIONAL] ✓ Found HTML content with ${data.html.length} characters`);
      html = data.html;
    } else if (data.functional_html) {
      console.log(`[SUPABASE FUNCTIONAL] ✓ Found HTML content in functional_html field with ${data.functional_html.length} characters`);
      html = data.functional_html;
    }
    
    // Return the data with HTML content added
    const responseData = {
      ...data,
      html: html
    };
    
    console.log(`✓ Successfully retrieved Functional Requirements data from Supabase with keys: ${Object.keys(responseData).join(', ')}`);
    
    if (html) {
      console.log(`✓ Functional Requirements data contains HTML content (${html.length} characters)`);
      console.log(`HTML preview: ${html.substring(0, 100)}...`);
    }
    
    return {
      source: 'supabase',
      data: responseData
    };
  } catch (error) {
    console.error('[SUPABASE FUNCTIONAL] Error:', error);
    return {
      source: 'supabase',
      error: error.message || 'Failed to fetch functional requirements data'
    };
  }
}
```

Then add a corresponding API endpoint in `server/routes.ts`:

```typescript
// API endpoint to fetch Functional Requirements content from Supabase
app.get('/api/supabase/functional-requirements/:ideaId', isAuthenticated, async (req, res) => {
  try {
    console.log(`==== FUNCTIONAL REQUIREMENTS API ACCESS ====`);
    const { ideaId } = req.params;
    const userId = req.user!.id;
    
    console.log(`User ${userId} is requesting Functional Requirements data for idea ${ideaId}`);
    
    // First check if we have the document in our database
    const document = await storage.getDocumentByType(parseInt(ideaId), 'FunctionalRequirements');
    
    if (!document || !document.externalId) {
      return res.status(404).json({ error: 'Functional Requirements document not found or has no external ID' });
    }
    
    console.log(`External ID provided in query: ${document.externalId}`);
    console.log(`✓ Document found with ID ${document.id}, status ${document.status}, externalId: ${document.externalId}`);
    
    // If document exists and has an external ID, fetch from Supabase
    console.log(`🔍 Using external ID ${document.externalId} to fetch Functional Requirements from Supabase`);
    
    const supabaseResponse = await fetchFunctionalRequirements(document.externalId, parseInt(ideaId), userId);
    
    if (supabaseResponse.error) {
      return res.status(500).json({ 
        error: `Failed to retrieve functional requirements data: ${supabaseResponse.error}` 
      });
    }
    
    // Update the document with the HTML content if it doesn't already have it
    if (supabaseResponse.data && supabaseResponse.data.html && (!document.html || document.status !== 'Completed')) {
      console.log(`✓ Updating document ${document.id} with HTML content from Supabase`);
      
      await storage.updateDocument(document.id, {
        html: supabaseResponse.data.html,
        status: 'Completed',
        updatedAt: new Date()
      });
    }
    
    res.json(supabaseResponse);
  } catch (error) {
    console.error('Error fetching functional requirements:', error);
    res.status(500).json({ error: 'Failed to fetch functional requirements data' });
  }
});

## Required State Variables

For each new document type (e.g., "FunctionalRequirements"), include these state variables:

```tsx
// State for <document_type>
const [<documentType>, set<DocumentType>] = useState<ProjectDocument | null>(null);
const [isLoading<DocumentType>, setIsLoading<DocumentType>] = useState(false);
const [isGenerating<DocumentType>, setIsGenerating<DocumentType>] = useState(false);
const [<documentType>Generating, set<DocumentType>Generating] = useState(false);
const [<documentType>TimedOut, set<DocumentType>TimedOut] = useState(false);
const [<documentType>Notes, set<DocumentType>Notes] = useState('');
```

## API Endpoints

Each document type needs these endpoints:

1. GET `/api/ideas/:ideaId/documents/<DocumentType>` - Retrieves document status and content
2. POST `/api/ideas/:ideaId/documents/<DocumentType>` - Creates/generates a new document
3. DELETE `/api/ideas/:ideaId/documents/<DocumentType>` - Deletes a document for regeneration
4. GET `/api/supabase/<document-type>/:ideaId` - Fetches content from Supabase if applicable

## Badge Styling

Use consistent badge styling across all document types:

```tsx
<Badge 
  variant={document.status === 'Completed' ? 'default' : 'outline'}
  className={document.status === 'Completed' ? 'bg-green-100 text-green-800 hover:bg-green-100' : 
              document.status === 'Generating' ? 'bg-amber-100 text-amber-800 hover:bg-amber-100' : ''}
>
  {document.status}
</Badge>
```

For documents that don't use the standard 'Draft'/'Generating'/'Completed' statuses:

```tsx
{document ? (
  <Badge 
    variant="default"
    className="bg-green-100 text-green-800 hover:bg-green-100"
  >
    Completed
  </Badge>
) : (
  <Badge variant="outline">Not Created</Badge>
)}
```

## Document Tab Header

All document tabs should use this header format without status badges:

```tsx
<div className="flex items-center justify-between mb-4">
  <h3 className="text-lg font-bold text-neutral-900">{Document Type} Document</h3>
  {!document && (
    <Button 
      size="sm" 
      variant="outline"
      onClick={handleGenerate<DocumentType>Click}
      disabled={isGenerating<DocumentType>}
    >
      <Icon className="mr-2 h-4 w-4" />
      Generate {Document Type}
    </Button>
  )}
</div>
```

## Document States

### Document Status Handling Pattern

When implementing document generation with external services (like n8n and Supabase), always follow this pattern to handle document status and timeouts:

#### API Endpoint Status Check Logic

```typescript
// API endpoint to fetch document content from Supabase
app.get('/api/supabase/<document-type>/:id', isAuthenticated, async (req, res, next) => {
  try {
    const { id: ideaId } = req.params;
    const userId = req.user!.id;
    
    // Get document from local database first
    const document = await storage.getDocumentByType(parseInt(ideaId), '<DocumentType>');
    
    if (!document || !document.externalId) {
      return res.status(404).json({ error: 'Document not found or has no external ID' });
    }
    
    // If document is stuck in "Generating" for too long, mark it as Completed
    const TWO_MINUTES = 2 * 60 * 1000; // 2 minutes in milliseconds
    if (document.status === 'Generating' && document.generationStartedAt) {
      const timeSinceStart = new Date().getTime() - document.generationStartedAt.getTime();
      
      if (timeSinceStart > TWO_MINUTES) {
        console.log(`⚠️ Document generation timed out, updating status to "Completed"`);
        try {
          await storage.updateDocument(document.id, {
            status: "Completed",
            updatedAt: new Date()
          });
          console.log(`✅ Successfully updated document status to "Completed" due to timeout`);
          // Update the local document object to reflect the change
          document.status = "Completed";
        } catch (err) {
          console.error(`❌ Failed to update document status: ${err.message}`);
        }
      }
    }
    
    // Fetch content from Supabase
    const supabaseResponse = await fetch<DocumentType>(document.externalId, parseInt(ideaId), userId);
    
    // Update document with HTML content if found
    if (supabaseResponse.data && supabaseResponse.data.html) {
      try {
        await storage.updateDocument(document.id, {
          html: supabaseResponse.data.html,
          status: 'Completed',
          updatedAt: new Date()
        });
      } catch (error) {
        console.error('Error updating document with HTML:', error);
      }
    }
    
    res.json(supabaseResponse);
  } catch (error) {
    next(error);
  }
});
```

#### Client-Side Status Check Pattern

When implementing the "Check Status" button for a document, use this pattern to ensure proper status updates:

```tsx
<Button 
  variant="outline"
  onClick={async () => {
    try {
      toast({
        title: "Checking status",
        description: "Refreshing the latest generation status",
        duration: 3000
      });
      
      // First, check with Supabase to get latest data and update local DB
      const supabaseResponse = await fetch(`/api/supabase/<document-type>/${ideaId}`);
      
      if (supabaseResponse.ok) {
        console.log('Successfully checked with Supabase');
      }
      
      // After Supabase check, get the updated document from local DB
      const refreshResponse = await fetch(`/api/ideas/${ideaId}/documents/<DocumentType>`);
      if (refreshResponse.ok) {
        const updatedDocument = await refreshResponse.json();
        set<DocumentType>(updatedDocument);
        
        // Update UI states based on document status
        if (updatedDocument.status === "Completed") {
          set<DocumentType>Generating(false);
          set<DocumentType>TimedOut(false);
          toast({
            title: "Status updated",
            description: "Document status has been updated to Completed",
            duration: 3000
          });
        } else if (updatedDocument.status === "Generating" && updatedDocument.generationStartedAt) {
          const startTime = new Date(updatedDocument.generationStartedAt);
          const currentTime = new Date();
          const elapsedTimeMinutes = (currentTime.getTime() - startTime.getTime()) / (1000 * 60);
          
          if (elapsedTimeMinutes > 2) {
            set<DocumentType>TimedOut(true);
          } else {
            set<DocumentType>TimedOut(false);
          }
        }
      }
    } catch (error) {
      console.error('Error checking status:', error);
      toast({
        title: "Error",
        description: "Failed to check status",
        variant: "destructive"
      });
    }
  }}
>
  <RotateCcw className="mr-2 h-4 w-4" />
  Check Status
</Button>
```

This pattern ensures that:
1. Documents don't get stuck indefinitely in "Generating" status
2. The UI properly updates after checking status
3. Users get clear feedback about the document state
4. Timeout handling is consistent across all document types

### 1. Loading State

```tsx
<div className="text-center py-8">
  <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
  <p>Loading {document type} document...</p>
</div>
```

### 2. Generating State

```tsx
<div className="text-center py-8">
  <div className="mb-4 mx-auto relative w-16 h-16">
    <div className="absolute inset-0 flex items-center justify-center animate-pulse">
      <Flame className="h-14 w-14 text-amber-400" />
    </div>
    <div className="absolute inset-0 flex items-center justify-center animate-spin">
      <Hammer className="h-10 w-10 text-primary" />
    </div>
  </div>
  <h4 className="text-lg font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-2">
    Forging Your {Document Type}
  </h4>
  <p className="text-neutral-600 mb-2">
    Please wait while we hammer out the {document type} for your idea...
  </p>
  <p className="text-neutral-500 text-sm italic">
    This process usually takes 1-2 minutes.
  </p>
</div>
```

### 3. Generation Timeout State

```tsx
<div className="border border-destructive rounded-md p-6 mb-4 bg-destructive/10">
  <div className="flex items-start space-x-4">
    <div className="mt-1">
      <AlertTriangle className="h-6 w-6 text-destructive" />
    </div>
    <div className="flex-1">
      <h4 className="font-bold text-destructive mb-2">Generation Timed Out</h4>
      <p className="text-neutral-700 mb-4">
        The {document type} document generation is taking longer than expected. 
        This could be due to high system load or complexity of your project.
      </p>
      <div className="flex items-center space-x-3">
        <Button 
          onClick={handleGenerate<DocumentType>Click}
          disabled={isGenerating<DocumentType>}
          className="bg-gradient-to-r from-amber-500 to-amber-700 hover:from-amber-600 hover:to-amber-800"
        >
          {isGenerating<DocumentType> ? (
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
          onClick={fetch<DocumentType>}
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Check Status
        </Button>
      </div>
    </div>
  </div>
</div>
```

### 4. Completed State

```tsx
<div>
  <div className="mb-6 flex justify-between items-center">
    <div>
      <p className="text-sm text-neutral-500">
        Last updated: {formatDate(document.updatedAt || document.createdAt)}
      </p>
    </div>
    <div className="flex gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={async () => {
          const success = await copyHtmlToClipboard("{document-type}-content");
          if (success) {
            toast({
              title: "Content copied to clipboard",
              description: "{Document type} copied as formatted text",
              duration: 3000
            });
          } else {
            toast({
              title: "Failed to copy content",
              description: "Please try again or select and copy manually",
              variant: "destructive",
              duration: 3000
            });
          }
        }}
      >
        <Copy className="mr-2 h-4 w-4" />
        Copy Content
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={handleRegenerate<DocumentType>Click}
        disabled={isGenerating<DocumentType>}
      >
        <RefreshCw className="mr-2 h-4 w-4" />
        Regenerate
      </Button>
    </div>
  </div>
  
  <div id="{document-type}-content" className="prose max-w-none prose-headings:font-semibold prose-h1:text-xl prose-h2:text-lg prose-h3:text-md prose-p:text-neutral-700">
    {document.html ? (
      <div dangerouslySetInnerHTML={{ __html: document.html }} />
    ) : document.content ? (
      <div className="whitespace-pre-wrap font-mono text-sm bg-neutral-50 p-4 rounded-md">
        {document.content}
      </div>
    ) : (
      <div className="p-4 text-center">
        <p className="text-neutral-600">
          {Document type} content is being processed. Check status to refresh.
        </p>
      </div>
    )}
  </div>
  
  {/* Regeneration Instructions Panel */}
  <div className="mt-6 flex">
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-sm text-neutral-500 inline-flex items-center"
        >
          <FileText className="mr-1 h-4 w-4" />
          Add regeneration instructions
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Add Regeneration Instructions</DialogTitle>
          <DialogDescription>
            Add specific instructions for regenerating your {Document Type}. These instructions will be used when you click the Regenerate button.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Textarea 
            id="{documentType}Notes"
            value={<documentType>Notes}
            onChange={(e) => set<DocumentType>Notes(e.target.value)}
            placeholder="E.g., Include more specific details, focus on certain areas..."
            className="min-h-[150px]"
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button">Save Instructions</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</div>
```

### 5. Empty/Initial State (Not Generated)

```tsx
<div className="py-8">
  <div className="mb-6">
    <p className="mb-2">Provide optional instructions for generating your {document type} document:</p>
    <Textarea
      value={<documentType>Notes}
      onChange={(e) => set<DocumentType>Notes(e.target.value)}
      placeholder="e.g., Specific focus areas, requirements, constraints..."
      className="h-24"
    />
  </div>
  <div className="flex justify-center">
    <Button 
      onClick={handleGenerate<DocumentType>Click}
      disabled={isGenerating<DocumentType>}
      className="bg-gradient-to-r from-amber-500 to-amber-700 hover:from-amber-600 hover:to-amber-800"
    >
      <Icon className="mr-2 h-4 w-4" />
      {isGenerating<DocumentType> ? 'Generating...' : 'Generate {Document Type}'}
    </Button>
  </div>
</div>
```

## Required Functions

### Fetch Document

```tsx
const fetch<DocumentType> = async () => {
  try {
    setIsLoading<DocumentType>(true);
    const response = await fetch(`/api/ideas/${ideaId}/documents/<DocumentType>`);
    if (response.ok) {
      const data = await response.json();
      set<DocumentType>(data);
      
      // Check if document is currently generating
      if (data && data.status === 'Generating') {
        set<DocumentType>Generating(true);
        
        // Check if generation has timed out (2 minutes or more since started)
        if (data.generationStartedAt) {
          const startedAt = new Date(data.generationStartedAt);
          const now = new Date();
          const diffMinutes = (now.getTime() - startedAt.getTime()) / (1000 * 60);
          
          if (diffMinutes >= 2) {
            console.log(`${Document type} generation timed out (started ${diffMinutes.toFixed(1)} minutes ago)`);
            set<DocumentType>TimedOut(true);
          } else {
            set<DocumentType>TimedOut(false);
            console.log(`${Document type} generation in progress (started ${diffMinutes.toFixed(1)} minutes ago)`);
          }
        }
      } else {
        set<DocumentType>Generating(false);
        set<DocumentType>TimedOut(false);
      }
    } else {
      // No document exists yet
      set<DocumentType>(null);
    }
  } catch (error) {
    console.error(`Error fetching ${document type}:`, error);
    toast({
      title: "Error",
      description: `Failed to load ${document type}`,
      variant: "destructive",
    });
  } finally {
    setIsLoading<DocumentType>(false);
  }
};
```

### Generate Document

```tsx
const handleGenerate<DocumentType>Click = async () => {
  try {
    setIsGenerating<DocumentType>(true);
    
    const response = await fetch(`/api/ideas/${ideaId}/documents/<DocumentType>`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instructions: <documentType>Notes,
      }),
    });
    
    if (response.ok) {
      const result = await response.json();
      set<DocumentType>Generating(true);
      set<DocumentType>TimedOut(false);
      fetch<DocumentType>(); // Fetch the newly created document status
      
      toast({
        title: "Generation Started",
        description: `${Document type} generation has started`,
      });
    } else {
      throw new Error(`Failed to start ${document type} generation`);
    }
  } catch (error) {
    console.error(`Error generating ${document type}:`, error);
    toast({
      title: "Error",
      description: `Failed to start ${document type} generation`,
      variant: "destructive",
    });
  } finally {
    setIsGenerating<DocumentType>(false);
  }
};
```

### Regenerate Document

```tsx
const handleRegenerate<DocumentType>Click = async () => {
  if (!<documentType>) return;
  
  try {
    setIsGenerating<DocumentType>(true);
    
    // Delete the existing document first
    const deleteResponse = await fetch(`/api/ideas/${ideaId}/documents/${<documentType>.id}`, {
      method: 'DELETE',
    });
    
    if (!deleteResponse.ok) {
      throw new Error(`Failed to delete existing ${document type}`);
    }
    
    // Clear the current document
    set<DocumentType>(null);
    
    // Generate new document
    const response = await fetch(`/api/ideas/${ideaId}/documents/<DocumentType>`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instructions: <documentType>Notes,
      }),
    });
    
    if (response.ok) {
      const result = await response.json();
      set<DocumentType>Generating(true);
      set<DocumentType>TimedOut(false);
      fetch<DocumentType>(); // Fetch the newly created document status
      
      toast({
        title: "Regeneration Started",
        description: `${Document type} regeneration has started`,
      });
    } else {
      throw new Error(`Failed to start ${document type} regeneration`);
    }
  } catch (error) {
    console.error(`Error regenerating ${document type}:`, error);
    toast({
      title: "Error",
      description: `Failed to regenerate ${document type}`,
      variant: "destructive",
    });
  } finally {
    setIsGenerating<DocumentType>(false);
  }
};
```

## Server-Side Implementation

### Document Routes

Add these routes to the server/routes.ts file:

```typescript
// GET document
app.get('/api/ideas/:ideaId/documents/<DocumentType>', isAuthenticated, async (req, res) => {
  try {
    const { ideaId } = req.params;
    const userId = req.user!.id;
    
    // Security checks
    const idea = await storage.getIdeaById(parseInt(ideaId), userId);
    if (!idea) {
      return res.status(404).json({ error: 'Idea not found' });
    }
    
    // Get document
    const document = await storage.getDocumentByType(parseInt(ideaId), '<DocumentType>');
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    res.json(document);
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

// CREATE document
app.post('/api/ideas/:ideaId/documents/<DocumentType>', isAuthenticated, async (req, res) => {
  try {
    const { ideaId } = req.params;
    const userId = req.user!.id;
    const { instructions } = req.body;
    
    // Security checks
    const idea = await storage.getIdeaById(parseInt(ideaId), userId);
    if (!idea) {
      return res.status(404).json({ error: 'Idea not found' });
    }
    
    // Check if document already exists
    const existingDocument = await storage.getDocumentByType(parseInt(ideaId), '<DocumentType>');
    if (existingDocument) {
      return res.status(400).json({ error: 'Document already exists' });
    }
    
    // Create document with "Generating" status
    const document = await storage.createDocument({
      ideaId: parseInt(ideaId),
      title: `${Document Type} Document`,
      documentType: '<DocumentType>',
      status: 'Generating',
      generationStartedAt: new Date(),
    });
    
    // Trigger the generation process with the N8N webhook
    try {
      const webhookUrl = process.env.N8N_<TYPE>_WEBHOOK_URL;
      if (!webhookUrl) {
        throw new Error('Webhook URL not configured');
      }
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ideaId: parseInt(ideaId),
          documentId: document.id,
          instructions: instructions || '',
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Webhook responded with ${response.status}`);
      }
      
      const result = await response.json();
      
      // Update document with external ID if provided by webhook
      if (result && result.id) {
        await storage.updateDocument(document.id, {
          externalId: result.id,
        });
      }
      
      res.status(201).json(document);
    } catch (error) {
      console.error('Error calling webhook:', error);
      
      // Update document to indicate error
      await storage.updateDocument(document.id, {
        status: 'Draft',
        generationStartedAt: null,
      });
      
      throw new Error('Failed to start generation process');
    }
  } catch (error) {
    console.error('Error creating document:', error);
    res.status(500).json({ error: 'Failed to create document' });
  }
});

// DELETE document
app.delete('/api/ideas/:ideaId/documents/:documentId', isAuthenticated, async (req, res) => {
  try {
    const { ideaId, documentId } = req.params;
    const userId = req.user!.id;
    
    // Security checks
    const idea = await storage.getIdeaById(parseInt(ideaId), userId);
    if (!idea) {
      return res.status(404).json({ error: 'Idea not found' });
    }
    
    // Get document and check if it belongs to the idea
    const document = await storage.getDocumentById(parseInt(documentId));
    if (!document || document.ideaId !== parseInt(ideaId)) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    // Delete document
    await storage.deleteDocument(parseInt(documentId));
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});
```

## Polling Implementation

Add a useEffect hook to poll for document updates during generation:

```tsx
// Poll for updates while document is generating
useEffect(() => {
  let interval: NodeJS.Timeout | null = null;
  
  if (<documentType>Generating && !<documentType>TimedOut) {
    // Poll every 10 seconds
    interval = setInterval(() => {
      fetch<DocumentType>();
    }, 10000);
  }
  
  return () => {
    if (interval) clearInterval(interval);
  };
}, [<documentType>Generating, <documentType>TimedOut]);
```

## Adding to Main Tabs

Include the new document tab in the main TabsList component:

```tsx
<TabsList className="grid grid-cols-4 md:w-auto">
  <TabsTrigger value="overview">Overview</TabsTrigger>
  <TabsTrigger value="requirements">Requirements</TabsTrigger>
  <TabsTrigger value="business">Business</TabsTrigger>
  <TabsTrigger value="canvas">Lean Canvas</TabsTrigger>
  <TabsTrigger value="functional">Functional</TabsTrigger> {/* New tab */}
</TabsList>
```

## Document Card in Overview Tab

Add a new card to the document overview grid:

```tsx
{/* Functional Requirements Card */}
<div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
  <div className="flex justify-between items-start mb-2">
    <h3 className="font-semibold">Functional Requirements</h3>
    {functionalRequirements ? (
      <Badge 
        variant={functionalRequirements.status === 'Completed' ? 'default' : 'outline'}
        className={functionalRequirements.status === 'Completed' ? 'bg-green-100 text-green-800 hover:bg-green-100' : 
                  functionalRequirements.status === 'Generating' ? 'bg-amber-100 text-amber-800 hover:bg-amber-100' : ''}
      >
        {functionalRequirements.status}
      </Badge>
    ) : (
      <Badge variant="outline">Not Created</Badge>
    )}
  </div>
  <p className="text-sm text-neutral-600 mb-3">
    Detailed functional specifications and requirements
  </p>
  <Button 
    size="sm" 
    variant="outline" 
    className="w-full"
    onClick={() => {
      const element = document.querySelector('[data-value="functional"]') as HTMLElement;
      element?.click();
    }}
  >
    {functionalRequirements ? 'View Document' : 'Create Document'}
  </Button>
</div>
```

## Conclusion

Following these standardized implementation guidelines ensures all document types maintain a consistent user experience throughout the application. This makes the interface more intuitive for users and simplifies future maintenance for developers.