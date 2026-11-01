import { useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AuthContext } from './AuthContextCore';
import { supabase } from '../services/supabase/client';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovery, setRecovery] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    let observed = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      observed = true;
      setSession(next);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'SIGNED_OUT') setRecovery(false);
      setLoading(false);
    });
    void supabase.auth.getSession().then(({ data, error: failure }) => {
      if (!active || observed) return;
      setSession(data.session);
      if (failure) setError(failure.message);
      setLoading(false);
    }).catch(() => {
      if (active) { setError('Could not restore your session. Please sign in again.'); setLoading(false); }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  return <AuthContext.Provider value={{ session, loading, recovery, error, finishRecovery: () => setRecovery(false) }}>{children}</AuthContext.Provider>;
}
