// ============================================================
// SUPABASE CONFIGURATION
// Replace these values with your own from supabase.com
// Project Settings > API
// ============================================================

const SUPABASE_URL = 'https://srghujzrbojuzilyswrf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyZ2h1anpyYm9qdXppbHlzd3JmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MjIwMjYsImV4cCI6MjA5MjI5ODAyNn0.1C5fDVoAK6Na_oh5d4SIXZ6cdp54bbuRJqxJz92hPfQ';

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
