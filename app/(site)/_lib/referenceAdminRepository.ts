'use client';

import stadiumSeed from '../../../data/stadiums.json';
import { supabase } from './supabaseClient';

export type ReferenceCountry = {
  code: string;
  name: string;
  active: boolean;
};

export type ReferenceLeague = {
  code: string;
  country_code: string;
  name: string;
  level: number | null;
  season_id: string | null;
  active: boolean;
};

export type ReferenceStadium = {
  id: string;
  team: string;
  name: string;
  city: string;
  league: string;
  country_code: string;
  league_code: string;
  league_pack: string;
  short_code: string;
  competition_id: string;
  season_id: string;
  membership_status: string;
  lat: number;
  lon: number;
  updated_at: string;
};

export type ReferenceAdminData = {
  countries: ReferenceCountry[];
  leagues: ReferenceLeague[];
  stadiums: ReferenceStadium[];
};

function text(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function numberValue(value: unknown) {
  return typeof value === 'number' ? value : Number(value ?? 0);
}

function normalizeStadium(row: Record<string, unknown>): ReferenceStadium {
  return {
    id: text(row.id),
    team: text(row.team),
    name: text(row.name),
    city: text(row.city),
    league: text(row.league),
    country_code: text(row.country_code ?? row.countryCode),
    league_code: text(row.league_code ?? row.leagueCode),
    league_pack: text(row.league_pack ?? row.leaguePack),
    short_code: text(row.short_code ?? row.shortCode),
    competition_id: text(row.competition_id ?? row.competitionId ?? row.primaryCompetitionId),
    season_id: text(row.season_id ?? row.seasonId ?? row.primarySeasonId),
    membership_status: text(row.membership_status ?? row.membershipStatus) || 'active',
    lat: numberValue(row.lat),
    lon: numberValue(row.lon),
    updated_at: text(row.updated_at),
  };
}

const seedStadiums = (stadiumSeed as Record<string, unknown>[]).map(normalizeStadium);

function metadataFromStadiums(stadiums: ReferenceStadium[]) {
  const countries = new Map<string, ReferenceCountry>();
  const leagues = new Map<string, ReferenceLeague>();

  for (const stadium of stadiums) {
    if (stadium.country_code && !countries.has(stadium.country_code)) {
      countries.set(stadium.country_code, {
        code: stadium.country_code,
        name: stadium.country_code.toUpperCase(),
        active: true,
      });
    }
    if (stadium.league_code && !leagues.has(stadium.league_code)) {
      leagues.set(stadium.league_code, {
        code: stadium.league_code,
        country_code: stadium.country_code,
        name: stadium.league,
        level: null,
        season_id: stadium.season_id || null,
        active: true,
      });
    }
  }

  return {
    countries: Array.from(countries.values()).sort((a, b) => a.name.localeCompare(b.name, 'da')),
    leagues: Array.from(leagues.values()).sort((a, b) => a.name.localeCompare(b.name, 'da')),
  };
}

export function mergeReferenceStadiums(remoteRows: Record<string, unknown>[] | null | undefined) {
  const merged = new Map(seedStadiums.map((stadium) => [stadium.id, stadium]));
  for (const row of remoteRows ?? []) {
    const stadium = normalizeStadium(row);
    if (stadium.id) merged.set(stadium.id, stadium);
  }
  return Array.from(merged.values()).sort((a, b) => a.country_code.localeCompare(b.country_code) || a.team.localeCompare(b.team, 'da'));
}

export async function listReferenceAdminData(): Promise<ReferenceAdminData> {
  if (!supabase) throw new Error('Supabase er ikke konfigureret.');
  const { data, error } = await supabase.rpc('list_reference_admin_data');
  if (error) throw error;

  const payload = (data ?? {}) as {
    countries?: Record<string, unknown>[];
    leagues?: Record<string, unknown>[];
    stadiums?: Record<string, unknown>[];
  };
  const stadiums = mergeReferenceStadiums(payload.stadiums);
  const seedMetadata = metadataFromStadiums(stadiums);
  const countries = new Map(seedMetadata.countries.map((country) => [country.code, country]));
  for (const row of payload.countries ?? []) {
    const code = text(row.code);
    if (code) countries.set(code, { code, name: text(row.name) || code.toUpperCase(), active: row.active !== false });
  }
  const leagues = new Map(seedMetadata.leagues.map((league) => [league.code, league]));
  for (const row of payload.leagues ?? []) {
    const code = text(row.code);
    if (code) leagues.set(code, {
      code,
      country_code: text(row.country_code),
      name: text(row.name) || code,
      level: row.level == null ? null : Number(row.level),
      season_id: text(row.season_id) || null,
      active: row.active !== false,
    });
  }
  return {
    countries: Array.from(countries.values()).sort((a, b) => a.name.localeCompare(b.name, 'da')),
    leagues: Array.from(leagues.values()).sort((a, b) => a.name.localeCompare(b.name, 'da')),
    stadiums,
  };
}

export async function upsertReferenceCountry(input: { code: string; name: string; active: boolean }) {
  if (!supabase) throw new Error('Supabase er ikke konfigureret.');
  const { error } = await supabase.rpc('upsert_reference_country', { p_code: input.code, p_name: input.name, p_active: input.active });
  if (error) throw error;
}

export async function upsertReferenceLeague(input: { code: string; country_code: string; name: string; level: number | null; season_id: string; active: boolean }) {
  if (!supabase) throw new Error('Supabase er ikke konfigureret.');
  const { error } = await supabase.rpc('upsert_reference_league', {
    p_code: input.code,
    p_country_code: input.country_code,
    p_name: input.name,
    p_level: input.level,
    p_season_id: input.season_id || null,
    p_active: input.active,
  });
  if (error) throw error;
}

export async function upsertReferenceStadium(stadium: ReferenceStadium) {
  if (!supabase) throw new Error('Supabase er ikke konfigureret.');
  const { updated_at: _updatedAt, ...payload } = stadium;
  const { error } = await supabase.rpc('upsert_reference_stadium', { p_payload: payload });
  if (error) throw error;
}
