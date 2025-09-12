'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/app/(site)/_lib/supabaseClient';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.exchangeCodeForSession()
      .then(() => router.replace('/'))
      .catch(() => router.replace('/'));
  }, [router]);

  return (
    <div className="min-h-screen grid place-items-center">
      <div className="text-neutral-300">Logger ind…</div>
    </div>
  );
}
