'use client';
import React, { useEffect, useMemo, useState } from 'react';
import stadiumSeed from '../../data/stadiums.json';
import SiteFooter from '../(site)/_components/SiteFooter';
import SiteHeader from '../(site)/_components/SiteHeader';
import { supabase } from '../(site)/_lib/supabaseClient';

type Stadium = {
  id: string;
  name: string;
  team: string;
  league: string;
  city?: string;
};

export default function MyPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [stadiums, setStadiums] = useState<Stadium[]>([]);
  const [visited, setVisited] = useState<Record<string, boolean>>({});
  const [showVisited, setShowVisited] = useState(false);
  const [filter, setFilter] = useState('');

  // Hent bruger + stadions
  useEffect(() => {
    if (!supabase) {
      setStadiums(stadiumSeed as Stadium[]);
      return;
    }

    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    supabase.from('stadiums').select('*').order('league', { ascending: true }).order('name', { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error(error);
        setStadiums(data ?? []);
      });
  }, []);

  // Hent mine visits
  useEffect(() => {
    if (!supabase || !userId) return;
    supabase.from('visits').select('stadium_id').then(({ data, error }) => {
      if (error) { console.error(error); return; }
      const map: Record<string, boolean> = {};
      data?.forEach((r: any) => { map[r.stadium_id] = true; });
      setVisited(map);
    });
  }, [userId]);

  // Filter + visited toggle
  const list = useMemo(() => {
    const f = filter.toLowerCase();
    const filtered = stadiums.filter(s =>
      `${s.name} ${s.team} ${s.city} ${s.league}`.toLowerCase().includes(f)
    );
    return filtered.filter(s => showVisited ? visited[s.id] : !visited[s.id]);
  }, [stadiums, visited, showVisited, filter]);

  // Marker/afmarker direkte fra Min side
  async function toggleVisit(id: string) {
    if (!supabase) { return; }
    if (!userId) { alert('Log ind for at ændre dine besøg.'); return; }
    if (visited[id]) {
      await supabase.from('visits').delete().eq('stadium_id', id).eq('user_id', userId);
      setVisited(v => ({ ...v, [id]: false }));
    } else {
      const { error } = await supabase.from('visits').insert({ user_id: userId, stadium_id: id });
      if (error) { alert('Kunne ikke gemme – tjek RLS/policies.'); return; }
      setVisited(v => ({ ...v, [id]: true }));
    }
  }

  return (
    <div className="min-h-screen">
      <SiteHeader title="Tribunetour · Min side" />

      <main className="mx-auto grid max-w-6xl gap-4 px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold">Min side</h2>
            <p className="text-sm text-neutral-400">
              Overblik over {showVisited ? 'besøgte' : 'ubesøgte'} stadions
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              className="w-64 rounded-xl bg-neutral-900 px-3 py-2 outline-none ring-1 ring-neutral-800"
              placeholder="Søg stadion, klub, by…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <div className="overflow-hidden rounded-xl border border-neutral-800">
              <button
                className={`px-3 py-2 text-sm ${!showVisited ? 'bg-white text-neutral-900' : 'bg-neutral-950 text-neutral-200'}`}
                onClick={() => setShowVisited(false)}
                aria-pressed={!showVisited}
              >
                Ubesøgte
              </button>
              <button
                className={`border-l border-neutral-800 px-3 py-2 text-sm ${showVisited ? 'bg-white text-neutral-900' : 'bg-neutral-950 text-neutral-200'}`}
                onClick={() => setShowVisited(true)}
                aria-pressed={showVisited}
              >
                Besøgte
              </button>
            </div>
          </div>
        </div>
        {!supabase && (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 text-sm text-neutral-500">
            Min side kører i read-only demo-tilstand, indtil Supabase-miljøvariabler er sat op.
          </div>
        )}

        <ul className="divide-y divide-neutral-800 rounded-2xl border border-neutral-800">
          {list.map(s => (
            <li key={s.id} className="flex items-center gap-4 p-4">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-neutral-800 text-neutral-300">
                {s.name.substring(0, 2)}
              </div>
              <div className="flex-1">
                <div className="font-medium">{s.name}</div>
                <div className="text-sm text-neutral-400">
                  {s.team} · {s.league}{s.city ? ` · ${s.city}` : ''}
                </div>
              </div>
              <button
                onClick={() => toggleVisit(s.id)}
                disabled={!supabase}
                className={`rounded-xl border px-3 py-2 text-sm ${visited[s.id] ? 'border-green-500/40 bg-green-500/20' : 'border-neutral-700'}`}
              >
                {!supabase ? 'Login kommer senere' : visited[s.id] ? 'Marker som ubesøgt' : 'Marker som besøgt'}
              </button>
            </li>
          ))}
          {list.length === 0 && (
            <li className="p-6 text-neutral-400">Ingen at vise her endnu.</li>
          )}
        </ul>
      </main>

      <SiteFooter />
    </div>
  );
}
