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
        ? url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/') + '?width=1200&quality=70&format=webp'
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
