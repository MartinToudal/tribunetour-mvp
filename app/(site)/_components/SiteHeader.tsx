'use client';

import LoginButton from './LoginButton';

type SiteHeaderProps = {
    title?: string;
};

export default function SiteHeader({ title = 'Tribunetour' }: SiteHeaderProps) {
    return (
        <header className="sticky top-0 z-10 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4">
                <div className="grid h-9 w-9 place-items-center rounded-2xl bg-neutral-800 text-sm font-bold">
                    TT
                </div>
                <h1 className="text-xl font-semibold">{title}</h1>
                <nav className="ml-auto flex items-center gap-2">
                    <a href="/" className="rounded-xl border border-neutral-700 px-3 py-2 text-sm hover:bg-white/10">
                        Forside
                    </a>
                    <a href="/map" className="rounded-xl border border-neutral-700 px-3 py-2 text-sm hover:bg-white/10">
                        Kort
                    </a>
                    <a href="/my" className="rounded-xl border border-neutral-700 px-3 py-2 text-sm hover:bg-white/10">
                        Min side
                    </a>
                    <a href="/support" className="rounded-xl border border-neutral-700 px-3 py-2 text-sm hover:bg-white/10">
                        Support
                    </a>
                    <LoginButton />
                </nav>
            </div>
        </header>
    );
}
