import { permanentRedirect } from 'next/navigation';
import SiteShell from '../../(site)/_components/SiteShell';
import {
    getSeedFixtures,
    getSeedStadiumById,
    getSeedStadiumMap,
    getStaticStadiumParams,
    type Fixture,
    type Stadium,
} from '../../(site)/_lib/referenceData';
import { canonicalClubId, isSameClubId } from '../../(site)/_lib/clubIdentityResolver';
import { countryLabel } from '../../(site)/_lib/leaguePacks';
import StadiumDetailClient from './StadiumDetailClient';

type StadiumDetailPageProps = {
    params: {
        id: string;
    };
};

const fixtures = getSeedFixtures();
const stadiumMap = getSeedStadiumMap();

export function generateStaticParams() {
    return getStaticStadiumParams();
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

function mapsHref(stadium: Stadium) {
    if (stadium.lat == null || stadium.lon == null) {
        return null;
    }

    return `https://www.google.com/maps/search/?api=1&query=${stadium.lat},${stadium.lon}`;
}

export default function StadiumDetailPage({ params }: StadiumDetailPageProps) {
    const stadium = getSeedStadiumById(params.id);

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

    const canonicalId = canonicalClubId(stadium.id);
    if (params.id !== canonicalId) {
        permanentRedirect(`/stadiums/${canonicalId}`);
    }

    const upcomingFixtures = fixtures
        .filter((fixture) => isSameClubId(fixture.venueClubId, stadium.id))
        .filter((fixture) => new Date(fixture.kickoff).getTime() >= Date.now())
        .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime())
        .slice(0, 5);
    const nextFixture = upcomingFixtures[0] ?? null;
    const directionsHref = mapsHref(stadium);
    const isExpandedLeaguePack = Boolean(stadium.countryCode && stadium.countryCode !== 'dk');
    const locationLabel = isExpandedLeaguePack
        ? `${countryLabel(stadium.countryCode)} · ${stadium.league}`
        : stadium.league;
    const quickStats = [
        { label: 'Klub', value: stadium.team },
        { label: 'By', value: stadium.city ?? 'Ukendt' },
        { label: 'Kommende kampe', value: String(upcomingFixtures.length) },
        ...(isExpandedLeaguePack
            ? [{ label: 'Land', value: countryLabel(stadium.countryCode) }]
            : []),
        ...(isExpandedLeaguePack && stadium.shortCode
            ? [{ label: 'Kode', value: stadium.shortCode }]
            : []),
        { label: 'Næste kamp', value: nextFixture ? formatKickoff(nextFixture.kickoff) : 'Ingen planlagt endnu' },
    ];

    return (
        <SiteShell title={`Tribunetour · ${stadium.name}`}>
            <section className="site-card p-5 md:p-6">
                <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
                    <div>
                        <div className="label-eyebrow">{locationLabel}</div>
                        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">{stadium.name}</h1>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)] md:text-base">
                            Hjemmebane for {stadium.team}
                            {stadium.city ? ` i ${stadium.city}` : ''}. Brug stadionet som anker for kommende kampe og din egen tur rundt i landet.
                        </p>

                        <div className="mt-4 flex flex-wrap gap-2">
                            <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-white">
                                {locationLabel}
                            </span>
                            <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-[var(--muted)]">
                                Stadionrejse og matchday-noter
                            </span>
                        </div>

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
                            {directionsHref && (
                                <a href={directionsHref} target="_blank" rel="noreferrer" className="cta-secondary">
                                    Åbn i kort
                                </a>
                            )}
                        </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                        {quickStats.map((stat) => (
                            <div key={stat.label} className="stat-chip">
                                <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">{stat.label}</div>
                                <div className="mt-2 text-xl font-semibold">{stat.value}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {nextFixture && (
                <section className="site-card overflow-hidden">
                    <div className="border-b border-white/5 p-5 md:p-6">
                        <div className="label-eyebrow">Næste kamp</div>
                        <h2 className="mt-2 text-2xl font-semibold tracking-tight">Næste kamp på {stadium.name}</h2>
                    </div>

                    <div className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-center md:p-6">
                        <div>
                            <div className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                                {nextFixture.round}
                            </div>
                            <div className="mt-2 text-2xl font-semibold text-white">
                                {stadiumMap[nextFixture.homeTeamId]?.team ?? nextFixture.homeTeamId} – {stadiumMap[nextFixture.awayTeamId]?.team ?? nextFixture.awayTeamId}
                            </div>
                            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                                Brug kampen som næste ankerpunkt i din tur, eller gå videre til kamplisten for at sammenligne med andre stadioner.
                            </p>
                        </div>

                        <div className="flex flex-col gap-3">
                            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white">
                                {formatKickoff(nextFixture.kickoff)}
                            </div>
                            <a href="/matches" className="cta-secondary">
                                Se alle kampe
                            </a>
                        </div>
                    </div>
                </section>
            )}

            <section className="site-card overflow-hidden">
                <div className="border-b border-white/5 p-5 md:p-6">
                    <div className="label-eyebrow">Din relation</div>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight">Din status, note og anmeldelse</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
                        Her gemmer du din egen relation til stadionet: besøgt-status, noter, billeder og din samlede oplevelse.
                    </p>
                </div>
                <StadiumDetailClient stadium={stadium} />
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
                    {isExpandedLeaguePack && (
                        <div className="site-card-soft p-4">
                            <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Land</div>
                            <div className="mt-2 text-lg font-semibold">{countryLabel(stadium.countryCode)}</div>
                        </div>
                    )}
                    {isExpandedLeaguePack && stadium.shortCode && (
                        <div className="site-card-soft p-4">
                            <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Intern kode</div>
                            <div className="mt-2 text-lg font-semibold">{stadium.shortCode}</div>
                        </div>
                    )}
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
                            <a href={`/matches/${fixture.id}`} className="text-sm font-medium text-[var(--accent)] underline underline-offset-2 md:ml-2">
                                Se kamp
                            </a>
                        </li>
                    ))}
                    {upcomingFixtures.length === 0 && (
                        <li className="p-6 text-[var(--muted)]">Ingen kommende kampe fundet for dette stadion lige nu.</li>
                    )}
                </ul>
            </section>
        </SiteShell>
    );
}
