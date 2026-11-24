import { createClient } from '@supabase/supabase-js';

// Vite env variables keep the connection details out of the source code,
// while preserving a safe fallback for local dev when the env file is not present.
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://mkjicpjvavptosgaalqb.supabase.co';

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_wwuJr8z_29tVwrh22ODT3w_v0xLlEAe';

export const createMavoryiSupabaseClient = (storageKey) => createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey,
    persistSession: true,
    autoRefreshToken: true,
  },
});

export const customerSupabase = createMavoryiSupabaseClient('mavoryi-customer-auth');
