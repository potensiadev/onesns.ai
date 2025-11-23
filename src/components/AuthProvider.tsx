import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * AuthProvider component that manages global authentication state.
 * This component:
 * - Listens for auth state changes
 */
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.email);

      // When user signs in
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        console.log('User signed in or token refreshed');
      }

      // When user signs out
      if (event === 'SIGNED_OUT') {
        console.log('User signed out');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return <>{children}</>;
};
