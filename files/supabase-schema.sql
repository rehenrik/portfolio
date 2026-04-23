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

-- Carousel images table
create table if not exists public.carousel_images (
  id         uuid primary key default gen_random_uuid(),
  image_url  text not null,
  label      text,
  mime_type  text,           -- e.g. 'image/webp', 'video/mp4'
  "order"    int default 0,
  active     boolean default true,
  created_at timestamptz default now()
);

-- If table already exists, add the column:
alter table public.carousel_images add column if not exists mime_type text;

alter table public.carousel_images enable row level security;

create policy "Public can read active carousel images"
  on public.carousel_images
  for select
  using (active = true);

create policy "Auth user can manage carousel images"
  on public.carousel_images
  for all
  using (auth.role() = 'authenticated');

-- ============================================================
-- TYPOGRAPHY CMS
-- ============================================================

-- Uploaded font families
create table if not exists public.fonts (
  id           uuid primary key default gen_random_uuid(),
  family_name  text not null unique,
  role         text not null check (role in ('serif','sans','mono')),
  weight_min   int  default 400,
  weight_max   int  default 400,
  woff2_url    text,
  woff_url     text,
  ttf_url      text,
  eot_url      text,
  svg_url      text,
  created_at   timestamptz default now()
);

alter table public.fonts enable row level security;

create policy "Public can read fonts"
  on public.fonts for select using (true);

create policy "Anon can manage fonts"
  on public.fonts for all using (true) with check (true);

-- Per-selector typography tokens
create table if not exists public.typography_tokens (
  selector       text primary key,
  font_role      text not null default 'sans' check (font_role in ('serif','sans','mono')),
  font_weight    text default '400',
  font_size      text default '1rem',
  letter_spacing text default '0',
  line_height    text default '1.5',
  updated_at     timestamptz default now()
);

alter table public.typography_tokens enable row level security;

create policy "Public can read typography"
  on public.typography_tokens for select using (true);

create policy "Anon can manage typography"
  on public.typography_tokens for all using (true) with check (true);

-- Seed typography tokens (matches current style.css defaults)
insert into public.typography_tokens (selector, font_role, font_weight, font_size, letter_spacing, line_height) values
  ('h1',                 'serif', '400', 'clamp(2.5rem, 5vw, 4.5rem)',     '-0.03em', '1.1'),
  ('h2',                 'serif', '400', 'clamp(2rem, 4vw, 3rem)',         '-0.02em', '1.2'),
  ('h3',                 'sans',  '500', 'clamp(1.5rem, 3vw, 2rem)',       '-0.01em', '1.3'),
  ('h4',                 'sans',  '500', 'clamp(1.25rem, 2.5vw, 1.5rem)',  '-0.01em', '1.4'),
  ('h5',                 'sans',  '500', 'clamp(1.1rem, 2vw, 1.25rem)',    '-0.01em', '1.4'),
  ('paragraph-xl',       'sans',  '300', 'clamp(1.25rem, 2.5vw, 1.5rem)',  '-0.01em', '1.6'),
  ('paragraph-l',        'sans',  '300', 'clamp(1.1rem, 2vw, 1.25rem)',    '-0.01em', '1.6'),
  ('paragraph-m',        'sans',  '300', '1rem',                            '-0.01em', '1.6'),
  ('paragraph-default',  'sans',  '400', '1rem',                            '-0.01em', '1.6'),
  ('paragraph-s',        'sans',  '400', '0.875rem',                        '-0.01em', '1.5'),
  ('paragraph-xs',       'sans',  '400', '0.75rem',                         '-0.01em', '1.4')
on conflict (selector) do nothing;

-- Storage bucket for uploaded font files (mirror of carousel-images config)
insert into storage.buckets (id, name, public)
  values ('fonts', 'fonts', true)
  on conflict (id) do nothing;

-- Permissive policies to match the existing carousel-images bucket
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'Public can read fonts bucket' and tablename = 'objects') then
    execute $p$create policy "Public can read fonts bucket" on storage.objects for select using (bucket_id = 'fonts')$p$;
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Anon can upload fonts bucket' and tablename = 'objects') then
    execute $p$create policy "Anon can upload fonts bucket" on storage.objects for insert with check (bucket_id = 'fonts')$p$;
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Anon can update fonts bucket' and tablename = 'objects') then
    execute $p$create policy "Anon can update fonts bucket" on storage.objects for update using (bucket_id = 'fonts') with check (bucket_id = 'fonts')$p$;
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Anon can delete fonts bucket' and tablename = 'objects') then
    execute $p$create policy "Anon can delete fonts bucket" on storage.objects for delete using (bucket_id = 'fonts')$p$;
  end if;
end $$;

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
