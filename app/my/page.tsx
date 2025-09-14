'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../(site)/_lib/supabaseClient';

type Stadium = {
  id: string;
  name: string;
  team: string;
  league: string;
  city: string;
};

export default function MyPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [stadiums, setStadiums] = useState<Stadium[]>([]);
  const [visited, setVisited] = useState<Record<string, boolean>>({});
  const [showVisited, setShowVisited] = useState(false);
  const [filter, setFilter] = useState('');

  // Hent bruger + stadions
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    supabase.from('stadiums').select('*').order('league', { ascending: true }).order('name', { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error(error);
        setStadiums(data ?? []);
      });
  }, []);

  // Hent mine visits
  useEffect(() => {
    if (!userId) return;
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
    <div className="mx-auto max-w-6xl px-4 py-6 grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Min side</h2>
          <p className="text-neutral-400 text-sm">
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
          <div className="rounded-xl border border-neutral-800 overflow-hidden">
            <button
              className={`px-3 py-2 text-sm ${!showVisited ? 'bg-white text-neutral-900' : 'bg-neutral-950 text-neutral-200'}`}
              onClick={() => setShowVisited(false)}
              aria-pressed={!showVisited}
            >
              Ubesøgte
            </button>
            <button
              className={`px-3 py-2 text-sm border-l border-neutral-800 ${showVisited ? 'bg-white text-neutral-900' : 'bg-neutral-950 text-neutral-200'}`}
              onClick={() => setShowVisited(true)}
              aria-pressed={showVisited}
            >
              Besøgte
            </button>
          </div>
        </div>
      </div>

      <ul className="divide-y divide-neutral-800 rounded-2xl border border-neutral-800">
        {list.map(s => (
          <li key={s.id} className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-neutral-800 grid place-items-center text-neutral-300">
              {s.name.substring(0, 2)}
            </div>
            <div className="flex-1">
              <div className="font-medium">{s.name}</div>
              <div className="text-sm text-neutral-400">{s.team} · {s.league} · {s.city}</div>
            </div>
            <button
              onClick={() => toggleVisit(s.id)}
              className={`rounded-xl px-3 py-2 text-sm border ${visited[s.id] ? 'bg-green-500/20 border-green-500/40' : 'border-neutral-700'}`}
            >
              {visited[s.id] ? 'Marker som ubesøgt' : 'Marker som besøgt'}
            </button>
          </li>
        ))}
        {list.length === 0 && (
          <li className="p-6 text-neutral-400">Ingen at vise her endnu.</li>
        )}
      </ul>
    </div>
  );
}
