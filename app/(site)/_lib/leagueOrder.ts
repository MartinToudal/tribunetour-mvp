export const LEAGUE_ORDER = [
  'Superliga',
  '1. division',
  '2. division',
  '3. division',
  'Bundesliga',
  '2. Bundesliga',
  '3. Liga',
  'Premier League',
  'Championship',
  'League One',
  'League Two',
  'Serie A',
  'Serie B',
  'Serie C - Gruppe A',
  'Serie C - Gruppe B',
  'Serie C - Gruppe C',
  'La Liga',
  'Segunda División',
  'Primera Federación - Gruppe 1',
  'Primera Federación - Gruppe 2',
] as const;

const leagueRankMap = new Map<string, number>(LEAGUE_ORDER.map((league, index) => [league, index]));

export function compareLeagues(a: string, b: string): number {
  const rankA = leagueRankMap.get(a) ?? Number.MAX_SAFE_INTEGER;
  const rankB = leagueRankMap.get(b) ?? Number.MAX_SAFE_INTEGER;

  if (rankA !== rankB) {
    return rankA - rankB;
  }

  return a.localeCompare(b, 'da');
}

export function sortLeagues<T extends string>(leagues: T[]): T[] {
  return [...leagues].sort((a, b) => compareLeagues(a, b));
}
