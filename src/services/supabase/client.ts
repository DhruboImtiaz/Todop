import { createClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://awfcntpziyorwiigqmel.supabase.co';
// Keep the existing SDK key so previous sign-ins still work after updating.
const storageKey = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;
export type DeviceAccount = Pick<User, 'id' | 'email'>;

// Publishable browser credentials; authorization is enforced by database RLS.
export const supabase = createClient(
  supabaseUrl,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_Sx0gbSbqiqHfGJiuiso16g_EyZm8jiM',
  { auth: { storageKey } },
);

// An expired session cannot refresh while offline. Read the existing identity
// only to select the device cache. All network requests still use SDK auth.
export function readDeviceAccount(): DeviceAccount | null {
  try {
    const user = JSON.parse(localStorage.getItem(storageKey) ?? 'null')?.user;
    if (typeof user?.id !== 'string' || !user.id) return null;
    return { id: user.id, email: typeof user.email === 'string' ? user.email : undefined };
  } catch {
    return null;
  }
}

export const authRedirect = (mode = 'signin') => `${window.location.origin}/auth?mode=${mode}`;
