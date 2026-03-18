'use client';
import React from 'react';
import SiteFooter from './(site)/_components/SiteFooter';
import SiteHeader from './(site)/_components/SiteHeader';
import StadiumList from './(site)/_components/StadiumList';

const highlights = [
  { label: 'Stadions', value: 'Danmark', copy: 'Byg et overblik over baner, klubber og afstande.' },
  { label: 'Kampe', value: 'Kommende', copy: 'Find kampe og planlæg næste tur med samme struktur som i appen.' },
  { label: 'Min tur', value: 'Besøg', copy: 'Gør web klar til synk på tværs af platforme og login.' },
];

export default function Page() {
  return (
    <div className="site-shell">
      <SiteHeader />

      <main className="site-main">
        <section className="site-card overflow-hidden p-6 md:p-8">
          <div className="grid gap-8 lg:grid-cols-[1.3fr_0.9fr] lg:items-end">
            <div>
              <div className="label-eyebrow">Fra app til platform</div>
              <h2 className="section-title mt-3 max-w-3xl">
                Tribunetour på web skal føles som samme produkt, ikke som et sideløbende site.
              </h2>
              <p className="section-copy mt-4 max-w-2xl">
                Derfor tager layoutet her udgangspunkt i appens informationshierarki: tydelige sektioner, rolige overgange,
                hurtige filtre og en mere produktnær loginoplevelse. Det er første skridt mod et fælles designspor.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <a href="#stadiums" className="cta-primary">Se stadionlisten</a>
                <a href="/map" className="cta-secondary">Åbn kortet</a>
              </div>
            </div>

            <div className="grid gap-3">
              {highlights.map((item) => (
                <div key={item.label} className="stat-chip">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{item.label}</div>
                  <div className="mt-2 text-2xl font-semibold tracking-tight">{item.value}</div>
                  <p className="mt-2 text-sm text-[var(--muted)]">{item.copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <article className="site-card-soft p-5">
            <div className="label-eyebrow">Oversigt</div>
            <h3 className="mt-2 text-xl font-semibold">App-inspireret rytme</h3>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              Weben er bygget op omkring cards, overskrifter og handlinger, der kan oversættes tilbage til appen senere.
            </p>
          </article>
          <article className="site-card-soft p-5">
            <div className="label-eyebrow">Login</div>
            <h3 className="mt-2 text-xl font-semibold">Fra prompt til produktflow</h3>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              Login er gjort klar som et rigtigt panel med e-mail, magic link og tydelige statusbeskeder.
            </p>
          </article>
          <article className="site-card-soft p-5">
            <div className="label-eyebrow">Retning</div>
            <h3 className="mt-2 text-xl font-semibold">Klar til fælles designspor</h3>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              Det her er bevidst ikke en klassisk marketing-side. Det er et web-lag til samme produktfamilie som iOS-appen.
            </p>
          </article>
        </section>

        <StadiumList />
      </main>

      <SiteFooter />
    </div>
  );
}
