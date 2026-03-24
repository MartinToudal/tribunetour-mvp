'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { hasSupabaseEnv, supabase } from '../_lib/supabaseClient';

function isValidEmail(email: string) {
  return /\S+@\S+\.\S+/.test(email);
}

export default function LoginButton() {
  const [loading, setLoading] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserEmail(session?.user?.email ?? null);
      if (session?.user?.email) {
        setMenuOpen(false);
        setInfoMessage(null);
        setEmail('');
        setPassword('');
      }
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const helperText = useMemo(() => {
    if (infoMessage) return infoMessage;
    return 'Log ind med e-mail og adgangskode. Har du tidligere brugt magic link, så vælg at sætte eller nulstille adgangskoden først.';
  }, [infoMessage]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    if (!isValidEmail(email)) {
      setErrorMessage('Indtast en gyldig e-mailadresse.');
      return;
    }
    if (password.length < 8) {
      setErrorMessage('Adgangskoden skal være mindst 8 tegn.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setInfoMessage(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setInfoMessage('Du er nu logget ind.');
  }

  async function handleSignUp() {
    if (!supabase) return;
    if (!isValidEmail(email)) {
      setErrorMessage('Indtast en gyldig e-mailadresse.');
      return;
    }
    if (password.length < 8) {
      setErrorMessage('Adgangskoden skal være mindst 8 tegn.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setInfoMessage(null);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    setLoading(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }

    if (data.session) {
      setInfoMessage('Konto oprettet og logget ind.');
      return;
    }

    setInfoMessage('Konto oprettet. Bekræft din e-mail, hvis Supabase kræver det, og log derefter ind.');
  }

  async function handlePasswordReset() {
    if (!supabase) return;
    if (!isValidEmail(email)) {
      setErrorMessage('Indtast en gyldig e-mailadresse.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setInfoMessage(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    setLoading(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setInfoMessage(`Vi har sendt et link til ${email}, hvor du kan sætte eller nulstille adgangskoden.`);
  }

  async function handleLogout() {
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  if (!hasSupabaseEnv) {
    return (
      <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-[var(--muted)]">
        Login klargøres
      </span>
    );
  }

  if (userEmail) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="max-w-[13rem] truncate rounded-full border border-[rgba(184,255,106,0.28)] bg-[rgba(184,255,106,0.1)] px-4 py-2 text-sm font-medium text-white sm:max-w-none"
        >
          {userEmail}
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-[calc(100%+12px)] w-72 rounded-[24px] border border-white/10 bg-[var(--surface-strong)] p-4 shadow-2xl">
            <p className="text-sm text-[var(--muted)]">Logget ind som</p>
            <p className="mt-1 break-all text-sm font-medium text-white">{userEmail}</p>
            <button type="button" onClick={handleLogout} className="cta-secondary mt-4 w-full">
              Log ud
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => setMenuOpen((v) => !v)} className="cta-primary px-4 py-2.5 text-sm sm:px-5 sm:py-3">
        {loading ? 'Sender link…' : 'Log ind'}
      </button>

      {menuOpen && (
        <div className="absolute right-0 top-[calc(100%+12px)] z-40 w-[min(92vw,22rem)] rounded-[28px] border border-white/10 bg-[var(--surface-strong)] p-4 shadow-2xl sm:p-5">
          <div className="mb-4">
            <div className="text-lg font-semibold">Få din egen Tribunetour</div>
            <p className="mt-1 text-sm text-[var(--muted)]">Gem din personlige visited-status, hold styr på dine stadionbesøg og byg videre på samme Tribunetour senere.</p>
          </div>

          <form className="grid gap-3" onSubmit={handleLogin}>
            <input
              type="email"
              className="field-input"
              placeholder="din@email.dk"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              type="password"
              className="field-input"
              placeholder="Adgangskode"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="submit" disabled={loading} className="cta-primary w-full">
              {loading ? 'Logger ind…' : 'Log ind'}
            </button>
            <button type="button" disabled={loading} onClick={handleSignUp} className="cta-secondary w-full">
              Opret konto
            </button>
            <button type="button" disabled={loading} onClick={handlePasswordReset} className="w-full text-sm text-[var(--accent)] underline-offset-4 hover:underline">
              Sæt eller nulstil adgangskode
            </button>
          </form>

          <p className="mt-3 text-xs leading-5 text-[var(--muted)]">{helperText}</p>
          {errorMessage && <p className="mt-2 text-xs text-rose-300">{errorMessage}</p>}
        </div>
      )}
    </div>
  );
}
