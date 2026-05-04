export type LeaguePackId =
  | 'core_denmark'
  | 'germany_top_3'
  | 'england_top_4'
  | 'italy_top_3'
  | 'spain_top_4'
  | 'france_top_3'
  | 'portugal_top_3'
  | 'netherlands_top_3'
  | 'belgium_top_3'
  | 'premium_full';

export type VisibleLeaguePackId = Exclude<LeaguePackId, 'premium_full'>;
export type RequestableLeaguePackId = Exclude<LeaguePackId, 'core_denmark'>;

export type LeaguePackCatalogEntry = {
  id: LeaguePackId;
  countryCode: string | null;
  label: string;
  sortOrder: number;
  levels: number;
  isCore: boolean;
  isPremium: boolean;
  includedByPremiumFull: boolean;
  requestDescription?: string;
  featureFlag?: string;
};

export const leaguePackCatalog: LeaguePackCatalogEntry[] = [
  {
    id: 'core_denmark',
    countryCode: 'dk',
    label: 'Danmark',
    sortOrder: 0,
    levels: 4,
    isCore: true,
    isPremium: false,
    includedByPremiumFull: false,
  },
  {
    id: 'germany_top_3',
    countryCode: 'de',
    label: 'Tyskland',
    sortOrder: 10,
    levels: 3,
    isCore: false,
    isPremium: true,
    includedByPremiumFull: true,
    requestDescription: 'Bundesliga, 2. Bundesliga og 3. Liga',
    featureFlag: 'NEXT_PUBLIC_ENABLE_GERMANY_TOP_3',
  },
  {
    id: 'england_top_4',
    countryCode: 'en',
    label: 'England',
    sortOrder: 20,
    levels: 4,
    isCore: false,
    isPremium: true,
    includedByPremiumFull: true,
    requestDescription: 'Premier League, Championship, League One og League Two',
    featureFlag: 'NEXT_PUBLIC_ENABLE_ENGLAND_TOP_4',
  },
  {
    id: 'italy_top_3',
    countryCode: 'it',
    label: 'Italien',
    sortOrder: 30,
    levels: 3,
    isCore: false,
    isPremium: true,
    includedByPremiumFull: true,
    requestDescription: 'Serie A, Serie B og Serie C',
    featureFlag: 'NEXT_PUBLIC_ENABLE_ITALY_TOP_3',
  },
  {
    id: 'spain_top_4',
    countryCode: 'es',
    label: 'Spanien',
    sortOrder: 40,
    levels: 4,
    isCore: false,
    isPremium: true,
    includedByPremiumFull: true,
    requestDescription: 'La Liga, Segunda División og Primera Federación gruppe 1-2',
    featureFlag: 'NEXT_PUBLIC_ENABLE_SPAIN_TOP_4',
  },
  {
    id: 'france_top_3',
    countryCode: 'fr',
    label: 'Frankrig',
    sortOrder: 50,
    levels: 3,
    isCore: false,
    isPremium: true,
    includedByPremiumFull: true,
    requestDescription: 'Ligue 1, Ligue 2 og National',
    featureFlag: 'NEXT_PUBLIC_ENABLE_FRANCE_TOP_3',
  },
  {
    id: 'portugal_top_3',
    countryCode: 'pt',
    label: 'Portugal',
    sortOrder: 60,
    levels: 3,
    isCore: false,
    isPremium: true,
    includedByPremiumFull: true,
    requestDescription: 'Liga Portugal, Liga Portugal 2 og Liga 3 - Oprykningsgruppe',
    featureFlag: 'NEXT_PUBLIC_ENABLE_PORTUGAL_TOP_3',
  },
  {
    id: 'netherlands_top_3',
    countryCode: 'nl',
    label: 'Holland',
    sortOrder: 70,
    levels: 3,
    isCore: false,
    isPremium: true,
    includedByPremiumFull: true,
    requestDescription: 'Eredivisie, Eerste Divisie og Tweede Divisie',
    featureFlag: 'NEXT_PUBLIC_ENABLE_NETHERLANDS_TOP_3',
  },
  {
    id: 'belgium_top_3',
    countryCode: 'be',
    label: 'Belgien',
    sortOrder: 80,
    levels: 3,
    isCore: false,
    isPremium: true,
    includedByPremiumFull: true,
    requestDescription: 'Jupiler Pro League, Challenger Pro League og National Division 1 ACFF/VV',
    featureFlag: 'NEXT_PUBLIC_ENABLE_BELGIUM_TOP_3',
  },
  {
    id: 'premium_full',
    countryCode: null,
    label: 'Alle premium-pakker',
    sortOrder: 1000,
    levels: 0,
    isCore: false,
    isPremium: true,
    includedByPremiumFull: false,
    requestDescription: 'Adgang til alle nuværende og kommende premium-pakker',
  },
];

const catalogById = new Map(leaguePackCatalog.map((entry) => [entry.id, entry]));
const countryEntries = leaguePackCatalog.filter((entry) => entry.countryCode);
const countryOrder = countryEntries
  .slice()
  .sort((left, right) => left.sortOrder - right.sortOrder)
  .map((entry) => entry.countryCode as string);
const countryLabels = Object.fromEntries(
  countryEntries.map((entry) => [entry.countryCode as string, entry.label])
) as Record<string, string>;

export const coreLeaguePackId: VisibleLeaguePackId = 'core_denmark';
export const visibleLeaguePackCatalog = leaguePackCatalog.filter(
  (entry): entry is LeaguePackCatalogEntry & { id: VisibleLeaguePackId } => entry.id !== 'premium_full'
);
export const requestableLeaguePackCatalog = leaguePackCatalog.filter(
  (entry): entry is LeaguePackCatalogEntry & { id: RequestableLeaguePackId } => entry.id !== 'core_denmark'
);

export function getLeaguePackCatalogEntry(id: string): LeaguePackCatalogEntry | undefined {
  return catalogById.get(id as LeaguePackId);
}

export function isKnownLeaguePackId(id: string): id is LeaguePackId {
  return catalogById.has(id as LeaguePackId);
}

export function getBuildEnabledVisibleLeaguePacks(): Array<LeaguePackCatalogEntry & { id: VisibleLeaguePackId }> {
  return visibleLeaguePackCatalog.filter((entry) => {
    if (entry.isCore) {
      return true;
    }

    if (!entry.featureFlag) {
      return true;
    }

    return process.env[entry.featureFlag] === 'true';
  });
}

export function getBuildEnabledVisibleLeaguePackIds(): VisibleLeaguePackId[] {
  return getBuildEnabledVisibleLeaguePacks().map((entry) => entry.id);
}

export function getPremiumFullIncludedPackIds(): VisibleLeaguePackId[] {
  return visibleLeaguePackCatalog
    .filter((entry) => entry.includedByPremiumFull)
    .map((entry) => entry.id);
}

export function expandGrantedLeaguePackIds(grantedPackIds: Iterable<string>): VisibleLeaguePackId[] {
  const ids = new Set<VisibleLeaguePackId>([coreLeaguePackId]);

  for (const grantedPackId of grantedPackIds) {
    if (!isKnownLeaguePackId(grantedPackId)) {
      continue;
    }

    if (grantedPackId === 'premium_full') {
      getPremiumFullIncludedPackIds().forEach((id) => ids.add(id));
      continue;
    }

    ids.add(grantedPackId);
  }

  return Array.from(ids).sort((left, right) => {
    const leftOrder = getLeaguePackCatalogEntry(left)?.sortOrder ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = getLeaguePackCatalogEntry(right)?.sortOrder ?? Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder;
  });
}

export function countryLabel(countryCode: string | null | undefined): string {
  if (!countryCode) {
    return 'Ukendt';
  }

  return countryLabels[countryCode] ?? countryCode.toUpperCase();
}

export function compareCountryCodes(left: string, right: string): number {
  const leftRank = countryOrder.indexOf(left);
  const rightRank = countryOrder.indexOf(right);
  const normalizedLeftRank = leftRank === -1 ? Number.MAX_SAFE_INTEGER : leftRank;
  const normalizedRightRank = rightRank === -1 ? Number.MAX_SAFE_INTEGER : rightRank;

  if (normalizedLeftRank !== normalizedRightRank) {
    return normalizedLeftRank - normalizedRightRank;
  }

  return countryLabel(left).localeCompare(countryLabel(right), 'da');
}
