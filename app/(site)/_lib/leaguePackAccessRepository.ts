import { supabase } from './supabaseClient';
import { coreLeaguePackId, expandGrantedLeaguePackIds, type VisibleLeaguePackId as LeaguePackId } from './leaguePackCatalog';

type LeaguePackAccessRow = {
  pack_key: string;
  enabled: boolean;
};

export async function getEnabledLeaguePacksForUser(userId: string): Promise<LeaguePackId[]> {
  if (!supabase) {
    return [coreLeaguePackId];
  }

  const { data, error } = await supabase
    .from('user_league_pack_access')
    .select('pack_key, enabled')
    .eq('user_id', userId)
    .eq('enabled', true);

  if (error) {
    throw error;
  }

  const grantedPackIds = (data as LeaguePackAccessRow[] | null)?.filter((row) => row.enabled).map((row) => row.pack_key) ?? [];
  return expandGrantedLeaguePackIds(grantedPackIds);
}
