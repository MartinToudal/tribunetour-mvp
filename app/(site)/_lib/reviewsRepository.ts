import { supabase } from './supabaseClient';

export const REVIEW_CATEGORIES = [
    'atmosphereSound',
    'sightlinesSeats',
    'aestheticsHistory',
    'foodDrinkQuality',
    'foodDrinkPrice',
    'valueForMoney',
    'accessTransport',
    'facilities',
    'matchdayOperations',
    'familyFriendliness',
    'awayFanConditions',
] as const;

export type ReviewCategory = (typeof REVIEW_CATEGORIES)[number];
export type ReviewScores = Partial<Record<ReviewCategory, number>>;
export type ReviewCategoryNotes = Partial<Record<ReviewCategory, string>>;

type SharedReviewRow = {
    club_id: string;
    match_label: string | null;
    scores: Record<string, unknown> | null;
    category_notes: Record<string, unknown> | null;
    summary: string | null;
    tags: string | null;
    updated_at: string | null;
};

export type ReviewRecord = {
    clubId: string;
    matchLabel: string;
    scores: ReviewScores;
    categoryNotes: ReviewCategoryNotes;
    summary: string;
    tags: string;
    updatedAt: string | null;
};

export type ReviewsMap = Record<string, ReviewRecord>;

function normalizeText(value: string | null | undefined): string {
    return value ?? '';
}

function normalizeScores(value: Record<string, unknown> | null | undefined): ReviewScores {
    const next: ReviewScores = {};

    if (!value) {
        return next;
    }

    REVIEW_CATEGORIES.forEach((category) => {
        const raw = value[category];
        if (typeof raw !== 'number' || !Number.isFinite(raw)) {
            return;
        }
        next[category] = Math.min(10, Math.max(1, Math.round(raw)));
    });

    return next;
}

function normalizeCategoryNotes(value: Record<string, unknown> | null | undefined): ReviewCategoryNotes {
    const next: ReviewCategoryNotes = {};

    if (!value) {
        return next;
    }

    REVIEW_CATEGORIES.forEach((category) => {
        const raw = value[category];
        if (typeof raw !== 'string') {
            return;
        }
        if (!raw.trim()) {
            return;
        }
        next[category] = raw;
    });

    return next;
}

function toReviewRecord(row: SharedReviewRow): ReviewRecord {
    return {
        clubId: row.club_id,
        matchLabel: normalizeText(row.match_label),
        scores: normalizeScores(row.scores),
        categoryNotes: normalizeCategoryNotes(row.category_notes),
        summary: normalizeText(row.summary),
        tags: normalizeText(row.tags),
        updatedAt: row.updated_at ?? null,
    };
}

function hasMeaningfulReview(review: ReviewRecord): boolean {
    return Boolean(
        review.matchLabel.trim()
        || review.summary.trim()
        || review.tags.trim()
        || Object.keys(review.scores).length
        || Object.keys(review.categoryNotes).length
    );
}

function toReviewsMap(rows: SharedReviewRow[] | null): ReviewsMap {
    const map: ReviewsMap = {};
    rows?.forEach((row) => {
        const review = toReviewRecord(row);
        if (!hasMeaningfulReview(review)) {
            return;
        }
        map[row.club_id] = review;
    });
    return map;
}

export async function getReviewsForUser(userId: string): Promise<ReviewsMap> {
    if (!supabase) {
        return {};
    }

    const { data, error } = await supabase
        .from('reviews')
        .select('club_id, match_label, scores, category_notes, summary, tags, updated_at')
        .eq('user_id', userId);

    if (error) {
        throw error;
    }

    return toReviewsMap(data as SharedReviewRow[] | null);
}

export async function getReviewRecordForUser(userId: string, clubId: string): Promise<ReviewRecord | null> {
    if (!supabase) {
        return null;
    }

    const { data, error } = await supabase
        .from('reviews')
        .select('club_id, match_label, scores, category_notes, summary, tags, updated_at')
        .eq('user_id', userId)
        .eq('club_id', clubId)
        .maybeSingle();

    if (error) {
        throw error;
    }

    if (!data) {
        return null;
    }

    return toReviewRecord(data as SharedReviewRow);
}

export async function setReviewForUser(
    userId: string,
    clubId: string,
    review: Omit<ReviewRecord, 'clubId'>
): Promise<void> {
    if (!supabase) {
        return;
    }

    const timestamp = review.updatedAt ?? new Date().toISOString();
    const { error } = await supabase
        .from('reviews')
        .upsert({
            user_id: userId,
            club_id: clubId,
            match_label: review.matchLabel,
            scores: review.scores,
            category_notes: review.categoryNotes,
            summary: review.summary,
            tags: review.tags,
            updated_at: timestamp,
            source: 'web',
        }, {
            onConflict: 'user_id,club_id',
        });

    if (error) {
        throw error;
    }
}
