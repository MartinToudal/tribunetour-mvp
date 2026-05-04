import { getCompetitionCatalogEntryByLeagueName } from './competitionCatalog';

export function compareLeagues(a: string, b: string): number {
  const rankA = getCompetitionCatalogEntryByLeagueName(a)?.sortOrder ?? Number.MAX_SAFE_INTEGER;
  const rankB = getCompetitionCatalogEntryByLeagueName(b)?.sortOrder ?? Number.MAX_SAFE_INTEGER;

  if (rankA !== rankB) {
    return rankA - rankB;
  }

  return a.localeCompare(b, 'da');
}

export function sortLeagues<T extends string>(leagues: T[]): T[] {
  return [...leagues].sort((a, b) => compareLeagues(a, b));
}
