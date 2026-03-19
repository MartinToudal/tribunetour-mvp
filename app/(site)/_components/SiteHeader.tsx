'use client';

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
  const pageKey = title.toLowerCase();

  function isActive(href: string, label: string) {
    if (href === '/') return pageKey === 'tribunetour';
    return pageKey.includes(label.toLowerCase());
  }

  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-[rgba(10,15,13,0.82)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 md:py-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <a href="/" className="flex min-w-0 items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[18px] border border-white/10 bg-white/5 text-sm font-black tracking-[0.22em] text-[var(--accent)]">
              TT
            </div>
            <div className="min-w-0">
              <div className="truncate text-xl font-semibold tracking-tight md:text-2xl">{title}</div>
              <div className="truncate text-sm text-[var(--muted)]">Find kampe, udforsk stadions og hold styr på dine besøg</div>
            </div>
          </a>

          <div className="flex items-center gap-3 self-start md:self-auto">
            <LoginButton />
          </div>
        </div>

        <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="pill-nav whitespace-nowrap" data-active={isActive(link.href, link.label) ? 'true' : 'false'}>
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
