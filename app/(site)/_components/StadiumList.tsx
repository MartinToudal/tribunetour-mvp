'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../_lib/supabaseClient';

type Stadium = { id:string; name:string; team:string; league:string; city:string; lat?:number; lon?:number };

export default function StadiumList() {
  const [stadiums, setStadiums] = useState<Stadium[]>([]);
  const [filter, setFilter] = useState('');
  const [userId, setUserId] = useState<string|null>(null);
  const [visited, setVisited] = useState<Record<string, boolean>>({});

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    supabase.from('stadiums').select('*').order('league',{ascending:true}).order('name',{ascending:true}).then(({ data }) => setStadiums(data ?? []));
  }, []);

  useEffect(() => {
    if (!userId) return;
    supabase.from('visits').select('stadium_id').then(({ data }) => {
      const m: Record<string, boolean> = {};
      data?.forEach((r:any)=> m[r.stadium_id] = true);
      setVisited(m);
    });
  }, [userId]);

  const filtered = useMemo(() => {
    const f = filter.toLowerCase();
    return stadiums.filter(s => `${s.name} ${s.team} ${s.city} ${s.league}`.toLowerCase().includes(f));
  }, [stadiums, filter]);

  async function toggleVisit(id:string) {
    if (!userId) { alert('Log ind for at markere besøgt.'); return; }
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
    <section className="rounded-2xl border border-neutral-800">
      <div className="flex items-center justify-between border-b border-neutral-800 p-4 gap-3">
        <h3 className="text-lg font-semibold">Stadions</h3>
        <input
          className="w-64 rounded-xl bg-neutral-900 px-3 py-2 outline-none ring-1 ring-neutral-800"
          placeholder="Søg stadion, klub, by…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      <ul className="divide-y divide-neutral-800">
        {filtered.map((s) => (
          <li key={s.id} className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-neutral-800 grid place-items-center text-neutral-300">
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
      </ul>
    </section>
  );
}
