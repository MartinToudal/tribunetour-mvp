'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '../../(site)/_lib/supabaseClient';

function isValidPassword(password: string) {
  return password.length >= 8;
}

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const client = supabase;
    if (!client) {
      setErrorMessage('Login er ikke konfigureret endnu.');
      setLoading(false);
      return;
    }

    const resolveSession = async () => {
      try {
        await client.auth.exchangeCodeForSession(window.location.href);
      } catch {}

      const { data } = await client.auth.getSession();
      if (data.session) {
        setReady(true);
        setMessage(data.session.user.email ? `Sætter adgangskode for ${data.session.user.email}.` : null);
      } else {
        setErrorMessage('Linket er ugyldigt eller udløbet. Bed om et nyt nulstillingslink.');
      }
      setLoading(false);
    };

    resolveSession();

    const { data: subscription } = client.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        setReady(Boolean(session));
        setErrorMessage(null);
        setLoading(false);
        setMessage(session?.user?.email ? `Sætter adgangskode for ${session.user.email}.` : null);
      }
    });

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase) return;

    if (!isValidPassword(password)) {
      setErrorMessage('Adgangskoden skal være mindst 8 tegn.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Adgangskoderne matcher ikke.');
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    const { error } = await supabase.auth.updateUser({ password });

    setSaving(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setReady(false);
    setPassword('');
    setConfirmPassword('');
    setMessage('Adgangskoden er gemt. Du kan nu logge ind på både web og i appen.');
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] px-6 py-16 text-white">
      <div className="mx-auto max-w-md rounded-[32px] border border-white/10 bg-[var(--surface-strong)] p-6 shadow-2xl">
        <h1 className="text-2xl font-semibold">Sæt adgangskode</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Brug denne side, hvis du tidligere har brugt magic link og nu vil logge ind med e-mail og adgangskode på både web og i appen.
        </p>

        {loading ? (
          <p className="mt-6 text-sm text-[var(--muted)]">Validerer link…</p>
        ) : ready ? (
          <form className="mt-6 grid gap-3" onSubmit={handleSubmit}>
            <input
              type="password"
              className="field-input"
              placeholder="Ny adgangskode"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <input
              type="password"
              className="field-input"
              placeholder="Gentag adgangskode"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
            <button type="submit" className="cta-primary w-full" disabled={saving}>
              {saving ? 'Gemmer…' : 'Gem adgangskode'}
            </button>
          </form>
        ) : (
          <div className="mt-6 grid gap-3">
            <Link href="/" className="cta-primary text-center">
              Til forsiden
            </Link>
          </div>
        )}

        {message && <p className="mt-4 text-sm text-[var(--muted)]">{message}</p>}
        {errorMessage && <p className="mt-4 text-sm text-rose-300">{errorMessage}</p>}
      </div>
    </main>
  );
}
