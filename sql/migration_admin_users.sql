-- Migration: Admin-Only User Registration
-- Adds role column to users and creates audit_logs table

-- 1. Add role column to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

-- 2. Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 3. Enable RLS on audit_logs (no SELECT policies for authenticated — backend-only access)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 4. Allow the backend (authenticated role) to INSERT audit logs
GRANT INSERT ON audit_logs TO authenticated;
