import { createClient } from "@supabase/supabase-js";

// The anon key is publishable by design; all protection lives in
// row-level security policies (see supabase/platform_schema.sql).
// Dev repo points at the DEV Supabase project; master at PROD.
const SUPABASE_URL = "https://rlaqpzeqmmlrdeqfbjyq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_pFmJCkvttv7J3JUsLGdD1g_UgXwCzyy";

export const configMissing = SUPABASE_URL.startsWith("REPLACE");

export const supabase = createClient(
  configMissing ? "https://placeholder.supabase.co" : SUPABASE_URL,
  configMissing ? "placeholder" : SUPABASE_ANON_KEY
);
