'use client';
import React, { useEffect, useMemo, useState } from 'react';
import SiteShell from '../(site)/_components/SiteShell';
import { useLeaguePackAccessModel } from '../(site)/_hooks/useLeaguePackAccessModel';
import { useNotesModel } from '../(site)/_hooks/useNotesModel';
import { usePhotosModel } from '../(site)/_hooks/usePhotosModel';
import { useReviewsModel } from '../(site)/_hooks/useReviewsModel';
import { useVisitedModel } from '../(site)/_hooks/useVisitedModel';
import { countryLabel, filterStadiumsForLeaguePackAccess } from '../(site)/_lib/leaguePacks';
import { compareLeagues } from '../(site)/_lib/leagueOrder';
import { getStadiums, type Stadium } from '../(site)/_lib/referenceData';
import { supabase } from '../(site)/_lib/supabaseClient';

type Achievement = {
  id: string;
  title: string;
  description: string;
  isUnlocked: boolean;
  progressText: string;
};

type PremiumRequestPackKey = 'germany_top_3' | 'england_top_4' | 'italy_top_3' | 'spain_top_4' | 'france_top_3' | 'premium_full';
type PremiumAccessRequestRow = {
  id: string;
  pack_key: PremiumRequestPackKey;
  status: 'open' | 'handled' | 'dismissed';
  message: string | null;
  created_at: string;
  updated_at: string;
};

const premiumRequestOptions: Array<{ key: PremiumRequestPackKey; label: string; description: string }> = [
  {
    key: 'england_top_4',
    label: 'England',
    description: 'Premier League, Championship, League One og League Two',
  },
  {
    key: 'germany_top_3',
    label: 'Tyskland',
    description: 'Bundesliga, 2. Bundesliga og 3. Liga',
  },
  {
    key: 'italy_top_3',
    label: 'Italien',
    description: 'Serie A, Serie B og Serie C',
  },
  {
    key: 'spain_top_4',
    label: 'Spanien',
    description: 'La Liga, Segunda División og Primera Federación gruppe 1-2',
  },
  {
    key: 'france_top_3',
    label: 'Frankrig',
    description: 'Ligue 1, Ligue 2 og National',
  },
  {
    key: 'premium_full',
    label: 'Alle premium-pakker',
    description: 'Adgang til alle nuværende og kommende premium-pakker',
  },
];

const homeCountryStorageKey = 'app.preferredHomeCountryCode';
const countryOrder = ['dk', 'de', 'en', 'it', 'es', 'fr'];

function compareCountryCodes(left: string, right: string) {
  const leftRank = countryOrder.indexOf(left);
  const rightRank = countryOrder.indexOf(right);
  const normalizedLeftRank = leftRank === -1 ? Number.MAX_SAFE_INTEGER : leftRank;
  const normalizedRightRank = rightRank === -1 ? Number.MAX_SAFE_INTEGER : rightRank;

  if (normalizedLeftRank !== normalizedRightRank) {
    return normalizedLeftRank - normalizedRightRank;
  }

  return countryLabel(left).localeCompare(countryLabel(right), 'da');
}

function clampProgress(value: number, max: number) {
  return `${Math.min(value, max)}/${max}`;
}

async function submitPremiumAccessRequestViaApi(targetPackKey: PremiumRequestPackKey, requestMessage: string) {
  if (!supabase) {
    throw new Error('Supabase er ikke konfigureret.');
  }

  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) {
    throw new Error('auth_required');
  }

  const response = await fetch('/api/premium-access-request', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      target_pack_key: targetPackKey,
      request_message: requestMessage.trim() || null,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof payload?.error === 'string' ? payload.error : 'request_failed');
  }

  return payload;
}

export default function MyPage() {
  const [stadiums, setStadiums] = useState<Stadium[]>([]);
  const [countryFilter, setCountryFilter] = useState<string>('dk');
  const [preferredHomeCountryCode, setPreferredHomeCountryCode] = useState<string>('dk');
  const [showVisited, setShowVisited] = useState(false);
  const [filter, setFilter] = useState('');
  const [premiumRequestPackKey, setPremiumRequestPackKey] = useState<PremiumRequestPackKey>('premium_full');
  const [premiumRequestMessage, setPremiumRequestMessage] = useState('');
  const [premiumRequestStatus, setPremiumRequestStatus] = useState<string | null>(null);
  const [premiumRequestError, setPremiumRequestError] = useState<string | null>(null);
  const [isSubmittingPremiumRequest, setIsSubmittingPremiumRequest] = useState(false);
  const [premiumRequestRows, setPremiumRequestRows] = useState<PremiumAccessRequestRow[]>([]);
  const [isLoadingPremiumRequestRows, setIsLoadingPremiumRequestRows] = useState(false);
  const { hasSupabaseEnv, isLoggedIn, isLoadingVisits, userEmail, visited, toggleVisited } = useVisitedModel();
  const { enabledPackIds, isLoadingLeaguePackAccess, leaguePackAccessError } = useLeaguePackAccessModel();
  const { notes, isLoadingNotes } = useNotesModel();
  const { reviews, isLoadingReviews } = useReviewsModel();
  const { photosByClubId, isLoadingPhotos } = usePhotosModel();

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
    if (!storedHomeCountryCode) {
      return;
    }

    setPreferredHomeCountryCode(storedHomeCountryCode);
    setCountryFilter(storedHomeCountryCode);
  }, []);

  const visibleStadiums = useMemo(
    () => filterStadiumsForLeaguePackAccess(stadiums, enabledPackIds),
    [stadiums, enabledPackIds]
  );
  const hiddenLeaguePackStadiumCount = stadiums.length - visibleStadiums.length;
  const visibleClubIds = useMemo(
    () => new Set(visibleStadiums.map((stadium) => stadium.id)),
    [visibleStadiums]
  );
  const visitedStadiums = useMemo(
    () => visibleStadiums.filter((stadium) => visited[stadium.id]),
    [visibleStadiums, visited]
  );
  const visitedCount = visitedStadiums.length;
  const totalCount = visibleStadiums.length;
  const remainingCount = Math.max(totalCount - visitedCount, 0);
  const completion = totalCount > 0 ? Math.round((visitedCount / totalCount) * 100) : 0;
  const progress = totalCount > 0 ? visitedCount / totalCount : 0;
  const coreVisibleStadiums = useMemo(
    () => visibleStadiums.filter((stadium) => (stadium.leaguePack ?? 'core_denmark') === 'core_denmark'),
    [visibleStadiums]
  );
  const premiumVisibleStadiums = useMemo(
    () => visibleStadiums.filter((stadium) => (stadium.leaguePack ?? 'core_denmark') !== 'core_denmark'),
    [visibleStadiums]
  );
  const coreVisitedCount = useMemo(
    () => coreVisibleStadiums.filter((stadium) => visited[stadium.id]).length,
    [coreVisibleStadiums, visited]
  );
  const premiumVisitedCount = useMemo(
    () => premiumVisibleStadiums.filter((stadium) => visited[stadium.id]).length,
    [premiumVisibleStadiums, visited]
  );
  const hasPremiumCountries = premiumVisibleStadiums.length > 0;
  const visibleCountryCount = new Set(visibleStadiums.map((stadium) => stadium.countryCode ?? 'dk')).size;
  const crossBorderTarget = Math.min(visibleCountryCount, 2);

  const countries = useMemo(
    () => Array.from(new Set(visibleStadiums.map((stadium) => stadium.countryCode ?? 'dk'))).sort(compareCountryCodes),
    [visibleStadiums]
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

    if (countryFilter !== 'Alle' && !countries.includes(countryFilter)) {
      setCountryFilter(resolvedHomeCountryCode);
    }
  }, [countries, countryFilter, preferredHomeCountryCode]);

  const currentScopeLabel = countryFilter === 'Alle' ? 'Alle aktive lande' : countryLabel(countryFilter);

  const scopedStadiums = useMemo(
    () => visibleStadiums.filter((stadium) => countryFilter === 'Alle' || (stadium.countryCode ?? 'dk') === countryFilter),
    [visibleStadiums, countryFilter]
  );
  const scopedClubIds = useMemo(
    () => new Set(scopedStadiums.map((stadium) => stadium.id)),
    [scopedStadiums]
  );
  const scopedVisitedCount = useMemo(
    () => scopedStadiums.filter((stadium) => visited[stadium.id]).length,
    [scopedStadiums, visited]
  );
  const scopedNotesCount = useMemo(
    () => Object.entries(notes).filter(([clubId, note]) => scopedClubIds.has(clubId) && note.trim().length > 0).length,
    [notes, scopedClubIds]
  );
  const notesCount = useMemo(
    () => Object.entries(notes).filter(([clubId, note]) => visibleClubIds.has(clubId) && note.trim().length > 0).length,
    [notes, visibleClubIds]
  );
  const scopedReviews = useMemo(
    () => Object.values(reviews).filter((review) => scopedClubIds.has(review.clubId)),
    [reviews, scopedClubIds]
  );
  const scopedReviewsCount = scopedReviews.length;
  const reviewsCount = useMemo(
    () => Object.values(reviews).filter((review) => visibleClubIds.has(review.clubId)).length,
    [reviews, visibleClubIds]
  );
  const scopedPhotosByClubId = useMemo(
    () => Object.entries(photosByClubId).filter(([clubId, items]) => scopedClubIds.has(clubId) && items.length > 0),
    [photosByClubId, scopedClubIds]
  );
  const scopedPhotosCount = useMemo(
    () => scopedPhotosByClubId.reduce((sum, [, items]) => sum + items.length, 0),
    [scopedPhotosByClubId]
  );
  const photosByVisibleClubId = useMemo(
    () => Object.entries(photosByClubId).filter(([clubId, items]) => visibleClubIds.has(clubId) && items.length > 0),
    [photosByClubId, visibleClubIds]
  );
  const photosCount = useMemo(
    () => photosByVisibleClubId.reduce((sum, [, items]) => sum + items.length, 0),
    [photosByVisibleClubId]
  );
  const isLoadingProgression = isLoadingVisits || isLoadingNotes || isLoadingReviews || isLoadingPhotos;

  const visitedByLeague = useMemo(() => {
    const grouped = new Map<string, { countryCode: string; league: string; total: number; visited: number }>();
    visibleStadiums.forEach((stadium) => {
      const countryCode = stadium.countryCode ?? 'dk';
      const key = `${countryCode}:${stadium.league}`;
      const current = grouped.get(key) ?? {
        countryCode,
        league: stadium.league,
        total: 0,
        visited: 0,
      };
      current.total += 1;
      if (visited[stadium.id]) {
        current.visited += 1;
      }
      grouped.set(key, current);
    });

    return [...grouped.values()].sort((left, right) => {
      const countryComparison = compareCountryCodes(left.countryCode, right.countryCode);
      if (countryComparison !== 0) {
        return countryComparison;
      }
      return compareLeagues(left.league, right.league);
    });
  }, [visibleStadiums, visited]);

  const completeLeagues = visitedByLeague.filter((row) => row.total > 0 && row.visited === row.total).length;
  const completePremiumLeagues = useMemo(() => {
    const grouped = new Map<string, { total: number; visited: number }>();
    premiumVisibleStadiums.forEach((stadium) => {
      const key = `${stadium.countryCode ?? 'dk'}:${stadium.league}`;
      const current = grouped.get(key) ?? { total: 0, visited: 0 };
      current.total += 1;
      if (visited[stadium.id]) {
        current.visited += 1;
      }
      grouped.set(key, current);
    });

    return [...grouped.values()].filter((row) => row.total > 0 && row.total === row.visited).length;
  }, [premiumVisibleStadiums, visited]);
  const averageReviewScoreText = useMemo(() => {
    const reviewAverages = Object.values(reviews)
      .filter((review) => visibleClubIds.has(review.clubId))
      .map((review) => {
        const values = Object.values(review.scores);
        if (!values.length) {
          return null;
        }
        const total = values.reduce((sum, score) => sum + score, 0);
        return total / values.length;
      })
      .filter((value): value is number => value !== null);

    if (!reviewAverages.length) {
      return null;
    }

    const total = reviewAverages.reduce((sum, value) => sum + value, 0);
    return `${(total / reviewAverages.length).toFixed(1)} / 10`;
  }, [reviews, visibleClubIds]);

  const stadiumsWithPhotosCount = photosByVisibleClubId.length;
  const openPremiumRequestRows = useMemo(
    () => premiumRequestRows.filter((row) => row.status === 'open'),
    [premiumRequestRows]
  );
  const selectedPackOpenRequest = useMemo(
    () => openPremiumRequestRows.find((row) => row.pack_key === premiumRequestPackKey) ?? null,
    [openPremiumRequestRows, premiumRequestPackKey]
  );

  useEffect(() => {
    let isCancelled = false;

    async function loadPremiumRequestRows() {
      if (!supabase || !isLoggedIn) {
        if (!isCancelled) {
          setPremiumRequestRows([]);
          setIsLoadingPremiumRequestRows(false);
        }
        return;
      }

      setIsLoadingPremiumRequestRows(true);
      try {
        const { data, error } = await supabase
          .from('premium_access_requests')
          .select('id, pack_key, status, message, created_at, updated_at')
          .order('created_at', { ascending: false });

        if (error) {
          throw error;
        }

        if (!isCancelled) {
          setPremiumRequestRows((data as PremiumAccessRequestRow[] | null) ?? []);
        }
      } catch {
        if (!isCancelled) {
          setPremiumRequestRows([]);
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingPremiumRequestRows(false);
        }
      }
    }

    loadPremiumRequestRows();

    return () => {
      isCancelled = true;
    };
  }, [isLoggedIn]);

  async function submitPremiumRequest() {
    if (!supabase || !isLoggedIn) {
      setPremiumRequestError('Du skal være logget ind for at anmode om premium-adgang.');
      return;
    }

    setIsSubmittingPremiumRequest(true);
    setPremiumRequestStatus(null);
    setPremiumRequestError(null);

    try {
      await submitPremiumAccessRequestViaApi(premiumRequestPackKey, premiumRequestMessage);

      const selectedLabel = premiumRequestOptions.find((option) => option.key === premiumRequestPackKey)?.label ?? premiumRequestPackKey;
      setPremiumRequestStatus(`Din anmodning om ${selectedLabel} er sendt.`);
      setPremiumRequestMessage('');
      const { data, error } = await supabase
        .from('premium_access_requests')
        .select('id, pack_key, status, message, created_at, updated_at')
        .order('created_at', { ascending: false });
      if (!error) {
        setPremiumRequestRows((data as PremiumAccessRequestRow[] | null) ?? []);
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      if (message.includes('auth_required')) {
        setPremiumRequestError('Du skal være logget ind for at anmode om premium-adgang.');
      } else if (message.includes('invalid_pack_key')) {
        setPremiumRequestError('Den valgte premium-pakke er ikke gyldig.');
      } else {
        setPremiumRequestError(message);
      }
    } finally {
      setIsSubmittingPremiumRequest(false);
    }
  }

  const visitedCitiesCount = useMemo(
    () => new Set(
      visitedStadiums
        .map((stadium) => stadium.city?.trim().toLowerCase())
        .filter((value): value is string => Boolean(value))
    ).size,
    [visitedStadiums]
  );

  const visitedLeaguesCount = useMemo(
    () => new Set(
      visitedStadiums
        .map((stadium) => stadium.league.trim().toLowerCase())
        .filter(Boolean)
    ).size,
    [visitedStadiums]
  );
  const visitedCountriesCount = useMemo(
    () => new Set(visitedStadiums.map((stadium) => stadium.countryCode ?? 'dk')).size,
    [visitedStadiums]
  );

  const baseAchievements = useMemo<Achievement[]>(() => {
    const halfThreshold = Math.max(1, Math.ceil(Math.max(coreVisibleStadiums.length, 1) * 0.5));

    return [
      {
        id: 'first_visit',
        title: 'Første skridt',
        description: 'Besøg dit første stadion.',
        isUnlocked: visitedCount >= 1,
        progressText: clampProgress(visitedCount, 1),
      },
      {
        id: 'five_stadiums',
        title: 'Groundhopper I',
        description: 'Besøg 5 stadions.',
        isUnlocked: visitedCount >= 5,
        progressText: clampProgress(visitedCount, 5),
      },
      {
        id: 'twelve_stadiums',
        title: 'Groundhopper II',
        description: 'Besøg 12 stadions.',
        isUnlocked: visitedCount >= 12,
        progressText: clampProgress(visitedCount, 12),
      },
      {
        id: 'halfway',
        title: 'Halvvejs',
        description: 'Besøg halvdelen af de danske stadions i grundpakken.',
        isUnlocked: coreVisitedCount >= halfThreshold,
        progressText: clampProgress(coreVisitedCount, halfThreshold),
      },
      {
        id: 'league_complete',
        title: 'Række-specialist',
        description: 'Fuldfør alle stadions i én liga.',
        isUnlocked: completeLeagues >= 1,
        progressText: clampProgress(completeLeagues, 1),
      },
      {
        id: 'first_review',
        title: 'Anmelder',
        description: 'Lav din første stadion-anmeldelse.',
        isUnlocked: reviewsCount >= 1,
        progressText: clampProgress(reviewsCount, 1),
      },
      {
        id: 'reviewer_level_2',
        title: 'Anmelder II',
        description: 'Lav anmeldelser af 5 stadions.',
        isUnlocked: reviewsCount >= 5,
        progressText: clampProgress(reviewsCount, 5),
      },
      {
        id: 'note_writer',
        title: 'Noteskriver',
        description: 'Skriv noter på 5 stadions.',
        isUnlocked: notesCount >= 5,
        progressText: clampProgress(notesCount, 5),
      },
      {
        id: 'first_photo',
        title: 'Fotograf',
        description: 'Tilføj dit første stadionbillede.',
        isUnlocked: photosCount >= 1,
        progressText: clampProgress(photosCount, 1),
      },
      {
        id: 'photo_collector',
        title: 'Fotojæger',
        description: 'Tilføj 10 stadionbilleder i alt.',
        isUnlocked: photosCount >= 10,
        progressText: clampProgress(photosCount, 10),
      },
      {
        id: 'gallery_builder',
        title: 'Galleri-bygger',
        description: 'Tilføj billeder på 3 forskellige stadions.',
        isUnlocked: stadiumsWithPhotosCount >= 3,
        progressText: clampProgress(stadiumsWithPhotosCount, 3),
      },
      {
        id: 'city_hopper',
        title: 'Byhopper',
        description: 'Besøg stadions i 5 forskellige byer.',
        isUnlocked: visitedCitiesCount >= 5,
        progressText: clampProgress(visitedCitiesCount, 5),
      },
      {
        id: 'league_explorer',
        title: 'Række-rejsende',
        description: 'Besøg stadions i 3 forskellige ligaer.',
        isUnlocked: visitedLeaguesCount >= 3,
        progressText: clampProgress(visitedLeaguesCount, 3),
      },
      {
        id: 'all_stadiums',
        title: 'Tribune Tour Master',
        description: 'Besøg alle stadions i grundpakken.',
        isUnlocked: coreVisibleStadiums.length > 0 && coreVisitedCount === coreVisibleStadiums.length,
        progressText: `${coreVisitedCount}/${Math.max(1, coreVisibleStadiums.length)}`,
      },
    ].sort((left, right) => {
      if (left.isUnlocked !== right.isUnlocked) {
        return left.isUnlocked ? -1 : 1;
      }
      return left.title.localeCompare(right.title, 'da');
    });
  }, [
    completeLeagues,
    coreVisibleStadiums.length,
    coreVisitedCount,
    notesCount,
    photosCount,
    reviewsCount,
    stadiumsWithPhotosCount,
    visitedCount,
    visitedCitiesCount,
    visitedLeaguesCount,
  ]);

  const premiumAchievements = useMemo<Achievement[]>(() => {
    if (!hasPremiumCountries) {
      return [];
    }

    return [
      {
        id: 'premium_first_visit',
        title: 'Udebanestart',
        description: 'Besøg dit første premium-stadion.',
        isUnlocked: premiumVisitedCount >= 1,
        progressText: clampProgress(premiumVisitedCount, 1),
      },
      {
        id: 'premium_explorer',
        title: 'International groundhopper',
        description: 'Besøg 5 premium-stadions.',
        isUnlocked: premiumVisitedCount >= 5,
        progressText: clampProgress(premiumVisitedCount, 5),
      },
      {
        id: 'cross_border',
        title: 'På tværs af grænser',
        description: 'Besøg stadions i mindst 2 aktive lande.',
        isUnlocked: crossBorderTarget <= 1 || visitedCountriesCount >= crossBorderTarget,
        progressText: `${Math.min(visitedCountriesCount, Math.max(crossBorderTarget, 1))}/${Math.max(crossBorderTarget, 1)}`,
      },
      {
        id: 'premium_league_complete',
        title: 'Premium-specialist',
        description: 'Fuldfør alle stadions i én premium-række.',
        isUnlocked: completePremiumLeagues >= 1,
        progressText: clampProgress(completePremiumLeagues, 1),
      },
    ].sort((left, right) => {
      if (left.isUnlocked !== right.isUnlocked) {
        return left.isUnlocked ? -1 : 1;
      }
      return left.title.localeCompare(right.title, 'da');
    });
  }, [completePremiumLeagues, crossBorderTarget, hasPremiumCountries, premiumVisitedCount, visitedCountriesCount]);

  const achievements = [...baseAchievements, ...premiumAchievements];
  const unlockedAchievementsCount = achievements.filter((achievement) => achievement.isUnlocked).length;

  const list = useMemo(() => {
    const search = filter.toLowerCase().trim();
    const filtered = scopedStadiums.filter((stadium) => `${stadium.name} ${stadium.team} ${stadium.city ?? ''} ${stadium.league}`.toLowerCase().includes(search));
    return filtered.filter((stadium) => (showVisited ? visited[stadium.id] : !visited[stadium.id]));
  }, [scopedStadiums, visited, showVisited, filter]);

  return (
    <SiteShell title="Tribunetour · Min tur">
      <section className="site-card p-5 md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="label-eyebrow">Min tur</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Overblik over dine stadionbesøg</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Se hvor mange stadions du har besøgt, hvor mange der mangler, og følg din progression på tværs af anmeldelser, noter og billeder.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[28rem]">
            <div className="stat-chip">
              <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Besøgte</div>
              <div className="mt-2 text-2xl font-semibold">{visitedCount}</div>
            </div>
            <div className="stat-chip">
              <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Tilbage</div>
              <div className="mt-2 text-2xl font-semibold">{remainingCount}</div>
            </div>
            <div className="stat-chip">
              <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Fuldført</div>
              <div className="mt-2 text-2xl font-semibold">{completion}%</div>
            </div>
          </div>
        </div>
        <div className="mt-5">
          <div className="flex items-center justify-between text-sm text-[var(--muted)]">
            <span>Fremdrift</span>
            <span>{completion}%</span>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,rgba(184,255,106,0.95),rgba(241,255,214,0.95))]"
              style={{ width: `${Math.max(progress * 100, 0)}%` }}
            />
          </div>
        </div>
      </section>

      <section className="site-card p-5 md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="label-eyebrow">Hjemland og scope</div>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight">Lås samme scope-logik som i appen</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Dit hjemland bliver udgangspunktet, når du åbner Tribunetour. Herfra kan du skifte mellem hjemland og alle aktive lande uden at miste overblikket.
            </p>
          </div>
          <div className="rounded-[28px] border border-[rgba(184,255,106,0.18)] bg-[rgba(184,255,106,0.08)] px-5 py-4 lg:min-w-[18rem]">
            <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Aktivt scope</div>
            <div className="mt-2 text-2xl font-semibold">{currentScopeLabel}</div>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Hjemland: {countryLabel(preferredHomeCountryCode)}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Hjemland</div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              {countries.map((countryCode) => (
                <button
                  key={`home-${countryCode}`}
                  type="button"
                  onClick={() => {
                    setPreferredHomeCountryCode(countryCode);
                    setCountryFilter(countryCode);
                    if (typeof window !== 'undefined') {
                      window.localStorage.setItem(homeCountryStorageKey, countryCode);
                    }
                  }}
                  className="pill-nav justify-center text-center"
                  data-active={preferredHomeCountryCode === countryCode ? 'true' : 'false'}
                >
                  {countryLabel(countryCode)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Viser nu</div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <button
                type="button"
                onClick={() => setCountryFilter('Alle')}
                className="pill-nav justify-center text-center"
                data-active={countryFilter === 'Alle' ? 'true' : 'false'}
              >
                Alle aktive lande
              </button>
              {countries.map((countryCode) => (
                <button
                  key={`scope-${countryCode}`}
                  type="button"
                  onClick={() => setCountryFilter(countryCode)}
                  className="pill-nav justify-center text-center"
                  data-active={countryFilter === countryCode ? 'true' : 'false'}
                >
                  {countryLabel(countryCode)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="site-card p-5 md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="label-eyebrow">Achievements</div>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight">Samme progression, uanset platform</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Basis-achievements følger din danske grundpakke, mens premium-achievements bliver synlige, når du har ekstra lande aktive. På den måde kan nye pyramider føjes til uden at ændre selve modellen.
            </p>
          </div>
          <div className="rounded-[28px] border border-[rgba(184,255,106,0.18)] bg-[rgba(184,255,106,0.08)] px-5 py-4">
            <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Låst op</div>
            <div className="mt-2 text-3xl font-semibold">{unlockedAchievementsCount}/{achievements.length}</div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="stat-chip">
            <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Noter</div>
            <div className="mt-2 text-2xl font-semibold">{notesCount}</div>
          </div>
          <div className="stat-chip">
            <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Anmeldelser</div>
            <div className="mt-2 text-2xl font-semibold">{reviewsCount}</div>
            {averageReviewScoreText && <p className="mt-2 text-xs text-[var(--muted)]">Snit: {averageReviewScoreText}</p>}
          </div>
          <div className="stat-chip">
            <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Billeder</div>
            <div className="mt-2 text-2xl font-semibold">{photosCount}</div>
            <p className="mt-2 text-xs text-[var(--muted)]">{stadiumsWithPhotosCount} stadions med billeder</p>
          </div>
          <div className="stat-chip">
            <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Udforskning</div>
            <div className="mt-2 text-2xl font-semibold">{visitedCitiesCount}</div>
            <p className="mt-2 text-xs text-[var(--muted)]">{visitedLeaguesCount} ligaer besøgt</p>
          </div>
        </div>

        <div className="mt-6">
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Basis-achievements</div>
          <div className="grid gap-3 lg:grid-cols-2">
            {baseAchievements.map((achievement) => (
              <article
                key={achievement.id}
                className={`rounded-[28px] border p-4 transition ${
                  achievement.isUnlocked
                    ? 'border-[rgba(184,255,106,0.26)] bg-[rgba(184,255,106,0.08)]'
                    : 'border-white/8 bg-white/4'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`grid h-12 w-12 shrink-0 place-items-center rounded-[18px] border text-lg ${
                      achievement.isUnlocked
                        ? 'border-[rgba(184,255,106,0.35)] bg-[rgba(184,255,106,0.12)] text-[var(--accent)]'
                        : 'border-white/10 bg-white/5 text-[var(--muted)]'
                    }`}
                  >
                    <span aria-hidden="true">{achievement.isUnlocked ? '✓' : '○'}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="font-semibold tracking-tight">{achievement.title}</h4>
                        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{achievement.description}</p>
                      </div>
                      <div className="rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-[var(--muted)]">
                        {achievement.progressText}
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        {premiumAchievements.length > 0 && (
          <div className="mt-6">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Premium achievements</div>
            <div className="mb-4 rounded-[24px] border border-white/8 bg-white/4 px-4 py-3 text-sm leading-6 text-[var(--muted)]">
              Grundachievements kan stadig fuldføres uanset hvor mange lande du har aktive. Premium-achievements gør det tydeligt, når du bruger flere landepakker og bevæger dig på tværs af pyramider.
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {premiumAchievements.map((achievement) => (
                <article
                  key={achievement.id}
                  className={`rounded-[28px] border p-4 transition ${
                    achievement.isUnlocked
                      ? 'border-[rgba(184,255,106,0.26)] bg-[rgba(184,255,106,0.08)]'
                      : 'border-white/8 bg-white/4'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`grid h-12 w-12 shrink-0 place-items-center rounded-[18px] border text-lg ${
                        achievement.isUnlocked
                          ? 'border-[rgba(184,255,106,0.35)] bg-[rgba(184,255,106,0.12)] text-[var(--accent)]'
                          : 'border-white/10 bg-white/5 text-[var(--muted)]'
                      }`}
                    >
                      <span aria-hidden="true">{achievement.isUnlocked ? '✓' : '○'}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="font-semibold tracking-tight">{achievement.title}</h4>
                          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{achievement.description}</p>
                        </div>
                        <div className="rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-[var(--muted)]">
                          {achievement.progressText}
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="site-card-soft p-5 md:p-6">
        <div className="label-eyebrow">Konto og sync</div>
        {!hasSupabaseEnv && (
          <>
            <h3 className="mt-2 text-xl font-semibold tracking-tight">Login klargøres</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Web kan allerede vise data og progression, men personlig sync er ikke slået helt til i dette miljø endnu.
            </p>
          </>
        )}

        {hasSupabaseEnv && !isLoggedIn && (
          <>
            <h3 className="mt-2 text-xl font-semibold tracking-tight">Gør Min tur personlig</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Log ind øverst på siden for at gemme dine stadionbesøg, synkronisere med appen og få adgang til premium-landepakker.
            </p>
            {hiddenLeaguePackStadiumCount > 0 && (
              <div className="mt-4 rounded-[24px] border border-white/8 bg-white/4 px-4 py-3 text-sm leading-6 text-[var(--muted)]">
                Ekstra ligaer bliver synlige efter login, hvis din konto har adgang til de relevante premium-pakker.
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-3">
              <a href="/" className="cta-primary">
                Gå til stadions
              </a>
              <a href="/matches" className="cta-secondary">
                Se kommende kampe
              </a>
            </div>
          </>
        )}

        {hasSupabaseEnv && isLoggedIn && (
          <>
            <h3 className="mt-2 text-xl font-semibold tracking-tight">Logget ind</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Kontoen {userEmail ?? ''} er aktiv. Din besøgsstatus og dine premium-adgange følger nu samme konto på tværs af web og app.
            </p>

            {leaguePackAccessError && (
              <div className="mt-4 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {leaguePackAccessError}
              </div>
            )}

            {isLoadingVisits && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-[var(--muted)]">
                Henter din besøgsstatus…
              </div>
            )}

            {isLoadingProgression && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-[var(--muted)]">
                Opdaterer din progression…
              </div>
            )}

            {!isLoadingVisits && visitedCount === 0 && (
              <div className="mt-4 rounded-[24px] border border-white/8 bg-white/4 px-4 py-3 text-sm leading-6 text-[var(--muted)]">
                Kontoen er klar. Start med at markere de stadions du allerede har besøgt, eller brug kampsiden til at planlægge de næste.
              </div>
            )}

            <div className="mt-6">
              <div className="text-sm font-medium text-white">Premium-adgang</div>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
                Anmod om adgang til ligaer i andre lande. Vi behandler anmodningen manuelt og åbner den rigtige pakke på din konto.
              </p>

              {isLoadingPremiumRequestRows && (
                <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                  Henter dine premium-anmodninger…
                </p>
              )}

              {!isLoadingPremiumRequestRows && selectedPackOpenRequest && (
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-[var(--muted)]">
                  Du har allerede en åben anmodning om {premiumRequestOptions.find((option) => option.key === selectedPackOpenRequest.pack_key)?.label ?? selectedPackOpenRequest.pack_key}.
                  <div className="mt-1 text-xs text-[var(--muted)]">
                    Sendt {new Date(selectedPackOpenRequest.created_at).toLocaleString('da-DK')}.
                  </div>
                </div>
              )}

              {!isLoadingPremiumRequestRows && !selectedPackOpenRequest && openPremiumRequestRows.length > 0 && (
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-[var(--muted)]">
                  Du har allerede åbne anmodninger om {openPremiumRequestRows.map((row) => premiumRequestOptions.find((option) => option.key === row.pack_key)?.label ?? row.pack_key).join(', ')}.
                </div>
              )}

              <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div>
                  <label className="text-sm font-medium text-white" htmlFor="premium-request-pack">
                    Premium-pakke
                  </label>
                  <select
                    id="premium-request-pack"
                    className="field-input mt-2"
                    value={premiumRequestPackKey}
                    onChange={(event) => setPremiumRequestPackKey(event.target.value as PremiumRequestPackKey)}
                  >
                    {premiumRequestOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                    {premiumRequestOptions.find((option) => option.key === premiumRequestPackKey)?.description}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-white" htmlFor="premium-request-message">
                    Besked, valgfri
                  </label>
                  <textarea
                    id="premium-request-message"
                    className="field-input mt-2 min-h-24"
                    value={premiumRequestMessage}
                    onChange={(event) => setPremiumRequestMessage(event.target.value)}
                    placeholder="Fx hvilken pakke du gerne vil teste først."
                  />
                </div>
              </div>

              <button
                type="button"
                className="cta-primary mt-4"
                disabled={isSubmittingPremiumRequest || Boolean(selectedPackOpenRequest)}
                onClick={submitPremiumRequest}
              >
                {isSubmittingPremiumRequest ? 'Sender…' : selectedPackOpenRequest ? 'Anmodning allerede sendt' : 'Anmod om premium-adgang'}
              </button>

              {premiumRequestStatus && (
                <div className="mt-4 rounded-2xl border border-[rgba(184,255,106,0.25)] bg-[rgba(184,255,106,0.08)] px-4 py-3 text-sm text-[var(--accent)]">
                  {premiumRequestStatus}
                </div>
              )}

              {premiumRequestError && (
                <div className="mt-4 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {premiumRequestError}
                </div>
              )}
            </div>
          </>
        )}
      </section>

      <section className="site-card p-5 md:p-6">
        <div className="label-eyebrow">Fordelt på liga</div>
        <h3 className="mt-2 text-2xl font-semibold tracking-tight">Din progression følger pyramiderne</h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
          Ligaerne er sorteret efter pyramiden i hvert land, så nye pakker kan falde ind i samme mønster uden ekstra UI-arbejde.
        </p>

        <div className="mt-6 grid gap-3">
          {visitedByLeague.map((row) => (
            <article key={`${row.countryCode}-${row.league}`} className="rounded-[24px] border border-white/8 bg-white/4 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold tracking-tight">{countryLabel(row.countryCode)} - {row.league}</div>
                </div>
                <div className="text-sm text-[var(--muted)]">{row.visited}/{row.total}</div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,rgba(184,255,106,0.95),rgba(241,255,214,0.95))]"
                  style={{ width: `${row.total > 0 ? (row.visited / row.total) * 100 : 0}%` }}
                />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="site-card overflow-hidden">
        <div className="border-b border-white/5 p-5 md:p-6">
          <div className="mb-4">
            <div className="label-eyebrow">Mine stadions</div>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight">Se stadions i dit aktuelle scope</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Listen nedenfor følger dit valgte scope. Skift mellem hjemland og alle aktive lande ovenfor for at tjekke hvordan samme model føles på tværs af produktet.
            </p>
          </div>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <input className="field-input md:max-w-md" placeholder="Søg stadion, klub, by…" value={filter} onChange={(e) => setFilter(e.target.value)} />
            <div className="grid w-full grid-cols-2 rounded-full border border-white/10 bg-white/5 p-1 md:w-auto md:min-w-[15rem]">
              <button className={`min-w-0 rounded-full px-3 py-2 text-sm ${!showVisited ? 'bg-white text-neutral-900' : 'text-[var(--muted)]'}`} onClick={() => setShowVisited(false)}>
                Ubesøgte
              </button>
              <button className={`min-w-0 rounded-full px-3 py-2 text-sm ${showVisited ? 'bg-white text-neutral-900' : 'text-[var(--muted)]'}`} onClick={() => setShowVisited(true)}>
                Besøgte
              </button>
            </div>
          </div>
        </div>

        <ul className="divide-y divide-white/5">
          {list.map((stadium) => {
            const isVisited = Boolean(visited[stadium.id]);
            return (
              <li key={stadium.id} className="flex flex-col gap-4 p-5 md:flex-row md:items-center">
                <div className="flex items-center gap-4">
                  <div className="grid h-12 w-12 place-items-center rounded-[18px] border border-white/10 bg-white/5 text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
                    {stadium.name.substring(0, 2)}
                  </div>
                  <div>
                    <div className="font-medium">{stadium.name}</div>
                    <div className="mt-1 text-sm text-[var(--muted)]">{stadium.team} · {stadium.league}{stadium.city ? ` · ${stadium.city}` : ''}</div>
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
          {list.length === 0 && (
            <li className="p-6 text-[var(--muted)]">
              {showVisited ? `Du har ingen besøgte stadions i ${currentScopeLabel}, der matcher søgningen lige nu.` : `Ingen ubesøgte stadions i ${currentScopeLabel} matcher den valgte visning lige nu.`}
            </li>
          )}
        </ul>
      </section>
    </SiteShell>
  );
}
