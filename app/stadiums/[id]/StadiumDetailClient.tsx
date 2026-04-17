'use client';

import { useEffect, useMemo, useState } from 'react';
import { useVisitedModel } from '../../(site)/_hooks/useVisitedModel';
import { useNotesModel } from '../../(site)/_hooks/useNotesModel';
import { usePhotosModel } from '../../(site)/_hooks/usePhotosModel';
import { useReviewsModel } from '../../(site)/_hooks/useReviewsModel';
import {
    REVIEW_CATEGORIES,
    type ReviewCategory,
    type ReviewCategoryNotes,
    type ReviewRecord,
    type ReviewScores,
} from '../../(site)/_lib/reviewsRepository';
import type { Stadium } from '../../(site)/_lib/referenceData';

type StadiumDetailClientProps = {
    stadium: Stadium;
};

type ReviewDraft = {
    matchLabel: string;
    scores: ReviewScores;
    categoryNotes: ReviewCategoryNotes;
    summary: string;
    tags: string;
};

const CATEGORY_LABELS: Record<ReviewCategory, string> = {
    atmosphereSound: 'Atmosfære og lyd',
    sightlinesSeats: 'Sigtlinjer og pladser',
    aestheticsHistory: 'Æstetik og historie',
    foodDrinkQuality: 'Mad og drikke - kvalitet',
    foodDrinkPrice: 'Mad og drikke - pris',
    valueForMoney: 'Værdi for pengene',
    accessTransport: 'Adgang og transport',
    facilities: 'Faciliteter',
    matchdayOperations: 'Matchday drift',
    familyFriendliness: 'Familievenlighed',
    awayFanConditions: 'Udebaneforhold',
};

function emptyReviewDraft(): ReviewDraft {
    return {
        matchLabel: '',
        scores: {},
        categoryNotes: {},
        summary: '',
        tags: '',
    };
}

function toReviewDraft(review?: ReviewRecord): ReviewDraft {
    if (!review) {
        return emptyReviewDraft();
    }

    return {
        matchLabel: review.matchLabel,
        scores: { ...review.scores },
        categoryNotes: { ...review.categoryNotes },
        summary: review.summary,
        tags: review.tags,
    };
}

function draftsAreEqual(left: ReviewDraft, right: ReviewDraft): boolean {
    if (left.matchLabel !== right.matchLabel || left.summary !== right.summary || left.tags !== right.tags) {
        return false;
    }

    return REVIEW_CATEGORIES.every((category) =>
        (left.scores[category] ?? null) === (right.scores[category] ?? null)
        && (left.categoryNotes[category] ?? '') === (right.categoryNotes[category] ?? '')
    );
}

function hasMeaningfulReviewDraft(review: ReviewDraft): boolean {
    return Boolean(
        review.matchLabel.trim()
        || review.summary.trim()
        || review.tags.trim()
        || Object.keys(review.scores).length
        || Object.keys(review.categoryNotes).length
    );
}

export default function StadiumDetailClient({ stadium }: StadiumDetailClientProps) {
    const { hasSupabaseEnv, isLoggedIn, isLoadingVisits, visited, toggleVisited } = useVisitedModel();
    const { notes, isLoadingNotes, saveNote } = useNotesModel();
    const { photosByClubId, isLoadingPhotos, uploadPhoto, saveCaption, deletePhoto } = usePhotosModel();
    const { reviews, isLoadingReviews, saveReview } = useReviewsModel();
    const isVisited = Boolean(visited[stadium.id]);
    const sharedNote = notes[stadium.id] ?? '';
    const sharedPhotos = photosByClubId[stadium.id] ?? [];
    const sharedReview = reviews[stadium.id];
    const [noteDraft, setNoteDraft] = useState(sharedNote);
    const [noteState, setNoteState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [noteError, setNoteError] = useState<string | null>(null);
    const [uploadCaptionDraft, setUploadCaptionDraft] = useState('');
    const [captionDrafts, setCaptionDrafts] = useState<Record<string, string>>({});
    const [photoState, setPhotoState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [photoError, setPhotoError] = useState<string | null>(null);
    const [reviewDraft, setReviewDraft] = useState<ReviewDraft>(toReviewDraft(sharedReview));
    const [reviewState, setReviewState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [reviewError, setReviewError] = useState<string | null>(null);

    useEffect(() => {
        setNoteDraft(sharedNote);
    }, [sharedNote]);

    useEffect(() => {
        setReviewDraft(toReviewDraft(sharedReview));
    }, [sharedReview]);

    useEffect(() => {
        setCaptionDrafts(
            sharedPhotos.reduce<Record<string, string>>((acc, photo) => {
                acc[photo.fileName] = photo.caption;
                return acc;
            }, {})
        );
    }, [sharedPhotos]);

    const hasUnsavedChanges = useMemo(
        () => noteDraft !== sharedNote,
        [noteDraft, sharedNote]
    );

    const hasUnsavedReviewChanges = useMemo(
        () => !draftsAreEqual(reviewDraft, toReviewDraft(sharedReview)),
        [reviewDraft, sharedReview]
    );

    const photoCount = useMemo(
        () => sharedPhotos.length,
        [sharedPhotos]
    );

    const reviewScoreCount = useMemo(
        () => REVIEW_CATEGORIES.filter((category) => reviewDraft.scores[category] != null).length,
        [reviewDraft]
    );

    const reviewAverage = useMemo(() => {
        const scores = REVIEW_CATEGORIES
            .map((category) => reviewDraft.scores[category])
            .filter((value): value is number => typeof value === 'number');

        if (!scores.length) {
            return null;
        }

        const total = scores.reduce((sum, value) => sum + value, 0);
        return (total / scores.length).toFixed(1);
    }, [reviewDraft]);

    async function handleSaveNote() {
        setNoteError(null);
        setNoteState('saving');
        const result = await saveNote(stadium.id, noteDraft);
        setNoteState(result.ok ? 'saved' : 'error');
        if (!result.ok) {
            if (result.error === 'notes_table_missing') {
                setNoteError('Notes-backend er ikke oprettet endnu.');
                return;
            }

            if (result.error === 'notes_permission_denied') {
                setNoteError('Notes-backend mangler adgang eller policy for denne bruger.');
                return;
            }

            if (result.error === 'auth_required') {
                setNoteError('Log ind for at gemme din note.');
                return;
            }

            setNoteError('Noten kunne ikke gemmes lige nu.');
            return;
        }

        if (result.ok) {
            window.setTimeout(() => {
                setNoteState((current) => (current === 'saved' ? 'idle' : current));
            }, 1400);
        }
    }

    async function handleSaveReview() {
        setReviewError(null);
        setReviewState('saving');

        const result = await saveReview(stadium.id, {
            matchLabel: reviewDraft.matchLabel,
            scores: reviewDraft.scores,
            categoryNotes: reviewDraft.categoryNotes,
            summary: reviewDraft.summary,
            tags: reviewDraft.tags,
            updatedAt: new Date().toISOString(),
        });

        setReviewState(result.ok ? 'saved' : 'error');
        if (!result.ok) {
            if (result.error === 'reviews_table_missing') {
                setReviewError('Reviews-backend er ikke oprettet endnu.');
                return;
            }

            if (result.error === 'reviews_permission_denied') {
                setReviewError('Reviews-backend mangler adgang eller policy for denne bruger.');
                return;
            }

            if (result.error === 'auth_required') {
                setReviewError('Log ind for at gemme din anmeldelse.');
                return;
            }

            setReviewError('Anmeldelsen kunne ikke gemmes lige nu.');
            return;
        }

        window.setTimeout(() => {
            setReviewState((current) => (current === 'saved' ? 'idle' : current));
        }, 1400);
    }

    async function handleUploadPhoto(file: File) {
        setPhotoError(null);
        setPhotoState('saving');

        const result = await uploadPhoto(stadium.id, file, uploadCaptionDraft.trim());
        setPhotoState(result.ok ? 'saved' : 'error');

        if (!result.ok) {
            if (result.error === 'photos_table_missing') {
                setPhotoError('Photos-backend er ikke oprettet endnu.');
                return;
            }

            if (result.error === 'photos_storage_missing') {
                setPhotoError('Photos-storage mangler bucket eller policy.');
                return;
            }

            if (result.error === 'photos_permission_denied') {
                setPhotoError('Photos-backend mangler adgang eller policy for denne bruger.');
                return;
            }

            if (result.error === 'auth_required') {
                setPhotoError('Log ind for at gemme billeder.');
                return;
            }

            setPhotoError('Billedet kunne ikke gemmes lige nu.');
            return;
        }

        setUploadCaptionDraft('');
        window.setTimeout(() => {
            setPhotoState((current) => (current === 'saved' ? 'idle' : current));
        }, 1400);
    }

    async function handleSavePhotoCaption(fileName: string) {
        setPhotoError(null);
        setPhotoState('saving');

        const result = await saveCaption(stadium.id, fileName, captionDrafts[fileName] ?? '');
        setPhotoState(result.ok ? 'saved' : 'error');

        if (!result.ok) {
            if (result.error === 'auth_required') {
                setPhotoError('Log ind for at gemme billedtekster.');
                return;
            }

            if (result.error === 'photos_permission_denied') {
                setPhotoError('Photos-backend mangler adgang eller policy for denne bruger.');
                return;
            }

            setPhotoError('Billedteksten kunne ikke gemmes lige nu.');
            return;
        }

        window.setTimeout(() => {
            setPhotoState((current) => (current === 'saved' ? 'idle' : current));
        }, 1400);
    }

    async function handleDeletePhoto(fileName: string) {
        setPhotoError(null);
        setPhotoState('saving');

        const result = await deletePhoto(stadium.id, fileName);
        setPhotoState(result.ok ? 'saved' : 'error');

        if (!result.ok) {
            if (result.error === 'auth_required') {
                setPhotoError('Log ind for at slette billeder.');
                return;
            }

            if (result.error === 'photos_permission_denied') {
                setPhotoError('Photos-backend mangler adgang eller policy for denne bruger.');
                return;
            }

            if (result.error === 'photos_storage_missing') {
                setPhotoError('Photos-storage mangler bucket eller policy.');
                return;
            }

            setPhotoError('Billedet kunne ikke slettes lige nu.');
            return;
        }

        window.setTimeout(() => {
            setPhotoState((current) => (current === 'saved' ? 'idle' : current));
        }, 1400);
    }

    return (
        <div className="grid gap-6 p-5 md:p-6">
                <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
                    <div className="flex flex-wrap items-center gap-3">
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${isVisited ? 'bg-[rgba(184,255,106,0.12)] text-[var(--accent)]' : 'bg-white/5 text-[var(--muted)]'}`}>
                            {isVisited ? 'Besøgt' : 'Ikke besøgt'}
                        </span>
                        {hasSupabaseEnv && isLoadingVisits && (
                            <span className="text-sm text-[var(--muted)]">Henter din status…</span>
                        )}
                        {!hasSupabaseEnv && (
                            <span className="text-sm text-[var(--muted)]">Personlig besøgsstatus og noter kommer senere på web.</span>
                        )}
                        {hasSupabaseEnv && !isLoggedIn && (
                            <span className="text-sm text-[var(--muted)]">Log ind for at gemme din status og note for {stadium.name}.</span>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={async () => {
                            const result = await toggleVisited(stadium.id);
                            if (!result.ok && result.error === 'auth_required') {
                                alert('Log ind for at ændre din besøgsstatus.');
                            } else if (!result.ok) {
                                alert('Kunne ikke gemme din besøgsstatus lige nu.');
                            }
                        }}
                        disabled={!hasSupabaseEnv}
                        className={`rounded-full px-4 py-2 text-sm font-medium transition ${isVisited ? 'border border-[rgba(184,255,106,0.35)] bg-[rgba(184,255,106,0.12)] text-white' : 'border border-white/10 bg-white/5 text-[var(--muted)] hover:text-white'}`}
                    >
                        {!hasSupabaseEnv ? 'Visited kommer senere' : !isLoggedIn ? 'Log ind for at gemme' : isVisited ? 'Marker som ubesøgt' : 'Marker som besøgt'}
                    </button>
                </div>

                <div className="site-card-soft p-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Personlig note</div>
                            <div className="mt-1 text-sm text-[var(--muted)]">
                                Brug noten til små observationer, stemning eller ting du vil huske til din næste tur.
                            </div>
                        </div>
                        {hasSupabaseEnv && isLoggedIn && isLoadingNotes && (
                            <span className="text-xs text-[var(--muted)]">Henter note…</span>
                        )}
                    </div>

                    <textarea
                        value={noteDraft}
                        onChange={(event) => {
                            setNoteDraft(event.target.value);
                            setNoteState('idle');
                        }}
                        placeholder={!hasSupabaseEnv ? 'Noter kommer senere på web.' : !isLoggedIn ? 'Log ind for at gemme en note til dette stadion.' : 'Skriv din note om stadionet her…'}
                        disabled={!hasSupabaseEnv || !isLoggedIn}
                        rows={5}
                        className="field-input mt-4 min-h-[9rem] resize-y"
                    />

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <div className="text-xs text-[var(--muted)]">
                            {!hasSupabaseEnv
                                ? 'Personlige noter er ikke aktive på web endnu.'
                                : !isLoggedIn
                                    ? 'Log ind for at gemme noter på tværs af app og web.'
                                    : noteState === 'saved'
                                        ? 'Noten er gemt.'
                                        : noteError
                                            ? noteError
                                            : noteState === 'error'
                                                ? 'Noten kunne ikke gemmes lige nu.'
                                            : hasUnsavedChanges
                                                ? 'Du har ikke-gemte ændringer.'
                                                : 'Din note følger denne konto.'}
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                void handleSaveNote();
                            }}
                            disabled={!hasSupabaseEnv || !isLoggedIn || !hasUnsavedChanges || noteState === 'saving'}
                            className="cta-secondary"
                        >
                            {noteState === 'saving' ? 'Gemmer…' : 'Gem note'}
                        </button>
                    </div>
                </div>

                <div className="site-card-soft p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Personlige billeder</div>
                            <div className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
                                Brug de samme stadionbilleder på tværs af app og web. Du kan uploade, skrive billedtekst og slette dem her.
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                            <span className="rounded-full bg-white/5 px-3 py-1">
                                Billeder: {photoCount}
                            </span>
                            {hasSupabaseEnv && isLoggedIn && isLoadingPhotos && (
                                <span className="rounded-full bg-white/5 px-3 py-1">Henter billeder…</span>
                            )}
                        </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                        <label className="grid gap-2">
                            <span className="text-sm font-medium text-white">Valgfri billedtekst til næste upload</span>
                            <input
                                value={uploadCaptionDraft}
                                onChange={(event) => {
                                    setUploadCaptionDraft(event.target.value);
                                    setPhotoState('idle');
                                }}
                                placeholder={!hasSupabaseEnv ? 'Photos kommer senere på web.' : !isLoggedIn ? 'Log ind for at gemme billeder.' : 'Fx Aftenlys over tribunen'}
                                disabled={!hasSupabaseEnv || !isLoggedIn}
                                className="field-input"
                            />
                        </label>

                        <label className={`cta-secondary cursor-pointer text-center ${(!hasSupabaseEnv || !isLoggedIn) ? 'pointer-events-none opacity-60' : ''}`}>
                            Vælg billede
                            <input
                                type="file"
                                accept="image/*"
                                disabled={!hasSupabaseEnv || !isLoggedIn || photoState === 'saving'}
                                className="hidden"
                                onChange={(event) => {
                                    const file = event.target.files?.[0];
                                    event.currentTarget.value = '';
                                    if (!file) {
                                        return;
                                    }
                                    void handleUploadPhoto(file);
                                }}
                            />
                        </label>
                    </div>

                    <div className="mt-4 text-xs text-[var(--muted)]">
                        {!hasSupabaseEnv
                            ? 'Personlige billeder er ikke aktive på web endnu.'
                            : !isLoggedIn
                                ? 'Log ind for at gemme billeder på tværs af app og web.'
                                : photoState === 'saved'
                                    ? 'Fotoændringen er gemt.'
                                    : photoError
                                        ? photoError
                                        : photoState === 'saving'
                                            ? 'Gemmer fotoændring…'
                                            : 'Dine billeder følger denne konto.'}
                    </div>

                    {sharedPhotos.length === 0 ? (
                        <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-black/10 p-5 text-sm text-[var(--muted)]">
                            Ingen billeder endnu.
                        </div>
                    ) : (
                        <div className="mt-4 grid gap-4">
                            {sharedPhotos.map((photo) => (
                                <article key={photo.fileName} className="rounded-2xl border border-white/8 bg-black/10 p-4">
                                    <div className="grid gap-4 md:grid-cols-[180px_1fr]">
                                        <div className="overflow-hidden rounded-2xl border border-white/8 bg-white/5">
                                            {photo.signedUrl ? (
                                                <img
                                                    src={photo.signedUrl}
                                                    alt={`Stadionfoto fra ${stadium.name}`}
                                                    className="h-full w-full object-cover"
                                                />
                                            ) : (
                                                <div className="flex min-h-[11rem] items-center justify-center text-sm text-[var(--muted)]">
                                                    Kunne ikke hente preview
                                                </div>
                                            )}
                                        </div>

                                        <div className="grid gap-3">
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <div>
                                                    <div className="text-sm font-medium text-white">{photo.fileName}</div>
                                                    <div className="mt-1 text-xs text-[var(--muted)]">
                                                        {photo.createdAt
                                                            ? `Uploadet ${new Date(photo.createdAt).toLocaleDateString('da-DK')}`
                                                            : 'Uploadtidspunkt ukendt'}
                                                    </div>
                                                </div>

                                                {photo.signedUrl && (
                                                    <a
                                                        href={photo.signedUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="rounded-full border border-white/10 px-4 py-2 text-sm text-[var(--muted)] transition hover:text-white"
                                                    >
                                                        Åbn billede
                                                    </a>
                                                )}
                                            </div>

                                            <label className="grid gap-2">
                                                <span className="text-sm font-medium text-white">Billedtekst</span>
                                                <textarea
                                                    value={captionDrafts[photo.fileName] ?? ''}
                                                    onChange={(event) => {
                                                        const value = event.target.value;
                                                        setCaptionDrafts((current) => ({
                                                            ...current,
                                                            [photo.fileName]: value,
                                                        }));
                                                        setPhotoState('idle');
                                                    }}
                                                    rows={3}
                                                    disabled={!hasSupabaseEnv || !isLoggedIn}
                                                    className="field-input min-h-[6rem] resize-y"
                                                />
                                            </label>

                                            <div className="flex flex-wrap gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        void handleSavePhotoCaption(photo.fileName);
                                                    }}
                                                    disabled={!hasSupabaseEnv || !isLoggedIn || photoState === 'saving'}
                                                    className="cta-secondary"
                                                >
                                                    Gem billedtekst
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        void handleDeletePhoto(photo.fileName);
                                                    }}
                                                    disabled={!hasSupabaseEnv || !isLoggedIn || photoState === 'saving'}
                                                    className="rounded-full border border-white/10 px-4 py-2 text-sm text-[var(--muted)] transition hover:text-white"
                                                >
                                                    Slet billede
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </div>

                <div className="site-card-soft p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Personlig anmeldelse</div>
                            <div className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
                                Dette er den samme reviewmodel som i appen: kamp-label, alle scorekategorier, kategorinoter, opsummering og tags.
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                            <span className="rounded-full bg-white/5 px-3 py-1">
                                Udfyldt: {reviewScoreCount}/{REVIEW_CATEGORIES.length}
                            </span>
                            {reviewAverage && (
                                <span className="rounded-full bg-[rgba(184,255,106,0.12)] px-3 py-1 text-[var(--accent)]">
                                    Snit {reviewAverage}/10
                                </span>
                            )}
                            {hasSupabaseEnv && isLoggedIn && isLoadingReviews && (
                                <span className="rounded-full bg-white/5 px-3 py-1">Henter anmeldelse…</span>
                            )}
                        </div>
                    </div>

                    <div className="mt-4 grid gap-4">
                        <label className="grid gap-2">
                            <span className="text-sm font-medium text-white">Kamp</span>
                            <input
                                value={reviewDraft.matchLabel}
                                onChange={(event) => {
                                    const value = event.target.value;
                                    setReviewDraft((current) => ({ ...current, matchLabel: value }));
                                    setReviewState('idle');
                                }}
                                placeholder="Fx FCK - Brøndby"
                                disabled={!hasSupabaseEnv || !isLoggedIn}
                                className="field-input"
                            />
                        </label>

                        <div className="grid gap-3">
                            {REVIEW_CATEGORIES.map((category) => {
                                const currentScore = reviewDraft.scores[category] ?? null;
                                const currentNote = reviewDraft.categoryNotes[category] ?? '';

                                return (
                                    <div key={category} className="rounded-2xl border border-white/8 bg-black/10 p-4">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div>
                                                <div className="text-sm font-medium text-white">{CATEGORY_LABELS[category]}</div>
                                                <div className="mt-1 text-xs text-[var(--muted)]">
                                                    Giv en score fra 1 til 10 og tilføj eventuelt en kort note.
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setReviewDraft((current) => {
                                                            const nextScore = Math.max(1, (current.scores[category] ?? 6) - 1);
                                                            return {
                                                                ...current,
                                                                scores: { ...current.scores, [category]: nextScore },
                                                            };
                                                        });
                                                        setReviewState('idle');
                                                    }}
                                                    disabled={!hasSupabaseEnv || !isLoggedIn}
                                                    className="rounded-full border border-white/10 px-3 py-1 text-sm text-[var(--muted)]"
                                                >
                                                    -
                                                </button>
                                                <span className="min-w-[5rem] text-center text-sm font-medium text-white">
                                                    {currentScore == null ? 'Ikke sat' : `${currentScore}/10`}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setReviewDraft((current) => {
                                                            const nextScore = Math.min(10, (current.scores[category] ?? 4) + 1);
                                                            return {
                                                                ...current,
                                                                scores: { ...current.scores, [category]: nextScore },
                                                            };
                                                        });
                                                        setReviewState('idle');
                                                    }}
                                                    disabled={!hasSupabaseEnv || !isLoggedIn}
                                                    className="rounded-full border border-white/10 px-3 py-1 text-sm text-[var(--muted)]"
                                                >
                                                    +
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setReviewDraft((current) => {
                                                            const nextScores = { ...current.scores };
                                                            delete nextScores[category];
                                                            return {
                                                                ...current,
                                                                scores: nextScores,
                                                            };
                                                        });
                                                        setReviewState('idle');
                                                    }}
                                                    disabled={!hasSupabaseEnv || !isLoggedIn || currentScore == null}
                                                    className="rounded-full border border-white/10 px-3 py-1 text-xs text-[var(--muted)]"
                                                >
                                                    Nulstil
                                                </button>
                                            </div>
                                        </div>

                                        <textarea
                                            value={currentNote}
                                            onChange={(event) => {
                                                const value = event.target.value;
                                                setReviewDraft((current) => {
                                                    const nextNotes = { ...current.categoryNotes };
                                                    if (!value.trim()) {
                                                        delete nextNotes[category];
                                                    } else {
                                                        nextNotes[category] = value;
                                                    }
                                                    return {
                                                        ...current,
                                                        categoryNotes: nextNotes,
                                                    };
                                                });
                                                setReviewState('idle');
                                            }}
                                            placeholder="Valgfri note til denne kategori…"
                                            disabled={!hasSupabaseEnv || !isLoggedIn}
                                            rows={2}
                                            className="field-input mt-3 min-h-[5rem] resize-y"
                                        />
                                    </div>
                                );
                            })}
                        </div>

                        <label className="grid gap-2">
                            <span className="text-sm font-medium text-white">Kort opsummering</span>
                            <textarea
                                value={reviewDraft.summary}
                                onChange={(event) => {
                                    const value = event.target.value;
                                    setReviewDraft((current) => ({ ...current, summary: value }));
                                    setReviewState('idle');
                                }}
                                placeholder={!hasSupabaseEnv ? 'Reviews kommer senere på web.' : !isLoggedIn ? 'Log ind for at gemme en anmeldelse.' : 'Skriv din samlede oplevelse her…'}
                                disabled={!hasSupabaseEnv || !isLoggedIn}
                                rows={4}
                                className="field-input min-h-[8rem] resize-y"
                            />
                        </label>

                        <label className="grid gap-2">
                            <span className="text-sm font-medium text-white">Tags</span>
                            <input
                                value={reviewDraft.tags}
                                onChange={(event) => {
                                    const value = event.target.value;
                                    setReviewDraft((current) => ({ ...current, tags: value }));
                                    setReviewState('idle');
                                }}
                                placeholder="kommaseparerede tags"
                                disabled={!hasSupabaseEnv || !isLoggedIn}
                                className="field-input"
                            />
                        </label>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="text-xs text-[var(--muted)]">
                            {!hasSupabaseEnv
                                ? 'Personlige anmeldelser er ikke aktive på web endnu.'
                                : !isLoggedIn
                                    ? 'Log ind for at gemme anmeldelser på tværs af app og web.'
                                    : reviewState === 'saved'
                                        ? 'Anmeldelsen er gemt.'
                                        : reviewError
                                            ? reviewError
                                            : reviewState === 'error'
                                                ? 'Anmeldelsen kunne ikke gemmes lige nu.'
                                                : hasUnsavedReviewChanges
                                                    ? 'Du har ikke-gemte reviewændringer.'
                                                    : 'Din anmeldelse følger denne konto.'}
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setReviewDraft(emptyReviewDraft());
                                    setReviewState('idle');
                                }}
                                disabled={!hasSupabaseEnv || !isLoggedIn || !hasMeaningfulReviewDraft(reviewDraft)}
                                className="rounded-full border border-white/10 px-4 py-2 text-sm text-[var(--muted)]"
                            >
                                Ryd lokalt
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    void handleSaveReview();
                                }}
                                disabled={!hasSupabaseEnv || !isLoggedIn || !hasUnsavedReviewChanges || reviewState === 'saving'}
                                className="cta-secondary"
                            >
                                {reviewState === 'saving' ? 'Gemmer…' : 'Gem anmeldelse'}
                            </button>
                        </div>
                    </div>
                </div>
        </div>
    );
}
