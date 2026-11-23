// Shadow Run · backend settings.
// Both values come from Supabase > Project Settings > API (or the "Connect" button).
// The publishable key is made to be public. Row Level Security in supabase/schema.sql is what protects the data.
// Leave either one empty and the game runs exactly as before, with no leaderboard and no stats.
window.SR_CONFIG = {
  url: "https://cpcbnrwlpxbtjjomging.supabase.co",   // e.g. https://abcdefghijkl.supabase.co
  key: "sb_publishable_60u-9t9kpi75e6LhChLvyQ_VDwihUsQ"    // publishable key (older projects call it the anon key). Never the secret / service_role key.
};
