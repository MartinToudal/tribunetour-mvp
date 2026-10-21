'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import SiteShell from '../../(site)/_components/SiteShell';
import { CLUB_CHECK_ADMIN_EMAIL, useClubCheckAdminAccess } from '../../(site)/_hooks/useClubCheckAdminAccess';
import {
  listReferenceAdminData,
  type ReferenceAdminData,
  type ReferenceStadium,
  upsertReferenceCountry,
  upsertReferenceLeague,
  upsertReferenceStadium,
} from '../../(site)/_lib/referenceAdminRepository';

const emptyStadium: ReferenceStadium = {
  id: '', team: '', name: '', city: '', league: '', country_code: 'dk', league_code: '', league_pack: '',
  short_code: '', competition_id: '', season_id: '', membership_status: 'active', lat: 0, lon: 0,
};

function errorText(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('not_authorized')) return 'Du har ikke admin-adgang.';
  if (message.includes('country_not_found')) return 'Landet findes ikke endnu. Opret landet først.';
  if (message.includes('stadium_id_required')) return 'Klub-ID er påkrævet og bør være stabilt.';
  if (message.includes('invalid_latitude') || message.includes('invalid_longitude')) return 'Koordinaterne ligger uden for et gyldigt område.';
  return message;
}

export default function ReferenceDataAdminPage() {
  const { isLoading: isAccessLoading, isAdmin, userEmail } = useClubCheckAdminAccess();
  const [data, setData] = useState<ReferenceAdminData | null>(null);
  const [search, setSearch] = useState('');
  const [countryFilter, setCountryFilter] = useState('all');
  const [leagueFilter, setLeagueFilter] = useState('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ReferenceStadium>(emptyStadium);
  const [countryForm, setCountryForm] = useState({ code: '', name: '' });
  const [leagueForm, setLeagueForm] = useState({ code: '', country_code: 'dk', name: '', level: '', season_id: '' });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function reload() {
    setError(null);
    try {
      setData(await listReferenceAdminData());
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  useEffect(() => {
    if (!isAccessLoading && isAdmin && userEmail === CLUB_CHECK_ADMIN_EMAIL) void reload();
  }, [isAccessLoading, isAdmin, userEmail]);

  const visibleStadiums = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data?.stadiums ?? []).filter((stadium) => {
      const matchesSearch = !query || [stadium.id, stadium.team, stadium.name, stadium.city, stadium.league].some((value) => value.toLowerCase().includes(query));
      return matchesSearch && (countryFilter === 'all' || stadium.country_code === countryFilter) && (leagueFilter === 'all' || stadium.league_code === leagueFilter);
    });
  }, [data, search, countryFilter, leagueFilter]);

  function beginEdit(stadium: ReferenceStadium) {
    setEditingId(stadium.id);
    setDraft({ ...stadium });
    setMessage(null);
    setError(null);
  }

  function beginCreate() {
    setEditingId('__new__');
    setDraft({ ...emptyStadium });
    setMessage(null);
    setError(null);
  }

  async function saveStadium(event: FormEvent) {
    event.preventDefault();
    setIsSaving(true); setMessage(null); setError(null);
    try {
      await upsertReferenceStadium(draft);
      await reload();
      setEditingId(null);
      setMessage('Stadion og klub er gemt centralt med ændringslog.');
    } catch (caught) { setError(errorText(caught)); } finally { setIsSaving(false); }
  }

  async function saveCountry(event: FormEvent) {
    event.preventDefault();
    setIsSaving(true); setMessage(null); setError(null);
    try { await upsertReferenceCountry({ ...countryForm, active: true }); setCountryForm({ code: '', name: '' }); await reload(); setMessage('Landet er gemt.'); }
    catch (caught) { setError(errorText(caught)); } finally { setIsSaving(false); }
  }

  async function saveLeague(event: FormEvent) {
    event.preventDefault();
    setIsSaving(true); setMessage(null); setError(null);
    try { await upsertReferenceLeague({ ...leagueForm, level: leagueForm.level ? Number(leagueForm.level) : null, active: true }); setLeagueForm({ code: '', country_code: 'dk', name: '', level: '', season_id: '' }); await reload(); setMessage('Rækken er gemt.'); }
    catch (caught) { setError(errorText(caught)); } finally { setIsSaving(false); }
  }

  if (isAccessLoading) return <SiteShell title="Tribunetour · Dataadmin"><section className="site-card p-5"><p className="section-copy">Kontrollerer adgang...</p></section></SiteShell>;
  if (userEmail !== CLUB_CHECK_ADMIN_EMAIL || !isAdmin) return <SiteShell title="Tribunetour · Dataadmin"><section className="site-card p-5"><div className="label-eyebrow">Privat adminværktøj</div><h1 className="mt-2 text-3xl font-semibold">Ingen adgang</h1><p className="section-copy mt-3">Dataadministration er kun tilgængelig for den godkendte administrator.</p></section></SiteShell>;

  return (
    <SiteShell title="Tribunetour · Dataadmin">
      <section className="site-card p-5 md:p-7">
        <div className="label-eyebrow">Én referencekilde</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Klubber og stadions</h1>
        <p className="section-copy mt-3 max-w-3xl">Redigér klub, stadion, række, land og koordinater samlet. Alle ændringer gemmes centralt og logges, så reference-data ikke skal rettes flere steder.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button className="cta-primary" onClick={beginCreate}>Tilføj klub/stadion</button>
          <button className="cta-secondary" onClick={() => void reload()}>Genindlæs data</button>
        </div>
      </section>

      {(message || error) && <section className={`site-card-soft p-4 text-sm ${error ? 'text-red-300' : 'text-emerald-300'}`}>{error ?? message}</section>}

      {editingId && <section className="site-card p-5 md:p-7">
        <div className="flex items-start justify-between gap-4"><div><div className="label-eyebrow">{editingId === '__new__' ? 'Ny reference' : 'Redigér reference'}</div><h2 className="mt-2 text-2xl font-semibold">Klub og stadion</h2></div><button className="cta-secondary" onClick={() => setEditingId(null)}>Annullér</button></div>
        <form className="mt-5 grid gap-3 md:grid-cols-2" onSubmit={saveStadium}>
          {([['id', 'Stabilt ID'], ['team', 'Klub'], ['name', 'Stadion'], ['city', 'By'], ['league', 'Række'], ['country_code', 'Landekode'], ['league_code', 'Rækkekode'], ['league_pack', 'League pack'], ['short_code', 'Kort klubnavn'], ['competition_id', 'Competition ID'], ['season_id', 'Sæson'], ['membership_status', 'Status'], ['lat', 'Latitude'], ['lon', 'Longitude']] as const).map(([key, label]) => <label className="grid gap-1 text-sm" key={key}><span className="text-[var(--muted)]">{label}</span><input className="field-input" value={String(draft[key])} onChange={(event) => setDraft({ ...draft, [key]: (key === 'lat' || key === 'lon') ? Number(event.target.value) : event.target.value })} required={['id', 'team', 'name', 'league', 'country_code', 'lat', 'lon'].includes(key)} disabled={key === 'id' && editingId !== '__new__'} /></label>)}
          <div className="md:col-span-2"><button className="cta-primary" disabled={isSaving}>{isSaving ? 'Gemmer...' : 'Gem ændringer'}</button></div>
        </form>
      </section>}

      <section className="site-card p-5 md:p-7">
        <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_auto]">
          <input className="field-input" placeholder="Søg klub, stadion, by eller ID" value={search} onChange={(event) => setSearch(event.target.value)} />
          <select className="field-input" value={countryFilter} onChange={(event) => setCountryFilter(event.target.value)}><option value="all">Alle lande</option>{(data?.countries ?? []).map((country) => <option key={country.code} value={country.code}>{country.name} ({country.code})</option>)}</select>
          <select className="field-input" value={leagueFilter} onChange={(event) => setLeagueFilter(event.target.value)}><option value="all">Alle rækker</option>{(data?.leagues ?? []).map((league) => <option key={league.code} value={league.code}>{league.name}</option>)}</select>
          <div className="stat-chip text-sm">{visibleStadiums.length} af {data?.stadiums.length ?? 0}</div>
        </div>
        <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[920px] text-left text-sm"><thead className="text-[var(--muted)]"><tr><th className="px-3 py-2">Klub</th><th className="px-3 py-2">Land</th><th className="px-3 py-2">Række</th><th className="px-3 py-2">Stadion</th><th className="px-3 py-2">Koordinater</th><th className="px-3 py-2" /></tr></thead><tbody>{visibleStadiums.map((stadium) => <tr className="border-t border-white/10" key={stadium.id}><td className="px-3 py-3"><strong>{stadium.team}</strong><div className="text-xs text-[var(--muted)]">{stadium.id}</div></td><td className="px-3 py-3">{stadium.country_code.toUpperCase()}</td><td className="px-3 py-3">{stadium.league}</td><td className="px-3 py-3">{stadium.name}<div className="text-xs text-[var(--muted)]">{stadium.city}</div></td><td className="px-3 py-3">{stadium.lat.toFixed(5)}, {stadium.lon.toFixed(5)}</td><td className="px-3 py-3 text-right"><button className="cta-secondary" onClick={() => beginEdit(stadium)}>Redigér</button></td></tr>)}</tbody></table></div>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        <form className="site-card p-5" onSubmit={saveCountry}><div className="label-eyebrow">Reference</div><h2 className="mt-2 text-xl font-semibold">Tilføj land</h2><div className="mt-4 grid gap-3"><input className="field-input" placeholder="Kode, fx se" value={countryForm.code} onChange={(event) => setCountryForm({ ...countryForm, code: event.target.value })} required /><input className="field-input" placeholder="Navn, fx Sverige" value={countryForm.name} onChange={(event) => setCountryForm({ ...countryForm, name: event.target.value })} required /><button className="cta-primary" disabled={isSaving}>Gem land</button></div></form>
        <form className="site-card p-5" onSubmit={saveLeague}><div className="label-eyebrow">Reference</div><h2 className="mt-2 text-xl font-semibold">Tilføj række</h2><div className="mt-4 grid gap-3"><input className="field-input" placeholder="Rækkekode" value={leagueForm.code} onChange={(event) => setLeagueForm({ ...leagueForm, code: event.target.value })} required /><input className="field-input" placeholder="Navn" value={leagueForm.name} onChange={(event) => setLeagueForm({ ...leagueForm, name: event.target.value })} required /><div className="grid grid-cols-3 gap-3"><input className="field-input" placeholder="Landekode" value={leagueForm.country_code} onChange={(event) => setLeagueForm({ ...leagueForm, country_code: event.target.value })} required /><input className="field-input" placeholder="Niveau" type="number" value={leagueForm.level} onChange={(event) => setLeagueForm({ ...leagueForm, level: event.target.value })} /><input className="field-input" placeholder="Sæson" value={leagueForm.season_id} onChange={(event) => setLeagueForm({ ...leagueForm, season_id: event.target.value })} /></div><button className="cta-primary" disabled={isSaving}>Gem række</button></div></form>
      </section>
    </SiteShell>
  );
}
