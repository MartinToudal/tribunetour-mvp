'use client';
import React, { useEffect, useMemo, useState } from 'react';
import SiteShell from '../(site)/_components/SiteShell';
import { useLeaguePackAccessModel } from '../(site)/_hooks/useLeaguePackAccessModel';
import { useNotesModel } from '../(site)/_hooks/useNotesModel';
import { usePhotosModel } from '../(site)/_hooks/usePhotosModel';
import { useReviewsModel } from '../(site)/_hooks/useReviewsModel';
import { useVisitedModel } from '../(site)/_hooks/useVisitedModel';
import { countryLabel, filterStadiumsForLeaguePackAccess } from '../(site)/_lib/leaguePacks';
import { getStadiums, type Stadium } from '../(site)/_lib/referenceData';
import { supabase } from '../(site)/_lib/supabaseClient';

type Achievement = {
  id: string;
  title: string;
  description: string;
  isUnlocked: boolean;
  progressText: string;
};

type PremiumRequestPackKey = 'germany_top_3' | 'england_top_4' | 'italy_top_3' | 'premium_full';
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
    key: 'premium_full',
    label: 'Alle premium-pakker',
    description: 'Adgang til alle nuværende og kommende premium-pakker',
  },
];

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
  const [countryFilter, setCountryFilter] = useState<string>('Alle');
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

  const visibleStadiums = useMemo(
    () => filterStadiumsForLeaguePackAccess(stadiums, enabledPackIds),
    [stadiums, enabledPackIds]
  );
  const hiddenLeaguePackStadiumCount = stadiums.length - visibleStadiums.length;

  const countries = useMemo(
    () => ['Alle', ...Array.from(new Set(visibleStadiums.map((stadium) => stadium.countryCode ?? 'dk'))).sort()],
    [visibleStadiums]
  );

  useEffect(() => {
    if (!countries.includes(countryFilter)) {
      setCountryFilter('Alle');
    }
  }, [countries, countryFilter]);

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
  const scopedReviews = useMemo(
    () => Object.values(reviews).filter((review) => scopedClubIds.has(review.clubId)),
    [reviews, scopedClubIds]
  );
  const scopedReviewsCount = scopedReviews.length;
  const scopedPhotosByClubId = useMemo(
    () => Object.entries(photosByClubId).filter(([clubId, items]) => scopedClubIds.has(clubId) && items.length > 0),
    [photosByClubId, scopedClubIds]
  );
  const scopedPhotosCount = useMemo(
    () => scopedPhotosByClubId.reduce((sum, [, items]) => sum + items.length, 0),
    [scopedPhotosByClubId]
  );
  const totalCount = scopedStadiums.length;
  const remainingCount = Math.max(totalCount - scopedVisitedCount, 0);
  const completion = totalCount > 0 ? Math.round((scopedVisitedCount / totalCount) * 100) : 0;
  const progress = totalCount > 0 ? scopedVisitedCount / totalCount : 0;
  const isLoadingProgression = isLoadingVisits || isLoadingNotes || isLoadingReviews || isLoadingPhotos;

  const visitedStadiums = useMemo(
    () => scopedStadiums.filter((stadium) => visited[stadium.id]),
    [scopedStadiums, visited]
  );

  const visitedByLeague = useMemo(() => {
    const grouped = new Map<string, Stadium[]>();
    scopedStadiums.forEach((stadium) => {
      const current = grouped.get(stadium.league) ?? [];
      current.push(stadium);
      grouped.set(stadium.league, current);
    });

    return [...grouped.entries()]
      .map(([league, items]) => ({
        league,
        total: items.length,
        visited: items.filter((stadium) => visited[stadium.id]).length,
      }))
      .sort((left, right) => {
        if (left.total !== right.total) {
          return right.total - left.total;
        }
        return left.league.localeCompare(right.league, 'da');
      });
  }, [scopedStadiums, visited]);

  const completeLeagues = visitedByLeague.filter((row) => row.total > 0 && row.visited === row.total).length;
  const averageReviewScoreText = useMemo(() => {
    const reviewAverages = scopedReviews
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
  }, [scopedReviews]);

  const stadiumsWithPhotosCount = scopedPhotosByClubId.length;
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

  const achievements = useMemo<Achievement[]>(() => {
    const halfThreshold = Math.max(1, Math.ceil(totalCount * 0.5));

    return [
      {
        id: 'first_visit',
        title: 'Første skridt',
        description: 'Besøg dit første stadion.',
        isUnlocked: scopedVisitedCount >= 1,
        progressText: clampProgress(scopedVisitedCount, 1),
      },
      {
        id: 'five_stadiums',
        title: 'Groundhopper I',
        description: 'Besøg 5 stadions.',
        isUnlocked: scopedVisitedCount >= 5,
        progressText: clampProgress(scopedVisitedCount, 5),
      },
      {
        id: 'twelve_stadiums',
        title: 'Groundhopper II',
        description: 'Besøg 12 stadions.',
        isUnlocked: scopedVisitedCount >= 12,
        progressText: clampProgress(scopedVisitedCount, 12),
      },
      {
        id: 'halfway',
        title: 'Halvvejs',
        description: 'Besøg halvdelen af alle stadions.',
        isUnlocked: scopedVisitedCount >= halfThreshold,
        progressText: clampProgress(scopedVisitedCount, halfThreshold),
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
        isUnlocked: scopedReviewsCount >= 1,
        progressText: clampProgress(scopedReviewsCount, 1),
      },
      {
        id: 'reviewer_level_2',
        title: 'Anmelder II',
        description: 'Lav anmeldelser af 5 stadions.',
        isUnlocked: scopedReviewsCount >= 5,
        progressText: clampProgress(scopedReviewsCount, 5),
      },
      {
        id: 'note_writer',
        title: 'Noteskriver',
        description: 'Skriv noter på 5 stadions.',
        isUnlocked: scopedNotesCount >= 5,
        progressText: clampProgress(scopedNotesCount, 5),
      },
      {
        id: 'first_photo',
        title: 'Fotograf',
        description: 'Tilføj dit første stadionbillede.',
        isUnlocked: scopedPhotosCount >= 1,
        progressText: clampProgress(scopedPhotosCount, 1),
      },
      {
        id: 'photo_collector',
        title: 'Fotojæger',
        description: 'Tilføj 10 stadionbilleder i alt.',
        isUnlocked: scopedPhotosCount >= 10,
        progressText: clampProgress(scopedPhotosCount, 10),
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
        description: 'Besøg alle stadions.',
        isUnlocked: totalCount > 0 && scopedVisitedCount === totalCount,
        progressText: `${scopedVisitedCount}/${Math.max(1, totalCount)}`,
      },
    ].sort((left, right) => {
      if (left.isUnlocked !== right.isUnlocked) {
        return left.isUnlocked ? -1 : 1;
      }
      return left.title.localeCompare(right.title, 'da');
    });
  }, [
    completeLeagues,
    scopedNotesCount,
    scopedPhotosCount,
    scopedReviewsCount,
    stadiumsWithPhotosCount,
    scopedVisitedCount,
    totalCount,
    visitedCitiesCount,
    visitedLeaguesCount,
  ]);

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
              <div className="mt-2 text-2xl font-semibold">{scopedVisitedCount}</div>
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
        {countries.length > 2 && (
          <div className="mb-5 border-b border-white/5 pb-5">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Landescope</div>
            <div className="grid grid-cols-3 gap-2 md:flex md:flex-wrap">
              {countries.map((countryCode) => (
                <button
                  key={countryCode}
                  type="button"
                  onClick={() => setCountryFilter(countryCode)}
                  className="pill-nav justify-center text-center"
                  data-active={countryFilter === countryCode ? 'true' : 'false'}
                >
                  {countryCode === 'Alle' ? 'Alle' : countryLabel(countryCode)}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="label-eyebrow">Progression</div>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight">Din konto begynder at ligne appen</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Web beregner nu achievements ud fra de samme shared data som appen: besøg, anmeldelser, noter og billeder.
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
            <div className="mt-2 text-2xl font-semibold">{scopedNotesCount}</div>
          </div>
          <div className="stat-chip">
            <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Anmeldelser</div>
            <div className="mt-2 text-2xl font-semibold">{scopedReviewsCount}</div>
            {averageReviewScoreText && <p className="mt-2 text-xs text-[var(--muted)]">Snit: {averageReviewScoreText}</p>}
          </div>
          <div className="stat-chip">
            <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Billeder</div>
            <div className="mt-2 text-2xl font-semibold">{scopedPhotosCount}</div>
            <p className="mt-2 text-xs text-[var(--muted)]">{stadiumsWithPhotosCount} stadions med billeder</p>
          </div>
          <div className="stat-chip">
            <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Udforskning</div>
            <div className="mt-2 text-2xl font-semibold">{visitedCitiesCount}</div>
            <p className="mt-2 text-xs text-[var(--muted)]">{visitedLeaguesCount} ligaer besøgt</p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-2">
          {achievements.map((achievement) => (
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
      </section>

      {!hasSupabaseEnv && (
        <section className="site-card-soft p-5 md:p-6">
          <div className="label-eyebrow">Min tur</div>
          <h3 className="mt-2 text-xl font-semibold tracking-tight">Besøgsstatus kommer senere på web</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            Du kan allerede udforske stadions og kampe her, men personlig besøgsstatus er ikke slået fuldt til på web endnu.
          </p>
        </section>
      )}

      {hasSupabaseEnv && !isLoggedIn && (
        <section className="site-card-soft p-5 md:p-6">
          <div className="label-eyebrow">Log ind</div>
          <h3 className="mt-2 text-xl font-semibold tracking-tight">Gør Min tur personlig</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            Log ind øverst på siden for at gemme dine stadionbesøg og få din egen status på tværs af Tribunetour.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a href="/" className="cta-primary">
              Gå til stadions
            </a>
            <a href="/matches" className="cta-secondary">
              Se kommende kampe
            </a>
          </div>
        </section>
      )}

      {hiddenLeaguePackStadiumCount > 0 && !isLoggedIn && (
        <section className="site-card-soft p-5 md:p-6">
          <div className="label-eyebrow">League pack</div>
          <h3 className="mt-2 text-xl font-semibold tracking-tight">Ekstra ligaer låses op efter login</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            Dine progressionstal viser Danmark, indtil du er logget ind. Derefter kan ekstra lande og ligaer indgå som premium-pakker.
          </p>
        </section>
      )}

      {hasSupabaseEnv && isLoggedIn && isLoadingVisits && (
        <section className="site-card-soft p-5 md:p-6 text-sm text-[var(--muted)]">
          Henter din besøgsstatus…
        </section>
      )}

      {hasSupabaseEnv && isLoggedIn && isLoadingProgression && (
        <section className="site-card-soft p-5 md:p-6 text-sm text-[var(--muted)]">
          Opdaterer din progression…
        </section>
      )}

      {hasSupabaseEnv && isLoggedIn && (
        <section className="site-card-soft p-5 md:p-6">
          <div className="label-eyebrow">Premium</div>
          <h3 className="mt-2 text-xl font-semibold tracking-tight">Anmod om adgang til flere ligaer</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            Send en anmodning, så vi kan åbne den rigtige landepakke for din konto.
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
            {isSubmittingPremiumRequest ? 'Sender…' : selectedPackOpenRequest ? 'Anmodning allerede sendt' : 'Send anmodning'}
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
        </section>
      )}

      {hasSupabaseEnv && isLoggedIn && !isLoadingVisits && scopedVisitedCount === 0 && (
        <section className="site-card-soft p-5 md:p-6">
          <div className="label-eyebrow">Klar til start</div>
          <h3 className="mt-2 text-xl font-semibold tracking-tight">Du har ikke markeret nogen stadioner endnu</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            Kontoen {userEmail ?? ''} er klar. Start med at markere de stadions du allerede har besøgt, eller brug kampsiden til at planlægge de næste.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a href="/" className="cta-primary">
              Markér stadions
            </a>
            <a href="/matches" className="cta-secondary">
              Se kampe
            </a>
          </div>
        </section>
      )}

      <section className="site-card overflow-hidden">
        <div className="border-b border-white/5 p-5 md:p-6">
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
              {showVisited ? 'Du har ingen besøgte stadions, der matcher søgningen lige nu.' : 'Ingen ubesøgte stadions matcher den valgte visning lige nu.'}
            </li>
          )}
        </ul>
      </section>
    </SiteShell>
  );
}
