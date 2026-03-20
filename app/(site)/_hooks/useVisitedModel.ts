'use client';

import { useEffect, useMemo, useState } from 'react';
import { hasSupabaseEnv, supabase } from '../_lib/supabaseClient';

type VisitRow = {
    stadium_id: string;
};

type ToggleResult = {
    ok: boolean;
    error?: string;
};

export function useVisitedModel() {
    const [userId, setUserId] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [visited, setVisited] = useState<Record<string, boolean>>({});
    const [isLoadingVisits, setIsLoadingVisits] = useState(false);

    useEffect(() => {
        if (!supabase) {
            return;
        }

        supabase.auth.getUser().then(({ data }) => {
            setUserId(data.user?.id ?? null);
            setUserEmail(data.user?.email ?? null);
        });

        const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
            setUserId(session?.user?.id ?? null);
            setUserEmail(session?.user?.email ?? null);
            if (!session?.user?.id) {
                setVisited({});
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
        setIsLoadingVisits(true);

        supabase
            .from('visits')
            .select('stadium_id')
            .then(({ data, error }) => {
                if (isCancelled) {
                    return;
                }

                if (error) {
                    console.error(error);
                    setIsLoadingVisits(false);
                    return;
                }

                const map: Record<string, boolean> = {};
                (data as VisitRow[] | null)?.forEach((row) => {
                    map[row.stadium_id] = true;
                });
                setVisited(map);
                setIsLoadingVisits(false);
            });

        return () => {
            isCancelled = true;
        };
    }, [userId]);

    async function toggleVisited(clubId: string): Promise<ToggleResult> {
        if (!supabase) {
            return { ok: false, error: 'visited_unavailable' };
        }

        if (!userId) {
            return { ok: false, error: 'auth_required' };
        }

        if (visited[clubId]) {
            const { error } = await supabase.from('visits').delete().eq('stadium_id', clubId).eq('user_id', userId);
            if (error) {
                console.error(error);
                return { ok: false, error: 'write_failed' };
            }
            setVisited((current) => ({ ...current, [clubId]: false }));
            return { ok: true };
        }

        const { error } = await supabase.from('visits').insert({ user_id: userId, stadium_id: clubId });
        if (error) {
            console.error(error);
            return { ok: false, error: 'write_failed' };
        }

        setVisited((current) => ({ ...current, [clubId]: true }));
        return { ok: true };
    }

    const visitedCount = useMemo(() => Object.values(visited).filter(Boolean).length, [visited]);

    return {
        hasSupabaseEnv,
        userId,
        userEmail,
        visited,
        visitedCount,
        isLoggedIn: Boolean(userId),
        isLoadingVisits,
        toggleVisited,
    };
}
