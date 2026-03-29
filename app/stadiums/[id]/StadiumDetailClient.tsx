'use client';

import { useEffect, useMemo, useState } from 'react';
import { useVisitedModel } from '../../(site)/_hooks/useVisitedModel';
import { useNotesModel } from '../../(site)/_hooks/useNotesModel';

type Stadium = {
    id: string;
    name: string;
    team: string;
    league: string;
    city?: string;
};

type StadiumDetailClientProps = {
    stadium: Stadium;
};

export default function StadiumDetailClient({ stadium }: StadiumDetailClientProps) {
    const { hasSupabaseEnv, isLoggedIn, isLoadingVisits, visited, toggleVisited } = useVisitedModel();
    const { notes, isLoadingNotes, saveNote } = useNotesModel();
    const isVisited = Boolean(visited[stadium.id]);
    const sharedNote = notes[stadium.id] ?? '';
    const [noteDraft, setNoteDraft] = useState(sharedNote);
    const [noteState, setNoteState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [noteError, setNoteError] = useState<string | null>(null);

    useEffect(() => {
        setNoteDraft(sharedNote);
    }, [sharedNote]);

    const hasUnsavedChanges = useMemo(
        () => noteDraft !== sharedNote,
        [noteDraft, sharedNote]
    );

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

    return (
        <section className="site-card overflow-hidden">
            <div className="border-b border-white/5 p-5 md:p-6">
                <div className="label-eyebrow">Din tur</div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">Status og note for {stadium.name}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
                    Brug samme besøgsstatus og stadionnote her som i resten af Tribunetour, så stedet indgår korrekt i din tur på tværs af app og web.
                </p>
            </div>

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
            </div>
        </section>
    );
}
