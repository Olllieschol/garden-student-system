-- Garden Student System — Supabase Schema
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard > SQL Editor)

-- Students table
-- All student data is stored as JSONB to preserve the full nested shape
-- (suspensions array, parent objects, siblings, etc.) without normalization.
-- Key fields are also extracted as columns for efficient filtering/indexing.
create table if not exists public.students (
  id        text primary key,          -- student numeric id as string
  data      jsonb not null             -- full student object
);

create index if not exists students_centre_idx  on public.students ((data->>'centre'));
create index if not exists students_class_idx   on public.students ((data->>'classId'));
create index if not exists students_status_idx  on public.students ((data->>'status'));
create index if not exists students_archived_idx on public.students ((data->>'archived'));

-- Classes table
create table if not exists public.classes (
  id   text primary key,
  data jsonb not null
);

-- Enable Row Level Security (keeps the policies clean)
alter table public.students enable row level security;
alter table public.classes  enable row level security;

-- Allow all operations for the anon role (app is already password-gated at the UI layer)
create policy "anon full access" on public.students for all to anon using (true) with check (true);
create policy "anon full access" on public.classes  for all to anon using (true) with check (true);

-- Enable Realtime so all browsers stay in sync
alter publication supabase_realtime add table public.students;
alter publication supabase_realtime add table public.classes;
