'use client';
import React, { useEffect, useMemo, useState } from 'react';
import stadiumSeed from '../../data/stadiums.json';
import SiteShell from '../(site)/_components/SiteShell';
import { useVisitedModel } from '../(site)/_hooks/useVisitedModel';
import { supabase } from '../(site)/_lib/supabaseClient';

type Stadium = {
  id: string;
  name: string;
  team: string;
  league: string;
  city?: string;
};

export default function MyPage() {
  const [stadiums, setStadiums] = useState<Stadium[]>([]);
  const [showVisited, setShowVisited] = useState(false);
  const [filter, setFilter] = useState('');
  const { hasSupabaseEnv, isLoggedIn, visited, visitedCount, toggleVisited } = useVisitedModel();

  useEffect(() => {
    if (!hasSupabaseEnv) {
      setStadiums(stadiumSeed as Stadium[]);
      return;
    }

    supabase
      ?.from('stadiums')
      .select('*')
      .order('league', { ascending: true })
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error(error);
          setStadiums(stadiumSeed as Stadium[]);
          return;
        }

        if (!data || data.length === 0) {
          setStadiums(stadiumSeed as Stadium[]);
          return;
        }

        setStadiums(data as Stadium[]);
      });
  }, [hasSupabaseEnv]);
  const totalCount = stadiums.length;
  const remainingCount = Math.max(totalCount - visitedCount, 0);
  const completion = totalCount > 0 ? Math.round((visitedCount / totalCount) * 100) : 0;

  const list = useMemo(() => {
    const search = filter.toLowerCase().trim();
    const filtered = stadiums.filter((stadium) => `${stadium.name} ${stadium.team} ${stadium.city ?? ''} ${stadium.league}`.toLowerCase().includes(search));
    return filtered.filter((stadium) => (showVisited ? visited[stadium.id] : !visited[stadium.id]));
  }, [stadiums, visited, showVisited, filter]);

  return (
    <SiteShell title="Tribunetour · Min tur">
      <section className="site-card p-5 md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="label-eyebrow">Min tur</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Overblik over dine stadionbesøg</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Følg din personlige besøgsstatus, se hvor mange stadions du mangler, og brug samme `visited`-model som grundlag for resten af Tribunetour på web.
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
      </section>

      <section className="site-card overflow-hidden">
        <div className="border-b border-white/5 p-5 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <input className="field-input md:max-w-md" placeholder="Søg stadion, klub, by…" value={filter} onChange={(e) => setFilter(e.target.value)} />
            <div className="flex rounded-full border border-white/10 bg-white/5 p-1">
              <button className={`rounded-full px-4 py-2 text-sm ${!showVisited ? 'bg-white text-neutral-900' : 'text-[var(--muted)]'}`} onClick={() => setShowVisited(false)}>
                Ubesøgte
              </button>
              <button className={`rounded-full px-4 py-2 text-sm ${showVisited ? 'bg-white text-neutral-900' : 'text-[var(--muted)]'}`} onClick={() => setShowVisited(true)}>
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
          {list.length === 0 && <li className="p-6 text-[var(--muted)]">Ingen stadions matcher den valgte visning lige nu.</li>}
        </ul>
      </section>
    </SiteShell>
  );
}
