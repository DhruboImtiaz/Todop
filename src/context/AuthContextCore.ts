import { createContext } from 'react';
import type { Session } from '@supabase/supabase-js';
interface AuthState { session: Session | null; loading: boolean; recovery: boolean; error: string; finishRecovery: () => void }
export const AuthContext = createContext<AuthState | null>(null);
