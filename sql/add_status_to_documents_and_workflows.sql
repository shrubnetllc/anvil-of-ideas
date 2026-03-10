-- Add status column to documents and workflows tables
-- This allows the frontend to distinguish between documents/workflows
-- that are still being generated vs those that are complete.
--
-- Existing rows with content get 'completed' (they already have content).
-- New rows default to 'generating' so documents aren't marked done prematurely.
--
-- Safe to run multiple times (idempotent).

BEGIN;

-- Documents: add status column if it doesn't exist
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'generating';

-- Ensure the column default is correct even if the column already existed
ALTER TABLE public.documents
  ALTER COLUMN status SET DEFAULT 'generating';

-- Backfill: any existing document that already has content should be 'completed'
UPDATE public.documents
  SET status = 'completed'
  WHERE (content IS NOT NULL OR content_sections IS NOT NULL)
    AND status != 'completed';

-- Workflows: add status column if it doesn't exist
ALTER TABLE public.workflows
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'generating';

-- Ensure the column default is correct even if the column already existed
ALTER TABLE public.workflows
  ALTER COLUMN status SET DEFAULT 'generating';

-- Backfill: any existing workflow that has content should be 'completed'
UPDATE public.workflows
  SET status = 'completed'
  WHERE (workflow_steps IS NOT NULL AND workflow_steps != '{}'::jsonb)
    AND status != 'completed';

COMMIT;
