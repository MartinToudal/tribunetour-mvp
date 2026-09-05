import { supabase } from './supabaseClient';

export type ClubCheckPayload = {
  clubId: string;
  checks: { fixtures: boolean; location: boolean; league: boolean };
  notes: string;
  snapshot: Record<string, unknown>;
  lat: string;
  lon: string;
  league: string;
};

export async function saveClubCheck(payload: ClubCheckPayload): Promise<string> {
  if (!supabase) {
    throw new Error('Supabase er ikke konfigureret');
  }

  const { data: reviewId, error: submitError } = await supabase.rpc('submit_club_check', {
    p_club_id: payload.clubId,
    p_checks: payload.checks,
    p_notes: payload.notes,
    p_snapshot: payload.snapshot,
    p_lat: payload.lat,
    p_lon: payload.lon,
    p_league: payload.league,
  });

  if (submitError || !reviewId) {
    throw submitError ?? new Error('Kontrollen kunne ikke gemmes');
  }

  const { error: approveError } = await supabase.rpc('approve_club_check', { p_review_id: reviewId });
  if (approveError) {
    throw approveError;
  }

  return reviewId as string;
}
