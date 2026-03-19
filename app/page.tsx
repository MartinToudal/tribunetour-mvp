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
            <div className="label-eyebrow">Tribunetour</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Planlæg stadionture og hold styr på dine besøg.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)] md:text-base">
              Find stadioner, få overblik over dine besøg og brug kortet til at udforske nye destinationer.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="stat-chip">
              <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Overblik</div>
              <div className="mt-2 text-xl font-semibold">Stadions og status</div>
              <p className="mt-2 text-sm text-[var(--muted)]">Se hvilke stadions du allerede har besøgt, og hvad der mangler.</p>
            </div>
            <div className="stat-chip">
              <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Kort</div>
              <div className="mt-2 text-xl font-semibold">Udforsk Danmark</div>
              <p className="mt-2 text-sm text-[var(--muted)]">Brug kortet til at finde næste stadion på din tur.</p>
            </div>
            <div className="stat-chip">
              <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Min tur</div>
              <div className="mt-2 text-xl font-semibold">Følg din fremdrift</div>
              <p className="mt-2 text-sm text-[var(--muted)]">Få et hurtigt overblik over besøgte og resterende stadions.</p>
            </div>
          </div>
        </div>
      </section>

      <StadiumList />
    </SiteShell>
  );
}
