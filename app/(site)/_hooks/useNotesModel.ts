'use client';

import { useEffect, useMemo, useState } from 'react';
import { getNotesForUser, setNoteForUser } from '../_lib/notesRepository';
import { hasSupabaseEnv, supabase } from '../_lib/supabaseClient';

type SaveResult = {
    ok: boolean;
    error?: string;
};

export function useNotesModel() {
    const [userId, setUserId] = useState<string | null>(null);
    const [notes, setNotes] = useState<Record<string, string>>({});
    const [isLoadingNotes, setIsLoadingNotes] = useState(false);

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
                setNotes({});
            }
        });

        return () => {
            subscription.subscription.unsubscribe();
        };
    }, []);

    function reloadNotes(currentUserId: string) {
        let isCancelled = false;
        setIsLoadingNotes(true);

        getNotesForUser(currentUserId)
            .then((map) => {
                if (isCancelled) {
                    return;
                }

                setNotes(map);
                setIsLoadingNotes(false);
            })
            .catch((error) => {
                if (isCancelled) {
                    return;
                }

                console.error(error);
                setIsLoadingNotes(false);
            });

        return () => {
            isCancelled = true;
        };
    }

    useEffect(() => {
        if (!supabase || !userId) {
            return;
        }

        return reloadNotes(userId);
    }, [userId]);

    async function saveNote(clubId: string, note: string): Promise<SaveResult> {
        if (!supabase) {
            return { ok: false, error: 'notes_unavailable' };
        }

        if (!userId) {
            return { ok: false, error: 'auth_required' };
        }

        try {
            await setNoteForUser(userId, clubId, note);
        } catch (error) {
            console.error(error);
            return { ok: false, error: 'write_failed' };
        }

        setNotes((current) => {
            const next = { ...current };
            if (!note.trim()) {
                delete next[clubId];
                return next;
            }
            next[clubId] = note;
            return next;
        });

        return { ok: true };
    }

    const notesCount = useMemo(
        () => Object.values(notes).filter((note) => note.trim().length > 0).length,
        [notes]
    );

    return {
        hasSupabaseEnv,
        userId,
        notes,
        notesCount,
        isLoggedIn: Boolean(userId),
        isLoadingNotes,
        saveNote,
        reloadNotes: () => {
            if (!userId) {
                return;
            }
            void reloadNotes(userId);
        },
    };
}
