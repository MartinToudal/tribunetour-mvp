'use client';
import React, { useEffect, useMemo, useState } from 'react';
import stadiumSeed from '../../../data/stadiums.json';
import { supabase } from '../_lib/supabaseClient';

type Stadium = { id:string; name:string; team:string; league:string; city:string; lat?:number; lon?:number };

export default function StadiumList() {
  const [stadiums, setStadiums] = useState<Stadium[]>([]);
  const [filter, setFilter] = useState('');
  const [userId, setUserId] = useState<string|null>(null);
  const [visited, setVisited] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!supabase) {
      setStadiums(stadiumSeed as Stadium[]);
      return;
    }

    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    supabase.from('stadiums').select('*').order('league',{ascending:true}).order('name',{ascending:true}).then(({ data }) => setStadiums(data ?? []));
  }, []);

  useEffect(() => {
    if (!supabase || !userId) return;
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
    if (!supabase) { return; }
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
    <section id="stadiums" className="site-card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-white/5 p-5 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="label-eyebrow">Stadions</div>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight">Byg din egen stadionliste</h3>
          <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
            Samme logik som i appen: søg, filtrér og marker besøg. Web er stadig tidligt, men strukturen er klar til at dele sprog med iOS.
          </p>
        </div>
        <input
          className="field-input md:max-w-sm"
          placeholder="Søg stadion, klub, by…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      {!supabase && (
        <div className="border-b border-white/5 px-5 py-4 text-sm text-[var(--muted)]">
          Viser lokale stadiondata. Login og synkronisering bliver aktiveret, når web-auth er slået fuldt til.
        </div>
      )}
      <ul className="divide-y divide-white/5">
        {filtered.map((s) => (
          <li key={s.id} className="flex flex-col gap-4 p-5 md:flex-row md:items-center">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[18px] border border-white/10 bg-white/5 text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
                {s.name.substring(0, 2)}
              </div>
              <div>
                <div className="font-medium text-white">{s.name}</div>
                <div className="mt-1 text-sm text-[var(--muted)]">{s.team} · {s.league} · {s.city}</div>
              </div>
            </div>
            <div className="md:ml-auto">
              <button
                onClick={() => toggleVisit(s.id)}
                disabled={!supabase}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${visited[s.id]
                  ? 'border border-[rgba(184,255,106,0.35)] bg-[rgba(184,255,106,0.12)] text-white'
                  : 'border border-white/10 bg-white/5 text-[var(--muted)] hover:text-white'}`}
              >
                {!supabase ? 'Login klargøres' : visited[s.id] ? 'Marker som ubesøgt' : 'Marker som besøgt'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
