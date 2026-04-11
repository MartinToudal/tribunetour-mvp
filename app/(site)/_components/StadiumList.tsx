'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { useVisitedModel } from '../_hooks/useVisitedModel';
import { useLeaguePackAccessModel } from '../_hooks/useLeaguePackAccessModel';
import { countryLabel, filterStadiumsForLeaguePackAccess } from '../_lib/leaguePacks';
import { sortLeagues } from '../_lib/leagueOrder';
import { getSeedStadiums, getStadiums, type Stadium } from '../_lib/referenceData';

type VisitFilter = 'all' | 'visited' | 'not-visited';

export default function StadiumList() {
  const [stadiums, setStadiums] = useState<Stadium[]>(() => getSeedStadiums());
  const [filter, setFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState<string>('Alle');
  const [leagueFilter, setLeagueFilter] = useState<string>('Alle');
  const [visitFilter, setVisitFilter] = useState<VisitFilter>('all');
  const { hasSupabaseEnv, isLoggedIn, isLoadingVisits, visitedLoadError, userEmail, visited, visitedCount, toggleVisited } = useVisitedModel();
  const { enabledPackIds, isLoadingLeaguePackAccess, leaguePackAccessError } = useLeaguePackAccessModel();

  useEffect(() => {
    let isCancelled = false;

    getStadiums().then((data) => {
      if (!isCancelled) {
        setStadiums(data);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [hasSupabaseEnv]);

  const visibleStadiums = useMemo(
    () => filterStadiumsForLeaguePackAccess(stadiums, enabledPackIds),
    [stadiums, enabledPackIds]
  );
  const hiddenLeaguePackStadiumCount = stadiums.length - visibleStadiums.length;
  const visibleVisitedCount = useMemo(
    () => visibleStadiums.filter((stadium) => visited[stadium.id]).length,
    [visibleStadiums, visited]
  );
  const countries = useMemo(
    () => ['Alle', ...Array.from(new Set(visibleStadiums.map((s) => s.countryCode ?? 'dk'))).sort()],
    [visibleStadiums]
  );
  const leagues = useMemo(
    () => ['Alle', ...sortLeagues(Array.from(new Set(
      visibleStadiums
        .filter((stadium) => countryFilter === 'Alle' || (stadium.countryCode ?? 'dk') === countryFilter)
        .map((s) => s.league)
    )))],
    [countryFilter, visibleStadiums]
  );

  useEffect(() => {
    if (!countries.includes(countryFilter)) {
      setCountryFilter('Alle');
      setLeagueFilter('Alle');
    }
  }, [countries, countryFilter]);

  const filtered = useMemo(() => {
    const search = filter.toLowerCase().trim();
    return visibleStadiums.filter((stadium) => {
      const matchesSearch = !search || `${stadium.name} ${stadium.team} ${stadium.city ?? ''} ${stadium.league}`.toLowerCase().includes(search);
      const matchesCountry = countryFilter === 'Alle' || (stadium.countryCode ?? 'dk') === countryFilter;
      const matchesLeague = leagueFilter === 'Alle' || stadium.league === leagueFilter;
      const isVisited = Boolean(visited[stadium.id]);
      const matchesVisit = visitFilter === 'all' || (visitFilter === 'visited' ? isVisited : !isVisited);
      return matchesSearch && matchesCountry && matchesLeague && matchesVisit;
    });
  }, [visibleStadiums, filter, countryFilter, leagueFilter, visitFilter, visited]);

  const hasActiveFilters = filter.trim().length > 0 || countryFilter !== 'Alle' || leagueFilter !== 'Alle' || visitFilter !== 'all';

  return (
    <section id="stadiums" className="site-card overflow-hidden">
      <div className="border-b border-white/5 p-5 md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="label-eyebrow">Stadions</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Find dit næste stadion</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Søg blandt stadioner, filtrér efter liga, og brug din egen besøgsstatus til at fokusere på steder du mangler eller allerede har været.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[26rem]">
            <div className="stat-chip">
              <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Stadions</div>
              <div className="mt-2 text-2xl font-semibold">{visibleStadiums.length}</div>
            </div>
            <div className="stat-chip">
              <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Besøgte</div>
              <div className="mt-2 text-2xl font-semibold">{visibleVisitedCount}</div>
            </div>
            <div className="stat-chip">
              <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Viser nu</div>
              <div className="mt-2 text-2xl font-semibold">{filtered.length}</div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <input className="field-input" placeholder="Søg stadion, klub, by…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <div className="grid grid-cols-3 gap-2 md:flex md:flex-wrap md:justify-end">
            {(['all', 'not-visited', 'visited'] as VisitFilter[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setVisitFilter(mode)}
                className="pill-nav justify-center text-center"
                data-active={visitFilter === mode ? 'true' : 'false'}
              >
                {mode === 'all' ? 'Alle' : mode === 'visited' ? 'Besøgte' : 'Ikke-besøgte'}
              </button>
            ))}
          </div>
        </div>

        {countries.length > 2 && (
          <div className="mt-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Land</div>
            <div className="grid grid-cols-3 gap-2 md:flex md:gap-2 md:overflow-x-auto md:px-1 md:pb-1">
              {countries.map((countryCode) => (
                <button
                  key={countryCode}
                  type="button"
                  onClick={() => {
                    setCountryFilter(countryCode);
                    setLeagueFilter('Alle');
                  }}
                  className="pill-nav min-w-0 justify-center text-center md:shrink-0"
                  data-active={countryFilter === countryCode ? 'true' : 'false'}
                >
                  {countryCode === 'Alle' ? 'Alle' : countryLabel(countryCode)}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Division</div>
          <div className="grid grid-cols-3 gap-2 md:flex md:gap-2 md:overflow-x-auto md:px-1 md:pb-1">
            {leagues.map((league) => (
              <button
                key={league}
                type="button"
                onClick={() => setLeagueFilter(league)}
                className="pill-nav min-w-0 justify-center text-center md:shrink-0"
                data-active={leagueFilter === league ? 'true' : 'false'}
              >
                {league}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!hasSupabaseEnv && (
        <div className="border-b border-white/5 p-5 md:p-6">
          <div className="text-sm leading-6 text-[var(--muted)]">
            Du kan allerede udforske stadioner her. Personlig besøgsstatus kommer senere på web.
          </div>
        </div>
      )}

      {hasSupabaseEnv && !isLoggedIn && (
        <div className="border-b border-white/5 p-5 md:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-medium text-white">Log ind for at gøre stadionlisten personlig</div>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                Når du logger ind, kan du markere stadioner som besøgt og filtrere efter din egen status.
              </p>
            </div>
            <a href="/my" className="cta-secondary">
              Gå til Min tur
            </a>
          </div>
        </div>
      )}

      {hiddenLeaguePackStadiumCount > 0 && !isLoggedIn && (
        <div className="border-b border-white/5 p-5 md:p-6">
          <div className="text-sm leading-6 text-[var(--muted)]">
            Tyske stadions er skjult, indtil du er logget ind.
          </div>
        </div>
      )}

      {hasSupabaseEnv && isLoggedIn && isLoadingLeaguePackAccess && (
        <div className="border-b border-white/5 p-5 md:p-6 text-sm text-[var(--muted)]">
          Henter din adgang til league packs…
        </div>
      )}

      {hasSupabaseEnv && isLoggedIn && leaguePackAccessError && (
        <div className="border-b border-white/5 p-5 md:p-6 text-sm text-[var(--muted)]">
          {leaguePackAccessError}
        </div>
      )}

      {hasSupabaseEnv && isLoggedIn && isLoadingVisits && (
        <div className="border-b border-white/5 p-5 md:p-6 text-sm text-[var(--muted)]">
          Henter din besøgsstatus…
        </div>
      )}

      {hasSupabaseEnv && isLoggedIn && visitedLoadError && (
        <div className="border-b border-white/5 p-5 md:p-6 text-sm text-[var(--muted)]">
          {visitedLoadError}
        </div>
      )}

      {hasSupabaseEnv && isLoggedIn && !isLoadingVisits && !visitedLoadError && visitedCount === 0 && (
        <div className="border-b border-white/5 p-5 md:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-medium text-white">Din konto er klar til stadionbesøg</div>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                {userEmail ?? 'Din konto'} har endnu ingen besøg. Start med at markere de stadioner du allerede har været på.
              </p>
            </div>
            <a href="/my" className="cta-secondary">
              Se Min tur
            </a>
          </div>
        </div>
      )}

      <ul className="divide-y divide-white/5">
        {filtered.map((stadium) => {
          const isVisited = Boolean(visited[stadium.id]);
          return (
            <li key={stadium.id} className="flex flex-col gap-4 p-5 md:flex-row md:items-center">
              <div className="flex items-center gap-4">
                <a href={`/stadiums/${stadium.id}`} className="grid h-12 w-12 shrink-0 place-items-center rounded-[18px] border border-white/10 bg-white/5 text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
                  {stadium.name.substring(0, 2)}
                </a>
                <div>
                  <a href={`/stadiums/${stadium.id}`} className="font-medium text-white hover:underline">
                    {stadium.name}
                  </a>
                  <div className="mt-1 text-sm text-[var(--muted)]">
                    {stadium.team} · {stadium.league}{stadium.city ? ` · ${stadium.city}` : ''}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 md:ml-auto">
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${isVisited ? 'bg-[rgba(184,255,106,0.12)] text-[var(--accent)]' : 'bg-white/5 text-[var(--muted)]'}`}>
                  {isVisited ? 'Besøgt' : 'Ikke besøgt'}
                </span>
                <button
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
              </li>
            );
          })}
        {filtered.length === 0 && (
          <li className="p-6 text-[var(--muted)]">
            {hasActiveFilters
              ? 'Ingen stadions matcher dine nuværende filtre.'
              : 'Ingen stadions matcher visningen lige nu.'}
          </li>
        )}
      </ul>
    </section>
  );
}
