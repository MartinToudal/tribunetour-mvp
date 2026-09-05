'use client';

import { useEffect, useState } from 'react';
import { hasSupabaseEnv, supabase } from '../_lib/supabaseClient';

export const CLUB_CHECK_ADMIN_EMAIL = 'martin@toudal.dk';

type ClubCheckAdminAccess = {
  isLoading: boolean;
  isAdmin: boolean;
  userEmail: string | null;
};

export function useClubCheckAdminAccess(): ClubCheckAdminAccess {
  const [state, setState] = useState<ClubCheckAdminAccess>({
    isLoading: true,
    isAdmin: false,
    userEmail: null,
  });

  useEffect(() => {
    if (!hasSupabaseEnv || !supabase) {
      setState({ isLoading: false, isAdmin: false, userEmail: null });
      return;
    }

    const client = supabase;

    let mounted = true;

    async function loadAccess() {
      const { data: userData, error: userError } = await client.auth.getUser();
      if (userError || !userData.user) {
        if (mounted) setState({ isLoading: false, isAdmin: false, userEmail: null });
        return;
      }

      const userEmail = userData.user.email?.trim().toLowerCase() ?? null;
      if (userEmail !== CLUB_CHECK_ADMIN_EMAIL) {
        if (mounted) setState({ isLoading: false, isAdmin: false, userEmail });
        return;
      }

      const { data: adminData, error: adminError } = await client.rpc('is_current_user_admin');
      if (mounted) {
        setState({
          isLoading: false,
          isAdmin: !adminError && Boolean(adminData),
          userEmail,
        });
      }
    }

    void loadAccess();
    const { data: authData } = client.auth.onAuthStateChange(() => {
      void loadAccess();
    });

    return () => {
      mounted = false;
      authData.subscription.unsubscribe();
    };
  }, []);

  return state;
}
