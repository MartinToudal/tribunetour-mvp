import SiteShell from '../../(site)/_components/SiteShell';
import {
    getSeedFixtureById,
    getSeedStadiumMap,
    getStaticFixtureParams,
    type Stadium,
} from '../../(site)/_lib/referenceData';
import MatchDetailClient from './MatchDetailClient';

type MatchDetailPageProps = {
    params: {
        id: string;
    };
};

const stadiumMap = getSeedStadiumMap();

export function generateStaticParams() {
    return getStaticFixtureParams();
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

function mapsHref(stadium: Stadium | undefined) {
    if (!stadium || stadium.lat == null || stadium.lon == null) {
        return null;
    }

    return `https://www.google.com/maps/search/?api=1&query=${stadium.lat},${stadium.lon}`;
}

export default function MatchDetailPage({ params }: MatchDetailPageProps) {
    const fixture = getSeedFixtureById(params.id);

    if (!fixture) {
        return (
            <SiteShell title="Tribunetour · Kamp">
                <section className="site-card p-5 md:p-6">
                    <div className="label-eyebrow">Kamp</div>
                    <h1 className="mt-2 text-2xl font-semibold tracking-tight">Kamp ikke fundet</h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
                        Den valgte kamp findes ikke i det aktuelle datasæt.
                    </p>
                    <div className="mt-4">
                        <a href="/matches" className="cta-secondary">
                            Tilbage til kampe
                        </a>
                    </div>
                </section>
            </SiteShell>
        );
    }

    const homeTeam = stadiumMap[fixture.homeTeamId];
    const awayTeam = stadiumMap[fixture.awayTeamId];
    const venue = stadiumMap[fixture.venueClubId];
    const directionsHref = mapsHref(venue);

    return (
        <SiteShell title="Tribunetour · Kamp">
            <section className="site-card p-5 md:p-6">
                <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
                    <div>
                        <div className="label-eyebrow">{fixture.round}</div>
                        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
                            {homeTeam?.team ?? fixture.homeTeamId} – {awayTeam?.team ?? fixture.awayTeamId}
                        </h1>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)] md:text-base">
                            Kampen spilles på {venue?.name ?? fixture.venueClubId}
                            {venue?.city ? ` i ${venue.city}` : ''}. Brug kampen som indgang til stadionet og resten af din tur.
                        </p>

                        <div className="mt-5 flex flex-wrap gap-3">
                            <a href="/matches" className="cta-primary">
                                Se alle kampe
                            </a>
                            {venue && (
                                <a href={`/stadiums/${venue.id}`} className="cta-secondary">
                                    Se stadion
                                </a>
                            )}
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
                        <div className="stat-chip">
                            <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Kickoff</div>
                            <div className="mt-2 text-sm font-semibold text-white">{formatKickoff(fixture.kickoff)}</div>
                        </div>
                        <div className="stat-chip">
                            <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Venue</div>
                            <div className="mt-2 text-xl font-semibold">{venue?.name ?? fixture.venueClubId}</div>
                        </div>
                        <div className="stat-chip">
                            <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Division</div>
                            <div className="mt-2 text-xl font-semibold">{venue?.league ?? 'Ukendt'}</div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="site-card overflow-hidden">
                <div className="border-b border-white/5 p-5 md:p-6">
                    <div className="label-eyebrow">Venue</div>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight">Stadion og kontekst</h2>
                </div>

                <div className="grid gap-4 p-5 md:grid-cols-2 md:p-6">
                    <div className="site-card-soft p-4">
                        <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Stadion</div>
                        <div className="mt-2 text-lg font-semibold">{venue?.name ?? fixture.venueClubId}</div>
                        {venue && (
                            <div className="mt-3">
                                <a href={`/stadiums/${venue.id}`} className="text-sm font-medium text-[var(--accent)] underline underline-offset-2">
                                    Åbn stadiondetaljer
                                </a>
                            </div>
                        )}
                    </div>

                    <div className="site-card-soft p-4">
                        <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">By</div>
                        <div className="mt-2 text-lg font-semibold">{venue?.city ?? 'Ukendt'}</div>
                    </div>

                    <div className="site-card-soft p-4">
                        <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Hjemmehold</div>
                        <div className="mt-2 text-lg font-semibold">{homeTeam?.team ?? fixture.homeTeamId}</div>
                    </div>

                    <div className="site-card-soft p-4">
                        <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Udehold</div>
                        <div className="mt-2 text-lg font-semibold">{awayTeam?.team ?? fixture.awayTeamId}</div>
                    </div>
                </div>
            </section>

            {venue && <MatchDetailClient stadium={venue} />}
        </SiteShell>
    );
}
