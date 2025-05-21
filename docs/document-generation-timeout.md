# Document Generation Timeout Component

This document outlines the standard UI component to display when a document generation process times out.

## Visual Structure

```jsx
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
          onClick={handleRegenerate}
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
```

## Implementation Requirements

1. **Styling**:
   - Border and background: Use `border-destructive` and `bg-destructive/10` for a soft error state
   - Text colors: Use `text-destructive` for headings and `text-neutral-700` for body text
   - Primary button: Use amber gradient (`from-amber-500 to-amber-700`)
   - Secondary button: Use outline variant

2. **Icons**:
   - Warning icon: `<AlertTriangle />` from Lucide React
   - Retry button: `<RefreshCw />` when idle, `<Loader2 className="animate-spin" />` when loading
   - Check Status button: `<RotateCcw />`

3. **Actions**:
   - Retry button should trigger the appropriate regeneration function
   - Check Status button should refresh the document status

4. **States**:
   - Handle loading state with disabled buttons and changed text/icons
   - Show appropriate text for the specific document type

## Usage

This component should be used in all document generation tabs:
- Lean Canvas
- Project Requirements
- Business Requirements
- Functional Requirements
- Any future document types

## Example

```jsx
{documentTimedOut ? (
  <div className="border border-destructive rounded-md p-6 mb-4 bg-destructive/10">
    {/* Timeout component as specified above */}
  </div>
) : (
  // Regular content
)}
```