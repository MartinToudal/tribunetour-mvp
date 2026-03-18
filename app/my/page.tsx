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

  useEffect(() => {
    if (!supabase || !userId) return;
    supabase.from('visits').select('stadium_id').then(({ data, error }) => {
      if (error) { console.error(error); return; }
      const map: Record<string, boolean> = {};
      data?.forEach((r: any) => { map[r.stadium_id] = true; });
      setVisited(map);
    });
  }, [userId]);

  const list = useMemo(() => {
    const f = filter.toLowerCase();
    const filtered = stadiums.filter(s => `${s.name} ${s.team} ${s.city} ${s.league}`.toLowerCase().includes(f));
    return filtered.filter(s => showVisited ? visited[s.id] : !visited[s.id]);
  }, [stadiums, visited, showVisited, filter]);

  async function toggleVisit(id: string) {
    if (!supabase) return;
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
    <div className="site-shell">
      <SiteHeader title="Tribunetour · Min tur" />

      <main className="site-main">
        <section className="site-card p-5 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="label-eyebrow">Min tur</div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">Overblik over {showVisited ? 'besøgte' : 'ubesøgte'} stadions</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">Samme dataidé som i appen, men gjort lettere at scanne og arbejde med på web.</p>
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <input
                className="field-input md:w-72"
                placeholder="Søg stadion, klub, by…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
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
        </section>

        {!supabase && (
          <div className="site-card-soft p-4 text-sm text-[var(--muted)]">
            Min tur kører i read-only webtilstand, indtil auth og synkronisering er slået helt til på web.
          </div>
        )}

        <section className="site-card overflow-hidden">
          <ul className="divide-y divide-white/5">
            {list.map(s => (
              <li key={s.id} className="flex flex-col gap-4 p-5 md:flex-row md:items-center">
                <div className="flex items-center gap-4">
                  <div className="grid h-12 w-12 place-items-center rounded-[18px] border border-white/10 bg-white/5 text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
                    {s.name.substring(0, 2)}
                  </div>
                  <div>
                    <div className="font-medium">{s.name}</div>
                    <div className="mt-1 text-sm text-[var(--muted)]">{s.team} · {s.league}{s.city ? ` · ${s.city}` : ''}</div>
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
            {list.length === 0 && <li className="p-6 text-[var(--muted)]">Ingen stadions matcher filteret lige nu.</li>}
          </ul>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
