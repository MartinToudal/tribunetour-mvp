import stadiumSeed from '../../../data/stadiums.json';
import fixturesSeed from '../../../data/fixtures.json';
import SiteShell from '../../(site)/_components/SiteShell';
import StadiumDetailClient from './StadiumDetailClient';

type Stadium = {
    id: string;
    name: string;
    team: string;
    league: string;
    city?: string;
    lat?: number;
    lon?: number;
};

type Fixture = {
  id: string;
  kickoff: string;
  round: string;
  homeTeamId: string;
    awayTeamId: string;
    venueClubId: string;
    status: string;
};

type StadiumDetailPageProps = {
    params: {
        id: string;
    };
};

const stadiums = stadiumSeed as Stadium[];
const fixtures = fixturesSeed as Fixture[];
const stadiumMap = Object.fromEntries(stadiums.map((stadium) => [stadium.id, stadium])) as Record<string, Stadium>;

export function generateStaticParams() {
    return stadiums.map((stadium) => ({ id: stadium.id }));
}

function formatKickoff(value: string) {
    return new Intl.DateTimeFormat('da-DK', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(value));
}

export default function StadiumDetailPage({ params }: StadiumDetailPageProps) {
    const stadium = stadiums.find((item) => item.id === params.id);

    if (!stadium) {
        return (
            <SiteShell title="Tribunetour · Stadion">
                <section className="site-card p-5 md:p-6">
                    <div className="label-eyebrow">Stadion</div>
                    <h1 className="mt-2 text-2xl font-semibold tracking-tight">Stadion ikke fundet</h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
                        Det valgte stadion findes ikke i det aktuelle datasæt.
                    </p>
                    <div className="mt-4">
                        <a href="/" className="cta-secondary">
                            Tilbage til stadions
                        </a>
                    </div>
                </section>
            </SiteShell>
        );
    }

    const upcomingFixtures = fixtures
        .filter((fixture) => fixture.venueClubId === stadium.id)
        .filter((fixture) => new Date(fixture.kickoff).getTime() >= Date.now())
        .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime())
        .slice(0, 5);

    return (
        <SiteShell title={`Tribunetour · ${stadium.name}`}>
            <section className="site-card p-5 md:p-6">
                <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
                    <div>
                        <div className="label-eyebrow">{stadium.league}</div>
                        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">{stadium.name}</h1>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)] md:text-base">
                            Hjemmebane for {stadium.team}
                            {stadium.city ? ` i ${stadium.city}` : ''}. Brug stadionet som anker for kommende kampe og din egen tur rundt i landet.
                        </p>

                        <div className="mt-5 flex flex-wrap gap-3">
                            <a href="/" className="cta-primary">
                                Se alle stadions
                            </a>
                            <a href="/matches" className="cta-secondary">
                                Se kommende kampe
                            </a>
                            <a href="/my" className="cta-secondary">
                                Gå til Min tur
                            </a>
                        </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                        <div className="stat-chip">
                            <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Klub</div>
                            <div className="mt-2 text-xl font-semibold">{stadium.team}</div>
                        </div>
                        <div className="stat-chip">
                            <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">By</div>
                            <div className="mt-2 text-xl font-semibold">{stadium.city ?? 'Ukendt'}</div>
                        </div>
                        <div className="stat-chip">
                            <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Kommende kampe</div>
                            <div className="mt-2 text-xl font-semibold">{upcomingFixtures.length}</div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="site-card overflow-hidden">
                <div className="border-b border-white/5 p-5 md:p-6">
                    <div className="label-eyebrow">Fakta</div>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight">Stadionoplysninger</h2>
                </div>

                <div className="grid gap-4 p-5 md:grid-cols-2 md:p-6">
                    <div className="site-card-soft p-4">
                        <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Navn</div>
                        <div className="mt-2 text-lg font-semibold">{stadium.name}</div>
                    </div>
                    <div className="site-card-soft p-4">
                        <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Hjemmehold</div>
                        <div className="mt-2 text-lg font-semibold">{stadium.team}</div>
                    </div>
                    <div className="site-card-soft p-4">
                        <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Division</div>
                        <div className="mt-2 text-lg font-semibold">{stadium.league}</div>
                    </div>
                    <div className="site-card-soft p-4">
                        <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Koordinater</div>
                        <div className="mt-2 text-sm text-white">
                            {stadium.lat?.toFixed(5) ?? '–'}, {stadium.lon?.toFixed(5) ?? '–'}
                        </div>
                    </div>
                </div>
            </section>

            <section className="site-card overflow-hidden">
                <div className="border-b border-white/5 p-5 md:p-6">
                    <div className="label-eyebrow">Kampe</div>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight">Kommende kampe her</h2>
                </div>

                <ul className="divide-y divide-white/5">
                    {upcomingFixtures.map((fixture) => (
                        <li key={fixture.id} className="flex flex-col gap-3 p-5 md:flex-row md:items-center">
                            <div className="min-w-0 flex-1">
                                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{fixture.round}</div>
                        <div className="mt-2 text-lg font-semibold text-white">
                                    {stadiumMap[fixture.homeTeamId]?.team ?? fixture.homeTeamId} – {stadiumMap[fixture.awayTeamId]?.team ?? fixture.awayTeamId}
                                </div>
                            </div>
                            <div className="rounded-full bg-white/5 px-3 py-2 text-sm text-white">
                                {formatKickoff(fixture.kickoff)}
                            </div>
                        </li>
                    ))}
                    {upcomingFixtures.length === 0 && (
                        <li className="p-6 text-[var(--muted)]">Ingen kommende kampe fundet for dette stadion lige nu.</li>
                    )}
                </ul>
            </section>

            <StadiumDetailClient stadium={stadium} />
        </SiteShell>
    );
}
