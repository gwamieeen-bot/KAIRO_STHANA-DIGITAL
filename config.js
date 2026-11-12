// KAIRO STHANA — SUPABASE CONFIG
// Isi 2 nilai ini dari Project Settings > API di Supabase.
// Gunakan Publishable/anon key saja. JANGAN taruh service_role key di sini.
window.KAIRO_SUPABASE = {
  url: "https://YOUR-PROJECT.supabase.co",
  anonKey: "YOUR_PUBLISHABLE_OR_ANON_KEY"
};

// Optional KAIRO Mascot AI backend.
// Static/local mode tetap jalan tanpa ini. Saat memakai server.mjs, endpoint ini aktif.
window.KAIRO_AI_ENDPOINT = "/api/kairo-ai";
