'use client';
import React from 'react';
import MatchesList from '../(site)/_components/MatchesList';
import SiteShell from '../(site)/_components/SiteShell';

export default function MatchesPage() {
  return (
    <SiteShell title="Tribunetour · Kampe">
      <MatchesList />
    </SiteShell>
  );
}
