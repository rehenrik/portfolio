// ============================================================
// SUPABASE CONFIGURATION
// ============================================================

const SUPABASE_URL = 'https://srghujzrbojuzilyswrf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyZ2h1anpyYm9qdXppbHlzd3JmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MjIwMjYsImV4cCI6MjA5MjI5ODAyNn0.1C5fDVoAK6Na_oh5d4SIXZ6cdp54bbuRJqxJz92hPfQ';

const SUPABASE_REST = SUPABASE_URL + '/rest/v1';
const SUPABASE_HEADERS = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: 'Bearer ' + SUPABASE_ANON_KEY
};

// ── Public read endpoints via direct REST (no SDK needed) ────
// Fired immediately when the page actually uses the carousel/projects
// (skips on admin), overlapping with HTML/CSS parse.
const _isPublicPage = !!document.getElementById('cardLine')
                   || !!document.getElementById('projectsGrid');

window._carouselDataPromise = _isPublicPage
  ? fetch(SUPABASE_REST + '/carousel_images?select=*&active=eq.true&order=order.asc',
      { headers: SUPABASE_HEADERS })
      .then(r => r.ok ? r.json() : []).catch(() => [])
  : Promise.resolve([]);

window._projectsDataPromise = _isPublicPage
  ? fetch(SUPABASE_REST + '/projects?select=*&order=order.asc',
      { headers: SUPABASE_HEADERS })
      .then(r => r.ok ? r.json() : []).catch(() => [])
  : Promise.resolve([]);

if (_isPublicPage) {
  window._carouselDataPromise.then(rows => {
    if (!Array.isArray(rows) || !document.head) return;
    let injected = 0;
    for (const r of rows) {
      if (injected >= 4) break;
      const url = r && r.image_url;
      if (!url) continue;
      const isVideo = (r.mime_type || '').startsWith('video/')
        || /\.(mp4|webm|mov|ogg)(\?|$)/i.test(url);
      if (isVideo) continue;

      const href = url.includes('/storage/v1/object/public/')
        ? url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/') + '?width=1200&resize=contain&quality=70&format=webp'
        : url;

      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = href;
      if (injected === 0) link.fetchPriority = 'high';
      document.head.appendChild(link);
      injected++;
    }
  });
}

async function getCarouselData() {
  return await window._carouselDataPromise;
}

async function getProjectsData() {
  return await window._projectsDataPromise;
}

// ── Typography CMS — fetch, cache, inject ────────────────────
const TYPO_CACHE_KEY = 'typography_css_v1';

function buildTypographyCSS(fonts, tokens) {
  let css = '';
  const faceRules = [];
  const roleToFamily = {};

  for (const f of (fonts || [])) {
    const srcs = [];
    if (f.woff2_url) srcs.push(`url("${f.woff2_url}") format("woff2")`);
    if (f.woff_url)  srcs.push(`url("${f.woff_url}") format("woff")`);
    if (f.ttf_url)   srcs.push(`url("${f.ttf_url}") format("truetype")`);
    if (f.eot_url)   srcs.push(`url("${f.eot_url}") format("embedded-opentype")`);
    if (f.svg_url)   srcs.push(`url("${f.svg_url}#${f.family_name}") format("svg")`);
    if (!srcs.length) continue;
    faceRules.push(
      `@font-face{font-family:"${f.family_name}";font-style:normal;font-display:swap;` +
      `font-weight:${f.weight_min || 400} ${f.weight_max || f.weight_min || 400};` +
      `src:${srcs.join(',')};}`
    );
    if (!roleToFamily[f.role]) roleToFamily[f.role] = f.family_name;
  }
  css += faceRules.join('\n');

  const rootBits = [];
  if (roleToFamily.serif) rootBits.push(`--serif:"${roleToFamily.serif}",Georgia,serif;`);
  if (roleToFamily.sans)  rootBits.push(`--sans:"${roleToFamily.sans}",system-ui,sans-serif;`);
  if (roleToFamily.mono)  rootBits.push(`--mono:"${roleToFamily.mono}",ui-monospace,monospace;`);
  if (rootBits.length) css += `\n:root{${rootBits.join('')}}`;

  for (const t of (tokens || [])) {
    if (!t.selector) continue;
    const sel = t.selector.startsWith('paragraph-') || t.selector.startsWith('.')
      ? (t.selector.startsWith('.') ? t.selector : '.' + t.selector)
      : t.selector;
    const fontVar = t.font_role === 'serif' ? 'var(--serif)'
                  : t.font_role === 'mono'  ? 'var(--mono)'
                  : 'var(--sans)';
    css += `\n${sel}{font-family:${fontVar};font-weight:${t.font_weight || '400'};` +
           `font-size:${t.font_size || '1rem'};letter-spacing:${t.letter_spacing || '0'};` +
           `line-height:${t.line_height || '1.5'};}`;
  }
  return css;
}

function applyTypographyCSS(css) {
  if (!css) return;
  let style = document.getElementById('typography-tokens');
  if (!style) {
    style = document.createElement('style');
    style.id = 'typography-tokens';
    document.head.appendChild(style);
  }
  if (style.textContent !== css) style.textContent = css;
}

// Typography CSS is only injected on the public site — admin has its own styles
// and doesn't need (or want) the tokens bleeding into its UI.
if (_isPublicPage) {
  (function applyCachedTypography() {
    try {
      const cached = localStorage.getItem(TYPO_CACHE_KEY);
      if (cached) applyTypographyCSS(cached);
    } catch (e) { /* ignore */ }
  })();

  window._typographyPromise = Promise.all([
    fetch(SUPABASE_REST + '/fonts?select=*', { headers: SUPABASE_HEADERS })
      .then(r => r.ok ? r.json() : []).catch(() => []),
    fetch(SUPABASE_REST + '/typography_tokens?select=*', { headers: SUPABASE_HEADERS })
      .then(r => r.ok ? r.json() : []).catch(() => [])
  ]).then(([fonts, tokens]) => {
    const css = buildTypographyCSS(fonts, tokens);
    try { localStorage.setItem(TYPO_CACHE_KEY, css); } catch (e) { /* quota */ }
    applyTypographyCSS(css);
    return { fonts, tokens, css };
  }).catch(() => ({ fonts: [], tokens: [], css: '' }));
} else {
  window._typographyPromise = Promise.resolve({ fonts: [], tokens: [], css: '' });
}

async function getTypographyData() {
  return await window._typographyPromise;
}

// ── SDK loader (only used by admin.html for writes/auth/storage) ─
window._supabaseClient = null;

async function getSupabaseClient() {
  if (window._supabaseClient) return window._supabaseClient;

  if (!window.supabase) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  window._supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return window._supabaseClient;
}

// ── Site Content CMS — fetch, cache, apply ───────────────────
const CONTENT_CACHE_KEY = 'site_content_v1';

function parseInlineMarkdown(str) {
  return (str || '').replace(/\*(.*?)\*/g, '<em>$1</em>');
}

function applySiteContent(items) {
  if (!Array.isArray(items)) return;
  const map = {};
  items.forEach(item => {
    map[`${item.page}__${item.section}__${item.field_key}`] = item.value;
  });
  document.querySelectorAll('[data-content]').forEach(el => {
    const val = map[el.dataset.content];
    if (val !== undefined) el.innerHTML = parseInlineMarkdown(val);
  });
}

if (_isPublicPage) {
  (function applyCachedContent() {
    try {
      const cached = localStorage.getItem(CONTENT_CACHE_KEY);
      if (cached) applySiteContent(JSON.parse(cached));
    } catch (_) {}
  })();

  window._siteContentPromise = fetch(
    SUPABASE_REST + '/site_content?select=*&page=eq.home&order=sort_order.asc',
    { headers: SUPABASE_HEADERS }
  )
    .then(r => r.ok ? r.json() : [])
    .then(data => {
      applySiteContent(data);
      try { localStorage.setItem(CONTENT_CACHE_KEY, JSON.stringify(data)); } catch (_) {}
      return data;
    })
    .catch(() => []);
} else {
  window._siteContentPromise = Promise.resolve([]);
}
