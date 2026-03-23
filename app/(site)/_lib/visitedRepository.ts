import { supabase } from './supabaseClient';

type LegacyVisitRow = {
    stadium_id: string;
};

type SharedVisitedRow = {
    club_id: string;
    visited: boolean;
};

export type VisitedMap = Record<string, boolean>;

function isMissingVisitedRelation(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
        return false;
    }

    const details = [
        'code' in error ? error.code : undefined,
        'message' in error ? error.message : undefined,
        'details' in error ? error.details : undefined,
        'hint' in error ? error.hint : undefined,
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

    return details.includes('42p01')
        || details.includes('pgrst205')
        || details.includes('visited') && (details.includes('not found') || details.includes('does not exist'));
}

function toVisitedMap(rows: SharedVisitedRow[] | null): VisitedMap {
    const map: VisitedMap = {};
    rows?.forEach((row) => {
        map[row.club_id] = Boolean(row.visited);
    });
    return map;
}

async function getVisitedFromSharedModel(userId: string): Promise<VisitedMap> {
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

async function getVisitedFromLegacyModel(userId: string): Promise<VisitedMap> {
    if (!supabase) {
        return {};
    }

    const { data, error } = await supabase
        .from('visits')
        .select('stadium_id')
        .eq('user_id', userId);

    if (error) {
        throw error;
    }

    const map: VisitedMap = {};
    (data as LegacyVisitRow[] | null)?.forEach((row) => {
        map[row.stadium_id] = true;
    });
    return map;
}

async function setVisitedInSharedModel(userId: string, clubId: string, nextVisited: boolean): Promise<void> {
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

async function setVisitedInLegacyModel(userId: string, clubId: string, nextVisited: boolean): Promise<void> {
    if (!supabase) {
        return;
    }

    if (nextVisited) {
        const { error } = await supabase.from('visits').insert({ user_id: userId, stadium_id: clubId });
        if (error) {
            throw error;
        }
        return;
    }

    const { error } = await supabase.from('visits').delete().eq('stadium_id', clubId).eq('user_id', userId);
    if (error) {
        throw error;
    }
}

export async function getVisitedForUser(userId: string): Promise<VisitedMap> {
    try {
        return await getVisitedFromSharedModel(userId);
    } catch (error) {
        if (!isMissingVisitedRelation(error)) {
            throw error;
        }
    }

    return getVisitedFromLegacyModel(userId);
}

export async function setVisitedForUser(userId: string, clubId: string, nextVisited: boolean): Promise<void> {
    try {
        await setVisitedInSharedModel(userId, clubId, nextVisited);
        return;
    } catch (error) {
        if (!isMissingVisitedRelation(error)) {
            throw error;
        }
    }

    await setVisitedInLegacyModel(userId, clubId, nextVisited);
}
