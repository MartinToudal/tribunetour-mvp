'use client';

import { useEffect, useMemo, useState } from 'react';
import { getReviewsForUser, setReviewForUser, type ReviewRecord, type ReviewsMap } from '../_lib/reviewsRepository';
import { hasSupabaseEnv, supabase } from '../_lib/supabaseClient';

type SaveResult = {
    ok: boolean;
    error?: string;
};

function classifyReviewsError(error: unknown): string {
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
        return 'reviews_table_missing';
    }

    if (
        maybeError.code === '42501'
        || combinedText.includes('row-level security')
        || combinedText.includes('permission denied')
        || combinedText.includes('not allowed')
    ) {
        return 'reviews_permission_denied';
    }

    return 'write_failed';
}

export function useReviewsModel() {
    const [userId, setUserId] = useState<string | null>(null);
    const [reviews, setReviews] = useState<ReviewsMap>({});
    const [isLoadingReviews, setIsLoadingReviews] = useState(false);

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
                setReviews({});
            }
        });

        return () => {
            subscription.subscription.unsubscribe();
        };
    }, []);

    function reloadReviews(currentUserId: string) {
        let isCancelled = false;
        setIsLoadingReviews(true);

        getReviewsForUser(currentUserId)
            .then((map) => {
                if (isCancelled) {
                    return;
                }

                setReviews(map);
                setIsLoadingReviews(false);
            })
            .catch((error) => {
                if (isCancelled) {
                    return;
                }

                console.error(error);
                setIsLoadingReviews(false);
            });

        return () => {
            isCancelled = true;
        };
    }

    useEffect(() => {
        if (!supabase || !userId) {
            return;
        }

        return reloadReviews(userId);
    }, [userId]);

    useEffect(() => {
        if (!supabase || !userId) {
            return;
        }

        const handleRefresh = () => {
            void reloadReviews(userId);
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

    async function saveReview(clubId: string, review: Omit<ReviewRecord, 'clubId'>): Promise<SaveResult> {
        if (!supabase) {
            return { ok: false, error: 'reviews_unavailable' };
        }

        if (!userId) {
            return { ok: false, error: 'auth_required' };
        }

        try {
            await setReviewForUser(userId, clubId, review);
        } catch (error) {
            console.error(error);
            return { ok: false, error: classifyReviewsError(error) };
        }

        setReviews((current) => ({
            ...current,
            [clubId]: {
                clubId,
                ...review,
            },
        }));

        return { ok: true };
    }

    const reviewsCount = useMemo(
        () => Object.values(reviews).length,
        [reviews]
    );

    return {
        hasSupabaseEnv,
        userId,
        reviews,
        reviewsCount,
        isLoggedIn: Boolean(userId),
        isLoadingReviews,
        saveReview,
        reloadReviews: () => {
            if (!userId) {
                return;
            }
            void reloadReviews(userId);
        },
    };
}
