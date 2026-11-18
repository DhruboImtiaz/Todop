import { createContext } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { DeviceAccount } from '../services/supabase/client';
interface AuthState {
  account: DeviceAccount | null;
  session: Session | null;
  loading: boolean;
  recovery: boolean;
  error: string;
  finishRecovery: () => void;
}
export const AuthContext = createContext<AuthState | null>(null);
