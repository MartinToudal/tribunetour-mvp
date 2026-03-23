'use client';

import { useEffect, useMemo, useState } from 'react';
import { getVisitedForUser, setVisitedForUser } from '../_lib/visitedRepository';
import { hasSupabaseEnv, supabase } from '../_lib/supabaseClient';

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

        getVisitedForUser(userId)
            .then((map) => {
                if (isCancelled) {
                    return;
                }

                setVisited(map);
                setIsLoadingVisits(false);
            })
            .catch((error) => {
                if (isCancelled) {
                    return;
                }

                console.error(error);
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
            try {
                await setVisitedForUser(userId, clubId, false);
            } catch (error) {
                console.error(error);
                return { ok: false, error: 'write_failed' };
            }
            setVisited((current) => ({ ...current, [clubId]: false }));
            return { ok: true };
        }

        try {
            await setVisitedForUser(userId, clubId, true);
        } catch (error) {
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
