'use client';
import React, { useEffect, useState } from 'react';
import { supabase } from '../_lib/supabaseClient';

export default function LoginButton() {
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserEmail(session?.user?.email ?? null);
    });
    return () => { sub.subscription.unsubscribe(); };
  }, []);

  async function handleLogin() {
    const email = window.prompt('Indtast din e-mail for login (magic link):');
    if (!email) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(false);
    if (error) alert('Kunne ikke sende login-link: ' + error.message);
    else setEmailSent(email);
  }

  async function handleLogout() { await supabase.auth.signOut(); }

  if (userEmail) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-neutral-400 hidden sm:inline">Logget ind som {userEmail}</span>
        <button onClick={handleLogout} className="rounded-xl border border-neutral-700 px-3 py-2 text-sm">Log ud</button>
      </div>
    );
  }
  return (
    <>
      <button onClick={handleLogin} className="rounded-xl bg-white/10 px-3 py-2 text-sm hover:bg-white/20" disabled={loading}>
        {loading ? 'Sender link…' : 'Log ind'}
      </button>
      {emailSent && <div className="text-xs text-neutral-400 ml-2">Jeg har sendt et link til <b>{emailSent}</b>. Tjek din inbox/spam.</div>}
    </>
  );
}