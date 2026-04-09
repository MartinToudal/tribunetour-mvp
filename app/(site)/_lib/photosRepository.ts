import { allKnownClubIds, canonicalClubId } from './clubIdentityResolver';
import { supabase } from './supabaseClient';

export const PHOTOS_BUCKET = 'stadium-photos';
const SIGNED_URL_TTL_SECONDS = 60 * 60;

type SharedPhotoRow = {
    club_id: string;
    file_name: string;
    caption: string | null;
    created_at: string | null;
    updated_at: string | null;
    source: string | null;
};

export type PhotoRecord = {
    clubId: string;
    fileName: string;
    caption: string;
    createdAt: string | null;
    updatedAt: string | null;
    source: string;
    signedUrl: string | null;
};

export type PhotosByClubMap = Record<string, PhotoRecord[]>;

function normalizeText(value: string | null | undefined): string {
    return value ?? '';
}

function buildStoragePath(userId: string, clubId: string, fileName: string): string {
    return `${userId}/${canonicalClubId(clubId)}/${fileName}`;
}

function buildStoragePaths(userId: string, clubId: string, fileName: string): string[] {
    return Array.from(
        new Set(
            allKnownClubIds(clubId).map((candidateClubId) => `${userId}/${candidateClubId}/${fileName}`)
        )
    );
}

function sanitizeFileName(value: string): string {
    return value
        .normalize('NFKD')
        .replace(/[^\w.-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase();
}

function inferExtension(file: File): string {
    const fileName = file.name.toLowerCase();
    if (fileName.endsWith('.png')) {
        return 'png';
    }
    if (fileName.endsWith('.webp')) {
        return 'webp';
    }
    if (fileName.endsWith('.heic')) {
        return 'heic';
    }
    return 'jpg';
}

function buildUploadFileName(clubId: string, file: File): string {
    const slug = sanitizeFileName(canonicalClubId(clubId)) || 'stadium';
    const extension = inferExtension(file);
    return `${slug}_${crypto.randomUUID()}.${extension}`;
}

function compareByCreatedAtDesc(left: PhotoRecord, right: PhotoRecord): number {
    const leftTime = left.createdAt ? Date.parse(left.createdAt) : 0;
    const rightTime = right.createdAt ? Date.parse(right.createdAt) : 0;
    if (leftTime !== rightTime) {
        return rightTime - leftTime;
    }
    return left.fileName.localeCompare(right.fileName, 'da');
}

async function loadSignedUrl(userId: string, clubId: string, fileName: string): Promise<string | null> {
    if (!supabase) {
        return null;
    }

    for (const path of buildStoragePaths(userId, clubId, fileName)) {
        const { data, error } = await supabase.storage
            .from(PHOTOS_BUCKET)
            .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

        if (error) {
            continue;
        }

        if (data.signedUrl) {
            return data.signedUrl;
        }
    }

    return null;
}

async function toPhotoRecord(userId: string, row: SharedPhotoRow): Promise<PhotoRecord> {
    return {
        clubId: canonicalClubId(row.club_id),
        fileName: row.file_name,
        caption: normalizeText(row.caption),
        createdAt: row.created_at ?? null,
        updatedAt: row.updated_at ?? null,
        source: normalizeText(row.source) || 'shared',
        signedUrl: await loadSignedUrl(userId, canonicalClubId(row.club_id), row.file_name),
    };
}

function groupPhotosByClub(records: PhotoRecord[]): PhotosByClubMap {
    return records.reduce<PhotosByClubMap>((acc, record) => {
        const existing = acc[record.clubId] ?? [];
        acc[record.clubId] = [...existing, record].sort(compareByCreatedAtDesc);
        return acc;
    }, {});
}

export async function getPhotosForUser(userId: string): Promise<PhotosByClubMap> {
    if (!supabase) {
        return {};
    }

    const { data, error } = await supabase
        .from('photos')
        .select('club_id, file_name, caption, created_at, updated_at, source')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        throw error;
    }

    const records = await Promise.all(
        ((data as SharedPhotoRow[] | null) ?? []).map((row) => toPhotoRecord(userId, row))
    );

    return groupPhotosByClub(records);
}

export async function setPhotoCaptionForUser(
    userId: string,
    clubId: string,
    fileName: string,
    caption: string
): Promise<PhotoRecord> {
    if (!supabase) {
        throw new Error('photos_unavailable');
    }

    clubId = canonicalClubId(clubId);
    const timestamp = new Date().toISOString();
    const { data, error } = await supabase
        .from('photos')
        .update({
            caption,
            updated_at: timestamp,
            source: 'web',
        })
        .eq('user_id', userId)
        .eq('club_id', clubId)
        .eq('file_name', fileName)
        .select('club_id, file_name, caption, created_at, updated_at, source')
        .single();

    if (error) {
        throw error;
    }

    return toPhotoRecord(userId, data as SharedPhotoRow);
}

export async function uploadPhotoForUser(
    userId: string,
    clubId: string,
    file: File,
    caption: string
): Promise<PhotoRecord> {
    if (!supabase) {
        throw new Error('photos_unavailable');
    }

    clubId = canonicalClubId(clubId);
    const fileName = buildUploadFileName(clubId, file);
    const path = buildStoragePath(userId, clubId, fileName);

    const { error: uploadError } = await supabase.storage
        .from(PHOTOS_BUCKET)
        .upload(path, file, {
            upsert: false,
            contentType: file.type || 'image/jpeg',
        });

    if (uploadError) {
        throw uploadError;
    }

    const timestamp = new Date().toISOString();
    const { data, error } = await supabase
        .from('photos')
        .upsert({
            user_id: userId,
            club_id: clubId,
            file_name: fileName,
            caption,
            created_at: timestamp,
            updated_at: timestamp,
            source: 'web',
        }, {
            onConflict: 'user_id,club_id,file_name',
        })
        .select('club_id, file_name, caption, created_at, updated_at, source')
        .single();

    if (error) {
        throw error;
    }

    return toPhotoRecord(userId, data as SharedPhotoRow);
}

export async function deletePhotoForUser(
    userId: string,
    clubId: string,
    fileName: string
): Promise<void> {
    if (!supabase) {
        throw new Error('photos_unavailable');
    }

    clubId = canonicalClubId(clubId);
    const { error: storageError } = await supabase.storage
        .from(PHOTOS_BUCKET)
        .remove(buildStoragePaths(userId, clubId, fileName));

    if (storageError) {
        throw storageError;
    }

    const { error } = await supabase
        .from('photos')
        .delete()
        .eq('user_id', userId)
        .eq('club_id', clubId)
        .eq('file_name', fileName);

    if (error) {
        throw error;
    }
}
