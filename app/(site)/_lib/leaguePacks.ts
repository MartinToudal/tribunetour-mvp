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
