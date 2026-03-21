'use client';
import React, { useEffect, useMemo, useState } from 'react';
import fixturesSeed from '../../../data/fixtures.json';
import stadiumSeed from '../../../data/stadiums.json';
import { useVisitedModel } from '../_hooks/useVisitedModel';

type Fixture = {
  id: string;
  kickoff: string;
  round: string;
  homeTeamId: string;
  awayTeamId: string;
  venueClubId: string;
  status: string;
  homeScore?: string;
  awayScore?: string;
};

type Stadium = {
  id: string;
  name: string;
  team: string;
  league: string;
  city?: string;
};

type WindowFilter = '14' | '30' | 'all';
type VisitFilter = 'all' | 'not-visited';

const windowOptions: { value: WindowFilter; label: string }[] = [
  { value: '14', label: '14 dage' },
  { value: '30', label: '30 dage' },
  { value: 'all', label: 'Alle' },
];

export default function MatchesList() {
  const [fixtures] = useState<Fixture[]>(fixturesSeed as Fixture[]);
  const [stadiums] = useState<Stadium[]>(stadiumSeed as Stadium[]);
  const [search, setSearch] = useState('');
  const [windowFilter, setWindowFilter] = useState<WindowFilter>('30');
  const [visitFilter, setVisitFilter] = useState<VisitFilter>('all');
  const [leagueFilter, setLeagueFilter] = useState('Alle');
  const { hasSupabaseEnv, isLoggedIn, isLoadingVisits, userEmail, visited } = useVisitedModel();

  const stadiumMap = useMemo(
    () => Object.fromEntries(stadiums.map((stadium) => [stadium.id, stadium])) as Record<string, Stadium>,
    [stadiums]
  );

  const leagues = useMemo(() => {
    const values = Array.from(
      new Set(
        fixtures
          .map((fixture) => stadiumMap[fixture.venueClubId]?.league)
          .filter(Boolean)
      )
    ) as string[];
    return ['Alle', ...values.sort()];
  }, [fixtures, stadiumMap]);

  const filteredFixtures = useMemo(() => {
    const now = new Date();
    const needle = search.toLowerCase().trim();

    return fixtures
      .filter((fixture) => new Date(fixture.kickoff).getTime() >= now.getTime())
      .filter((fixture) => {
        if (windowFilter === 'all') return true;
        const days = Number(windowFilter);
        const diff = new Date(fixture.kickoff).getTime() - now.getTime();
        return diff <= days * 24 * 60 * 60 * 1000;
      })
      .filter((fixture) => {
        const venue = stadiumMap[fixture.venueClubId];
        const matchesLeague = leagueFilter === 'Alle' || venue?.league === leagueFilter;
        const matchesVisit = visitFilter === 'all' || !visited[fixture.venueClubId];
        const haystack = `${fixture.round} ${venue?.team ?? fixture.homeTeamId} ${venue?.name ?? fixture.venueClubId} ${venue?.city ?? ''}`.toLowerCase();
        const matchesSearch = !needle || haystack.includes(needle);
        return matchesLeague && matchesVisit && matchesSearch;
      })
      .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());
  }, [fixtures, leagueFilter, search, stadiumMap, visitFilter, visited, windowFilter]);

  const hasActiveFilters = search.trim().length > 0 || leagueFilter !== 'Alle' || visitFilter !== 'all' || windowFilter !== '30';

  function formatKickoff(value: string) {
    return new Intl.DateTimeFormat('da-DK', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }

  return (
    <section className="site-card overflow-hidden">
      <div className="border-b border-white/5 p-5 md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="label-eyebrow">Kampe</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Kommende kampe</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Få overblik over kommende kampe, filtrér på tidsvindue, og brug din besøgsstatus til at fokusere på de venues, du mangler.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[26rem]">
            <div className="stat-chip">
              <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Kommende</div>
              <div className="mt-2 text-2xl font-semibold">{filteredFixtures.length}</div>
            </div>
            <div className="stat-chip">
              <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Vindue</div>
              <div className="mt-2 text-2xl font-semibold">{windowFilter === 'all' ? 'Alle' : `${windowFilter}d`}</div>
            </div>
            <div className="stat-chip">
              <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Venue-filter</div>
              <div className="mt-2 text-xl font-semibold">{visitFilter === 'all' ? 'Alle' : 'Ikke-besøgte'}</div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <input className="field-input" placeholder="Søg runde, klub eller stadion…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="flex flex-wrap gap-2 md:justify-end">
            {windowOptions.map((option) => (
              <button key={option.value} type="button" onClick={() => setWindowFilter(option.value)} className="pill-nav" data-active={windowFilter === option.value ? 'true' : 'false'}>
                {option.label}
              </button>
            ))}
            <button type="button" onClick={() => setVisitFilter(visitFilter === 'all' ? 'not-visited' : 'all')} className="pill-nav" data-active={visitFilter === 'not-visited' ? 'true' : 'false'}>
              {visitFilter === 'all' ? 'Alle venues' : 'Kun ikke-besøgte'}
            </button>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Division</div>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {leagues.map((league) => (
              <button key={league} type="button" onClick={() => setLeagueFilter(league)} className="pill-nav shrink-0" data-active={leagueFilter === league ? 'true' : 'false'}>
                {league}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!hasSupabaseEnv && (
        <div className="border-b border-white/5 p-5 md:p-6">
          <div className="text-sm leading-6 text-[var(--muted)]">
            Du kan allerede udforske kommende kampe her. Personlig besøgsstatus kommer senere på web.
          </div>
        </div>
      )}

      {hasSupabaseEnv && !isLoggedIn && (
        <div className="border-b border-white/5 p-5 md:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-medium text-white">Log ind for at bruge venue-status i dine kampvalg</div>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                Når du logger ind, kan du filtrere mod de venues du ikke har besøgt endnu.
              </p>
            </div>
            <a href="/my" className="cta-secondary">
              Gå til Min tur
            </a>
          </div>
        </div>
      )}

      {hasSupabaseEnv && isLoggedIn && isLoadingVisits && (
        <div className="border-b border-white/5 p-5 md:p-6 text-sm text-[var(--muted)]">
          Henter din besøgsstatus…
        </div>
      )}

      {hasSupabaseEnv && isLoggedIn && !isLoadingVisits && (
        <div className="border-b border-white/5 p-5 md:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-medium text-white">Kampvalg for {userEmail ?? 'din konto'}</div>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                Brug filtre og venue-status til at fokusere på de stadioner du mangler eller planlægger at besøge næste gang.
              </p>
            </div>
            <a href="/" className="cta-secondary">
              Se stadions
            </a>
          </div>
        </div>
      )}

      <ul className="divide-y divide-white/5">
        {filteredFixtures.map((fixture) => {
          const venue = stadiumMap[fixture.venueClubId];
          const isVisited = Boolean(visited[fixture.venueClubId]);
          return (
            <li key={fixture.id} className="flex flex-col gap-4 p-5 md:flex-row md:items-center">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{fixture.round}</div>
                <div className="mt-2 text-lg font-semibold text-white">{venue?.team ?? fixture.homeTeamId}</div>
                <div className="mt-1 text-sm text-[var(--muted)]">{venue?.name ?? fixture.venueClubId}{venue?.city ? ` · ${venue.city}` : ''}</div>
              </div>
              <div className="flex items-center gap-3 md:ml-auto">
                <div className="rounded-full bg-white/5 px-3 py-2 text-sm text-white">{formatKickoff(fixture.kickoff)}</div>
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${isVisited ? 'bg-[rgba(184,255,106,0.12)] text-[var(--accent)]' : 'bg-white/5 text-[var(--muted)]'}`}>
                  {isVisited ? 'Venue besøgt' : 'Venue ikke besøgt'}
                </span>
              </div>
            </li>
          );
        })}
        {filteredFixtures.length === 0 && (
          <li className="p-6 text-[var(--muted)]">
            {hasActiveFilters ? 'Ingen kommende kampe matcher dine nuværende filtre.' : 'Ingen kommende kampe matcher visningen lige nu.'}
          </li>
        )}
      </ul>
    </section>
  );
}
