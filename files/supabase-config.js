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

// ── Global Fonts (type_styles) — fetch, cache, inject ────────
const TYPE_STYLES_CACHE_KEY = 'type_styles_css_v1';

function buildTypeStylesCSS(fonts, styles) {
  let css = '';

  // @font-face + CSS vars (reuse existing font logic)
  const faceRules = [];
  const roleToFamily = {};
  for (const f of (fonts || [])) {
    const srcs = [];
    if (f.woff2_url) srcs.push(`url("${f.woff2_url}") format("woff2")`);
    if (f.woff_url)  srcs.push(`url("${f.woff_url}") format("woff")`);
    if (f.ttf_url)   srcs.push(`url("${f.ttf_url}") format("truetype")`);
    if (!srcs.length) continue;
    faceRules.push(
      `@font-face{font-family:"${f.family_name}";font-style:normal;font-display:swap;` +
      `font-weight:${f.weight_min||400} ${f.weight_max||f.weight_min||400};src:${srcs.join(',')};}`
    );
    if (!roleToFamily[f.role]) roleToFamily[f.role] = f.family_name;
  }
  css += faceRules.join('\n');

  const rootBits = [];
  if (roleToFamily.serif) rootBits.push(`--serif:"${roleToFamily.serif}",Georgia,serif;`);
  if (roleToFamily.sans)  rootBits.push(`--sans:"${roleToFamily.sans}",system-ui,sans-serif;`);
  if (roleToFamily.mono)  rootBits.push(`--mono:"${roleToFamily.mono}",ui-monospace,monospace;`);
  if (rootBits.length) css += `\n:root{${rootBits.join('')}}`;

  for (const s of (styles || [])) {
    if (!s.css_targets) continue;
    const t   = s.css_targets;
    const fam = s.font_role === 'serif' ? 'var(--serif)' : s.font_role === 'mono' ? 'var(--mono)' : 'var(--sans)';
    css += `\n${t}{font-family:${fam};font-weight:${s.font_weight||'400'};font-size:${s.font_size||'1rem'};` +
           `line-height:${s.line_height||'1.5'};letter-spacing:${s.letter_spacing||'0'};text-transform:${s.text_transform||'none'};}`;

    if (s.font_size_tablet || s.line_height_tablet) {
      css += `\n@media(max-width:1024px){${t}{`;
      if (s.font_size_tablet)   css += `font-size:${s.font_size_tablet};`;
      if (s.line_height_tablet) css += `line-height:${s.line_height_tablet};`;
      css += '}}';
    }
    if (s.font_size_mobile || s.line_height_mobile) {
      css += `\n@media(max-width:640px){${t}{`;
      if (s.font_size_mobile)   css += `font-size:${s.font_size_mobile};`;
      if (s.line_height_mobile) css += `line-height:${s.line_height_mobile};`;
      css += '}}';
    }
  }
  return css;
}

function applyTypeStylesCSS(css) {
  if (!css) return;
  let el = document.getElementById('type-styles-css');
  if (!el) {
    el = document.createElement('style');
    el.id = 'type-styles-css';
    document.head.appendChild(el);
  }
  if (el.textContent !== css) el.textContent = css;
}

if (_isPublicPage) {
  (function applyCachedTypeStyles() {
    try {
      const cached = localStorage.getItem(TYPE_STYLES_CACHE_KEY);
      if (cached) applyTypeStylesCSS(cached);
    } catch (_) {}
  })();

  window._typeStylesPromise = Promise.all([
    fetch(SUPABASE_REST + '/fonts?select=*', { headers: SUPABASE_HEADERS })
      .then(r => r.ok ? r.json() : []).catch(() => []),
    fetch(SUPABASE_REST + '/type_styles?select=*&order=sort_order.asc', { headers: SUPABASE_HEADERS })
      .then(r => r.ok ? r.json() : []).catch(() => [])
  ]).then(([fonts, styles]) => {
    const css = buildTypeStylesCSS(fonts, styles);
    try { localStorage.setItem(TYPE_STYLES_CACHE_KEY, css); } catch (_) {}
    applyTypeStylesCSS(css);
    return { fonts, styles, css };
  }).catch(() => ({ fonts: [], styles: [], css: '' }));
} else {
  window._typeStylesPromise = Promise.resolve({ fonts: [], styles: [], css: '' });
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

// ── Global Colors CMS — fetch, cache, inject ─────────────────
const COLOR_CACHE_KEY = 'color_css_v1';

function buildColorsCSS(families, tokens, assignments) {
  const byFamily = {};
  for (const t of (tokens || [])) {
    if (!byFamily[t.family_name]) byFamily[t.family_name] = {};
    byFamily[t.family_name][t.shade] = t;
  }

  let lightRoot = '';
  let darkRoot  = '';

  for (const fam of (families || [])) {
    const shades = byFamily[fam.name] || {};
    for (const [shade, t] of Object.entries(shades)) {
      lightRoot += `--${fam.name}-${shade}:${t.value};`;
      if (t.dark_value) darkRoot += `--${fam.name}-${shade}:${t.dark_value};`;
    }
  }

  for (const a of (assignments || [])) {
    if (a.light_token) lightRoot += `${a.css_var}:var(--${a.light_token.replace('/', '-')});`;
    if (a.dark_token)  darkRoot  += `${a.css_var}:var(--${a.dark_token.replace('/', '-')});`;
  }

  let css = `:root{${lightRoot}}`;
  if (darkRoot) css += `[data-theme="dark"]{${darkRoot}}`;
  return css;
}

function applyColorsCSS(css) {
  if (!css) return;
  let el = document.getElementById('color-tokens-css');
  if (!el) {
    el = document.createElement('style');
    el.id = 'color-tokens-css';
    document.head.appendChild(el);
  }
  if (el.textContent !== css) el.textContent = css;
}

if (_isPublicPage) {
  (function applyCachedColors() {
    try {
      const cached = localStorage.getItem(COLOR_CACHE_KEY);
      if (cached) applyColorsCSS(cached);
    } catch (_) {}
  })();

  window._colorsPromise = Promise.all([
    fetch(SUPABASE_REST + '/color_families?select=*&order=sort_order.asc', { headers: SUPABASE_HEADERS })
      .then(r => r.ok ? r.json() : []).catch(() => []),
    fetch(SUPABASE_REST + '/color_tokens?select=*', { headers: SUPABASE_HEADERS })
      .then(r => r.ok ? r.json() : []).catch(() => []),
    fetch(SUPABASE_REST + '/color_assignments?select=*&order=sort_order.asc', { headers: SUPABASE_HEADERS })
      .then(r => r.ok ? r.json() : []).catch(() => [])
  ]).then(([families, tokens, assignments]) => {
    const css = buildColorsCSS(families, tokens, assignments);
    try { localStorage.setItem(COLOR_CACHE_KEY, css); } catch (_) {}
    applyColorsCSS(css);
    return { families, tokens, assignments, css };
  }).catch(() => ({ families: [], tokens: [], assignments: [], css: '' }));
} else {
  window._colorsPromise = Promise.resolve({ families: [], tokens: [], assignments: [], css: '' });
}

async function getColorsData() {
  return await window._colorsPromise;
}

// ── Global Buttons CSS ───────────────────────────────────────
const BUTTON_CACHE_KEY = 'button_css_v1';

function buildButtonsCSS(sizes, styles) {
  let css = '.btn{display:inline-flex;align-items:center;justify-content:center;border-style:solid;font-family:inherit;cursor:pointer;transition:all 0.15s;text-decoration:none;line-height:1;white-space:nowrap;}';
  for (const s of (sizes || [])) {
    if (!s.name) continue;
    css += `\n.btn-${s.name}{padding:${s.padding_y||'8px'} ${s.padding_x||'12px'};font-size:${s.font_size||'14px'};border-radius:${s.border_radius||'6px'};gap:${s.icon_gap||'6px'};}`;
  }
  for (const b of (styles || [])) {
    if (!b.variant || !b.color) continue;
    const cls = `.btn-${b.variant}.btn-${b.color}`;
    css += `\n${cls}{background:${b.bg_color||'transparent'};color:${b.text_color||'#000'};border-color:${b.border_color||'transparent'};border-width:${b.border_width||'0px'};}`;
    const hHas = b.hover_bg_color || b.hover_text_color || b.hover_border_color || b.hover_opacity;
    if (hHas) {
      css += `\n${cls}:hover{`;
      if (b.hover_bg_color)     css += `background:${b.hover_bg_color};`;
      if (b.hover_text_color)   css += `color:${b.hover_text_color};`;
      if (b.hover_border_color) css += `border-color:${b.hover_border_color};`;
      if (b.hover_opacity)      css += `opacity:${b.hover_opacity};`;
      css += `}`;
    }
    const aHas = b.active_bg_color || b.active_text_color || b.active_border_color;
    if (aHas) {
      css += `\n${cls}:active{`;
      if (b.active_bg_color)     css += `background:${b.active_bg_color};`;
      if (b.active_text_color)   css += `color:${b.active_text_color};`;
      if (b.active_border_color) css += `border-color:${b.active_border_color};`;
      css += `}`;
    }
    css += `\n${cls}:disabled,${cls}[aria-disabled="true"]{opacity:${b.disabled_opacity||'0.4'};cursor:not-allowed;pointer-events:none;}`;
  }
  return css;
}

function applyButtonsCSS(css) {
  if (!css) return;
  let el = document.getElementById('button-tokens-css');
  if (!el) { el = document.createElement('style'); el.id = 'button-tokens-css'; document.head.appendChild(el); }
  if (el.textContent !== css) el.textContent = css;
}

if (_isPublicPage) {
  (function applyCachedButtons() {
    try { const c = localStorage.getItem(BUTTON_CACHE_KEY); if (c) applyButtonsCSS(c); } catch (_) {}
  })();

  window._buttonsPromise = Promise.all([
    fetch(SUPABASE_REST + '/button_sizes?select=*&order=sort_order.asc',  { headers: SUPABASE_HEADERS }).then(r => r.ok ? r.json() : []),
    fetch(SUPABASE_REST + '/button_styles?select=*&order=sort_order.asc', { headers: SUPABASE_HEADERS }).then(r => r.ok ? r.json() : []),
  ]).then(([sizes, styles]) => {
    const css = buildButtonsCSS(sizes, styles);
    try { localStorage.setItem(BUTTON_CACHE_KEY, css); } catch (_) {}
    applyButtonsCSS(css);
    return { sizes, styles, css };
  }).catch(() => ({ sizes: [], styles: [], css: '' }));
} else {
  window._buttonsPromise = Promise.resolve({ sizes: [], styles: [], css: '' });
}

async function getButtonsData() {
  return await window._buttonsPromise;
}
