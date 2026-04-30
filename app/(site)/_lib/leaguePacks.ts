import germanyTop3Stadiums from '../../../data/league-packs/germany_top_3/stadiums.json';
import englandTop4Stadiums from '../../../data/league-packs/england_top_4/stadiums.json';
import italyTop3Stadiums from '../../../data/league-packs/italy_top_3/stadiums.json';
import spainTop4Stadiums from '../../../data/league-packs/spain_top_4/stadiums.json';
import franceTop3Stadiums from '../../../data/league-packs/france_top_3/stadiums.json';
import type { Stadium } from './referenceData';

export type LeaguePackId = 'core_denmark' | 'germany_top_3' | 'england_top_4' | 'italy_top_3' | 'spain_top_4' | 'france_top_3';

export type LeaguePackDefinition = {
  id: LeaguePackId;
  label: string;
  countryCode: string;
  isCore: boolean;
  stadiums: Stadium[];
};

const germanyTop3Enabled = process.env.NEXT_PUBLIC_ENABLE_GERMANY_TOP_3 === 'true';
const englandTop4Enabled = process.env.NEXT_PUBLIC_ENABLE_ENGLAND_TOP_4 === 'true';
const italyTop3Enabled = process.env.NEXT_PUBLIC_ENABLE_ITALY_TOP_3 === 'true';
const spainTop4Enabled = process.env.NEXT_PUBLIC_ENABLE_SPAIN_TOP_4 === 'true';
const franceTop3Enabled = process.env.NEXT_PUBLIC_ENABLE_FRANCE_TOP_3 === 'true';

export const countryLabels: Record<string, string> = {
  dk: 'Danmark',
  de: 'Tyskland',
  en: 'England',
  it: 'Italien',
  es: 'Spanien',
  fr: 'Frankrig',
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
    label: 'Tyskland',
    countryCode: 'de',
    isCore: false,
    stadiums: germanyTop3Stadiums as Stadium[],
  },
  {
    id: 'england_top_4',
    label: 'England',
    countryCode: 'en',
    isCore: false,
    stadiums: englandTop4Stadiums as Stadium[],
  },
  {
    id: 'italy_top_3',
    label: 'Italien',
    countryCode: 'it',
    isCore: false,
    stadiums: italyTop3Stadiums as Stadium[],
  },
  {
    id: 'spain_top_4',
    label: 'Spanien',
    countryCode: 'es',
    isCore: false,
    stadiums: spainTop4Stadiums as Stadium[],
  },
  {
    id: 'france_top_3',
    label: 'Frankrig',
    countryCode: 'fr',
    isCore: false,
    stadiums: franceTop3Stadiums as Stadium[],
  },
];

export function getEnabledExperimentalLeaguePacks(): LeaguePackDefinition[] {
  return experimentalLeaguePacks.filter((pack) => {
    switch (pack.id) {
      case 'germany_top_3':
        return germanyTop3Enabled;
      case 'england_top_4':
        return englandTop4Enabled;
      case 'italy_top_3':
        return italyTop3Enabled;
      case 'spain_top_4':
        return spainTop4Enabled;
      case 'france_top_3':
        return franceTop3Enabled;
      default:
        return false;
    }
  });
}

export function getEnabledLeaguePackIds(): LeaguePackId[] {
  return [
    coreDenmarkLeaguePack.id,
    ...getEnabledExperimentalLeaguePacks().map((pack) => pack.id),
  ];
}

export function getBuildAvailableLeaguePackIds(): LeaguePackId[] {
  return getEnabledLeaguePackIds();
}

export function stadiumLeaguePackId(stadium: Stadium): LeaguePackId {
  const countryCode = stadium.countryCode ?? (stadium.id.startsWith('dk-') ? 'dk' : undefined);
  const leaguePack = stadium.leaguePack ?? (countryCode === coreDenmarkLeaguePack.countryCode ? coreDenmarkLeaguePack.id : undefined);
  return (leaguePack as LeaguePackId | undefined) ?? coreDenmarkLeaguePack.id;
}

export function isExperimentalLeaguePackStadium(stadium: Stadium): boolean {
  const countryCode = stadium.countryCode ?? (stadium.id.startsWith('dk-') ? 'dk' : undefined);
  const leaguePack = stadiumLeaguePackId(stadium);
  return leaguePack !== coreDenmarkLeaguePack.id || countryCode !== coreDenmarkLeaguePack.countryCode;
}

export function filterStadiumsForLeaguePackAccess(stadiums: Stadium[], enabledPackIds: Iterable<LeaguePackId>): Stadium[] {
  const packIdSet = new Set(enabledPackIds);
  return stadiums.filter((stadium) => packIdSet.has(stadiumLeaguePackId(stadium)));
}
