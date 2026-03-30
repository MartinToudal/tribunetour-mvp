'use client';

import { useEffect, useMemo, useState } from 'react';
import { getWeekendPlanForUser, setWeekendPlanForUser } from '../_lib/weekendPlanRepository';
import { supabase } from '../_lib/supabaseClient';

type SaveResult = {
    ok: boolean;
    error?: string;
};

function classifyWeekendPlanError(error: unknown): string {
    if (!error || typeof error !== 'object') {
        return 'write_failed';
    }

    const maybeError = error as {
        code?: string;
        message?: string;
        details?: string;
        hint?: string;
    };

    const combinedText = [
        maybeError.code ?? '',
        maybeError.message ?? '',
        maybeError.details ?? '',
        maybeError.hint ?? '',
    ]
        .join(' ')
        .toLowerCase();

    if (
        maybeError.code === '42P01'
        || combinedText.includes('relation')
        || combinedText.includes('table')
    ) {
        return 'weekend_plan_table_missing';
    }

    if (
        maybeError.code === '42501'
        || combinedText.includes('row-level security')
        || combinedText.includes('permission denied')
    ) {
        return 'weekend_plan_permission_denied';
    }

    return 'write_failed';
}

export function useWeekendPlanModel() {
    const [userId, setUserId] = useState<string | null>(null);
    const [fixtureIds, setFixtureIds] = useState<string[]>([]);
    const [updatedAt, setUpdatedAt] = useState<string | null>(null);
    const [isLoadingPlan, setIsLoadingPlan] = useState(false);

    useEffect(() => {
        if (!supabase) {
            return;
        }

        supabase.auth.getUser().then(({ data }) => {
            setUserId(data.user?.id ?? null);
        });

        const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
            setUserId(session?.user?.id ?? null);
            if (!session?.user?.id) {
                setFixtureIds([]);
                setUpdatedAt(null);
            }
        });

        return () => {
            subscription.subscription.unsubscribe();
        };
    }, []);

    useEffect(() => {
        if (!supabase || !userId) {
            return;
        }

        let isCancelled = false;
        setIsLoadingPlan(true);

        getWeekendPlanForUser(userId)
            .then((record) => {
                if (isCancelled) {
                    return;
                }

                setFixtureIds(record.fixtureIds);
                setUpdatedAt(record.updatedAt);
                setIsLoadingPlan(false);
            })
            .catch((error) => {
                if (isCancelled) {
                    return;
                }

                console.error(error);
                setIsLoadingPlan(false);
            });

        return () => {
            isCancelled = true;
        };
    }, [userId]);

    const fixtureIdSet = useMemo(() => new Set(fixtureIds), [fixtureIds]);

    async function savePlan(nextFixtureIds: string[]): Promise<SaveResult> {
        if (!supabase) {
            return { ok: false, error: 'weekend_plan_unavailable' };
        }

        if (!userId) {
            return { ok: false, error: 'auth_required' };
        }

        try {
            const record = await setWeekendPlanForUser(userId, nextFixtureIds);
            setFixtureIds(record.fixtureIds);
            setUpdatedAt(record.updatedAt);
            return { ok: true };
        } catch (error) {
            console.error(error);
            return { ok: false, error: classifyWeekendPlanError(error) };
        }
    }

    async function toggleFixture(fixtureId: string): Promise<SaveResult> {
        const next = fixtureIdSet.has(fixtureId)
            ? fixtureIds.filter((id) => id !== fixtureId)
            : [...fixtureIds, fixtureId];
        return savePlan(next);
    }

    async function clearPlan(): Promise<SaveResult> {
        return savePlan([]);
    }

    return {
        fixtureIds,
        fixtureIdSet,
        updatedAt,
        isLoadingPlan,
        toggleFixture,
        clearPlan,
        savePlan,
    };
}
