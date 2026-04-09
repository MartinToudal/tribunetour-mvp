import { canonicalClubId } from './clubIdentityResolver';
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
    const latestByClubId: Record<string, SharedNoteRow> = {};

    rows?.forEach((row) => {
        const clubId = canonicalClubId(row.club_id);
        const current = latestByClubId[clubId];
        const currentTime = current?.updated_at ? Date.parse(current.updated_at) : 0;
        const nextTime = row.updated_at ? Date.parse(row.updated_at) : 0;
        if (current && currentTime > nextTime) {
            return;
        }
        latestByClubId[clubId] = row;
    });

    const map: NotesMap = {};
    Object.values(latestByClubId).forEach((row) => {
        const note = normalizeNote(row.note);
        if (!note.trim()) {
            return;
        }
        map[canonicalClubId(row.club_id)] = note;
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

    clubId = canonicalClubId(clubId);

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
        clubId: canonicalClubId(data.club_id),
        note: normalizeNote(data.note),
        updatedAt: data.updated_at ?? null,
    };
}

export async function setNoteForUser(userId: string, clubId: string, note: string): Promise<void> {
    if (!supabase) {
        return;
    }

    clubId = canonicalClubId(clubId);
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
