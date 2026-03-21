'use client';

import { useVisitedModel } from '../../(site)/_hooks/useVisitedModel';

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
    const isVisited = Boolean(visited[stadium.id]);

    return (
        <section className="site-card overflow-hidden">
            <div className="border-b border-white/5 p-5 md:p-6">
                <div className="label-eyebrow">Din status</div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">Stadionet i din tur</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
                    Brug samme besøgsstatus her som i resten af Tribunetour, så stadionet indgår korrekt i `Stadions`, `Kampe` og `Min tur`.
                </p>
            </div>

            <div className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-center md:p-6">
                <div className="flex flex-wrap items-center gap-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${isVisited ? 'bg-[rgba(184,255,106,0.12)] text-[var(--accent)]' : 'bg-white/5 text-[var(--muted)]'}`}>
                        {isVisited ? 'Besøgt' : 'Ikke besøgt'}
                    </span>
                    {hasSupabaseEnv && isLoadingVisits && (
                        <span className="text-sm text-[var(--muted)]">Henter din status…</span>
                    )}
                    {!hasSupabaseEnv && (
                        <span className="text-sm text-[var(--muted)]">Personlig besøgsstatus kommer senere på web.</span>
                    )}
                    {hasSupabaseEnv && !isLoggedIn && (
                        <span className="text-sm text-[var(--muted)]">Log ind for at gemme din status for {stadium.name}.</span>
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
        </section>
    );
}
