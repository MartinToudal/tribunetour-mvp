import germanyTop3Stadiums from '../../../data/league-packs/germany_top_3/stadiums.json';
import englandTop4Stadiums from '../../../data/league-packs/england_top_4/stadiums.json';
import italyTop3Stadiums from '../../../data/league-packs/italy_top_3/stadiums.json';
import spainTop4Stadiums from '../../../data/league-packs/spain_top_4/stadiums.json';
import franceTop3Stadiums from '../../../data/league-packs/france_top_3/stadiums.json';
import type { Stadium } from './referenceData';
import {
  coreLeaguePackId,
  countryLabel,
  getBuildEnabledVisibleLeaguePacks,
  type VisibleLeaguePackId as LeaguePackId,
} from './leaguePackCatalog';

export { countryLabel };
export type { LeaguePackId };

export type LeaguePackDefinition = {
  id: LeaguePackId;
  label: string;
  countryCode: string;
  isCore: boolean;
  stadiums: Stadium[];
};

export const coreDenmarkLeaguePack: LeaguePackDefinition = {
  id: coreLeaguePackId,
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
  const enabledIds = new Set(
    getBuildEnabledVisibleLeaguePacks()
      .filter((entry) => !entry.isCore)
      .map((entry) => entry.id)
  );
  return experimentalLeaguePacks.filter((pack) => enabledIds.has(pack.id));
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
  return (leaguePack as LeaguePackId | undefined) ?? coreLeaguePackId;
}

export function isExperimentalLeaguePackStadium(stadium: Stadium): boolean {
  const countryCode = stadium.countryCode ?? (stadium.id.startsWith('dk-') ? 'dk' : undefined);
  const leaguePack = stadiumLeaguePackId(stadium);
  return leaguePack !== coreLeaguePackId || countryCode !== coreDenmarkLeaguePack.countryCode;
}

export function filterStadiumsForLeaguePackAccess(stadiums: Stadium[], enabledPackIds: Iterable<LeaguePackId>): Stadium[] {
  const packIdSet = new Set(enabledPackIds);
  return stadiums.filter((stadium) => packIdSet.has(stadiumLeaguePackId(stadium)));
}
