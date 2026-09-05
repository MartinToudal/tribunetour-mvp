'use client';

import { useEffect, useMemo, useState } from 'react';
import SiteShell from '../(site)/_components/SiteShell';
import { CLUB_CHECK_ADMIN_EMAIL, useClubCheckAdminAccess } from '../(site)/_hooks/useClubCheckAdminAccess';
import stadiumSeed from '../../data/stadiums.json';
import fixtureSeed from '../../data/fixtures.json';

type Stadium = {
  id: string;
  team: string;
  name: string;
  city?: string;
  league?: string;
  countryCode?: string;
  lat?: number;
  lon?: number;
  membershipStatus?: string;
  primarySeasonId?: string;
};

type Fixture = {
  kickoff: string;
  homeTeamId: string;
  awayTeamId: string;
  venueClubId: string;
  status: string;
};

type CheckState = {
  fixtures: boolean;
  location: boolean;
  league: boolean;
  lat: string;
  lon: string;
  leagueValue: string;
  notes: string;
};

type HistoryEntry = {
  timestamp: string;
  clubId: string;
  club: string;
  checks: Pick<CheckState, 'fixtures' | 'location' | 'league'>;
  changes: Record<string, { from: string; to: string }>;
};

const STORAGE_KEY = 'tribunetour.club-check.v1';
const HISTORY_KEY = 'tribunetour.club-check-history.v1';
const stadiums = stadiumSeed as Stadium[];
const fixtures = fixtureSeed as Fixture[];
const clubNames = Object.fromEntries(stadiums.map((stadium) => [stadium.id, stadium.team]));

function todayKey() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Copenhagen' }).format(new Date());
}

function hash(value: string) {
  return [...value].reduce((total, character) => ((total * 31) + character.charCodeAt(0)) >>> 0, 7);
}

function selectDailyClubs(items: Stadium[], key: string) {
  return [...items]
    .sort((a, b) => hash(`${key}:${a.id}`) - hash(`${key}:${b.id}`))
    .slice(0, 3);
}

function initialState(stadium: Stadium): CheckState {
  return {
    fixtures: false,
    location: false,
    league: false,
    lat: String(stadium.lat ?? ''),
    lon: String(stadium.lon ?? ''),
    leagueValue: stadium.league ?? '',
    notes: '',
  };
}

function formatKickoff(value: string) {
  return new Intl.DateTimeFormat('da-DK', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default function ClubCheckPage() {
  const { isLoading: isAccessLoading, isAdmin, userEmail } = useClubCheckAdminAccess();
  const [day, setDay] = useState(todayKey);
  const [states, setStates] = useState<Record<string, CheckState>>({});
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [saved, setSaved] = useState(false);

  const activeStadiums = useMemo(
    () => stadiums.filter((stadium) => (stadium.membershipStatus ?? 'active') === 'active'),
    []
  );
  const clubs = useMemo(() => selectDailyClubs(activeStadiums, day), [activeStadiums, day]);
  const leagueOptions = useMemo(
    () => Array.from(new Set(activeStadiums.map((stadium) => stadium.league).filter(Boolean))).sort((a, b) => (a ?? '').localeCompare(b ?? '', 'da')) as string[],
    [activeStadiums]
  );

  useEffect(() => {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}') as Record<string, CheckState>;
    const storedHistory = JSON.parse(window.localStorage.getItem(HISTORY_KEY) || '[]') as HistoryEntry[];
    setStates(Object.fromEntries(clubs.map((club) => [club.id, stored[club.id] ?? initialState(club)])));
    setHistory(storedHistory);
  }, [clubs]);

  function update(clubId: string, patch: Partial<CheckState>) {
    setSaved(false);
    setStates((current) => ({ ...current, [clubId]: { ...current[clubId], ...patch } }));
  }

  function upcomingMatches(clubId: string) {
    const now = Date.now();
    return fixtures
      .filter((fixture) => fixture.status === 'scheduled' && new Date(fixture.kickoff).getTime() >= now && (fixture.homeTeamId === clubId || fixture.awayTeamId === clubId || fixture.venueClubId === clubId))
      .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime())
      .slice(0, 5);
  }

  function displayClub(clubId: string) {
    return clubNames[clubId] ?? clubId;
  }

  function saveClub(club: Stadium) {
    const state = states[club.id];
    if (!state) return;
    const changes: HistoryEntry['changes'] = {};
    if (String(club.lat ?? '') !== state.lat) changes.lat = { from: String(club.lat ?? ''), to: state.lat };
    if (String(club.lon ?? '') !== state.lon) changes.lon = { from: String(club.lon ?? ''), to: state.lon };
    if ((club.league ?? '') !== state.leagueValue) changes.league = { from: club.league ?? '', to: state.leagueValue };

    const nextHistory = [
      {
        timestamp: new Date().toISOString(),
        clubId: club.id,
        club: club.team,
        checks: { fixtures: state.fixtures, location: state.location, league: state.league },
        changes,
      },
      ...history,
    ];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(states));
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
    setHistory(nextHistory);
    setSaved(true);
  }

  function exportHistory() {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), history }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tribunetour-klubtjek-${day}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (isAccessLoading) {
    return <SiteShell title="Tribunetour · Klubtjek"><section className="site-card p-5 md:p-7"><p className="section-copy">Kontrollerer adgang...</p></section></SiteShell>;
  }

  if (userEmail !== CLUB_CHECK_ADMIN_EMAIL || !isAdmin) {
    return <SiteShell title="Tribunetour · Klubtjek"><section className="site-card p-5 md:p-7"><div className="label-eyebrow">Privat adminværktøj</div><h1 className="mt-2 text-3xl font-semibold tracking-tight">Ingen adgang</h1><p className="section-copy mt-3">Klubtjek er kun tilgængeligt for den godkendte administrator. Log ind med den rigtige konto for at fortsætte.</p><a className="cta-secondary mt-5 inline-flex" href="/">Tilbage til forsiden</a></section></SiteShell>;
  }

  return (
    <SiteShell title="Tribunetour · Klubtjek">
      <section className="site-card p-5 md:p-7">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <div className="label-eyebrow">Daglig datakontrol</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Klubtjek</h1>
            <p className="section-copy mt-3 max-w-2xl">Tjek tre klubber ad gangen. Bekræft kampprogram, stadionplacering og rækketilhør, og registrer rettelser med historik.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="cta-secondary" onClick={() => setDay(todayKey())}>Dagens klubber</button>
            <button className="cta-secondary" onClick={exportHistory} disabled={!history.length}>Eksportér historik</button>
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="stat-chip"><div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Dato</div><div className="mt-2 text-lg font-semibold">{day}</div></div>
          <div className="stat-chip"><div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Dagens stikprøve</div><div className="mt-2 text-lg font-semibold">{clubs.length} klubber</div></div>
          <div className="stat-chip"><div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Kontroller gemt</div><div className="mt-2 text-lg font-semibold">{history.length}</div></div>
        </div>
      </section>

      <div className="grid gap-5">
        {clubs.map((club) => {
          const state = states[club.id] ?? initialState(club);
          const matches = upcomingMatches(club.id);
          const isDanish = club.countryCode?.toLowerCase() === 'dk';
          const complete = (isDanish ? state.fixtures : true) && state.location && state.league;
          return (
            <section className="site-card p-5 md:p-7" key={club.id}>
              <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-5 md:flex-row md:items-start">
                <div>
                  <div className="label-eyebrow">{club.countryCode?.toUpperCase() ?? 'INT'} · {club.city ?? 'Ukendt by'}</div>
                  <h2 className="mt-2 text-2xl font-semibold">{club.team}</h2>
                  <p className="mt-1 text-[var(--muted)]">{club.name} · {club.league ?? 'Ingen række angivet'}</p>
                </div>
                <button className={complete ? 'cta-primary' : 'cta-secondary'} onClick={() => saveClub(club)}>{complete ? 'Gem godkendelse' : 'Gem kontrol'}</button>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-3">
                <label className="site-card-soft flex cursor-pointer gap-3 p-4">
                  <input type="checkbox" checked={state.fixtures} disabled={!isDanish} onChange={(event) => update(club.id, { fixtures: event.target.checked })} className="mt-1 h-5 w-5 accent-[var(--accent-strong)] disabled:opacity-50" />
                  <span><strong className="block">Kampprogram korrekt</strong><span className="mt-1 block text-sm text-[var(--muted)]">{!isDanish ? 'Gælder kun danske klubber' : matches.length ? `${matches.length} kommende kampe vist` : 'Ingen kommende kampe i data'}</span></span>
                </label>
                <label className="site-card-soft flex cursor-pointer gap-3 p-4">
                  <input type="checkbox" checked={state.location} onChange={(event) => update(club.id, { location: event.target.checked })} className="mt-1 h-5 w-5 accent-[var(--accent-strong)]" />
                  <span><strong className="block">Lokation korrekt</strong><span className="mt-1 block text-sm text-[var(--muted)]">Kontrollér punktet på kortet eller i Google Maps</span></span>
                </label>
                <label className="site-card-soft flex cursor-pointer gap-3 p-4">
                  <input type="checkbox" checked={state.league} onChange={(event) => update(club.id, { league: event.target.checked })} className="mt-1 h-5 w-5 accent-[var(--accent-strong)]" />
                  <span><strong className="block">Rækketilhør korrekt</strong><span className="mt-1 block text-sm text-[var(--muted)]">Kontrollér land, række og sæson</span></span>
                </label>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <label className="text-sm text-[var(--muted)]">Breddegrad<input className="field-input mt-2" value={state.lat} onChange={(event) => update(club.id, { lat: event.target.value })} inputMode="decimal" /></label>
                <label className="text-sm text-[var(--muted)]">Længdegrad<input className="field-input mt-2" value={state.lon} onChange={(event) => update(club.id, { lon: event.target.value })} inputMode="decimal" /></label>
                <label className="text-sm text-[var(--muted)]">Række<select className="field-input mt-2" value={state.leagueValue} onChange={(event) => update(club.id, { leagueValue: event.target.value })}><option value="">Vælg række</option>{leagueOptions.map((league) => <option key={league} value={league}>{league}</option>)}</select></label>
              </div>
              <label className="mt-4 block text-sm text-[var(--muted)]">Noter<textarea className="field-input mt-2 min-h-20 resize-y" value={state.notes} onChange={(event) => update(club.id, { notes: event.target.value })} placeholder="Skriv en kort note hvis noget skal følges op..." /></label>

              {matches.length > 0 && <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4"><div className="text-sm font-semibold">Kommende kampe i data</div><div className="mt-3 grid gap-2 text-sm text-[var(--muted)]">{matches.map((match) => <div key={`${match.kickoff}-${match.homeTeamId}-${match.awayTeamId}`} className="flex flex-wrap justify-between gap-2"><span>{displayClub(match.homeTeamId)} vs {displayClub(match.awayTeamId)}</span><span>{formatKickoff(match.kickoff)}</span></div>)}</div></div>}
            </section>
          );
        })}
      </div>

      {saved && <div className="rounded-2xl border border-[rgba(184,255,106,0.3)] bg-[rgba(184,255,106,0.08)] p-4 text-sm">Kontrollen er gemt lokalt på denne maskine.</div>}
      <section className="site-card-soft p-5 md:p-7"><div className="label-eyebrow">Kontrolhistorik</div><h2 className="mt-2 text-xl font-semibold">Seneste registreringer</h2><div className="mt-4 grid gap-2 text-sm text-[var(--muted)]">{history.slice(0, 8).map((entry) => <div key={`${entry.timestamp}-${entry.clubId}`} className="flex flex-col justify-between gap-1 border-b border-white/10 py-3 sm:flex-row"><span><strong className="text-[var(--text)]">{entry.club}</strong> · {entry.checks.fixtures && entry.checks.location && entry.checks.league ? 'godkendt' : 'delvist kontrolleret'}</span><span>{formatKickoff(entry.timestamp)}</span></div>)}{!history.length && <p>Ingen kontroller er gemt endnu.</p>}</div></section>
    </SiteShell>
  );
}
