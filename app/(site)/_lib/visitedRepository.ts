import { supabase } from './supabaseClient';

type VisitRow = {
    stadium_id: string;
};

export type VisitedMap = Record<string, boolean>;

export async function getVisitedForUser(userId: string): Promise<VisitedMap> {
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
    (data as VisitRow[] | null)?.forEach((row) => {
        map[row.stadium_id] = true;
    });
    return map;
}

export async function setVisitedForUser(userId: string, clubId: string, nextVisited: boolean): Promise<void> {
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
