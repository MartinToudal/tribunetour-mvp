'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../(site)/_lib/supabaseClient';

export default function AuthCallbackPage() {
  const router = useRouter();
  useEffect(() => {
    const run = async () => {
      try {
        // v2 kræver en URL-argument (eller params). Vi giver hele URL'en.
        await supabase.auth.exchangeCodeForSession(window.location.href);
      } catch {}
      router.replace('/');
    };
    run();
  }, [router]);
  return <div className="min-h-screen grid place-items-center"><div className="text-neutral-300">Logger ind…</div></div>;
}