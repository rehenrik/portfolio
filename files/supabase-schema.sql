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

-- ============================================================
-- GLOBAL COLORS — Design System de Cores
-- ============================================================

create table if not exists public.color_families (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,  -- 'primary', 'neutral', 'success'
  label      text not null,         -- 'Primary', 'Neutral', 'Success'
  sort_order int  default 0,
  created_at timestamptz default now()
);

alter table public.color_families enable row level security;
create policy "Public reads color_families" on public.color_families for select using (true);
create policy "Anon manages color_families" on public.color_families for all using (true) with check (true);

create table if not exists public.color_tokens (
  id          uuid primary key default gen_random_uuid(),
  family_name text not null,
  shade       int  not null check (shade in (50,100,200,300,400,500,600,700,800,900,950)),
  value       text not null default '#000000',
  dark_value  text default '',
  updated_at  timestamptz default now(),
  unique (family_name, shade)
);

alter table public.color_tokens enable row level security;
create policy "Public reads color_tokens" on public.color_tokens for select using (true);
create policy "Anon manages color_tokens" on public.color_tokens for all using (true) with check (true);

create table if not exists public.color_assignments (
  id          uuid primary key default gen_random_uuid(),
  css_var     text not null unique,
  label       text not null,
  category    text default 'geral',
  light_token text default '',
  dark_token  text default '',
  sort_order  int  default 0
);

alter table public.color_assignments enable row level security;
create policy "Public reads color_assignments" on public.color_assignments for select using (true);
create policy "Anon manages color_assignments" on public.color_assignments for all using (true) with check (true);

-- Seed: 7 famílias
insert into public.color_families (name, label, sort_order) values
  ('primary',   'Primary',   1),
  ('secondary', 'Secondary', 2),
  ('neutral',   'Neutral',   3),
  ('success',   'Success',   4),
  ('warning',   'Warning',   5),
  ('error',     'Error',     6),
  ('info',      'Info',      7)
on conflict (name) do nothing;

-- Seed: Primary (baseado no laranja atual #FE4311)
insert into public.color_tokens (family_name, shade, value, dark_value) values
  ('primary',  50,  '#FFF5F2', ''),
  ('primary', 100,  '#FFDDD4', ''),
  ('primary', 200,  '#FFC1AF', ''),
  ('primary', 300,  '#FFA08A', ''),
  ('primary', 400,  '#FF7660', ''),
  ('primary', 500,  '#FE4311', ''),
  ('primary', 600,  '#D93600', ''),
  ('primary', 700,  '#B02B00', ''),
  ('primary', 800,  '#8A2100', ''),
  ('primary', 900,  '#641800', ''),
  ('primary', 950,  '#3F0E00', '')
on conflict (family_name, shade) do nothing;

-- Seed: Neutral (bege claro → preto admin, com overrides dark mode)
insert into public.color_tokens (family_name, shade, value, dark_value) values
  ('neutral',  50,  '#F6F5F1', '#0E0E10'),
  ('neutral', 100,  '#ECEAE4', '#18181B'),
  ('neutral', 200,  '#DDD9CF', '#222226'),
  ('neutral', 300,  '#C9C4B9', '#2E2A2F'),
  ('neutral', 400,  '#B0AA9E', '#4A4550'),
  ('neutral', 500,  '#888178', '#6B6575'),
  ('neutral', 600,  '#645E57', '#8C8596'),
  ('neutral', 700,  '#484238', '#B0A9BA'),
  ('neutral', 800,  '#2E2923', '#D0CAD8'),
  ('neutral', 900,  '#1A1715', '#E8E4EE'),
  ('neutral', 950,  '#0E0E10', '#F5F7FA')
on conflict (family_name, shade) do nothing;

-- Seed: Success
insert into public.color_tokens (family_name, shade, value) values
  ('success',  50,  '#F0FDF4'), ('success', 100, '#DCFCE7'), ('success', 200, '#BBF7D0'),
  ('success', 300,  '#86EFAC'), ('success', 400, '#4ADE80'), ('success', 500, '#22C55E'),
  ('success', 600,  '#16A34A'), ('success', 700, '#15803D'), ('success', 800, '#166534'),
  ('success', 900,  '#14532D'), ('success', 950, '#052E16')
on conflict (family_name, shade) do nothing;

-- Seed: Warning
insert into public.color_tokens (family_name, shade, value) values
  ('warning',  50,  '#FFFBEB'), ('warning', 100, '#FEF3C7'), ('warning', 200, '#FDE68A'),
  ('warning', 300,  '#FCD34D'), ('warning', 400, '#FBBF24'), ('warning', 500, '#F59E0B'),
  ('warning', 600,  '#D97706'), ('warning', 700, '#B45309'), ('warning', 800, '#92400E'),
  ('warning', 900,  '#78350F'), ('warning', 950, '#451A03')
on conflict (family_name, shade) do nothing;

-- Seed: Error
insert into public.color_tokens (family_name, shade, value) values
  ('error',  50,  '#FFF1F2'), ('error', 100, '#FFE4E6'), ('error', 200, '#FECDD3'),
  ('error', 300,  '#FDA4AF'), ('error', 400, '#FB7185'), ('error', 500, '#F43F5E'),
  ('error', 600,  '#E11D48'), ('error', 700, '#BE123C'), ('error', 800, '#9F1239'),
  ('error', 900,  '#881337'), ('error', 950, '#4C0519')
on conflict (family_name, shade) do nothing;

-- Seed: Info
insert into public.color_tokens (family_name, shade, value) values
  ('info',  50,  '#EFF6FF'), ('info', 100, '#DBEAFE'), ('info', 200, '#BFDBFE'),
  ('info', 300,  '#93C5FD'), ('info', 400, '#60A5FA'), ('info', 500, '#3B82F6'),
  ('info', 600,  '#2563EB'), ('info', 700, '#1D4ED8'), ('info', 800, '#1E40AF'),
  ('info', 900,  '#1E3A8A'), ('info', 950, '#172554')
on conflict (family_name, shade) do nothing;

-- Seed: Secondary (roxo neutro)
insert into public.color_tokens (family_name, shade, value) values
  ('secondary',  50,  '#FAF5FF'), ('secondary', 100, '#F3E8FF'), ('secondary', 200, '#E9D5FF'),
  ('secondary', 300,  '#D8B4FE'), ('secondary', 400, '#C084FC'), ('secondary', 500, '#A855F7'),
  ('secondary', 600,  '#9333EA'), ('secondary', 700, '#7E22CE'), ('secondary', 800, '#6B21A8'),
  ('secondary', 900,  '#581C87'), ('secondary', 950, '#3B0764')
on conflict (family_name, shade) do nothing;

-- Seed: 4 assignments semânticos
insert into public.color_assignments (css_var, label, category, light_token, dark_token, sort_order) values
  ('--accent',   'Accent / Destaque', 'geral',      'primary-500',  'primary-400',  1),
  ('--bg',       'Fundo do site',     'geral',      'neutral-50',   'neutral-950',  2),
  ('--card-bg',  'Fundo de cards',    'componente', 'neutral-100',  'neutral-900',  3),
  ('--fg',       'Texto principal',   'texto',      'neutral-950',  'neutral-50',   4)
on conflict (css_var) do nothing;

-- ============================================================
-- GLOBAL BUTTONS — Design System de Botões
-- ============================================================

create table if not exists public.button_tokens (
  id              uuid primary key default gen_random_uuid(),
  name            text not null unique,
  label           text not null,
  sort_order      int  default 0,

  -- Default state
  bg_color        text default 'transparent',
  text_color      text default '#000000',
  border_color    text default 'transparent',
  border_width    text default '0px',
  border_radius   text default '0.25rem',
  padding_x       text default '1rem',
  padding_y       text default '0.5rem',
  icon_position   text default 'left',
  icon_size       text default '1rem',
  icon_gap        text default '0.5rem',
  type_style_name text default '',
  font_weight     text default '500',
  font_size       text default '1rem',

  -- Hover state
  hover_bg_color      text default '',
  hover_text_color    text default '',
  hover_border_color  text default '',
  hover_transform     text default '',
  hover_opacity       text default '',

  -- Active state
  active_bg_color     text default '',
  active_text_color   text default '',
  active_border_color text default '',
  active_transform    text default '',

  -- Focus state
  focus_ring_color    text default '',
  focus_ring_width    text default '2px',
  focus_ring_offset   text default '2px',

  -- Disabled state
  disabled_opacity    text default '0.4',
  disabled_cursor     text default 'not-allowed',

  -- Responsive tablet (max 1024px)
  tablet_padding_x    text default '',
  tablet_padding_y    text default '',
  tablet_font_size    text default '',

  -- Responsive mobile (max 640px)
  mobile_padding_x    text default '',
  mobile_padding_y    text default '',
  mobile_font_size    text default '',

  updated_at      timestamptz default now()
);

alter table public.button_tokens enable row level security;

create policy "Public reads button_tokens"
  on public.button_tokens for select using (true);

create policy "Anon manages button_tokens"
  on public.button_tokens for all using (true) with check (true);

-- Seed: 7 variantes com defaults visuais coerentes
insert into public.button_tokens
  (name, label, sort_order,
   bg_color, text_color, border_color, border_width, border_radius, padding_x, padding_y,
   font_size, font_weight, icon_position, icon_size, icon_gap,
   hover_bg_color, hover_text_color, hover_border_color, hover_transform,
   active_transform, disabled_opacity,
   focus_ring_color, focus_ring_width, focus_ring_offset)
values
  ('primary',   'Primary',   1,
   '#FE4311', '#ffffff', 'transparent', '0px', '0.5rem', '1.25rem', '0.625rem',
   '0.875rem', '500', 'left', '1rem', '0.5rem',
   '#D93600', '#ffffff', 'transparent', 'translateY(-1px)',
   'scale(0.97)', '0.4',
   '#FE4311', '2px', '3px'),

  ('secondary', 'Secondary', 2,
   'rgba(254,67,17,0.1)', '#FE4311', 'transparent', '0px', '0.5rem', '1.25rem', '0.625rem',
   '0.875rem', '500', 'left', '1rem', '0.5rem',
   'rgba(254,67,17,0.18)', '#D93600', 'transparent', 'translateY(-1px)',
   'scale(0.97)', '0.4',
   '#FE4311', '2px', '3px'),

  ('contained', 'Contained', 3,
   '#1A1715', '#F5F7FA', 'transparent', '0px', '0.5rem', '1.25rem', '0.625rem',
   '0.875rem', '500', 'left', '1rem', '0.5rem',
   '#2E2923', '#F5F7FA', 'transparent', 'translateY(-1px)',
   'scale(0.97)', '0.4',
   '#1A1715', '2px', '3px'),

  ('outline',   'Outline',   4,
   'transparent', '#1A1715', '#1A1715', '1.5px', '0.5rem', '1.25rem', '0.625rem',
   '0.875rem', '500', 'left', '1rem', '0.5rem',
   '#1A1715', '#ffffff', '#1A1715', 'translateY(-1px)',
   'scale(0.97)', '0.4',
   '#1A1715', '2px', '3px'),

  ('online',    'Online',    5,
   '#22c55e', '#ffffff', 'transparent', '0px', '99px', '1.25rem', '0.625rem',
   '0.875rem', '500', 'left', '1rem', '0.5rem',
   '#16a34a', '#ffffff', 'transparent', 'translateY(-1px)',
   'scale(0.97)', '0.4',
   '#22c55e', '2px', '3px'),

  ('text',      'Text',      6,
   'transparent', '#1A1715', 'transparent', '0px', '0.25rem', '0.5rem', '0.375rem',
   '0.875rem', '400', 'right', '1rem', '0.375rem',
   'transparent', '#FE4311', 'transparent', '',
   '', '0.4',
   '#1A1715', '2px', '3px'),

  ('link',      'Link',      7,
   'transparent', '#FE4311', 'transparent', '0px', '0px', '0px', '0px',
   '0.875rem', '400', 'right', '0.875rem', '0.25rem',
   'transparent', '#D93600', 'transparent', '',
   '', '0.4',
   '#FE4311', '2px', '2px')

on conflict (name) do nothing;
