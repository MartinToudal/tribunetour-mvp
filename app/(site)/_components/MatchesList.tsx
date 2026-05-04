'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { useVisitedModel } from '../_hooks/useVisitedModel';
import { useLeaguePackAccessModel } from '../_hooks/useLeaguePackAccessModel';
import { useWeekendPlanModel } from '../_hooks/useWeekendPlanModel';
import { countryLabel, filterStadiumsForLeaguePackAccess, stadiumLeaguePackId } from '../_lib/leaguePacks';
import { compareCountryCodes } from '../_lib/leaguePackCatalog';
import { sortLeagues } from '../_lib/leagueOrder';
import {
  getFixtures,
  getSeedStadiumMap,
  stadiumCountsTowardTopSystem,
  stadiumMembershipStatusLabel,
  stadiumShouldRemainVisibleOutsideTopSystem,
  type Fixture,
  type Stadium,
} from '../_lib/referenceData';

type TimeFilter = 'today' | 'next3Days' | 'week' | 'month';
type VisitFilter = 'all' | 'not-visited';
type SortMode = 'date' | 'distance';

const timeFilterOptions: { value: TimeFilter; label: string }[] = [
  { value: 'today', label: 'I dag' },
  { value: 'next3Days', label: '3 dage' },
  { value: 'week', label: 'Uge' },
  { value: 'month', label: 'Måned' },
];

const homeCountryStorageKey = 'app.preferredHomeCountryCode';
const matchesTimeFilterStorageKey = 'matches.timeFilter';
const matchesSortModeStorageKey = 'matches.sortMode';
const matchesOnlyUnvisitedStorageKey = 'matches.onlyUnvisitedVenues';

function haversineDistanceInMeters(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) {
  const earthRadius = 6371000;
  const dLat = (to.latitude - from.latitude) * (Math.PI / 180);
  const dLon = (to.longitude - from.longitude) * (Math.PI / 180);
  const lat1 = from.latitude * (Math.PI / 180);
  const lat2 = to.latitude * (Math.PI / 180);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}

function formatDistance(meters: number) {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }

  return `${(meters / 1000).toFixed(1)} km`;
}

export default function MatchesList() {
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [search, setSearch] = useState('');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('week');
  const [visitFilter, setVisitFilter] = useState<VisitFilter>('all');
  const [leagueFilter, setLeagueFilter] = useState('Alle');
  const [countryFilter, setCountryFilter] = useState('all');
  const [sortMode, setSortMode] = useState<SortMode>('date');
  const [preferredHomeCountryCode, setPreferredHomeCountryCode] = useState('dk');
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const { hasSupabaseEnv, isLoggedIn, isLoadingVisits, userEmail, visited } = useVisitedModel();
  const { enabledPackIds, isLoadingLeaguePackAccess, leaguePackAccessError } = useLeaguePackAccessModel();
  const { fixtureIdSet, fixtureIds, isLoadingPlan, toggleFixture, clearPlan } = useWeekendPlanModel();
  const stadiumMap = useMemo<Record<string, Stadium>>(() => getSeedStadiumMap(), []);
  const [planMessage, setPlanMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    getFixtures().then((data) => {
      if (!isCancelled) {
        setFixtures(data);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const storedHomeCountryCode = window.localStorage.getItem(homeCountryStorageKey)?.trim().toLowerCase();
    const storedTimeFilter = window.localStorage.getItem(matchesTimeFilterStorageKey)?.trim() as TimeFilter | null;
    const storedSortMode = window.localStorage.getItem(matchesSortModeStorageKey)?.trim() as SortMode | null;
    const storedOnlyUnvisited = window.localStorage.getItem(matchesOnlyUnvisitedStorageKey)?.trim();

    if (storedHomeCountryCode) {
      setPreferredHomeCountryCode(storedHomeCountryCode);
      setCountryFilter(storedHomeCountryCode);
    }

    if (storedTimeFilter && timeFilterOptions.some((option) => option.value === storedTimeFilter)) {
      setTimeFilter(storedTimeFilter);
    }

    if (storedSortMode === 'date' || storedSortMode === 'distance') {
      setSortMode(storedSortMode);
    }

    if (storedOnlyUnvisited === 'true') {
      setVisitFilter('not-visited');
    } else if (storedOnlyUnvisited === 'false') {
      setVisitFilter('all');
    }
  }, []);

  const visibleStadiums = useMemo(
    () => filterStadiumsForLeaguePackAccess(Object.values(stadiumMap), enabledPackIds),
    [stadiumMap, enabledPackIds]
  );
  const progressionVisibleStadiums = useMemo(
    () => visibleStadiums.filter(stadiumCountsTowardTopSystem),
    [visibleStadiums]
  );
  const visibleOutsideTopSystemStadiums = useMemo(
    () => visibleStadiums.filter(stadiumShouldRemainVisibleOutsideTopSystem),
    [visibleStadiums]
  );
  const visibleStadiumIdSet = useMemo(
    () => new Set(progressionVisibleStadiums.map((stadium) => stadium.id)),
    [progressionVisibleStadiums]
  );
  const visibleOutsideTopSystemIdSet = useMemo(
    () => new Set(visibleOutsideTopSystemStadiums.map((stadium) => stadium.id)),
    [visibleOutsideTopSystemStadiums]
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

  const leagues = useMemo(() => {
    const values = Array.from(
      new Set(
        fixtures
          .filter((fixture) => visibleStadiumIdSet.has(fixture.venueClubId) || visibleStadiumIdSet.has(stadiumMap[fixture.venueClubId]?.id ?? ''))
          .map((fixture) => stadiumMap[fixture.venueClubId]?.league)
          .filter((league) => {
            if (!league) {
              return false;
            }
            if (countryFilter === 'all') {
              return true;
            }
            return (progressionVisibleStadiums.find((stadium) => stadium.league === league)?.countryCode ?? 'dk') === countryFilter;
          })
          .filter(Boolean)
      )
    ) as string[];
    return ['Alle', ...sortLeagues(values)];
  }, [countryFilter, fixtures, progressionVisibleStadiums, stadiumMap, visibleStadiumIdSet]);

  useEffect(() => {
    if (leagueFilter !== 'Alle' && !leagues.includes(leagueFilter)) {
      setLeagueFilter('Alle');
    }
  }, [leagueFilter, leagues]);

  const filteredFixtures = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const needle = search.toLowerCase().trim();

    return fixtures
      .filter((fixture) => new Date(fixture.kickoff).getTime() >= todayStart.getTime())
      .filter((fixture) => {
        const venue = stadiumMap[fixture.venueClubId];
        return venue ? enabledPackIds.includes(stadiumLeaguePackId(venue)) : false;
      })
      .filter((fixture) => {
        const kickoffDate = new Date(fixture.kickoff);
        const endExclusive = new Date(todayStart);

        switch (timeFilter) {
          case 'today':
            endExclusive.setDate(endExclusive.getDate() + 1);
            break;
          case 'next3Days':
            endExclusive.setDate(endExclusive.getDate() + 3);
            break;
          case 'week':
            endExclusive.setDate(endExclusive.getDate() + 7);
            break;
          case 'month':
            endExclusive.setMonth(endExclusive.getMonth() + 1);
            break;
        }

        return kickoffDate.getTime() < endExclusive.getTime();
      })
      .filter((fixture) => {
        const venue = stadiumMap[fixture.venueClubId];
        const matchesCountry = countryFilter === 'all' || (venue?.countryCode ?? 'dk') === countryFilter;
        const matchesLeague = leagueFilter === 'Alle' || venue?.league === leagueFilter;
        const matchesVisit = visitFilter === 'all' || !visited[fixture.venueClubId];
        const haystack = `${fixture.round} ${venue?.team ?? fixture.homeTeamId} ${venue?.name ?? fixture.venueClubId} ${venue?.city ?? ''}`.toLowerCase();
        const matchesSearch = !needle || haystack.includes(needle);
        return matchesCountry && matchesLeague && matchesVisit && matchesSearch;
      })
      .sort((left, right) => {
        if (sortMode === 'distance' && currentLocation) {
          const leftVenue = stadiumMap[left.venueClubId];
          const rightVenue = stadiumMap[right.venueClubId];
          const leftDistance = leftVenue?.lat != null && leftVenue?.lon != null
            ? haversineDistanceInMeters(currentLocation, { latitude: leftVenue.lat, longitude: leftVenue.lon })
            : Number.MAX_SAFE_INTEGER;
          const rightDistance = rightVenue?.lat != null && rightVenue?.lon != null
            ? haversineDistanceInMeters(currentLocation, { latitude: rightVenue.lat, longitude: rightVenue.lon })
            : Number.MAX_SAFE_INTEGER;

          if (leftDistance !== rightDistance) {
            return leftDistance - rightDistance;
          }
        }

        return new Date(left.kickoff).getTime() - new Date(right.kickoff).getTime();
      });
  }, [countryFilter, currentLocation, enabledPackIds, fixtures, leagueFilter, search, sortMode, stadiumMap, timeFilter, visitFilter, visited]);
  const nonTopSystemFixtures = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    return fixtures
      .filter((fixture) => new Date(fixture.kickoff).getTime() >= todayStart.getTime())
      .filter((fixture) => {
        const venue = stadiumMap[fixture.venueClubId];
        return venue ? enabledPackIds.includes(stadiumLeaguePackId(venue)) : false;
      })
      .filter((fixture) => {
        const venue = stadiumMap[fixture.venueClubId];
        if (!venue) {
          return false;
        }

        if (!visibleOutsideTopSystemIdSet.has(venue.id)) {
          return false;
        }

        return countryFilter === 'all' || (venue.countryCode ?? 'dk') === countryFilter;
      })
      .sort((left, right) => new Date(left.kickoff).getTime() - new Date(right.kickoff).getTime());
  }, [countryFilter, enabledPackIds, fixtures, stadiumMap, visibleOutsideTopSystemIdSet]);

  const hasActiveFilters =
    search.trim().length > 0 ||
    countryFilter !== 'all' ||
    leagueFilter !== 'Alle' ||
    visitFilter !== 'all' ||
    timeFilter !== 'week' ||
    sortMode !== 'date';
  const activeFilterCount = [
    countryFilter !== 'all',
    leagueFilter !== 'Alle',
    visitFilter !== 'all',
    timeFilter !== 'week',
    sortMode !== 'date',
  ].filter(Boolean).length;
  const resultSummaryText =
    activeFilterCount === 0
      ? `${filteredFixtures.length} kommende kampe i dit nuværende scope`
      : `${filteredFixtures.length} kommende kampe med ${activeFilterCount} aktive filtre`;

  const plannedFixtures = useMemo(() => {
    if (fixtureIds.length === 0) {
      return [];
    }

    const orderMap = new Map(fixtureIds.map((fixtureId, index) => [fixtureId, index]));
    return fixtures
      .filter((fixture) => fixtureIdSet.has(fixture.id))
      .sort((left, right) => {
        const leftOrder = orderMap.get(left.id) ?? Number.MAX_SAFE_INTEGER;
        const rightOrder = orderMap.get(right.id) ?? Number.MAX_SAFE_INTEGER;
        if (leftOrder !== rightOrder) {
          return leftOrder - rightOrder;
        }
        return new Date(left.kickoff).getTime() - new Date(right.kickoff).getTime();
      });
  }, [fixtureIdSet, fixtureIds, fixtures]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(matchesTimeFilterStorageKey, timeFilter);
  }, [timeFilter]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(matchesSortModeStorageKey, sortMode);
  }, [sortMode]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(matchesOnlyUnvisitedStorageKey, visitFilter === 'not-visited' ? 'true' : 'false');
  }, [visitFilter]);

  useEffect(() => {
    if (sortMode !== 'distance' || currentLocation || typeof window === 'undefined' || !('geolocation' in navigator)) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocationError(null);
      },
      (error) => {
        setLocationError(error.message || 'Lokation er ikke tilgængelig lige nu.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  }, [sortMode, currentLocation]);

  const currentScopeLabel = countryFilter === 'all' ? 'Alle aktive lande' : countryLabel(countryFilter);
  const venueFilterLabel = visitFilter === 'all' ? 'Alle stadions' : 'Kun ubesøgte';
  const sortModeLabel = sortMode === 'date' ? 'Dato' : 'Afstand';

  function teamName(teamId: string) {
    return stadiumMap[teamId]?.team ?? teamId;
  }

  function distanceText(fixture: Fixture) {
    if (!currentLocation) {
      return null;
    }

    const venue = stadiumMap[fixture.venueClubId];
    if (venue?.lat == null || venue?.lon == null) {
      return null;
    }

    const distance = haversineDistanceInMeters(currentLocation, {
      latitude: venue.lat,
      longitude: venue.lon,
    });

    return formatDistance(distance);
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

  async function handleTogglePlan(fixtureId: string) {
    const result = await toggleFixture(fixtureId);
    setPlanMessage(result.ok ? null : 'Vi kunne ikke opdatere planen lige nu.');
  }

  async function handleClearPlan() {
    const result = await clearPlan();
    setPlanMessage(result.ok ? null : 'Vi kunne ikke rydde planen lige nu.');
  }

  function requestLocation() {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setLocationError('Din browser understøtter ikke lokation.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocationError(null);
      },
      (error) => {
        setLocationError(error.message || 'Lokation er ikke tilgængelig lige nu.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  }

  return (
    <section className="site-card overflow-hidden">
      <div className="border-b border-white/5 p-5 md:p-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="label-eyebrow">Kampe</div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">Find næste gode kamp</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
                Brug samme scope-logik som i appen og filtrér ned til de kampe, der bedst passer til din næste stadiontur.
              </p>
            </div>
            <div className="rounded-[28px] border border-[rgba(184,255,106,0.18)] bg-[rgba(184,255,106,0.08)] px-5 py-4 lg:min-w-[18rem]">
              <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Matchende kampe</div>
              <div className="mt-2 text-3xl font-semibold">{filteredFixtures.length}</div>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{resultSummaryText}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <MatchesContextChip text={currentScopeLabel} />
            <MatchesContextChip text={venueFilterLabel} />
            <MatchesContextChip text={`Sortering: ${sortModeLabel}`} />
          </div>

          <div className="flex flex-wrap gap-2">
            {timeFilterOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setTimeFilter(option.value)}
                className="pill-nav justify-center text-center"
                data-active={timeFilter === option.value ? 'true' : 'false'}
              >
                {option.label}
              </button>
            ))}
          </div>

          {sortMode === 'distance' && !currentLocation && (
            <div className="rounded-[24px] border border-white/8 bg-white/4 px-4 py-3 text-sm leading-6 text-[var(--muted)]">
              <div className="font-medium text-white">Afstandssortering kræver lokation</div>
              <p className="mt-1">{locationError ?? 'Tillad lokation i browseren for at sortere kampene efter afstand.'}</p>
              <button type="button" className="cta-secondary mt-3" onClick={requestLocation}>
                Tillad lokation
              </button>
            </div>
          )}

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
              <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap">
                <button
                  type="button"
                  onClick={() => setVisitFilter(visitFilter === 'all' ? 'not-visited' : 'all')}
                  className="pill-nav justify-center text-center"
                  data-active={visitFilter === 'not-visited' ? 'true' : 'false'}
                >
                  {visitFilter === 'all' ? 'Alle stadions' : 'Kun ubesøgte'}
                </button>
                <button
                  type="button"
                  onClick={() => setSortMode(sortMode === 'date' ? 'distance' : 'date')}
                  className="pill-nav justify-center text-center"
                  data-active={sortMode === 'distance' ? 'true' : 'false'}
                >
                  {sortMode === 'date' ? 'Dato' : 'Afstand'}
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <input className="field-input" placeholder="Søg klub, stadion, by eller runde…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Liga</div>
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
          const isPlanned = fixtureIdSet.has(fixture.id);
          const homeTeam = teamName(fixture.homeTeamId);
          const awayTeam = teamName(fixture.awayTeamId);
          const fixtureDistance = distanceText(fixture);

          return (
            <li key={fixture.id} className="flex flex-col gap-4 p-5 md:flex-row md:items-center">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{fixture.round}</div>
                <div className="mt-2 text-lg font-semibold text-white">
                  {homeTeam} – {awayTeam}
                </div>
                <div className="mt-1 text-sm text-[var(--muted)]">
                  På{' '}
                  <a href={`/stadiums/${fixture.venueClubId}`} className="hover:text-white hover:underline">
                    {venue?.name ?? fixture.venueClubId}
                  </a>
                  {venue?.city ? ` · ${venue.city}` : ''}
                  {fixtureDistance ? ` · ${fixtureDistance}` : ''}
                </div>
                <div className="mt-3 flex flex-wrap gap-3">
                  <a href={`/matches/${fixture.id}`} className="text-sm font-medium text-[var(--accent)] underline underline-offset-2">
                    Se kamp
                  </a>
                  <a href={`/stadiums/${fixture.venueClubId}`} className="text-sm font-medium text-[var(--accent)] underline underline-offset-2">
                    Se stadion
                  </a>
                </div>
              </div>
              <div className="flex items-center gap-3 md:ml-auto">
                {hasSupabaseEnv && isLoggedIn && (
                  <button
                    type="button"
                    onClick={() => void handleTogglePlan(fixture.id)}
                    className="pill-nav justify-center text-center"
                    data-active={isPlanned ? 'true' : 'false'}
                  >
                    {isPlanned ? 'I plan' : 'Tilføj til plan'}
                  </button>
                )}
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
            {hasActiveFilters
              ? `Ingen kommende kampe i ${currentScopeLabel} matcher dine nuværende filtre.`
              : `Ingen kommende kampe i ${currentScopeLabel} matcher visningen lige nu.`}
          </li>
        )}
      </ul>

      <div className="border-t border-white/5 p-5 md:p-6">
        <div className="flex flex-col gap-3">
          <div>
            <div className="label-eyebrow">Ekstra spor</div>
            <h3 className="mt-2 text-xl font-semibold tracking-tight">Kampe uden for aktuelt topsystem</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Her samler vi kommende kampe for klubber, der er nedrykkede, historiske eller med i et ekstra turneringsspor. De tæller ikke med i det normale topsystem-feed.
            </p>
          </div>

          {nonTopSystemFixtures.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/10 px-4 py-5 text-sm text-[var(--muted)]">
              Der er ingen kommende kampe i dette spor endnu. Når de første ikke-topsystem-klubber får kampe i data, dukker de op her.
            </div>
          ) : (
            <ul className="divide-y divide-white/5 rounded-3xl border border-white/8 bg-white/[0.03]">
              {nonTopSystemFixtures.slice(0, 20).map((fixture) => {
                const venue = stadiumMap[fixture.venueClubId];
                return (
                  <li key={fixture.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{fixture.round}</div>
                      <div className="mt-2 text-sm font-semibold text-white">
                        {teamName(fixture.homeTeamId)} – {teamName(fixture.awayTeamId)}
                      </div>
                      <div className="mt-1 text-sm text-[var(--muted)]">
                        {venue?.name ?? fixture.venueClubId}
                        {venue?.city ? ` · ${venue.city}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {venue && stadiumMembershipStatusLabel(venue) && (
                        <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-[var(--muted)]">
                          {stadiumMembershipStatusLabel(venue)}
                        </span>
                      )}
                      <a href={`/matches/${fixture.id}`} className="text-sm font-medium text-[var(--accent)] underline underline-offset-2">
                        Se kamp
                      </a>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {hasSupabaseEnv && isLoggedIn && !isLoadingVisits && (
        <div className="border-t border-white/5 p-5 md:p-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <div>
              <div className="label-eyebrow">Plan</div>
              <h3 className="mt-2 text-xl font-semibold tracking-tight">Gem kampene til din næste tur</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Planen følger de valg du laver i kampfeedet og holder sig synkroniseret mellem web og app.
              </p>
              {planMessage && (
                <p className="mt-2 text-sm text-rose-300">{planMessage}</p>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[18rem]">
              <div className="stat-chip">
                <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">I plan</div>
                <div className="mt-2 text-2xl font-semibold">{plannedFixtures.length}</div>
              </div>
              <button
                type="button"
                onClick={() => void handleClearPlan()}
                className="cta-secondary disabled:cursor-not-allowed disabled:opacity-60"
                disabled={plannedFixtures.length === 0 || isLoadingPlan}
              >
                Ryd plan
              </button>
            </div>
          </div>

          <div className="mt-4">
            {isLoadingPlan ? (
              <div className="text-sm text-[var(--muted)]">Henter plan…</div>
            ) : plannedFixtures.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/10 px-4 py-5 text-sm text-[var(--muted)]">
                Din plan er tom endnu. Brug “Tilføj til plan” på kampene ovenfor.
              </div>
            ) : (
              <ul className="space-y-3">
                {plannedFixtures.map((fixture) => {
                  const venue = stadiumMap[fixture.venueClubId];
                  return (
                    <li key={fixture.id} className="rounded-3xl border border-white/8 bg-white/[0.03] px-4 py-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white">
                            {teamName(fixture.homeTeamId)} – {teamName(fixture.awayTeamId)}
                          </div>
                          <div className="mt-1 text-sm text-[var(--muted)]">
                            {formatKickoff(fixture.kickoff)} · {venue?.name ?? fixture.venueClubId}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleTogglePlan(fixture.id)}
                          className="pill-nav justify-center text-center"
                        >
                          Fjern fra plan
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function MatchesContextChip({ text }: { text: string }) {
  return (
    <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-[var(--muted)]">
      {text}
    </span>
  );
}
