export default function SiteFooter() {
  return (
    <footer className="mx-auto mt-6 flex max-w-6xl flex-col gap-3 px-4 pb-10 pt-2 text-sm text-[var(--muted)] md:flex-row md:items-center md:justify-between">
      <div>© {new Date().getFullYear()} Tribunetour · Fodbold, stadions og rejser samlet i ét produktspor.</div>
      <div className="flex items-center gap-4">
        <a className="hover:text-white" href="/support">Support</a>
        <a className="hover:text-white" href="/privacy">Privatliv</a>
      </div>
    </footer>
  );
}
