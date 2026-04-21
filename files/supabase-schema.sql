-- ============================================================
-- SUPABASE SCHEMA – Portfolio
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Projects table
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  year        text,
  tags        text[],          -- e.g. ARRAY['UX/UI Design', 'Prototyping']
  image_url   text,
  url         text,            -- link to case study page
  "order"     int default 0,   -- sort order on homepage
  published   boolean default true,
  created_at  timestamptz default now()
);

-- Enable Row Level Security
alter table public.projects enable row level security;

-- Allow anyone to read published projects (public portfolio)
create policy "Public can read published projects"
  on public.projects
  for select
  using (published = true);

-- Optional: allow authenticated user (you) to manage all projects
create policy "Auth user can manage projects"
  on public.projects
  for all
  using (auth.role() = 'authenticated');

-- ── SEED DATA (example) ─────────────────────────────────────
insert into public.projects (title, description, year, tags, image_url, url, "order") values
  (
    'Project One',
    'Created the experience and applied a Design System for consistency',
    '2024 – 2025',
    ARRAY['UX/UI Design', 'Design System', 'Prototyping', 'Handoff'],
    '',   -- replace with your image URL from Supabase Storage
    '/work/project-one',
    1
  ),
  (
    'Project Two',
    'Scalable design system with core elements',
    '2023 – Present',
    ARRAY['Design System', 'Documentation', 'Foundations', 'Variables'],
    '',
    '/work/project-two',
    2
  ),
  (
    'Project Three',
    'Redesign to make the experience more intuitive and easy to navigate',
    '2022',
    ARRAY['UI Design', 'Visual Design', 'Prototyping'],
    '',
    '/work/project-three',
    3
  );
