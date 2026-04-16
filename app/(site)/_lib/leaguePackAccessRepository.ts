import { supabase } from './supabaseClient';
import type { LeaguePackId } from './leaguePacks';

type LeaguePackAccessRow = {
  pack_key: string;
  enabled: boolean;
};

export async function getEnabledLeaguePacksForUser(userId: string): Promise<LeaguePackId[]> {
  if (!supabase) {
    return ['core_denmark'];
  }

  const { data, error } = await supabase
    .from('user_league_pack_access')
    .select('pack_key, enabled')
    .eq('user_id', userId)
    .eq('enabled', true);

  if (error) {
    throw error;
  }

  const ids = new Set<LeaguePackId>(['core_denmark']);
  (data as LeaguePackAccessRow[] | null)?.forEach((row) => {
    if (
      row.enabled &&
      (row.pack_key === 'core_denmark' ||
        row.pack_key === 'germany_top_3' ||
        row.pack_key === 'england_top_4')
    ) {
      ids.add(row.pack_key);
    }
  });

  return Array.from(ids);
}
