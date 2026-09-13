import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isRecovery: boolean;
  signIn: (email: string, password?: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password?: string) => Promise<{ error: Error | null }>;
  resetPasswordForEmail: (email: string) => Promise<{ error: Error | null }>;
  verifyRecoveryOtp: (email: string, token: string) => Promise<{ error: Error | null }>;
  updateUserPassword: (password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRecovery, setIsRecovery] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.sessionStorage.getItem('todop_recovery') === 'true';
    }
    return false;
  });

  useEffect(() => {
    let mounted = true;

    // Fetch initial session
    const initializeAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Error fetching initial session:', error.message);
        }
        if (mounted) {
          setSession(data.session);
          setUser(data.session?.user ?? null);
          setLoading(false);
        }
      } catch (err) {
        console.error('Unexpected error during auth initialization:', err);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        if (mounted) {
          if (event === 'PASSWORD_RECOVERY') {
            setIsRecovery(true);
            if (typeof window !== 'undefined') {
              window.sessionStorage.setItem('todop_recovery', 'true');
            }
          } else if (event === 'SIGNED_OUT') {
            setIsRecovery(false);
            if (typeof window !== 'undefined') {
              window.sessionStorage.removeItem('todop_recovery');
            }
          }

          setSession(currentSession);
          setUser(currentSession?.user ?? null);
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password?: string) => {
    // Basic email/password for now
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: password || '', // Required by Supabase if using email/password
    });
    return { error };
  };

  const signUp = async (email: string, password?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password: password || '',
    });
    return { error };
  };

  const resetPasswordForEmail = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    return { error };
  };

  const verifyRecoveryOtp = async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'recovery' });
    return { error };
  };

  const updateUserPassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        loading,
        isRecovery,
        signIn,
        signUp,
        resetPasswordForEmail,
        verifyRecoveryOtp,
        updateUserPassword,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
