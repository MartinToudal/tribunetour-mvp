import type { LeaguePackId } from './leaguePackCatalog';

export type CompetitionKind = 'domestic_league' | 'european_cup';
export type CompetitionMembershipStatus = 'active' | 'relegated' | 'historical';

export type CompetitionMembership = {
  competitionId: string;
  seasonId?: string;
  status: CompetitionMembershipStatus;
  isPrimary: boolean;
};

export type CompetitionCatalogEntry = {
  id: string;
  countryCode: string | null;
  leaguePackId: LeaguePackId | null;
  name: string;
  type: CompetitionKind;
  level: number | null;
  groupKey: string | null;
  sortOrder: number;
  isPrimaryDomestic: boolean;
  isPremiumEligible: boolean;
  aliases: string[];
};

export const competitionCatalog: CompetitionCatalogEntry[] = [
  { id: 'dk-superliga', countryCode: 'dk', leaguePackId: 'core_denmark', name: 'Superliga', type: 'domestic_league', level: 1, groupKey: null, sortOrder: 0, isPrimaryDomestic: true, isPremiumEligible: false, aliases: ['superliga'] },
  { id: 'dk-1-division', countryCode: 'dk', leaguePackId: 'core_denmark', name: '1. division', type: 'domestic_league', level: 2, groupKey: null, sortOrder: 1, isPrimaryDomestic: true, isPremiumEligible: false, aliases: ['1. division', '1 division'] },
  { id: 'dk-2-division', countryCode: 'dk', leaguePackId: 'core_denmark', name: '2. division', type: 'domestic_league', level: 3, groupKey: null, sortOrder: 2, isPrimaryDomestic: true, isPremiumEligible: false, aliases: ['2. division', '2 division'] },
  { id: 'dk-3-division', countryCode: 'dk', leaguePackId: 'core_denmark', name: '3. division', type: 'domestic_league', level: 4, groupKey: null, sortOrder: 3, isPrimaryDomestic: true, isPremiumEligible: false, aliases: ['3. division', '3 division'] },
  { id: 'de-bundesliga', countryCode: 'de', leaguePackId: 'germany_top_3', name: 'Bundesliga', type: 'domestic_league', level: 1, groupKey: null, sortOrder: 10, isPrimaryDomestic: true, isPremiumEligible: true, aliases: ['bundesliga', 'bundelsliga'] },
  { id: 'de-2-bundesliga', countryCode: 'de', leaguePackId: 'germany_top_3', name: '2. Bundesliga', type: 'domestic_league', level: 2, groupKey: null, sortOrder: 11, isPrimaryDomestic: true, isPremiumEligible: true, aliases: ['2. bundesliga', '2 bundesliga'] },
  { id: 'de-3-liga', countryCode: 'de', leaguePackId: 'germany_top_3', name: '3. Liga', type: 'domestic_league', level: 3, groupKey: null, sortOrder: 12, isPrimaryDomestic: true, isPremiumEligible: true, aliases: ['3. liga', '3 liga'] },
  { id: 'en-premier-league', countryCode: 'en', leaguePackId: 'england_top_4', name: 'Premier League', type: 'domestic_league', level: 1, groupKey: null, sortOrder: 20, isPrimaryDomestic: true, isPremiumEligible: true, aliases: ['premier league'] },
  { id: 'en-championship', countryCode: 'en', leaguePackId: 'england_top_4', name: 'Championship', type: 'domestic_league', level: 2, groupKey: null, sortOrder: 21, isPrimaryDomestic: true, isPremiumEligible: true, aliases: ['championship'] },
  { id: 'en-league-one', countryCode: 'en', leaguePackId: 'england_top_4', name: 'League One', type: 'domestic_league', level: 3, groupKey: null, sortOrder: 22, isPrimaryDomestic: true, isPremiumEligible: true, aliases: ['league one'] },
  { id: 'en-league-two', countryCode: 'en', leaguePackId: 'england_top_4', name: 'League Two', type: 'domestic_league', level: 4, groupKey: null, sortOrder: 23, isPrimaryDomestic: true, isPremiumEligible: true, aliases: ['league two'] },
  { id: 'it-serie-a', countryCode: 'it', leaguePackId: 'italy_top_3', name: 'Serie A', type: 'domestic_league', level: 1, groupKey: null, sortOrder: 30, isPrimaryDomestic: true, isPremiumEligible: true, aliases: ['serie a'] },
  { id: 'it-serie-b', countryCode: 'it', leaguePackId: 'italy_top_3', name: 'Serie B', type: 'domestic_league', level: 2, groupKey: null, sortOrder: 31, isPrimaryDomestic: true, isPremiumEligible: true, aliases: ['serie b'] },
  { id: 'it-serie-c-gruppe-a', countryCode: 'it', leaguePackId: 'italy_top_3', name: 'Serie C - Gruppe A', type: 'domestic_league', level: 3, groupKey: 'a', sortOrder: 32, isPrimaryDomestic: true, isPremiumEligible: true, aliases: ['serie c - gruppe a'] },
  { id: 'it-serie-c-gruppe-b', countryCode: 'it', leaguePackId: 'italy_top_3', name: 'Serie C - Gruppe B', type: 'domestic_league', level: 3, groupKey: 'b', sortOrder: 33, isPrimaryDomestic: true, isPremiumEligible: true, aliases: ['serie c - gruppe b'] },
  { id: 'it-serie-c-gruppe-c', countryCode: 'it', leaguePackId: 'italy_top_3', name: 'Serie C - Gruppe C', type: 'domestic_league', level: 3, groupKey: 'c', sortOrder: 34, isPrimaryDomestic: true, isPremiumEligible: true, aliases: ['serie c - gruppe c'] },
  { id: 'es-la-liga', countryCode: 'es', leaguePackId: 'spain_top_4', name: 'La Liga', type: 'domestic_league', level: 1, groupKey: null, sortOrder: 40, isPrimaryDomestic: true, isPremiumEligible: true, aliases: ['la liga'] },
  { id: 'es-segunda-division', countryCode: 'es', leaguePackId: 'spain_top_4', name: 'Segunda División', type: 'domestic_league', level: 2, groupKey: null, sortOrder: 41, isPrimaryDomestic: true, isPremiumEligible: true, aliases: ['segunda division', 'segunda división'] },
  { id: 'es-primera-federacion-gruppe-1', countryCode: 'es', leaguePackId: 'spain_top_4', name: 'Primera Federación - Gruppe 1', type: 'domestic_league', level: 3, groupKey: '1', sortOrder: 42, isPrimaryDomestic: true, isPremiumEligible: true, aliases: ['primera federacion - gruppe 1', 'primera federación - gruppe 1'] },
  { id: 'es-primera-federacion-gruppe-2', countryCode: 'es', leaguePackId: 'spain_top_4', name: 'Primera Federación - Gruppe 2', type: 'domestic_league', level: 3, groupKey: '2', sortOrder: 43, isPrimaryDomestic: true, isPremiumEligible: true, aliases: ['primera federacion - gruppe 2', 'primera federación - gruppe 2'] },
  { id: 'fr-ligue-1', countryCode: 'fr', leaguePackId: 'france_top_3', name: 'Ligue 1', type: 'domestic_league', level: 1, groupKey: null, sortOrder: 50, isPrimaryDomestic: true, isPremiumEligible: true, aliases: ['ligue 1'] },
  { id: 'fr-ligue-2', countryCode: 'fr', leaguePackId: 'france_top_3', name: 'Ligue 2', type: 'domestic_league', level: 2, groupKey: null, sortOrder: 51, isPrimaryDomestic: true, isPremiumEligible: true, aliases: ['ligue 2'] },
  { id: 'fr-national', countryCode: 'fr', leaguePackId: 'france_top_3', name: 'National', type: 'domestic_league', level: 3, groupKey: null, sortOrder: 52, isPrimaryDomestic: true, isPremiumEligible: true, aliases: ['national'] },
  { id: 'pt-liga-portugal', countryCode: 'pt', leaguePackId: 'portugal_top_3', name: 'Liga Portugal', type: 'domestic_league', level: 1, groupKey: null, sortOrder: 60, isPrimaryDomestic: true, isPremiumEligible: true, aliases: ['liga portugal', 'primeira liga'] },
  { id: 'pt-liga-portugal-2', countryCode: 'pt', leaguePackId: 'portugal_top_3', name: 'Liga Portugal 2', type: 'domestic_league', level: 2, groupKey: null, sortOrder: 61, isPrimaryDomestic: true, isPremiumEligible: true, aliases: ['liga portugal 2', 'segunda liga'] },
  { id: 'pt-liga-3-oprykningsgruppe', countryCode: 'pt', leaguePackId: 'portugal_top_3', name: 'Liga 3 - Oprykningsgruppe', type: 'domestic_league', level: 3, groupKey: 'promotion', sortOrder: 62, isPrimaryDomestic: true, isPremiumEligible: true, aliases: ['liga 3 - oprykningsgruppe', 'liga 3 promotion stage', 'liga 3 promotion group'] },
  { id: 'nl-eredivisie', countryCode: 'nl', leaguePackId: 'netherlands_top_3', name: 'Eredivisie', type: 'domestic_league', level: 1, groupKey: null, sortOrder: 70, isPrimaryDomestic: true, isPremiumEligible: true, aliases: ['eredivisie', 'aeresdivisionen', 'æresdivisionen'] },
  { id: 'nl-eerste-divisie', countryCode: 'nl', leaguePackId: 'netherlands_top_3', name: 'Eerste Divisie', type: 'domestic_league', level: 2, groupKey: null, sortOrder: 71, isPrimaryDomestic: true, isPremiumEligible: true, aliases: ['eerste divisie'] },
  { id: 'nl-tweede-divisie', countryCode: 'nl', leaguePackId: 'netherlands_top_3', name: 'Tweede Divisie', type: 'domestic_league', level: 3, groupKey: null, sortOrder: 72, isPrimaryDomestic: true, isPremiumEligible: true, aliases: ['tweede divisie'] },
  { id: 'nl-promotion-relegation-playoffs', countryCode: 'nl', leaguePackId: 'netherlands_top_3', name: 'Promotie/degradatie play-offs', type: 'domestic_league', level: null, groupKey: 'playoff', sortOrder: 73, isPrimaryDomestic: false, isPremiumEligible: true, aliases: ['promotie/degradatie play-offs', 'eredivisie playoffs', 'promotion relegation playoffs'] },
  { id: 'be-jupiler-pro-league', countryCode: 'be', leaguePackId: 'belgium_top_3', name: 'Jupiler Pro League', type: 'domestic_league', level: 1, groupKey: null, sortOrder: 80, isPrimaryDomestic: true, isPremiumEligible: true, aliases: ['jupiler pro league', 'jupiler league'] },
  { id: 'be-challenger-pro-league', countryCode: 'be', leaguePackId: 'belgium_top_3', name: 'Challenger Pro League', type: 'domestic_league', level: 2, groupKey: null, sortOrder: 81, isPrimaryDomestic: true, isPremiumEligible: true, aliases: ['challenger pro league'] },
  { id: 'be-national-division-1-acff', countryCode: 'be', leaguePackId: 'belgium_top_3', name: 'National Division 1 ACFF', type: 'domestic_league', level: 3, groupKey: 'acff', sortOrder: 82, isPrimaryDomestic: true, isPremiumEligible: true, aliases: ['national division 1 acff'] },
  { id: 'be-national-division-1-vv', countryCode: 'be', leaguePackId: 'belgium_top_3', name: 'National Division 1 VV', type: 'domestic_league', level: 3, groupKey: 'vv', sortOrder: 83, isPrimaryDomestic: true, isPremiumEligible: true, aliases: ['national division 1 vv'] },
  { id: 'be-pro-league-relegation-playoffs', countryCode: 'be', leaguePackId: 'belgium_top_3', name: 'Jupiler Pro League - Nedrykningsgruppe', type: 'domestic_league', level: null, groupKey: 'relegation-playoff', sortOrder: 84, isPrimaryDomestic: false, isPremiumEligible: true, aliases: ['jupiler pro league - nedrykningsgruppe', 'jupiler league - nedrykningsgruppe'] },
  { id: 'be-pro-league-champions-playoffs', countryCode: 'be', leaguePackId: 'belgium_top_3', name: 'Jupiler Pro League - Mesterskabsspil', type: 'domestic_league', level: null, groupKey: 'championship-playoff', sortOrder: 85, isPrimaryDomestic: false, isPremiumEligible: true, aliases: ['jupiler pro league - mesterskabsspil', 'jupiler league - mesterskabet - slutspil'] },
  { id: 'be-pro-league-europe-playoffs', countryCode: 'be', leaguePackId: 'belgium_top_3', name: 'Jupiler Pro League - Conference League Gruppe', type: 'domestic_league', level: null, groupKey: 'conference-playoff', sortOrder: 86, isPrimaryDomestic: false, isPremiumEligible: true, aliases: ['jupiler pro league - conference league gruppe', 'jupiler league - conference league gruppe'] },
  { id: 'be-promotion-relegation-playoffs', countryCode: 'be', leaguePackId: 'belgium_top_3', name: 'Belgisk promotion/relegation playoff', type: 'domestic_league', level: null, groupKey: 'promotion-relegation-playoff', sortOrder: 87, isPrimaryDomestic: false, isPremiumEligible: true, aliases: ['belgisk promotion/relegation playoff', 'jupiler league - nedrykning'] },
  { id: 'be-national-division-1-acff-promotion-group', countryCode: 'be', leaguePackId: 'belgium_top_3', name: 'National Division 1 ACFF - Oprykningsgruppe', type: 'domestic_league', level: null, groupKey: 'promotion-group', sortOrder: 88, isPrimaryDomestic: false, isPremiumEligible: true, aliases: ['national division 1 acff - oprykningsgruppe'] },
  { id: 'uefa-champions-league', countryCode: null, leaguePackId: null, name: 'UEFA Champions League', type: 'european_cup', level: null, groupKey: null, sortOrder: 900, isPrimaryDomestic: false, isPremiumEligible: true, aliases: ['champions league', 'uefa champions league'] },
  { id: 'uefa-europa-league', countryCode: null, leaguePackId: null, name: 'UEFA Europa League', type: 'european_cup', level: null, groupKey: null, sortOrder: 910, isPrimaryDomestic: false, isPremiumEligible: true, aliases: ['europa league', 'uefa europa league'] },
  { id: 'uefa-conference-league', countryCode: null, leaguePackId: null, name: 'UEFA Conference League', type: 'european_cup', level: null, groupKey: null, sortOrder: 920, isPrimaryDomestic: false, isPremiumEligible: true, aliases: ['conference league', 'uefa conference league'] },
];

const competitionById = new Map(competitionCatalog.map((entry) => [entry.id, entry]));
const competitionByNormalizedAlias = buildCompetitionAliasMap();

function buildCompetitionAliasMap(): Map<string, CompetitionCatalogEntry> {
  const mapping = new Map<string, CompetitionCatalogEntry>();

  for (const entry of competitionCatalog) {
    for (const alias of [entry.name, ...entry.aliases]) {
      const normalizedAlias = normalizeCompetitionName(alias);
      if (!mapping.has(normalizedAlias)) {
        mapping.set(normalizedAlias, entry);
      }
    }
  }

  return mapping;
}

export function normalizeCompetitionName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replaceAll('bundelsliga', 'bundesliga')
    .trim();
}

export function getCompetitionCatalogEntry(id: string | null | undefined): CompetitionCatalogEntry | undefined {
  if (!id) {
    return undefined;
  }
  return competitionById.get(id);
}

export function getCompetitionCatalogEntryByLeagueName(name: string): CompetitionCatalogEntry | undefined {
  return competitionByNormalizedAlias.get(normalizeCompetitionName(name));
}

export function resolveCompetitionCatalogEntry(
  competitionId: string | null | undefined,
  leagueCode: string | null | undefined,
  leagueName: string,
  countryCode?: string | null
): CompetitionCatalogEntry | undefined {
  if (competitionId) {
    const byId = getCompetitionCatalogEntry(competitionId);
    if (byId) {
      return byId;
    }
  }

  if (leagueCode) {
    const byCode = getCompetitionCatalogEntry(leagueCode);
    if (byCode) {
      return byCode;
    }
  }

  const byName = getCompetitionCatalogEntryByLeagueName(leagueName);
  if (byName && (!countryCode || byName.countryCode === countryCode)) {
    return byName;
  }

  return byName;
}

export function inferCompetitionId(
  leagueCode: string | null | undefined,
  leagueName: string,
  countryCode?: string | null
): string | undefined {
  return resolveCompetitionCatalogEntry(undefined, leagueCode, leagueName, countryCode)?.id;
}

export function getCompetitionDisplayName(
  competitionId: string | null | undefined,
  fallback?: string | null
): string | undefined {
  return getCompetitionCatalogEntry(competitionId)?.name ?? fallback ?? undefined;
}

export function getCompetitionMembershipStatusLabel(
  status: CompetitionMembershipStatus | null | undefined
): string | null {
  switch (status) {
    case 'relegated':
      return 'Nedrykket';
    case 'historical':
      return 'Historisk';
    default:
      return null;
  }
}
