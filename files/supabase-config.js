// ============================================================
// SUPABASE CONFIGURATION
// Replace these values with your own from supabase.com
// Project Settings > API
// ============================================================

const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_PUBLIC_KEY';

// Load the Supabase client from CDN
// (added in the HTML via <script> before this file)
// We expose a global `supabase` client
window._supabaseClient = null;

async function getSupabaseClient() {
  if (window._supabaseClient) return window._supabaseClient;

  // Dynamically load Supabase SDK if not already loaded
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
