import SiteFooter from '../(site)/_components/SiteFooter';
import SiteHeader from '../(site)/_components/SiteHeader';

export default function PrivacyPage() {
    return (
        <div className="min-h-screen">
            <SiteHeader title="Tribunetour · Privatliv" />

            <main className="mx-auto max-w-4xl px-4 py-6">
                <article className="rounded-3xl border border-neutral-800 p-6">
                    <h2 className="text-3xl font-semibold tracking-tight">Privatliv</h2>
                    <p className="mt-4 text-neutral-300">
                        Denne side beskriver på et overordnet niveau, hvordan Tribunetour håndterer data i den nuværende version.
                    </p>

                    <section className="mt-8">
                        <h3 className="text-xl font-semibold">Hvilke data appen bruger</h3>
                        <ul className="mt-3 list-disc space-y-2 pl-5 text-neutral-400">
                            <li>Lokation til funktioner som afstand til stadioner og “tættest på mig”.</li>
                            <li>Brugerindhold som stadionbesøg, noter, anmeldelser, billeder og plan-data.</li>
                        </ul>
                    </section>

                    <section className="mt-8">
                        <h3 className="text-xl font-semibold">Hvordan data gemmes</h3>
                        <p className="mt-3 text-neutral-400">
                            Personlige data synkroniseres via iCloud/CloudKit, når funktionen er tilgængelig og brugeren er logget ind med iCloud.
                            Data bruges til at holde appens personlige indhold tilgængeligt på tværs af brugerens egne enheder.
                        </p>
                    </section>

                    <section className="mt-8">
                        <h3 className="text-xl font-semibold">Tracking og tredjepartsannoncer</h3>
                        <p className="mt-3 text-neutral-400">
                            Tribunetour bruger ikke tredjepartsannoncering eller klassisk tracking som en del af denne version.
                        </p>
                    </section>

                    <section className="mt-8">
                        <h3 className="text-xl font-semibold">Kontakt</h3>
                        <p className="mt-3 text-neutral-400">
                            Hvis du har spørgsmål om privatliv eller datahåndtering, kan du kontakte{' '}
                            <a className="text-white underline decoration-neutral-600 underline-offset-4" href="mailto:martin@toudal.dk">
                                martin@toudal.dk
                            </a>.
                        </p>
                    </section>
                </article>
            </main>

            <SiteFooter />
        </div>
    );
}
