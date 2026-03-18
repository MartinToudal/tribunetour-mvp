'use client';
export const dynamic = 'force-dynamic'; // undgå prerender/SSR på /map
import React from 'react';
import SiteFooter from '../(site)/_components/SiteFooter';
import SiteHeader from '../(site)/_components/SiteHeader';
import MapView from '../(site)/_components/MapView';

export default function MapPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader title="Tribunetour · Kort" />

      <main className="mx-auto max-w-6xl px-4 py-6 grid gap-6">
        <MapView />
      </main>

      <SiteFooter />
    </div>
  );
}
