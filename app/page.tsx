'use client';
import React, { useState } from 'react';

type Stadium = {
  id: string;
  name: string;
  team: string;
  league: 'Superliga' | '1. division' | '2. division' | '3. division';
  city: string;
  lat?: number;
  lon?: number;
};

type ReviewScores = {
  view: number;
  atmosphere: number;
  amenities: number;
  valueForMoney: number;
  accessibility: number;
  authenticity: number;
  pitchQuality: number;
};

const initialStadiums: Stadium[] = [
  { id: 'bif', name: 'Brøndby Stadion', team: 'Brøndby IF', league: 'Superliga', city: 'Brøndby' },
  { id: 'fck', name: 'Parken', team: 'F.C. København', league: 'Superliga', city: 'København' },
  { id: 'fcm', name: 'MCH Arena', team: 'FC Midtjylland', league: 'Superliga', city: 'Herning' },
];

const weights = {
  view: 0.15,
  atmosphere: 0.25,
  amenities: 0.15,
  valueForMoney: 0.10,
  accessibility: 0.10,
  authenticity: 0.15,
  pitchQuality: 0.10,
};

const labelMap: Record<string, string> = {
  view: 'Udsyn',
  atmosphere: 'Stemning',
  amenities: 'Faciliteter',
  valueForMoney: 'Værdi for pengene',
  accessibility: 'Tilgængelighed',
  authenticity: 'Autenticitet',
  pitchQuality: 'Bane',
};

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-neutral-800 p-4 bg-neutral-900">
      <div className="text-sm text-neutral-400">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
      {sub && <div className="text-xs text-neutral-500 mt-1">{sub}</div>}
    </div>
  );
}

function FilterPill({ label, active }: { label: string; active?: boolean }) {
  return (
    <button className={`rounded-full px-3 py-1 text-xs border ${active ? 'bg-white text-neutral-900' : 'border-neutral-700'}`}>{label}</button>
  );
}

export default function Page() {
  const [stadiums] = useState<Stadium[]>(initialStadiums);
  const [filter, setFilter] = useState<string>('');
  const [myVisited, setMyVisited] = useState<Record<string, boolean>>({});

  const filtered = stadiums.filter((s) =>
    `${s.name} ${s.team} ${s.city} ${s.league}`.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-2xl bg-neutral-800 grid place-items-center text-sm font-bold">TT</div>
          <h1 className="text-xl font-semibold">TribuneTour</h1>
          <div className="ml-auto flex gap-2">
            <input
              className="w-64 rounded-xl bg-neutral-900 px-3 py-2 outline-none ring-1 ring-neutral-800"
              placeholder="Søg stadion, klub, by…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <button className="rounded-xl bg-white/10 px-3 py-2 hover:bg-white/20">Log ind</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 grid gap-6">
        <section className="rounded-2xl border border-neutral-800 p-6 bg-gradient-to-br from-neutral-900 to-neutral-950">
          <h2 className="text-2xl font-semibold">48 stadions. Én sæson. Kan vi nå dem alle?</h2>
          <p className="mt-2 text-neutral-300">
            Følg vores jagt på at besøge alle danske divisionsklubbers hjemmebaner – og giv dine egne anmeldelser.
          </p>
          <div className="mt-4 flex gap-3">
            <button className="rounded-xl bg-white text-neutral-900 px-4 py-2 font-medium">Kom i gang</button>
            <button className="rounded-xl border border-neutral-700 px-4 py-2">Se kort</button>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard label="Stadions i mål" value={`${stadiums.length}/48`} sub="registreret i systemet" />
          <StatCard label="Besøgte (mine)" value={`${Object.values(myVisited).filter(Boolean).length}`} sub="kræver login" />
          <StatCard label="Næste gode mulighed" value="Find i kampprogram" sub="filtrér efter ubesøgte" />
        </section>

        <section className="rounded-2xl border border-neutral-800">
          <div className="flex items-center justify-between border-b border-neutral-800 p-4">
            <h3 className="text-lg font-semibold">Stadions</h3>
            <div className="flex gap-2 text-sm">
              <FilterPill label="Alle" active />
              <FilterPill label="Superliga" />
              <FilterPill label="1. division" />
              <FilterPill label="2. division" />
              <FilterPill label="3. division" />
            </div>
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
                  onClick={() => setMyVisited((m) => ({ ...m, [s.id]: !m[s.id] }))}
                  className={`rounded-xl px-3 py-2 text-sm border ${myVisited[s.id] ? 'bg-green-500/20 border-green-500/40' : 'border-neutral-700'}`}
                >
                  {myVisited[s.id] ? 'Marker som ubesøgt' : 'Marker som besøgt'}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-neutral-800 p-4">
          <h3 className="text-lg font-semibold">Anmeldelsesmodel (uddrag)</h3>
          <p className="text-sm text-neutral-400 mb-2">Skaler 1–5 pr. kriterium. Vægte ses herunder. Samlet score beregnes automatisk.</p>
          <div className="grid md:grid-cols-2 gap-3 text-sm">
            {Object.entries(weights).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between rounded-xl bg-neutral-900 px-3 py-2">
                <span className="capitalize">{labelMap[k as keyof typeof weights] || k}</span>
                <span className="text-neutral-300">{Math.round(v * 100)}%</span>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-4 py-10 text-sm text-neutral-400">
        © {new Date().getFullYear()} TribuneTour · tribunetour.dk
      </footer>
    </div>
  );
}
