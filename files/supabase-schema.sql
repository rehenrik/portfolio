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

-- ============================================================
-- SITE CONTENT CMS
-- ============================================================

create table if not exists public.site_content (
  id           uuid primary key default gen_random_uuid(),
  page         text not null,
  section      text not null,
  component    text not null,       -- 'heading' | 'paragraph' | 'cta'
  field_key    text not null,
  field_label  text not null,
  field_type   text default 'text', -- 'text' | 'textarea'
  value        text not null default '',
  sort_order   int  default 0,
  updated_at   timestamptz default now(),
  unique (page, section, field_key)
);

alter table public.site_content enable row level security;

create policy "Public can read site_content"
  on public.site_content for select using (true);

create policy "Anon can update site_content"
  on public.site_content for update using (true) with check (true);

-- Seed: current static text from index.html (Home page)
insert into public.site_content (page, section, component, field_key, field_label, field_type, value, sort_order) values
  -- Hero
  ('home','hero','heading',   'h1_line1',       'Título — linha 1',          'text',     'Visual and Product Designer',                                                                                                                                                                        1),
  ('home','hero','heading',   'h1_line2',       'Título — linha 2',          'text',     'shaping *intuitive* experiences',                                                                                                                                                                    2),
  ('home','hero','paragraph', 'subtitle',       'Subtítulo',                 'textarea', 'A multifaceted designer with over 10 years of agency experience, focused on purposeful, balanced user interfaces.',                                                                                  3),
  ('home','hero','cta',       'cta_primary',    'Texto do botão principal',  'text',     'Let''s talk',                                                                                                                                                                                        4),
  -- Projects
  ('home','projects','heading',   'h2_line1',   'Título — linha 1',          'text',     'Turning ideas into',                                                                                                                                                                                 5),
  ('home','projects','heading',   'h2_line2',   'Título — linha 2',          'text',     '*usable* Designs',                                                                                                                                                                                   6),
  ('home','projects','paragraph', 'description','Descrição da seção',        'textarea', 'Projects that simplify complexity and improve how people interact.',                                                                                                                                  7),
  -- About
  ('home','about','heading',   'h2_line1',      'Título — linha 1',          'text',     'Designing',                                                                                                                                                                                          8),
  ('home','about','heading',   'h2_line2',      'Título — linha 2',          'text',     'with *depth*',                                                                                                                                                                                       9),
  ('home','about','paragraph', 'intro',         'Parágrafo introdutório',    'textarea', 'Just me, turning sketches and clicks into experiences that feel alive.',                                                                                                                             10),
  ('home','about','paragraph', 'paragraph_2',   'Parágrafo — história',      'textarea', 'I grew up in São Paulo, and since I was little, drawing has been a part of my life. In my childhood, I started playing around with Photoshop, and there I discovered a new way to explore creativity. Today, it is in design that I have found my path to transform ideas into something real.',  11),
  ('home','about','cta',       'cta_about',     'Botão "About"',             'text',     'A short summary →',                                                                                                                                                                                 12),
  ('home','about','paragraph', 'paragraph_3',   'Parágrafo — Design Systems','textarea', 'I focus on designing interfaces that are not only clean and intuitive, but also enjoyable to use. Alongside that, I build strong and scalable Design Systems that give teams consistency.',          13),
  ('home','about','cta',       'cta_playground','Botão "Playground"',        'text',     'Explore Playground →',                                                                                                                                                                               14),
  -- Skills
  ('home','skills','heading',  'h2',            'Título da seção',           'text',     'Skills I''m *confident* in',                                                                                                                                                                        15),
  -- Contact
  ('home','contact','heading',   'h2_line1',    'Título — linha 1',          'text',     'I''d love to',                                                                                                                                                                                      16),
  ('home','contact','heading',   'h2_line2',    'Título — linha 2',          'text',     '*talk* to you',                                                                                                                                                                                     17),
  ('home','contact','paragraph', 'description', 'Texto descritivo',          'textarea', 'Whether you''ve got a project in mind, a question, or just want to say hi.',                                                                                                                        18),
  ('home','contact','cta',       'cta_primary', 'Texto do botão',            'text',     'Let''s talk',                                                                                                                                                                                       19)
on conflict (page, section, field_key) do nothing;

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

-- ============================================================
-- GLOBAL FONTS — Design System Typography
-- ============================================================

create table if not exists public.type_styles (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null unique,
  label               text not null,
  css_targets         text not null,
  font_role           text not null default 'sans' check (font_role in ('serif','sans','mono')),
  font_weight         text default '400',
  font_size           text default '1rem',
  font_size_tablet    text default '',
  font_size_mobile    text default '',
  line_height         text default '1.5',
  line_height_tablet  text default '',
  line_height_mobile  text default '',
  letter_spacing      text default '0',
  text_transform      text default 'none',
  sort_order          int  default 0,
  updated_at          timestamptz default now()
);

alter table public.type_styles enable row level security;

create policy "Public reads type_styles"
  on public.type_styles for select using (true);

create policy "Anon manages type_styles"
  on public.type_styles for all using (true) with check (true);

-- Seed: 11 semantic styles
insert into public.type_styles
  (name, label, css_targets, font_role, font_weight, font_size, font_size_tablet, font_size_mobile, line_height, line_height_tablet, line_height_mobile, letter_spacing, text_transform, sort_order)
values
  ('display',         'Display',         '.ts-display',    'serif', '400', 'clamp(4rem,7vw,6rem)',          'clamp(3rem,5vw,4rem)',          '2.75rem',  '1.0',     '',    '',    '-0.04em', 'none',      1),
  ('h1',              'Heading 1',       'h1',             'serif', '400', 'clamp(2.5rem,5vw,4.5rem)',      'clamp(2rem,4vw,3rem)',          '1.875rem', '1.1',     '',    '',    '-0.03em', 'none',      2),
  ('h2',              'Heading 2',       'h2',             'serif', '400', 'clamp(2rem,4vw,3rem)',          'clamp(1.5rem,3vw,2.25rem)',     '1.625rem', '1.2',     '',    '',    '-0.02em', 'none',      3),
  ('h3',              'Heading 3',       'h3',             'sans',  '500', 'clamp(1.5rem,3vw,2rem)',        'clamp(1.25rem,2vw,1.75rem)',    '1.375rem', '1.3',     '',    '',    '-0.01em', 'none',      4),
  ('h4',              'Heading 4',       'h4',             'sans',  '500', 'clamp(1.25rem,2vw,1.5rem)',     '1.25rem',                       '1.125rem', '1.4',     '',    '',    '-0.01em', 'none',      5),
  ('paragraph-large', 'Paragraph Large', '.paragraph-large','sans', '300', 'clamp(1.1rem,2vw,1.25rem)',    '1.1rem',                        '1rem',     '1.6',     '',    '',    '-0.01em', 'none',      6),
  ('paragraph',       'Paragraph',       'p',              'sans',  '400', '1rem',                          '',                              '',         '1.6',     '',    '',    '-0.01em', 'none',      7),
  ('paragraph-small', 'Paragraph Small', '.paragraph-small','sans', '400', '0.875rem',                     '',                              '',         '1.5',     '',    '',    '0',       'none',      8),
  ('caption',         'Caption',         '.caption',       'sans',  '400', '0.75rem',                      '',                              '',         '1.4',     '',    '',    '0',       'none',      9),
  ('button',          'Button',          '.btn',           'sans',  '500', '0.875rem',                     '',                              '',         '1',       '',    '',    '0.02em',  'uppercase', 10),
  ('link',            'Link',            'a',              'sans',  '400', 'inherit',                      '',                              '',         'inherit', '',    '',    '0',       'none',      11)
on conflict (name) do nothing;
