'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { useVisitedModel } from '../_hooks/useVisitedModel';
import { useLeaguePackAccessModel } from '../_hooks/useLeaguePackAccessModel';
import { countryLabel, filterStadiumsForLeaguePackAccess } from '../_lib/leaguePacks';
import { compareCountryCodes } from '../_lib/leaguePackCatalog';
import { compareLeagues, sortLeagues } from '../_lib/leagueOrder';
import {
  getSeedStadiums,
  getStadiums,
  stadiumCountsTowardTopSystem,
  stadiumMembershipStatusLabel,
  stadiumShouldRemainVisibleOutsideTopSystem,
  type Stadium,
} from '../_lib/referenceData';

type VisitFilter = 'all' | 'visited' | 'not-visited';

const homeCountryStorageKey = 'app.preferredHomeCountryCode';
const stadiumsCountryFilterStorageKey = 'stadiums.countryFilter';

function StadiumsContextChip({ text }: { text: string }) {
  return <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-[var(--muted)]">{text}</span>;
}

export default function StadiumList() {
  const [stadiums, setStadiums] = useState<Stadium[]>(() => getSeedStadiums());
  const [filter, setFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [leagueFilter, setLeagueFilter] = useState<string>('Alle');
  const [visitFilter, setVisitFilter] = useState<VisitFilter>('all');
  const [preferredHomeCountryCode, setPreferredHomeCountryCode] = useState('dk');
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

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const storedHomeCountryCode = window.localStorage.getItem(homeCountryStorageKey)?.trim().toLowerCase();
    const storedCountryFilter = window.localStorage.getItem(stadiumsCountryFilterStorageKey)?.trim().toLowerCase();

    if (storedHomeCountryCode) {
      setPreferredHomeCountryCode(storedHomeCountryCode);
    }

    if (storedCountryFilter) {
      setCountryFilter(storedCountryFilter);
    } else if (storedHomeCountryCode) {
      setCountryFilter(storedHomeCountryCode);
    }
  }, []);

  const visibleStadiums = useMemo(
    () => filterStadiumsForLeaguePackAccess(stadiums, enabledPackIds),
    [stadiums, enabledPackIds]
  );
  const progressionVisibleStadiums = useMemo(
    () => visibleStadiums.filter(stadiumCountsTowardTopSystem),
    [visibleStadiums]
  );
  const visibleOutsideTopSystemStadiums = useMemo(
    () => visibleStadiums.filter(stadiumShouldRemainVisibleOutsideTopSystem),
    [visibleStadiums]
  );
  const hiddenLeaguePackStadiumCount = stadiums.length - visibleStadiums.length;
  const visibleVisitedCount = useMemo(
    () => progressionVisibleStadiums.filter((stadium) => visited[stadium.id]).length,
    [progressionVisibleStadiums, visited]
  );
  const countries = useMemo(
    () => Array.from(new Set(progressionVisibleStadiums.map((stadium) => stadium.countryCode ?? 'dk'))).sort(compareCountryCodes),
    [progressionVisibleStadiums]
  );

  useEffect(() => {
    if (!countries.length) {
      return;
    }

    const resolvedHomeCountryCode = countries.includes(preferredHomeCountryCode)
      ? preferredHomeCountryCode
      : countries.includes('dk')
        ? 'dk'
        : countries[0];

    if (resolvedHomeCountryCode !== preferredHomeCountryCode) {
      setPreferredHomeCountryCode(resolvedHomeCountryCode);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(homeCountryStorageKey, resolvedHomeCountryCode);
      }
    }

    if (countryFilter !== 'all' && !countries.includes(countryFilter)) {
      setCountryFilter(resolvedHomeCountryCode);
    }
  }, [countries, countryFilter, preferredHomeCountryCode]);

  const leagues = useMemo(
    () => ['Alle', ...sortLeagues(Array.from(new Set(
      progressionVisibleStadiums
        .filter((stadium) => countryFilter === 'all' || (stadium.countryCode ?? 'dk') === countryFilter)
        .map((stadium) => stadium.league)
    )))],
    [countryFilter, progressionVisibleStadiums]
  );

  useEffect(() => {
    if (leagueFilter !== 'Alle' && !leagues.includes(leagueFilter)) {
      setLeagueFilter('Alle');
    }
  }, [leagueFilter, leagues]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(stadiumsCountryFilterStorageKey, countryFilter);
  }, [countryFilter]);

  const filtered = useMemo(() => {
    const search = filter.toLowerCase().trim();
    return progressionVisibleStadiums.filter((stadium) => {
      const matchesSearch = !search || `${stadium.name} ${stadium.team} ${stadium.city ?? ''} ${stadium.league}`.toLowerCase().includes(search);
      const matchesCountry = countryFilter === 'all' || (stadium.countryCode ?? 'dk') === countryFilter;
      const matchesLeague = leagueFilter === 'Alle' || stadium.league === leagueFilter;
      const isVisited = Boolean(visited[stadium.id]);
      const matchesVisit = visitFilter === 'all' || (visitFilter === 'visited' ? isVisited : !isVisited);
      return matchesSearch && matchesCountry && matchesLeague && matchesVisit;
    });
  }, [progressionVisibleStadiums, filter, countryFilter, leagueFilter, visitFilter, visited]);

  const currentScopeLabel = countryFilter === 'all' ? 'Alle aktive lande' : countryLabel(countryFilter);
  const visitFilterLabel = visitFilter === 'all' ? 'Alle stadions' : visitFilter === 'visited' ? 'Kun besøgte' : 'Kun ubesøgte';
  const hasActiveFilters = filter.trim().length > 0 || countryFilter !== 'all' || leagueFilter !== 'Alle' || visitFilter !== 'all';
  const activeFilterCount = [
    countryFilter !== 'all',
    leagueFilter !== 'Alle',
    visitFilter !== 'all',
  ].filter(Boolean).length;
  const resultSummaryText =
    activeFilterCount === 0
      ? `${filtered.length} stadions i dit nuværende scope`
      : `${filtered.length} stadions med ${activeFilterCount} aktive filtre`;
  const visibleOutsideTopSystemFiltered = useMemo(
    () =>
      visibleOutsideTopSystemStadiums
        .filter((stadium) => countryFilter === 'all' || (stadium.countryCode ?? 'dk') === countryFilter)
        .sort((left, right) => {
          const countryCompare = compareCountryCodes(left.countryCode ?? 'dk', right.countryCode ?? 'dk');
          if (countryCompare !== 0) {
            return countryCompare;
          }
          const leagueCompare = compareLeagues(left.league, right.league);
          if (leagueCompare !== 0) {
            return leagueCompare;
          }
          return left.team.localeCompare(right.team, 'da');
        }),
    [countryFilter, visibleOutsideTopSystemStadiums]
  );

  return (
    <section id="stadiums" className="site-card overflow-hidden">
      <div className="border-b border-white/5 p-5 md:p-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="label-eyebrow">Stadions</div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">Find dit næste stadion</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
                Brug samme scope-logik som i appen og skift mellem liste, divisioner og besøgsstatus uden at miste overblikket.
              </p>
            </div>
            <div className="rounded-[28px] border border-[rgba(184,255,106,0.18)] bg-[rgba(184,255,106,0.08)] px-5 py-4 lg:min-w-[18rem]">
              <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Stadions i visning</div>
              <div className="mt-2 text-3xl font-semibold">{filtered.length}</div>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{resultSummaryText}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StadiumsContextChip text={currentScopeLabel} />
            <StadiumsContextChip text={visitFilterLabel} />
            <StadiumsContextChip text={`Besøgt: ${visibleVisitedCount}`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Scope</div>
              <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setCountryFilter('all');
                    setLeagueFilter('Alle');
                  }}
                  className="pill-nav justify-center text-center"
                  data-active={countryFilter === 'all' ? 'true' : 'false'}
                >
                  Alle aktive lande
                </button>
                {countries.map((countryCode) => (
                  <button
                    key={countryCode}
                    type="button"
                    onClick={() => {
                      setCountryFilter(countryCode);
                      setLeagueFilter('Alle');
                    }}
                    className="pill-nav justify-center text-center"
                    data-active={countryFilter === countryCode ? 'true' : 'false'}
                  >
                    {countryLabel(countryCode)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Filtre</div>
              <div className="grid grid-cols-3 gap-2 md:flex md:flex-wrap">
                {(['all', 'not-visited', 'visited'] as VisitFilter[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setVisitFilter(mode)}
                    className="pill-nav justify-center text-center"
                    data-active={visitFilter === mode ? 'true' : 'false'}
                  >
                    {mode === 'all' ? 'Alle stadions' : mode === 'visited' ? 'Kun besøgte' : 'Kun ubesøgte'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <input className="field-input" placeholder="Søg klub, stadion, by eller liga…" value={filter} onChange={(e) => setFilter(e.target.value)} />
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Division</div>
              <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:justify-end">
                {leagues.map((league) => (
                  <button
                    key={league}
                    type="button"
                    onClick={() => setLeagueFilter(league)}
                    className="pill-nav min-w-0 justify-center text-center"
                    data-active={leagueFilter === league ? 'true' : 'false'}
                  >
                    {league}
                  </button>
                ))}
              </div>
            </div>
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
            Premium-stadions er skjult, indtil du er logget ind og har adgang til de relevante landepakker.
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

      <div className="border-t border-white/5 p-5 md:p-6">
        <div className="flex flex-col gap-3">
          <div>
            <div className="label-eyebrow">Ekstra spor</div>
            <h3 className="mt-2 text-xl font-semibold tracking-tight">Synlige uden for aktuelt topsystem</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Her lander nedrykkede, historiske og ekstra turneringsspor. De tæller ikke med i det aktuelle topsystem, men de bliver bevaret som en del af klubbens historie.
            </p>
          </div>

          {visibleOutsideTopSystemFiltered.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/10 px-4 py-5 text-sm text-[var(--muted)]">
              Der er ingen klubber i dette spor endnu. Når de første `relegated` eller `historical` hold kommer i data, dukker de op her som et separat lag.
            </div>
          ) : (
            <ul className="divide-y divide-white/5 rounded-3xl border border-white/8 bg-white/[0.03]">
              {visibleOutsideTopSystemFiltered.map((stadium) => (
                <li key={stadium.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white">{stadium.team}</div>
                    <div className="mt-1 text-sm text-[var(--muted)]">
                      <a href={`/stadiums/${stadium.id}`} className="hover:text-white hover:underline">
                        {stadium.name}
                      </a>
                      {stadium.city ? ` · ${stadium.city}` : ''}
                    </div>
                    <div className="mt-1 text-xs text-[var(--muted)]">{stadium.league}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {stadiumMembershipStatusLabel(stadium) && (
                      <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-[var(--muted)]">
                        {stadiumMembershipStatusLabel(stadium)}
                      </span>
                    )}
                    <a href={`/stadiums/${stadium.id}`} className="text-sm font-medium text-[var(--accent)] underline underline-offset-2">
                      Se stadion
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
