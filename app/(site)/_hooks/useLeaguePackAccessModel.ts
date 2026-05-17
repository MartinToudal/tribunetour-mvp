'use client';

import { useEffect, useMemo, useState } from 'react';
import { getEnabledLeaguePacksForUser } from '../_lib/leaguePackAccessRepository';
import { getSelectableLeaguePackIds, type LeaguePackId } from '../_lib/leaguePacks';
import { supabase } from '../_lib/supabaseClient';

export function useLeaguePackAccessModel() {
  const [userId, setUserId] = useState<string | null>(null);
  const [enabledPackIds, setEnabledPackIds] = useState<LeaguePackId[]>(['core_denmark']);
  const [isLoadingLeaguePackAccess, setIsLoadingLeaguePackAccess] = useState(false);
  const [leaguePackAccessError, setLeaguePackAccessError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
      if (!session?.user?.id) {
        setEnabledPackIds(['core_denmark']);
        setLeaguePackAccessError(null);
      }
    });

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || !userId) {
      return;
    }

    let isCancelled = false;
    setIsLoadingLeaguePackAccess(true);
    setLeaguePackAccessError(null);

    getEnabledLeaguePacksForUser(userId)
      .then((packIds) => {
        if (isCancelled) {
          return;
        }

        const selectablePackIds = new Set(getSelectableLeaguePackIds());
        setEnabledPackIds(packIds.filter((packId) => selectablePackIds.has(packId)));
        setIsLoadingLeaguePackAccess(false);
      })
      .catch((error) => {
        if (isCancelled) {
          return;
        }
        console.error(error);
        setEnabledPackIds(['core_denmark']);
        setLeaguePackAccessError('Kunne ikke hente dine premium-adgange lige nu.');
        setIsLoadingLeaguePackAccess(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [userId]);

  const enabledPackIdSet = useMemo(() => new Set(enabledPackIds), [enabledPackIds]);

  return {
    enabledPackIds,
    enabledPackIdSet,
    isLoadingLeaguePackAccess,
    leaguePackAccessError,
  };
}
