import { supabase } from './supabaseClient';

type SharedVisitedRow = {
    club_id: string;
    visited: boolean;
};

export type VisitedMap = Record<string, boolean>;

function toVisitedMap(rows: SharedVisitedRow[] | null): VisitedMap {
    const map: VisitedMap = {};
    rows?.forEach((row) => {
        map[row.club_id] = Boolean(row.visited);
    });
    return map;
}

export async function getVisitedForUser(userId: string): Promise<VisitedMap> {
    if (!supabase) {
        return {};
    }

    const { data, error } = await supabase
        .from('visited')
        .select('club_id, visited')
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
