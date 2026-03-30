import { supabase } from './supabaseClient';

type WeekendPlanRow = {
    fixture_ids: string[] | null;
    updated_at: string | null;
    source: string | null;
};

export type WeekendPlanRecord = {
    fixtureIds: string[];
    updatedAt: string | null;
    source: string;
};

function normalizeFixtureIds(value: string[] | null | undefined): string[] {
    return Array.from(new Set((value ?? []).filter(Boolean))).sort((left, right) => left.localeCompare(right, 'da'));
}

function toWeekendPlanRecord(row: WeekendPlanRow | null): WeekendPlanRecord {
    return {
        fixtureIds: normalizeFixtureIds(row?.fixture_ids),
        updatedAt: row?.updated_at ?? null,
        source: row?.source ?? 'shared',
    };
}

export async function getWeekendPlanForUser(userId: string): Promise<WeekendPlanRecord> {
    if (!supabase) {
        return toWeekendPlanRecord(null);
    }

    const { data, error } = await supabase
        .from('weekend_plans')
        .select('fixture_ids, updated_at, source')
        .eq('user_id', userId)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return toWeekendPlanRecord((data as WeekendPlanRow | null) ?? null);
}

export async function setWeekendPlanForUser(userId: string, fixtureIds: string[]): Promise<WeekendPlanRecord> {
    if (!supabase) {
        return toWeekendPlanRecord(null);
    }

    const updatedAt = new Date().toISOString();
    const { data, error } = await supabase
        .from('weekend_plans')
        .upsert({
            user_id: userId,
            fixture_ids: normalizeFixtureIds(fixtureIds),
            updated_at: updatedAt,
            source: 'web',
        }, {
            onConflict: 'user_id',
        })
        .select('fixture_ids, updated_at, source')
        .single();

    if (error) {
        throw error;
    }

    return toWeekendPlanRecord(data as WeekendPlanRow);
}
