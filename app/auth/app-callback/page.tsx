'use client';

import { useEffect } from 'react';

const appCallbackBase = 'tribunetour://auth-callback';

function buildAppRedirectUrl() {
  const url = new URL(window.location.href);
  const target = new URL(appCallbackBase);

  if (url.search) {
    target.search = url.search;
  }

  if (url.hash) {
    target.hash = url.hash;
  }

  return target.toString();
}

export default function AppAuthCallbackPage() {
  useEffect(() => {
    const target = buildAppRedirectUrl();
    window.location.replace(target);
  }, []);

  return (
    <div className="min-h-screen grid place-items-center bg-[#0f1511] px-6 text-center text-neutral-200">
      <div className="max-w-sm space-y-3">
        <div className="text-lg font-semibold">Sender dig tilbage til appen…</div>
        <p className="text-sm text-neutral-400">
          Hvis appen ikke åbner automatisk, så gå tilbage til Tribunetour og prøv login-linket igen.
        </p>
      </div>
    </div>
  );
}
