import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { User, Session } from '@supabase/supabase-js';

export type AuthState =
  | 'INITIALIZING'
  | 'SIGNED_OUT'
  | 'AUTHENTICATING'
  | 'SIGNED_IN'
  | 'PROFILE_INCOMPLETE'
  | 'PROFILE_COMPLETE'
  | 'AUTH_ERROR';

interface AuthContextType {
  authState: AuthState;
  user: User | null;
  session: Session | null;
  profile: any | null;
  refreshProfile: () => Promise<void>;
  setAuthState: (state: AuthState) => void;
}

const AuthContext = createContext<AuthContextType>({
  authState: 'INITIALIZING',
  user: null,
  session: null,
  profile: null,
  refreshProfile: async () => {},
  setAuthState: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>('INITIALIZING');
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any | null>(null);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        // PGRST116: Profile row not found (user metadata trigger not completed yet)
        // PGRST205 / 42P01: profiles table does not exist in backend schema cache (migrations not applied)
        if (error.code === 'PGRST116' || error.code === 'PGRST205' || error.code === '42P01') {
          console.warn(
            'Profiles table missing or profile row not found. Please verify SQL migrations in supabase/migrations/ have been executed in your Supabase SQL Editor.'
          );
          setProfile(null);
          setAuthState('PROFILE_INCOMPLETE');
          return;
        }
        throw error;
      }

      setProfile(data);
      if (data && data.is_profile_completed) {
        setAuthState('PROFILE_COMPLETE');
      } else {
        setAuthState('PROFILE_INCOMPLETE');
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
      setAuthState('AUTH_ERROR');
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    let active = true;

    // 1. Get initial session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (!active) return;
      setSession(initialSession);
      const currentUser = initialSession?.user ?? null;
      setUser(currentUser);
      
      if (currentUser) {
        fetchProfile(currentUser.id);
      } else {
        setAuthState('SIGNED_OUT');
      }
    });

    // 2. Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!active) return;
        setSession(newSession);
        const currentUser = newSession?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          await fetchProfile(currentUser.id);
        } else {
          setProfile(null);
          setAuthState('SIGNED_OUT');
        }
      }
    );

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ authState, user, session, profile, refreshProfile, setAuthState }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
