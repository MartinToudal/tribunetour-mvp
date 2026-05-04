'use client';

import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import SiteShell from '../../(site)/_components/SiteShell';
import { hasSupabaseEnv, supabase } from '../../(site)/_lib/supabaseClient';
import { requestableLeaguePackCatalog, type RequestableLeaguePackId as PackKey } from '../../(site)/_lib/leaguePackCatalog';

type PremiumAccessRow = {
  email: string;
  user_id: string;
  pack_key: PackKey;
  enabled: boolean;
  updated_at: string;
};

type PremiumAccessRequestRow = {
  request_id: string;
  email: string;
  user_id: string;
  pack_key: PackKey;
  status: 'open' | 'handled' | 'dismissed';
  message: string | null;
  created_at: string;
  updated_at: string;
};

const packOptions: Array<{ key: PackKey; label: string; description: string }> = requestableLeaguePackCatalog.map((entry) => ({
  key: entry.id,
  label: entry.label,
  description: entry.requestDescription ?? entry.label,
}));

function packLabel(packKey: string) {
  return packOptions.find((option) => option.key === packKey)?.label ?? packKey;
}

function errorText(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('not_authorized')) {
    return 'Du har ikke admin-adgang til premium.';
  }
  if (message.includes('user_not_found')) {
    return 'Brugeren findes ikke. Tjek email-adressen.';
  }
  if (message.includes('invalid_pack_key')) {
    return 'Den valgte pakke er ikke gyldig.';
  }
  return message;
}

export default function PremiumAdminPage() {
  const [email, setEmail] = useState('');
  const [packKey, setPackKey] = useState<PackKey>('england_top_4');
  const [accessRows, setAccessRows] = useState<PremiumAccessRow[]>([]);
  const [requestRows, setRequestRows] = useState<PremiumAccessRequestRow[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enabledRows = useMemo(
    () => accessRows.filter((row) => row.enabled),
    [accessRows]
  );
  const openRequestRows = useMemo(
    () => requestRows.filter((row) => row.status === 'open'),
    [requestRows]
  );
  const handledRequestRows = useMemo(
    () => requestRows.filter((row) => row.status !== 'open'),
    [requestRows]
  );

  async function loadAdminState() {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data: userData } = await supabase.auth.getUser();
      setUserEmail(userData.user?.email ?? null);

      if (!userData.user) {
        setIsAdmin(false);
        setAccessRows([]);
        setRequestRows([]);
        return;
      }

      const { data: adminData, error: adminError } = await supabase.rpc('is_current_user_admin');
      if (adminError) {
        throw adminError;
      }

      const nextIsAdmin = Boolean(adminData);
      setIsAdmin(nextIsAdmin);

      if (!nextIsAdmin) {
        setAccessRows([]);
        setRequestRows([]);
        return;
      }

      const { data, error: listError } = await supabase.rpc('list_premium_access');
      if (listError) {
        throw listError;
      }

      setAccessRows((data as PremiumAccessRow[] | null) ?? []);

      const { data: requestsData, error: requestsError } = await supabase.rpc('list_premium_access_requests');
      if (requestsError) {
        throw requestsError;
      }

      setRequestRows((requestsData as PremiumAccessRequestRow[] | null) ?? []);
    } catch (caught) {
      setError(errorText(caught));
      setAccessRows([]);
      setRequestRows([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadAdminState();

    if (!supabase) {
      return;
    }

    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      loadAdminState();
    });

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, []);

  async function submitAccessChange(action: 'grant' | 'revoke') {
    if (!supabase || !email.trim()) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const functionName = action === 'grant'
        ? 'grant_league_pack_access_by_email'
        : 'revoke_league_pack_access_by_email';

      const { data, error: actionError } = await supabase.rpc(functionName, {
        target_email: email.trim(),
        target_pack_key: packKey,
      });

      if (actionError) {
        throw actionError;
      }

      const row = ((data as PremiumAccessRow[] | null) ?? [])[0];
      setMessage(
        action === 'grant'
          ? `${row?.email ?? email.trim()} har nu adgang til ${packLabel(packKey)}.`
          : `${row?.email ?? email.trim()} har ikke længere aktiv adgang til ${packLabel(packKey)}.`
      );
      await loadAdminState();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function approveAccessRequest(row: PremiumAccessRequestRow) {
    if (!supabase) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const { error: approveError } = await supabase.rpc('approve_premium_access_request', {
        target_request_id: row.request_id,
      });

      if (approveError) {
        throw approveError;
      }

      setMessage(`${row.email} har nu adgang til ${packLabel(row.pack_key)}.`);
      await loadAdminState();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitAccessChange('grant');
  }

  return (
    <SiteShell>
      <section className="site-card p-5 md:p-6">
        <div className="label-eyebrow">Admin</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
          Premium-adgang
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)] md:text-base">
          Tildel eller fjern adgang til premium-pakker uden at køre SQL manuelt.
        </p>
      </section>

      {!hasSupabaseEnv && (
        <section className="site-card-soft p-5 md:p-6 text-sm text-[var(--muted)]">
          Supabase er ikke konfigureret for webmiljøet.
        </section>
      )}

      {hasSupabaseEnv && isLoading && (
        <section className="site-card-soft p-5 md:p-6 text-sm text-[var(--muted)]">
          Tjekker admin-adgang…
        </section>
      )}

      {hasSupabaseEnv && !isLoading && !userEmail && (
        <section className="site-card-soft p-5 md:p-6">
          <h2 className="text-xl font-semibold">Log ind først</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Du skal være logget ind med en admin-bruger for at administrere premium-adgang.
          </p>
          <a href="/my" className="cta-primary mt-4 inline-flex">
            Gå til login
          </a>
        </section>
      )}

      {hasSupabaseEnv && !isLoading && userEmail && !isAdmin && (
        <section className="site-card-soft p-5 md:p-6">
          <h2 className="text-xl font-semibold">Ingen admin-adgang</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            {userEmail} er logget ind, men er ikke oprettet som admin.
          </p>
        </section>
      )}

      {hasSupabaseEnv && !isLoading && isAdmin && (
        <>
          <section className="site-card p-5 md:p-6">
            <form className="grid gap-4" onSubmit={handleSubmit}>
              <div>
                <label className="text-sm font-medium text-white" htmlFor="premium-email">
                  Brugerens email
                </label>
                <input
                  id="premium-email"
                  className="field-input mt-2"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="bruger@example.com"
                  autoComplete="email"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium text-white" htmlFor="premium-pack">
                  Premium-pakke
                </label>
                <select
                  id="premium-pack"
                  className="field-input mt-2"
                  value={packKey}
                  onChange={(event) => setPackKey(event.target.value as PackKey)}
                >
                  {packOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  {packOptions.find((option) => option.key === packKey)?.description}
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button type="submit" className="cta-primary justify-center" disabled={isSubmitting}>
                  {isSubmitting ? 'Gemmer…' : 'Tildel adgang'}
                </button>
                <button
                  type="button"
                  className="cta-secondary justify-center disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isSubmitting || !email.trim()}
                  onClick={() => submitAccessChange('revoke')}
                >
                  Fjern adgang
                </button>
              </div>
            </form>

            {message && (
              <div className="mt-4 rounded-2xl border border-[rgba(184,255,106,0.25)] bg-[rgba(184,255,106,0.08)] px-4 py-3 text-sm text-[var(--accent)]">
                {message}
              </div>
            )}

            {error && (
              <div className="mt-4 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}
          </section>

          <section className="site-card overflow-hidden">
            <div className="border-b border-white/5 p-5 md:p-6">
              <h2 className="text-xl font-semibold">Premium-anmodninger</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Godkend en anmodning for automatisk at åbne den ønskede pakke på brugerens konto.
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                {openRequestRows.length} åbne · {handledRequestRows.length} behandlede
              </p>
            </div>

            {!requestRows.length ? (
              <div className="p-5 text-sm text-[var(--muted)] md:p-6">
                Der er ingen premium-anmodninger endnu.
              </div>
            ) : (
              <div>
                <div className="border-b border-white/5 px-5 py-4 md:px-6">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Åbne</h3>
                </div>
                {!openRequestRows.length ? (
                  <div className="p-5 text-sm text-[var(--muted)] md:p-6">
                    Ingen åbne anmodninger lige nu.
                  </div>
                ) : (
                  <ul className="divide-y divide-white/5">
                    {openRequestRows.map((row) => (
                      <li key={row.request_id} className="grid gap-3 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                        <div>
                          <div className="font-medium text-white">{row.email}</div>
                          <div className="mt-1 text-sm text-[var(--muted)]">
                            {packLabel(row.pack_key)} · Åben
                          </div>
                          {row.message && (
                            <div className="mt-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-[var(--muted)]">
                              {row.message}
                            </div>
                          )}
                        </div>
                        <div className="text-sm text-[var(--muted)]">
                          {new Date(row.created_at).toLocaleString('da-DK')}
                          <button
                            type="button"
                            className="cta-secondary mt-3 justify-center disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={isSubmitting}
                            onClick={() => approveAccessRequest(row)}
                          >
                            Godkend
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="border-y border-white/5 px-5 py-4 md:px-6">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Senest behandlede</h3>
                </div>
                {!handledRequestRows.length ? (
                  <div className="p-5 text-sm text-[var(--muted)] md:p-6">
                    Ingen behandlede anmodninger endnu.
                  </div>
                ) : (
                  <ul className="divide-y divide-white/5">
                    {handledRequestRows.slice(0, 10).map((row) => (
                      <li key={row.request_id} className="grid gap-3 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                        <div>
                          <div className="font-medium text-white">{row.email}</div>
                          <div className="mt-1 text-sm text-[var(--muted)]">
                            {packLabel(row.pack_key)} · {row.status === 'handled' ? 'Godkendt' : 'Afvist'}
                          </div>
                          {row.message && (
                            <div className="mt-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-[var(--muted)]">
                              {row.message}
                            </div>
                          )}
                        </div>
                        <div className="text-sm text-[var(--muted)]">
                          {new Date(row.updated_at).toLocaleString('da-DK')}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>

          <section className="site-card overflow-hidden">
            <div className="border-b border-white/5 p-5 md:p-6">
              <h2 className="text-xl font-semibold">Aktive premium-adgange</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Viser aktive pakke-adgange for brugere. Deaktiverede rækker ligger stadig i databasen, men vises ikke her.
              </p>
            </div>

            {!enabledRows.length ? (
              <div className="p-5 text-sm text-[var(--muted)] md:p-6">
                Der er ingen aktive premium-adgange endnu.
              </div>
            ) : (
              <ul className="divide-y divide-white/5">
                {enabledRows.map((row) => (
                  <li key={`${row.user_id}-${row.pack_key}`} className="grid gap-2 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                    <div>
                      <div className="font-medium text-white">{row.email}</div>
                      <div className="mt-1 text-sm text-[var(--muted)]">
                        {packLabel(row.pack_key)}
                      </div>
                    </div>
                    <div className="text-sm text-[var(--muted)]">
                      Opdateret {new Date(row.updated_at).toLocaleDateString('da-DK')}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </SiteShell>
  );
}
