'use client';

import { useEffect, useMemo, useState } from 'react';

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
  const [showManualOpen, setShowManualOpen] = useState(false);
  const target = useMemo(() => {
    if (typeof window === 'undefined') return appCallbackBase;
    return buildAppRedirectUrl();
  }, []);

  useEffect(() => {
    const attemptOpen = () => {
      window.location.href = target;
    };

    attemptOpen();
    const retryTimer = window.setTimeout(attemptOpen, 600);
    const manualTimer = window.setTimeout(() => setShowManualOpen(true), 1200);

    return () => {
      window.clearTimeout(retryTimer);
      window.clearTimeout(manualTimer);
    };
  }, [target]);

  return (
    <div className="min-h-screen grid place-items-center bg-[#0f1511] px-6 text-center text-neutral-200">
      <div className="max-w-sm space-y-4">
        <div className="text-lg font-semibold">Sender dig tilbage til appen…</div>
        <p className="text-sm text-neutral-400">
          Hvis appen ikke åbner automatisk, så brug knappen herunder.
        </p>
        {showManualOpen && (
          <a
            href={target}
            className="inline-flex min-w-44 items-center justify-center rounded-full border border-white/10 bg-white px-5 py-3 text-sm font-medium text-black"
          >
            Åbn appen
          </a>
        )}
      </div>
    </div>
  );
}
