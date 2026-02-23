-- Migration script: V1 (serial IDs, lean_canvas + project_documents) -> V2 (UUID IDs, unified documents)
-- Run this against a copy/staging database first!
-- Prerequisites: uuid-ossp extension must be enabled

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

BEGIN;

-- ============================================================
-- Step 1: Create new UUID-based tables alongside old ones
-- ============================================================

CREATE TABLE users_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  old_id integer,  -- track old serial ID for FK migration
  username text NOT NULL UNIQUE,
  password text NOT NULL,
  email text,
  email_verified text DEFAULT 'false',
  verification_token text,
  verification_token_expiry timestamptz
);

CREATE TABLE ideas_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  old_id integer,
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT '',
  description text NOT NULL,
  founder_name text,
  founder_email text,
  company_stage text,
  website_url text,
  company_name text,
  status text NOT NULL DEFAULT 'Draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE jobs_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  old_id text,
  user_id uuid NOT NULL,
  idea_id uuid NOT NULL,
  status text DEFAULT '',
  document_type text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE documents_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  idea_id uuid NOT NULL,
  job_id uuid,
  document_type text NOT NULL,
  content text,
  content_sections jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  generated_at timestamptz DEFAULT now()
);

-- ============================================================
-- Step 2: Migrate users data
-- ============================================================

INSERT INTO users_v2 (old_id, username, password, email, email_verified, verification_token, verification_token_expiry)
SELECT id, username, password, email, email_verified, verification_token, verification_token_expiry
FROM users;

-- ============================================================
-- Step 3: Migrate ideas data (idea -> description rename)
-- ============================================================

INSERT INTO ideas_v2 (old_id, user_id, title, description, founder_name, founder_email, company_stage, website_url, company_name, status, created_at, updated_at)
SELECT
  i.id,
  u2.id,
  COALESCE(i.title, ''),
  COALESCE(i.idea, ''),
  i.founder_name,
  i.founder_email,
  i.company_stage,
  i.website_url,
  i.company_name,
  COALESCE(i.status, 'Draft'),
  i.created_at,
  i.updated_at
FROM ideas i
JOIN users_v2 u2 ON u2.old_id = i.user_id;

-- ============================================================
-- Step 4: Migrate jobs data (strip projectId)
-- ============================================================

INSERT INTO jobs_v2 (old_id, user_id, idea_id, status, document_type, description, created_at, updated_at)
SELECT
  j.id::text,
  u2.id,
  i2.id,
  j.status,
  j.document_type,
  j.description,
  j.created_at,
  j.updated_at
FROM jobs j
JOIN users_v2 u2 ON u2.old_id = j.user_id
JOIN ideas_v2 i2 ON i2.old_id = j.idea_id;

-- ============================================================
-- Step 5: Migrate lean_canvas into documents table
-- ============================================================

INSERT INTO documents_v2 (user_id, idea_id, document_type, content, content_sections, created_at, updated_at, generated_at)
SELECT
  i2.user_id,
  i2.id,
  'LeanCanvas',
  lc.html,
  jsonb_build_object(
    'problem', lc.problem,
    'customerSegments', lc.customer_segments,
    'uniqueValueProposition', lc.unique_value_proposition,
    'solution', lc.solution,
    'channels', lc.channels,
    'revenueStreams', lc.revenue_streams,
    'costStructure', lc.cost_structure,
    'keyMetrics', lc.key_metrics,
    'unfairAdvantage', lc.unfair_advantage
  ),
  lc.created_at,
  lc.updated_at,
  lc.updated_at
FROM lean_canvas lc
JOIN ideas_v2 i2 ON i2.old_id = lc.idea_id;

-- ============================================================
-- Step 6: Migrate project_documents into documents table
-- ============================================================

INSERT INTO documents_v2 (user_id, idea_id, document_type, content, created_at, updated_at, generated_at)
SELECT
  i2.user_id,
  i2.id,
  pd.document_type,
  COALESCE(pd.html, pd.content),
  pd.created_at,
  pd.updated_at,
  pd.updated_at
FROM project_documents pd
JOIN ideas_v2 i2 ON i2.old_id = pd.idea_id;

-- ============================================================
-- Step 7: Add foreign key constraints to new tables
-- ============================================================

ALTER TABLE ideas_v2 ADD CONSTRAINT ideas_v2_user_fk FOREIGN KEY (user_id) REFERENCES users_v2(id);
ALTER TABLE jobs_v2 ADD CONSTRAINT jobs_v2_user_fk FOREIGN KEY (user_id) REFERENCES users_v2(id);
ALTER TABLE jobs_v2 ADD CONSTRAINT jobs_v2_idea_fk FOREIGN KEY (idea_id) REFERENCES ideas_v2(id);
ALTER TABLE documents_v2 ADD CONSTRAINT documents_v2_user_fk FOREIGN KEY (user_id) REFERENCES users_v2(id);
ALTER TABLE documents_v2 ADD CONSTRAINT documents_v2_idea_fk FOREIGN KEY (idea_id) REFERENCES ideas_v2(id);
ALTER TABLE documents_v2 ADD CONSTRAINT documents_v2_job_fk FOREIGN KEY (job_id) REFERENCES jobs_v2(id);

-- ============================================================
-- Step 8: Drop old tables, rename new tables
-- ============================================================

-- Drop old RLS policies first (ignore errors if they don't exist)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view own profile" ON users;
  DROP POLICY IF EXISTS "Users can update own profile" ON users;
  DROP POLICY IF EXISTS "Users can view own ideas" ON ideas;
  DROP POLICY IF EXISTS "Users can insert own ideas" ON ideas;
  DROP POLICY IF EXISTS "Users can update own ideas" ON ideas;
  DROP POLICY IF EXISTS "Users can delete own ideas" ON ideas;
  DROP POLICY IF EXISTS "Users can view canvas of own ideas" ON lean_canvas;
  DROP POLICY IF EXISTS "Users can insert canvas for own ideas" ON lean_canvas;
  DROP POLICY IF EXISTS "Users can update canvas of own ideas" ON lean_canvas;
  DROP POLICY IF EXISTS "Users can delete canvas of own ideas" ON lean_canvas;
  DROP POLICY IF EXISTS "Users can manage documents of own ideas" ON project_documents;
  DROP POLICY IF EXISTS "Users can view own jobs" ON jobs;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Drop old tables (cascade to drop FK constraints)
DROP TABLE IF EXISTS project_documents CASCADE;
DROP TABLE IF EXISTS lean_canvas CASCADE;
DROP TABLE IF EXISTS jobs CASCADE;
DROP TABLE IF EXISTS ideas CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Rename new tables
ALTER TABLE users_v2 RENAME TO users;
ALTER TABLE ideas_v2 RENAME TO ideas;
ALTER TABLE jobs_v2 RENAME TO jobs;
ALTER TABLE documents_v2 RENAME TO documents;

-- Rename constraints
ALTER TABLE ideas RENAME CONSTRAINT ideas_v2_user_fk TO ideas_user_id_fkey;
ALTER TABLE jobs RENAME CONSTRAINT jobs_v2_user_fk TO jobs_user_id_fkey;
ALTER TABLE jobs RENAME CONSTRAINT jobs_v2_idea_fk TO jobs_idea_id_fkey;
ALTER TABLE documents RENAME CONSTRAINT documents_v2_user_fk TO documents_user_id_fkey;
ALTER TABLE documents RENAME CONSTRAINT documents_v2_idea_fk TO documents_idea_id_fkey;
ALTER TABLE documents RENAME CONSTRAINT documents_v2_job_fk TO documents_job_id_fkey;

-- Drop the migration helper columns
ALTER TABLE users DROP COLUMN IF EXISTS old_id;
ALTER TABLE ideas DROP COLUMN IF EXISTS old_id;
ALTER TABLE jobs DROP COLUMN IF EXISTS old_id;

-- Rename username unique constraint if needed
-- (Postgres will keep existing constraint names through rename)

COMMIT;

-- ============================================================
-- Step 9: Apply RLS policies (run after commit)
-- ============================================================
-- See enable_rls.sql for the RLS policy definitions
