import { canonicalClubId } from './clubIdentityResolver';
import { supabase } from './supabaseClient';

type SharedVisitedRow = {
    club_id: string;
    visited: boolean;
    updated_at?: string | null;
};

export type VisitedMap = Record<string, boolean>;

function toVisitedMap(rows: SharedVisitedRow[] | null): VisitedMap {
    const latestByClubId: Record<string, SharedVisitedRow> = {};

    rows?.forEach((row) => {
        const clubId = canonicalClubId(row.club_id);
        const current = latestByClubId[clubId];
        const currentTime = current?.updated_at ? Date.parse(current.updated_at) : 0;
        const nextTime = row.updated_at ? Date.parse(row.updated_at) : 0;
        if (current && currentTime > nextTime) {
            return;
        }
        latestByClubId[clubId] = row;
    });

    const map: VisitedMap = {};
    Object.values(latestByClubId).forEach((row) => {
        map[canonicalClubId(row.club_id)] = Boolean(row.visited);
    });
    return map;
}

export async function getVisitedForUser(userId: string): Promise<VisitedMap> {
    if (!supabase) {
        return {};
    }

    const { data, error } = await supabase
        .from('visited')
        .select('club_id, visited, updated_at')
        .eq('user_id', userId);

    if (error) {
        throw error;
    }

    return toVisitedMap(data as SharedVisitedRow[] | null);
}

export async function setVisitedForUser(userId: string, clubId: string, nextVisited: boolean): Promise<void> {
    if (!supabase) {
        return;
    }

    clubId = canonicalClubId(clubId);
    const timestamp = new Date().toISOString();
    const { error } = await supabase
        .from('visited')
        .upsert({
            user_id: userId,
            club_id: clubId,
            visited: nextVisited,
            visited_date: nextVisited ? timestamp : null,
            updated_at: timestamp,
            source: 'web',
        }, {
            onConflict: 'user_id,club_id',
        });

    if (error) {
        throw error;
    }
}
