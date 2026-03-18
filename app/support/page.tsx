import SiteFooter from '../(site)/_components/SiteFooter';
import SiteHeader from '../(site)/_components/SiteHeader';

export default function SupportPage() {
    return (
        <div className="min-h-screen">
            <SiteHeader title="Tribunetour · Support" />

            <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 md:grid-cols-[1.15fr_0.85fr]">
                <section className="grid gap-6">
                    <article className="rounded-3xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950 p-6">
                        <p className="mb-3 inline-flex rounded-full bg-green-500/10 px-3 py-1 text-sm font-semibold text-green-300">
                            Support
                        </p>
                        <h2 className="text-3xl font-semibold tracking-tight">
                            Hjælp til kampe, stadions og dine egne oplevelser.
                        </h2>
                        <p className="mt-3 max-w-2xl text-neutral-300">
                            Tribunetour hjælper dig med at finde kampe, holde styr på hvilke stadions du har
                            besøgt og planlægge kommende stadionture. Her finder du den korte vej til kontakt,
                            svar og privatlivsinformation.
                        </p>
                    </article>

                    <article className="rounded-3xl border border-neutral-800 p-6">
                        <h3 className="text-2xl font-semibold">Om Tribunetour</h3>
                        <div className="mt-4 grid gap-4">
                            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
                                <h4 className="font-medium">Find kommende kampe</h4>
                                <p className="mt-2 text-sm text-neutral-400">
                                    Brug søgning og filtre til at finde relevante opgør og stadioner.
                                </p>
                            </div>
                            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
                                <h4 className="font-medium">Hold styr på stadionbesøg</h4>
                                <p className="mt-2 text-sm text-neutral-400">
                                    Marker besøg, gem billeder og følg din egen progression over tid.
                                </p>
                            </div>
                            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
                                <h4 className="font-medium">Planlæg næste tur</h4>
                                <p className="mt-2 text-sm text-neutral-400">
                                    Saml kampe i en plan og få overblik over næste weekend eller midtuge.
                                </p>
                            </div>
                        </div>
                    </article>

                    <article className="rounded-3xl border border-neutral-800 p-6">
                        <h3 className="text-2xl font-semibold">FAQ</h3>
                        <div className="mt-4 grid gap-3">
                            <details className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4" open>
                                <summary className="cursor-pointer font-medium">Hvorfor kan jeg ikke se mine data på en ny enhed?</summary>
                                <p className="mt-3 text-sm text-neutral-400">
                                    Personlige data synkroniseres via iCloud/CloudKit. Du skal være logget ind med iCloud på den nye enhed,
                                    og iCloud skal være tilgængelig, før data kommer frem.
                                </p>
                            </details>
                            <details className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
                                <summary className="cursor-pointer font-medium">Hvorfor er et kamptidspunkt forkert?</summary>
                                <p className="mt-3 text-sm text-neutral-400">
                                    I denne version bruger appen indbyggede kampdata. Hvis du finder en fejl, så send kamp, stadion og korrekt tidspunkt til support.
                                </p>
                            </details>
                            <details className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
                                <summary className="cursor-pointer font-medium">Hvordan rapporterer jeg en fejl?</summary>
                                <p className="mt-3 text-sm text-neutral-400">
                                    Send en kort beskrivelse, device-model, iOS-version og gerne et screenshot. Det gør fejlsøgningen markant hurtigere.
                                </p>
                            </details>
                            <details className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
                                <summary className="cursor-pointer font-medium">Hvorfor beder appen om lokation?</summary>
                                <p className="mt-3 text-sm text-neutral-400">
                                    Lokation bruges til afstand til stadioner og funktioner som “tættest på mig”. Resten af appen kan stadig bruges uden lokationstilladelse.
                                </p>
                            </details>
                        </div>
                    </article>
                </section>

                <aside className="grid gap-6">
                    <article className="rounded-3xl border border-neutral-800 p-6">
                        <h3 className="text-2xl font-semibold">Kontakt</h3>
                        <p className="mt-3 text-neutral-300">
                            Brug mailen herunder, hvis du vil rapportere en fejl, foreslå en forbedring eller har spørgsmål til appen.
                        </p>
                        <a
                            href="mailto:support@tribunetour.dk"
                            className="mt-5 block rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 transition hover:border-neutral-700 hover:bg-neutral-900"
                        >
                            <span className="block text-xs uppercase tracking-[0.14em] text-neutral-500">Supportmail</span>
                            <span className="mt-2 block text-lg font-medium">support@tribunetour.dk</span>
                        </a>
                        <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                            Forventet svartid er normalt 2-5 hverdage. Ved fejlrapporter hjælper det at inkludere device-model, iOS-version og screenshot.
                        </div>
                    </article>

                    <article className="rounded-3xl border border-neutral-800 p-6">
                        <h3 className="text-2xl font-semibold">Privatliv</h3>
                        <p className="mt-3 text-neutral-300">
                            Tribunetour bruger lokation til afstands- og nærhedsfunktioner og bruger iCloud/CloudKit til at synkronisere personlige data som besøg, noter, anmeldelser, billeder og planer.
                        </p>
                        <div className="mt-4 grid gap-3">
                            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
                                <h4 className="font-medium">Ingen tracking</h4>
                                <p className="mt-2 text-sm text-neutral-400">
                                    Denne version bruger ikke tredjeparts annoncering eller klassisk tracking.
                                </p>
                            </div>
                            <a href="/privacy" className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 text-sm font-medium text-neutral-200 transition hover:border-neutral-700 hover:bg-neutral-900">
                                Åbn privacy-siden
                            </a>
                        </div>
                    </article>
                </aside>
            </main>

            <SiteFooter />
        </div>
    );
}
