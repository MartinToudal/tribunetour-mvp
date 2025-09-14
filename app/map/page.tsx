'use client';
import React from 'react';
import MapView from '../(site)/_components/MapView';
import LoginButton from '../(site)/_components/LoginButton';

export default function MapPage() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-2xl bg-neutral-800 grid place-items-center text-sm font-bold">TT</div>
          <h1 className="text-xl font-semibold">TribuneTour · Kort</h1>
          <div className="ml-auto flex gap-2 items-center">
            <a href="/" className="rounded-xl border border-neutral-700 px-3 py-2 text-sm hover:bg-white/10">Forside</a>
            <a href="/my" className="rounded-xl border border-neutral-700 px-3 py-2 text-sm hover:bg-white/10">Min side</a>
            <LoginButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 grid gap-6">
        <MapView />
      </main>

      <footer className="mx-auto max-w-6xl px-4 py-10 text-sm text-neutral-400">
        © {new Date().getFullYear()} TribuneTour · tribunetour.dk
      </footer>
    </div>
  );
}
