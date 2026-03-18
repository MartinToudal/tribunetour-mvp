'use client';
import React from 'react';
import SiteShell from './(site)/_components/SiteShell';
import StadiumList from './(site)/_components/StadiumList';

export default function Page() {
  return (
    <SiteShell>
      <section className="site-card p-5 md:p-6">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <div>
            <div className="label-eyebrow">Retning</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Weben skal være en arbejdsflade, ikke en plakat.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)] md:text-base">
              Derfor er forsiden trimmet ned. Fokus er nu på stadium-overblik, filtrering og besøgsstatus i stedet for store statements.
              Det ligger tættere på appens måde at arbejde på og giver et bedre grundlag for fælles design senere.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="stat-chip">
              <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Nu</div>
              <div className="mt-2 text-xl font-semibold">Stadions først</div>
              <p className="mt-2 text-sm text-[var(--muted)]">Vi bygger den del af weben, hvor data og handling allerede findes.</p>
            </div>
            <div className="stat-chip">
              <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Næste lag</div>
              <div className="mt-2 text-xl font-semibold">Kampe og Min tur</div>
              <p className="mt-2 text-sm text-[var(--muted)]">Næste skridt er at oversætte flere af appens rigtige flows til web.</p>
            </div>
            <div className="stat-chip">
              <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Login</div>
              <div className="mt-2 text-xl font-semibold">Klar til forbedring</div>
              <p className="mt-2 text-sm text-[var(--muted)]">Login er nu et egentligt flow og kan udbygges uden at rode i layoutet igen.</p>
            </div>
          </div>
        </div>
      </section>

      <StadiumList />
    </SiteShell>
  );
}
