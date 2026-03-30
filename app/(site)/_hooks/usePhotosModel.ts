'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    deletePhotoForUser,
    getPhotosForUser,
    setPhotoCaptionForUser,
    uploadPhotoForUser,
    type PhotoRecord,
    type PhotosByClubMap,
} from '../_lib/photosRepository';
import { hasSupabaseEnv, supabase } from '../_lib/supabaseClient';

type SaveResult = {
    ok: boolean;
    error?: string;
};

function classifyPhotosError(error: unknown): string {
    if (!error || typeof error !== 'object') {
        return 'write_failed';
    }

    const maybeError = error as {
        code?: string;
        message?: string;
        details?: string;
        hint?: string;
        statusCode?: string | number;
    };

    const combinedText = [
        maybeError.code ?? '',
        maybeError.message ?? '',
        maybeError.details ?? '',
        maybeError.hint ?? '',
        String(maybeError.statusCode ?? ''),
    ]
        .join(' ')
        .toLowerCase();

    if (
        maybeError.code === '42P01'
        || combinedText.includes('relation')
        || combinedText.includes('table')
    ) {
        return 'photos_table_missing';
    }

    if (
        combinedText.includes('bucket')
        || combinedText.includes('storage')
        || combinedText.includes('object not found')
    ) {
        return 'photos_storage_missing';
    }

    if (
        maybeError.code === '42501'
        || combinedText.includes('row-level security')
        || combinedText.includes('permission denied')
        || combinedText.includes('not allowed')
    ) {
        return 'photos_permission_denied';
    }

    return 'write_failed';
}

function replacePhotoRecord(current: PhotosByClubMap, nextRecord: PhotoRecord): PhotosByClubMap {
    const currentList = current[nextRecord.clubId] ?? [];
    const withoutExisting = currentList.filter((record) => record.fileName !== nextRecord.fileName);
    const nextList = [...withoutExisting, nextRecord].sort((left, right) => {
        const leftTime = left.createdAt ? Date.parse(left.createdAt) : 0;
        const rightTime = right.createdAt ? Date.parse(right.createdAt) : 0;
        if (leftTime !== rightTime) {
            return rightTime - leftTime;
        }
        return left.fileName.localeCompare(right.fileName, 'da');
    });

    return {
        ...current,
        [nextRecord.clubId]: nextList,
    };
}

export function usePhotosModel() {
    const [userId, setUserId] = useState<string | null>(null);
    const [photosByClubId, setPhotosByClubId] = useState<PhotosByClubMap>({});
    const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);

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
                setPhotosByClubId({});
            }
        });

        return () => {
            subscription.subscription.unsubscribe();
        };
    }, []);

    function reloadPhotos(currentUserId: string) {
        let isCancelled = false;
        setIsLoadingPhotos(true);

        getPhotosForUser(currentUserId)
            .then((map) => {
                if (isCancelled) {
                    return;
                }

                setPhotosByClubId(map);
                setIsLoadingPhotos(false);
            })
            .catch((error) => {
                if (isCancelled) {
                    return;
                }

                console.error(error);
                setIsLoadingPhotos(false);
            });

        return () => {
            isCancelled = true;
        };
    }

    useEffect(() => {
        if (!supabase || !userId) {
            return;
        }

        return reloadPhotos(userId);
    }, [userId]);

    useEffect(() => {
        if (!supabase || !userId) {
            return;
        }

        const handleRefresh = () => {
            void reloadPhotos(userId);
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

    async function uploadPhoto(clubId: string, file: File, caption = ''): Promise<SaveResult> {
        if (!supabase) {
            return { ok: false, error: 'photos_unavailable' };
        }

        if (!userId) {
            return { ok: false, error: 'auth_required' };
        }

        try {
            const record = await uploadPhotoForUser(userId, clubId, file, caption);
            setPhotosByClubId((current) => replacePhotoRecord(current, record));
            return { ok: true };
        } catch (error) {
            console.error(error);
            return { ok: false, error: classifyPhotosError(error) };
        }
    }

    async function saveCaption(clubId: string, fileName: string, caption: string): Promise<SaveResult> {
        if (!supabase) {
            return { ok: false, error: 'photos_unavailable' };
        }

        if (!userId) {
            return { ok: false, error: 'auth_required' };
        }

        try {
            const record = await setPhotoCaptionForUser(userId, clubId, fileName, caption);
            setPhotosByClubId((current) => replacePhotoRecord(current, record));
            return { ok: true };
        } catch (error) {
            console.error(error);
            return { ok: false, error: classifyPhotosError(error) };
        }
    }

    async function deletePhoto(clubId: string, fileName: string): Promise<SaveResult> {
        if (!supabase) {
            return { ok: false, error: 'photos_unavailable' };
        }

        if (!userId) {
            return { ok: false, error: 'auth_required' };
        }

        try {
            await deletePhotoForUser(userId, clubId, fileName);
            setPhotosByClubId((current) => {
                const currentList = current[clubId] ?? [];
                const nextList = currentList.filter((record) => record.fileName !== fileName);
                const next = { ...current };
                if (nextList.length) {
                    next[clubId] = nextList;
                } else {
                    delete next[clubId];
                }
                return next;
            });
            return { ok: true };
        } catch (error) {
            console.error(error);
            return { ok: false, error: classifyPhotosError(error) };
        }
    }

    const photosCount = useMemo(
        () => Object.values(photosByClubId).reduce((sum, list) => sum + list.length, 0),
        [photosByClubId]
    );

    return {
        hasSupabaseEnv,
        userId,
        photosByClubId,
        photosCount,
        isLoggedIn: Boolean(userId),
        isLoadingPhotos,
        uploadPhoto,
        saveCaption,
        deletePhoto,
        reloadPhotos: () => {
            if (!userId) {
                return;
            }
            void reloadPhotos(userId);
        },
    };
}
