-- Helper function to get the current user ID from the JWT claim
-- This matches what we set in `server/db-security.ts` and what Supabase sets
CREATE OR REPLACE FUNCTION auth_user_id() RETURNS text AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::text;
$$ LANGUAGE sql STABLE;

-- Enable RLS on tables
ALTER TABLE ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE lean_canvas ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 1. Policies for 'users' table
-- Users can read their own profile
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (id::text = auth_user_id());

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (id::text = auth_user_id());

-- 2. Policies for 'ideas' table
-- Users can control their own ideas
CREATE POLICY "Users can view own ideas" ON ideas
  FOR SELECT USING (user_id::text = auth_user_id());

CREATE POLICY "Users can insert own ideas" ON ideas
  FOR INSERT WITH CHECK (user_id::text = auth_user_id());

CREATE POLICY "Users can update own ideas" ON ideas
  FOR UPDATE USING (user_id::text = auth_user_id());

CREATE POLICY "Users can delete own ideas" ON ideas
  FOR DELETE USING (user_id::text = auth_user_id());

-- 3. Policies for 'jobs' table
-- Simple user ownership
CREATE POLICY "Users can view own jobs" ON jobs
  FOR ALL USING (user_id::text = auth_user_id());

-- 4. Policies for 'lean_canvas' table
-- Access depends on ownership of the parent idea
CREATE POLICY "Users can view canvas of own ideas" ON lean_canvas
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM ideas 
      WHERE ideas.id = lean_canvas.idea_id 
      AND ideas.user_id::text = auth_user_id()
    )
  );

CREATE POLICY "Users can insert canvas for own ideas" ON lean_canvas
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM ideas 
      WHERE ideas.id = lean_canvas.idea_id 
      AND ideas.user_id::text = auth_user_id()
    )
  );

CREATE POLICY "Users can update canvas of own ideas" ON lean_canvas
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM ideas 
      WHERE ideas.id = lean_canvas.idea_id 
      AND ideas.user_id::text = auth_user_id()
    )
  );

CREATE POLICY "Users can delete canvas of own ideas" ON lean_canvas
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM ideas 
      WHERE ideas.id = lean_canvas.idea_id 
      AND ideas.user_id::text = auth_user_id()
    )
  );

-- 5. Policies for 'project_documents' table
-- Access depends on ownership of the parent idea
CREATE POLICY "Users can manage documents of own ideas" ON project_documents
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM ideas 
      WHERE ideas.id = project_documents.idea_id 
      AND ideas.user_id::text = auth_user_id()
    )
  );
