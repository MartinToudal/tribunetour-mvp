import { createClient } from '@supabase/supabase-js';
import fixturesSeed from '../../../data/fixtures.json';
import stadiumSeed from '../../../data/stadiums.json';
import { aliasMap, canonicalClubId, normalizeIncomingClubId } from './clubIdentityResolver';
import { getEnabledExperimentalLeaguePacks } from './leaguePacks';
import { compareLeagues } from './leagueOrder';

// Generated from the app's canonical CSV reference-data via scripts/generate-reference-data.mjs.

export type Stadium = {
  id: string;
  name: string;
  team: string;
  league: string;
  city?: string;
  lat?: number;
  lon?: number;
  countryCode?: string;
  leagueCode?: string;
  leaguePack?: string;
  shortCode?: string;
};

export type Fixture = {
  id: string;
  kickoff: string;
  round: string;
  homeTeamId: string;
  awayTeamId: string;
  venueClubId: string;
  status: string;
  homeScore?: number | null;
  awayScore?: number | null;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const hasSupabaseReferenceData = Boolean(supabaseUrl && supabaseAnonKey);

const seedStadiums = [...(stadiumSeed as Stadium[])].sort(
  (a, b) => compareLeagues(a.league, b.league) || a.name.localeCompare(b.name, 'da')
);
const enabledExperimentalStadiums = getEnabledExperimentalLeaguePacks().flatMap((pack) => pack.stadiums);
const enabledSeedStadiums = normalizeStadiums([...seedStadiums, ...enabledExperimentalStadiums]);
const seedFixtures = fixturesSeed as Fixture[];
const seedStadiumMap = aliasMap(Object.fromEntries(
  enabledSeedStadiums.map((stadium) => [stadium.id, stadium])
) as Record<string, Stadium>);

function createReferenceDataClient() {
  if (!hasSupabaseReferenceData) {
    return null;
  }

  return createClient(supabaseUrl as string, supabaseAnonKey as string);
}

export function getSeedStadiums(): Stadium[] {
  return enabledSeedStadiums;
}

export function getSeedFixtures(): Fixture[] {
  return seedFixtures;
}

export function getSeedStadiumMap(): Record<string, Stadium> {
  return seedStadiumMap;
}

export function getSeedStadiumById(id: string): Stadium | undefined {
  return seedStadiumMap[normalizeIncomingClubId(id)];
}

export function getSeedFixtureById(id: string): Fixture | undefined {
  return seedFixtures.find((fixture) => fixture.id === id);
}

export function getStaticStadiumParams() {
  return Array.from(new Set(enabledSeedStadiums.map((stadium) => canonicalClubId(stadium.id)))).map((id) => ({ id }));
}

export function getStaticFixtureParams() {
  return seedFixtures.map((fixture) => ({ id: fixture.id }));
}

function normalizeStadiums(stadiums: Stadium[]): Stadium[] {
  const latestByCanonicalId = new Map<string, Stadium>();

  for (const stadium of stadiums) {
    const canonicalId = canonicalClubId(stadium.id);
    const countryCode = stadium.countryCode ?? (canonicalId.startsWith('dk-') ? 'dk' : undefined);
    if (latestByCanonicalId.has(canonicalId)) {
      continue;
    }

    latestByCanonicalId.set(canonicalId, {
      ...stadium,
      id: canonicalId,
      countryCode,
      leaguePack: stadium.leaguePack ?? (countryCode === 'dk' ? 'core_denmark' : undefined),
    });
  }

  return Array.from(latestByCanonicalId.values()).sort(
    (a, b) => compareLeagues(a.league, b.league) || a.name.localeCompare(b.name, 'da')
  );
}

export async function getStadiums(): Promise<Stadium[]> {
  if (!hasSupabaseReferenceData) {
    return enabledSeedStadiums;
  }

  const client = createReferenceDataClient();
  const { data, error } = await client!
    .from('stadiums')
    .select('*')
    .order('name', { ascending: true });

  if (error || !data || data.length === 0) {
    if (error) {
      console.error(error);
    }
    return enabledSeedStadiums;
  }

  return normalizeStadiums([...(data as Stadium[]), ...enabledExperimentalStadiums]);
}

export async function getFixtures(): Promise<Fixture[]> {
  return seedFixtures;
}
