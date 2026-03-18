'use client';
export const dynamic = 'force-dynamic';
import React from 'react';
import SiteFooter from '../(site)/_components/SiteFooter';
import SiteHeader from '../(site)/_components/SiteHeader';
import MapView from '../(site)/_components/MapView';

export default function MapPage() {
  return (
    <div className="site-shell">
      <SiteHeader title="Tribunetour · Kort" />

      <main className="site-main">
        <section className="site-card overflow-hidden p-3 md:p-4">
          <MapView />
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
