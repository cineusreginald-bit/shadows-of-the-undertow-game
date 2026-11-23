// Shadow Run · backend settings.
// Both values come from Supabase > Project Settings > API (or the "Connect" button).
// The publishable key is made to be public. Row Level Security in supabase/schema.sql is what protects the data.
// Leave either one empty and the game runs exactly as before, with no leaderboard and no stats.
window.SR_CONFIG = {
  url: "",   // e.g. https://abcdefghijkl.supabase.co
  key: ""    // publishable key (older projects call it the anon key). Never the secret / service_role key.
};
