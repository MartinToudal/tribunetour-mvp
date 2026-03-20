'use client';
import React, { useEffect, useMemo, useState } from 'react';
import stadiumSeed from '../../../data/stadiums.json';
import VisitedModelNotice from './VisitedModelNotice';
import { useVisitedModel } from '../_hooks/useVisitedModel';

type Stadium = {
  id: string;
  name: string;
  team: string;
  league: string;
  city?: string;
  lat?: number;
  lon?: number;
};

type VisitFilter = 'all' | 'visited' | 'not-visited';

export default function StadiumList() {
  const [stadiums, setStadiums] = useState<Stadium[]>([]);
  const [filter, setFilter] = useState('');
  const [leagueFilter, setLeagueFilter] = useState<string>('Alle');
  const [visitFilter, setVisitFilter] = useState<VisitFilter>('all');
  const { hasSupabaseEnv, isLoggedIn, userEmail, visited, visitedCount, toggleVisited } = useVisitedModel();

  useEffect(() => {
    if (!hasSupabaseEnv) {
      setStadiums(stadiumSeed as Stadium[]);
      return;
    }
  }, [hasSupabaseEnv]);

  const leagues = useMemo(() => ['Alle', ...Array.from(new Set(stadiums.map((s) => s.league))).sort()], [stadiums]);

  const filtered = useMemo(() => {
    const search = filter.toLowerCase().trim();
    return stadiums.filter((stadium) => {
      const matchesSearch = !search || `${stadium.name} ${stadium.team} ${stadium.city ?? ''} ${stadium.league}`.toLowerCase().includes(search);
      const matchesLeague = leagueFilter === 'Alle' || stadium.league === leagueFilter;
      const isVisited = Boolean(visited[stadium.id]);
      const matchesVisit = visitFilter === 'all' || (visitFilter === 'visited' ? isVisited : !isVisited);
      return matchesSearch && matchesLeague && matchesVisit;
    });
  }, [stadiums, filter, leagueFilter, visitFilter, visited]);

  return (
    <section id="stadiums" className="site-card overflow-hidden">
      <div className="border-b border-white/5 p-5 md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="label-eyebrow">Stadions</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Find dit næste stadion</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Søg blandt stadioner, filtrér efter liga, og brug din personlige `visited`-status som filter på tværs af Tribunetour.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[26rem]">
            <div className="stat-chip">
              <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Stadions</div>
              <div className="mt-2 text-2xl font-semibold">{stadiums.length}</div>
            </div>
            <div className="stat-chip">
              <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Besøgte</div>
              <div className="mt-2 text-2xl font-semibold">{visitedCount}</div>
            </div>
            <div className="stat-chip">
              <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Viser nu</div>
              <div className="mt-2 text-2xl font-semibold">{filtered.length}</div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <input className="field-input" placeholder="Søg stadion, klub, by…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            {(['all', 'not-visited', 'visited'] as VisitFilter[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setVisitFilter(mode)}
                className="pill-nav"
                data-active={visitFilter === mode ? 'true' : 'false'}
              >
                {mode === 'all' ? 'Alle' : mode === 'visited' ? 'Besøgte' : 'Ikke-besøgte'}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {leagues.map((league) => (
            <button
              key={league}
              type="button"
              onClick={() => setLeagueFilter(league)}
              className="pill-nav"
              data-active={leagueFilter === league ? 'true' : 'false'}
            >
              {league}
            </button>
          ))}
        </div>
      </div>

      <div className="border-b border-white/5 p-4 md:p-5">
        <VisitedModelNotice hasSupabaseEnv={hasSupabaseEnv} isLoggedIn={isLoggedIn} userEmail={userEmail} compact />
      </div>

      <ul className="divide-y divide-white/5">
        {filtered.map((stadium) => {
          const isVisited = Boolean(visited[stadium.id]);
          return (
            <li key={stadium.id} className="flex flex-col gap-4 p-5 md:flex-row md:items-center">
              <div className="flex items-center gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[18px] border border-white/10 bg-white/5 text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
                  {stadium.name.substring(0, 2)}
                </div>
                <div>
                  <div className="font-medium text-white">{stadium.name}</div>
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
        {filtered.length === 0 && <li className="p-6 text-[var(--muted)]">Ingen stadions matcher dine filtre lige nu.</li>}
      </ul>
    </section>
  );
}
