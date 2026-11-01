import { createClient } from '@supabase/supabase-js';

// Publishable browser credentials; authorization is enforced by database RLS.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || 'https://awfcntpziyorwiigqmel.supabase.co',
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_Sx0gbSbqiqHfGJiuiso16g_EyZm8jiM',
);
export const authRedirect = (mode = 'signin') => `${window.location.origin}/auth?mode=${mode}`;
