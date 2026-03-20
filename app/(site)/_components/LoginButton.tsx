'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { hasSupabaseEnv, supabase } from '../_lib/supabaseClient';

function isValidEmail(email: string) {
  return /\S+@\S+\.\S+/.test(email);
}

export default function LoginButton() {
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserEmail(session?.user?.email ?? null);
      if (session?.user?.email) {
        setMenuOpen(false);
        setEmailSent(null);
        setEmail('');
      }
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const helperText = useMemo(() => {
    if (emailSent) return `Magic link sendt til ${emailSent}. Tjek inbox og spam.`;
    return 'Log ind med e-mail for at gemme din personlige visited-status og fortsætte på tværs af Tribunetour senere.';
  }, [emailSent]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    if (!isValidEmail(email)) {
      setErrorMessage('Indtast en gyldig e-mailadresse.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    setLoading(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setEmailSent(email);
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
          className="rounded-full border border-[rgba(184,255,106,0.28)] bg-[rgba(184,255,106,0.1)] px-4 py-2 text-sm font-medium text-white"
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
      <button type="button" onClick={() => setMenuOpen((v) => !v)} className="cta-primary">
        {loading ? 'Sender link…' : 'Log ind'}
      </button>

      {menuOpen && (
        <div className="absolute right-0 top-[calc(100%+12px)] w-[min(92vw,22rem)] rounded-[28px] border border-white/10 bg-[var(--surface-strong)] p-5 shadow-2xl">
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
            <button type="submit" disabled={loading} className="cta-primary w-full">
              {loading ? 'Sender magic link…' : 'Send magic link'}
            </button>
          </form>

          <p className="mt-3 text-xs leading-5 text-[var(--muted)]">{helperText}</p>
          {errorMessage && <p className="mt-2 text-xs text-rose-300">{errorMessage}</p>}
        </div>
      )}
    </div>
  );
}
