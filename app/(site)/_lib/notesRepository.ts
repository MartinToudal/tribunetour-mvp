import { supabase } from './supabaseClient';

type SharedNoteRow = {
    club_id: string;
    note: string | null;
    updated_at: string | null;
};

export type NoteRecord = {
    clubId: string;
    note: string;
    updatedAt: string | null;
};

export type NotesMap = Record<string, string>;

function normalizeNote(value: string | null | undefined): string {
    return value ?? '';
}

function toNotesMap(rows: SharedNoteRow[] | null): NotesMap {
    const map: NotesMap = {};
    rows?.forEach((row) => {
        const note = normalizeNote(row.note);
        if (!note.trim()) {
            return;
        }
        map[row.club_id] = note;
    });
    return map;
}

export async function getNotesForUser(userId: string): Promise<NotesMap> {
    if (!supabase) {
        return {};
    }

    const { data, error } = await supabase
        .from('notes')
        .select('club_id, note, updated_at')
        .eq('user_id', userId);

    if (error) {
        throw error;
    }

    return toNotesMap(data as SharedNoteRow[] | null);
}

export async function getNoteRecordForUser(userId: string, clubId: string): Promise<NoteRecord | null> {
    if (!supabase) {
        return null;
    }

    const { data, error } = await supabase
        .from('notes')
        .select('club_id, note, updated_at')
        .eq('user_id', userId)
        .eq('club_id', clubId)
        .maybeSingle();

    if (error) {
        throw error;
    }

    if (!data) {
        return null;
    }

    return {
        clubId: data.club_id,
        note: normalizeNote(data.note),
        updatedAt: data.updated_at ?? null,
    };
}

export async function setNoteForUser(userId: string, clubId: string, note: string): Promise<void> {
    if (!supabase) {
        return;
    }

    const timestamp = new Date().toISOString();
    const { error } = await supabase
        .from('notes')
        .upsert({
            user_id: userId,
            club_id: clubId,
            note,
            updated_at: timestamp,
            source: 'web',
        }, {
            onConflict: 'user_id,club_id',
        });

    if (error) {
        throw error;
    }
}
