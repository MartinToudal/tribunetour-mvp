import germanyTop3Stadiums from '../../../data/league-packs/germany_top_3/stadiums.json';
import type { Stadium } from './referenceData';

export type LeaguePackId = 'core_denmark' | 'germany_top_3';

export type LeaguePackDefinition = {
  id: LeaguePackId;
  label: string;
  countryCode: string;
  isCore: boolean;
  stadiums: Stadium[];
};

const germanyTop3Enabled = process.env.NEXT_PUBLIC_ENABLE_GERMANY_TOP_3 === 'true';

export const countryLabels: Record<string, string> = {
  dk: 'Danmark',
  de: 'Tyskland',
};

export function countryLabel(countryCode: string | null | undefined): string {
  if (!countryCode) {
    return 'Ukendt';
  }

  return countryLabels[countryCode] ?? countryCode.toUpperCase();
}

export const coreDenmarkLeaguePack: LeaguePackDefinition = {
  id: 'core_denmark',
  label: 'Danmark',
  countryCode: 'dk',
  isCore: true,
  stadiums: [],
};

export const experimentalLeaguePacks: LeaguePackDefinition[] = [
  {
    id: 'germany_top_3',
    label: 'Tyskland top 3',
    countryCode: 'de',
    isCore: false,
    stadiums: germanyTop3Stadiums as Stadium[],
  },
];

export function getEnabledExperimentalLeaguePacks(): LeaguePackDefinition[] {
  if (!germanyTop3Enabled) {
    return [];
  }

  return experimentalLeaguePacks;
}

export function getEnabledLeaguePackIds(): LeaguePackId[] {
  return [
    coreDenmarkLeaguePack.id,
    ...getEnabledExperimentalLeaguePacks().map((pack) => pack.id),
  ];
}

export function isExperimentalLeaguePackStadium(stadium: Stadium): boolean {
  const countryCode = stadium.countryCode ?? (stadium.id.startsWith('dk-') ? 'dk' : undefined);
  const leaguePack = stadium.leaguePack ?? (countryCode === coreDenmarkLeaguePack.countryCode ? coreDenmarkLeaguePack.id : undefined);

  return leaguePack !== coreDenmarkLeaguePack.id || countryCode !== coreDenmarkLeaguePack.countryCode;
}

export function filterStadiumsForLeaguePackAccess(stadiums: Stadium[], isLoggedIn: boolean): Stadium[] {
  if (isLoggedIn) {
    return stadiums;
  }

  return stadiums.filter((stadium) => !isExperimentalLeaguePackStadium(stadium));
}
