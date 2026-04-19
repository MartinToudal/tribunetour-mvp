'use client';
import React from 'react';
import SiteShell from './(site)/_components/SiteShell';
import StadiumList from './(site)/_components/StadiumList';

const appStoreUrl = 'https://apps.apple.com/dk/app/tribunetour/id6759063990';

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
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                href={appStoreUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-fit rounded-[18px] border border-white/10 bg-white/5 p-2 transition hover:border-white/20 hover:bg-white/10"
                aria-label="Download Tribunetour i App Store"
              >
                <img
                  src="/app-store-badge-dk.svg"
                  alt="Download on the App Store"
                  className="h-[52px] w-auto"
                />
              </a>
              <span className="text-sm leading-6 text-[var(--muted)]">
                Tag Tribunetour med på farten og hold styr på dine stadionbesøg direkte i appen.
              </span>
            </div>
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
              <div className="mt-2 text-xl font-semibold">Kommende kampe</div>
              <p className="mt-2 text-sm text-[var(--muted)]">Se kommende kampe og fokusér på stadioner, du mangler at besøge.</p>
            </div>
          </div>
        </div>
      </section>

      <StadiumList />
    </SiteShell>
  );
}
