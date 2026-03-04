-- Helper function to get the current user ID from the JWT claim
-- This matches what we set in `server/db-security.ts` and what Supabase sets
CREATE OR REPLACE FUNCTION auth_user_id() RETURNS text AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::text;
$$ LANGUAGE sql STABLE;

-- Enable RLS on tables
ALTER TABLE ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 1. Policies for 'users' table
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (id::text = auth_user_id());

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (id::text = auth_user_id());

-- 2. Policies for 'ideas' table
CREATE POLICY "Users can view own ideas" ON ideas
  FOR SELECT USING (user_id::text = auth_user_id());

CREATE POLICY "Users can insert own ideas" ON ideas
  FOR INSERT WITH CHECK (user_id::text = auth_user_id());

CREATE POLICY "Users can update own ideas" ON ideas
  FOR UPDATE USING (user_id::text = auth_user_id());

CREATE POLICY "Users can delete own ideas" ON ideas
  FOR DELETE USING (user_id::text = auth_user_id());

-- 3. Policies for 'jobs' table
CREATE POLICY "Users can manage own jobs" ON jobs
  FOR ALL USING (user_id::text = auth_user_id());

-- 4. Policies for 'documents' table
-- Documents have direct user_id FK, so we can use direct ownership check
CREATE POLICY "Users can view own documents" ON documents
  FOR SELECT USING (user_id::text = auth_user_id());

CREATE POLICY "Users can insert own documents" ON documents
  FOR INSERT WITH CHECK (user_id::text = auth_user_id());

CREATE POLICY "Users can update own documents" ON documents
  FOR UPDATE USING (user_id::text = auth_user_id());

CREATE POLICY "Users can delete own documents" ON documents
  FOR DELETE USING (user_id::text = auth_user_id());
