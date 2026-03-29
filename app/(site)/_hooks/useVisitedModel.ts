'use client';

import { useEffect, useMemo, useState } from 'react';
import { getVisitedForUser, setVisitedForUser } from '../_lib/visitedRepository';
import { hasSupabaseEnv, supabase } from '../_lib/supabaseClient';

type ToggleResult = {
    ok: boolean;
    error?: string;
};

const VISITED_LOAD_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timeoutId = window.setTimeout(() => {
            reject(new Error('visited_load_timeout'));
        }, timeoutMs);

        promise
            .then((value) => {
                window.clearTimeout(timeoutId);
                resolve(value);
            })
            .catch((error) => {
                window.clearTimeout(timeoutId);
                reject(error);
            });
    });
}

export function useVisitedModel() {
    const [userId, setUserId] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [visited, setVisited] = useState<Record<string, boolean>>({});
    const [isLoadingVisits, setIsLoadingVisits] = useState(false);
    const [visitedLoadError, setVisitedLoadError] = useState<string | null>(null);

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
                setVisitedLoadError(null);
            }
        });

        return () => {
            subscription.subscription.unsubscribe();
        };
    }, []);

    function reloadVisited(currentUserId: string) {
        let isCancelled = false;
        setIsLoadingVisits(true);
        setVisitedLoadError(null);

        withTimeout(getVisitedForUser(currentUserId), VISITED_LOAD_TIMEOUT_MS)
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
                setVisitedLoadError('Kunne ikke hente din besøgsstatus lige nu.');
            });

        return () => {
            isCancelled = true;
        };
    }

    useEffect(() => {
        if (!supabase || !userId) {
            return;
        }

        return reloadVisited(userId);
    }, [userId]);

    useEffect(() => {
        if (!supabase || !userId) {
            return;
        }

        const handleRefresh = () => {
            void reloadVisited(userId);
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                handleRefresh();
            }
        };

        window.addEventListener('focus', handleRefresh);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('focus', handleRefresh);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
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
        visitedLoadError,
        toggleVisited,
    };
}
