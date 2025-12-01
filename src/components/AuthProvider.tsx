import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Session, User } from '@supabase/supabase-js';
import { Loader2 } from 'lucide-react';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  authReady: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * AuthProvider component that manages global authentication state and ensures
 * children render only after the initial session has been resolved.
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let active = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!active) return;
      setSession(newSession ?? null);
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED' || event === 'SIGNED_OUT' || event === 'PASSWORD_RECOVERY') {
        setAuthReady(true);
      }
    });

    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (!active) return;
        if (error) {
          console.error('Error initializing auth session', error);
        }
        setSession(session ?? null);
        setAuthReady(true);
      })
      .catch((error) => {
        if (!active) return;
        console.error('Unexpected error initializing auth session', error);
        setAuthReady(true);
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    authReady,
  }), [session, authReady]);

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
