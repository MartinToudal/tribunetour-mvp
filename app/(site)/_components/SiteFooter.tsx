export default function SiteFooter() {
    return (
        <footer className="mx-auto max-w-6xl px-4 py-10 text-sm text-neutral-400">
            © {new Date().getFullYear()} Tribunetour ·{' '}
            <a className="hover:text-white" href="/support">
                Support
            </a>{' '}
            ·{' '}
            <a className="hover:text-white" href="/privacy">
                Privatliv
            </a>
        </footer>
    );
}
