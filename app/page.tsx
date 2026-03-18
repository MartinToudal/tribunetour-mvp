'use client';
import React from 'react';
import SiteFooter from './(site)/_components/SiteFooter';
import SiteHeader from './(site)/_components/SiteHeader';
import StadiumList from './(site)/_components/StadiumList';

export default function Page() {
  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-4 py-6 grid gap-6">
        <section className="rounded-2xl border border-neutral-800 p-6 bg-gradient-to-br from-neutral-900 to-neutral-950">
          <h2 className="text-2xl font-semibold">Kampe, stadions og din egen groundhopping samlet ét sted.</h2>
          <p className="mt-2 text-neutral-300">
            Find kommende kampe, udforsk stadioner og byg din egen Tribunetour med besøg, billeder og anmeldelser.
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

      <SiteFooter />
    </div>
  );
}
