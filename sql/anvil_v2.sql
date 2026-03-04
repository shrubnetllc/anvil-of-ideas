-- Anvil of Ideas V2 Schema
-- All tables use UUID primary keys
-- Unified documents table replaces lean_canvas and project_documents

create table public.users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password text not null,
  email text,
  email_verified text default 'false',
  verification_token text,
  verification_token_expiry timestamptz
);

create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  title text not null default '',
  description text not null,
  founder_name text,
  founder_email text,
  company_stage text,
  website_url text,
  company_name text,
  status text not null default 'Draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  idea_id uuid not null references public.ideas(id),
  status text default '',
  document_type text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  idea_id uuid not null references public.ideas(id),
  job_id uuid references public.jobs(id),
  document_type text not null,
  content text,
  content_sections jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  generated_at timestamptz default now()
);

create table public.app_settings (
  id serial primary key,
  key varchar(50) not null unique,
  value text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
