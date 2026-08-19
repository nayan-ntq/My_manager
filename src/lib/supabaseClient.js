import { createClient } from "@supabase/supabase-js";

// These are safe to ship in client code: the publishable key only ever
// grants access allowed by this project's Row Level Security policies
// (see supabase/schema.sql — every table is scoped to auth.uid()).
const SUPABASE_URL = "https://iupvyckoztcslgalbfyq.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_TaGNveSyiU-ZThkhS5QjQA_X9X-Mq3J";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
export const supabaseConfigured = true;
