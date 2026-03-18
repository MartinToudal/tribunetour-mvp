'use client';
export const dynamic = 'force-dynamic';
import React from 'react';
import SiteShell from '../(site)/_components/SiteShell';
import MapView from '../(site)/_components/MapView';

export default function MapPage() {
  return (
    <SiteShell title="Tribunetour · Kort">
      <section className="site-card p-5 md:p-6">
        <div className="mb-4">
          <div className="label-eyebrow">Kort</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">Stadions på kort</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Kortvisningen er stadig enkel, men ligger nu i samme shell og samme produktlogik som resten af weben.</p>
        </div>
        <div className="overflow-hidden rounded-[24px] border border-white/10">
          <MapView />
        </div>
      </section>
    </SiteShell>
  );
}
