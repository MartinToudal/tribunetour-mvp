'use client';
import React from 'react';
import LoginButton from './(site)/_components/LoginButton';
import StadiumList from './(site)/_components/StadiumList';

export default function Page() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-2xl bg-neutral-800 grid place-items-center text-sm font-bold">TT</div>
          <h1 className="text-xl font-semibold">TribuneTour</h1>
          <div className="ml-auto flex gap-2 items-center">
            <a href="/my" className="rounded-xl border border-neutral-700 px-3 py-2 text-sm hover:bg-white/10">Min side</a>
            <a href="/map" className="rounded-xl border border-neutral-700 px-3 py-2 text-sm hover:bg-white/10">Se kort</a>
            <LoginButton />
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
            <a
              href="#stadiums"
              className="rounded-xl bg-white text-neutral-900 px-4 py-2 font-medium"
            >
              Kom i gang
            </a>
            <a href="/map" className="rounded-2xl border border-neutral-700 px-4 py-2">Se kort</a>
          </div>
        </section>

        <a id="stadiums" />
        <StadiumList />
      </main>

      <footer className="mx-auto max-w-6xl px-4 py-10 text-sm text-neutral-400">
        © {new Date().getFullYear()} TribuneTour · tribunetour.dk
      </footer>
    </div>
  );
}
