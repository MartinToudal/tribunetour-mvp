'use client';

import { usePathname } from 'next/navigation';
import LoginButton from './LoginButton';

type SiteHeaderProps = {
  title?: string;
};

const links = [
  { href: '/', label: 'Stadions' },
  { href: '/matches', label: 'Kampe' },
  { href: '/map', label: 'Kort' },
  { href: '/my', label: 'Min tur' },
  { href: '/support', label: 'Support' },
];

export default function SiteHeader({ title = 'Tribunetour' }: SiteHeaderProps) {
  const pathname = usePathname();
  const pageTitle = title === 'Tribunetour' ? 'Tribunetour' : title.replace(/^Tribunetour\s*·\s*/i, '');

  function isActive(href: string, label: string) {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-[rgba(10,15,13,0.82)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 md:gap-4 md:py-5">
        <div className="flex items-start justify-between gap-3 md:flex-row md:items-center md:justify-between">
          <a href="/" className="flex min-w-0 items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[18px] border border-white/10 bg-white/5 text-sm font-black tracking-[0.22em] text-[var(--accent)]">
              TT
            </div>
            <div className="min-w-0">
              <div className="truncate text-xl font-semibold tracking-tight md:text-2xl">Tribunetour</div>
              <div className="hidden truncate text-sm text-[var(--muted)] sm:block">
                {pageTitle === 'Tribunetour' ? 'Find kampe, udforsk stadions og hold styr på dine besøg' : pageTitle}
              </div>
            </div>
          </a>

          <div className="flex shrink-0 items-center gap-2 self-start md:self-auto">
            <LoginButton />
          </div>
        </div>

        <nav className="grid grid-cols-3 gap-2 pb-1 md:flex md:flex-wrap md:gap-2">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="pill-nav min-w-0 justify-center whitespace-nowrap text-center md:justify-start" data-active={isActive(link.href, link.label) ? 'true' : 'false'}>
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
