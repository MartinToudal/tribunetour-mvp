'use client';

import React, { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useLeaguePackAccessModel } from '../_hooks/useLeaguePackAccessModel';
import { countryLabel, filterStadiumsForLeaguePackAccess } from '../_lib/leaguePacks';
import { compareCountryCodes } from '../_lib/leaguePackCatalog';
import { getSeedStadiums, type Stadium } from '../_lib/referenceData';
import { useVisitedModel } from '../_hooks/useVisitedModel';

const MapContainer = dynamic(() => import('react-leaflet').then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then((m) => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then((m) => m.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then((m) => m.Popup), { ssr: false });
const homeCountryStorageKey = 'app.preferredHomeCountryCode';
export default function MapView() {
    const [stadiums, setStadiums] = useState<Stadium[]>([]);
    const [countryFilter, setCountryFilter] = useState<string>('dk');
    const [preferredHomeCountryCode, setPreferredHomeCountryCode] = useState('dk');
    const [onlyUnvisited, setOnlyUnvisited] = useState(false);
    const [icon, setIcon] = useState<any>(null);
    const { hasSupabaseEnv, isLoggedIn, isLoadingVisits, visited } = useVisitedModel();
    const { enabledPackIds, isLoadingLeaguePackAccess, leaguePackAccessError } = useLeaguePackAccessModel();

    useEffect(() => {
        (async () => {
            const L = await import('leaflet');
            const defaultIcon = new L.Icon({
                iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
                iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
                shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41],
            });
            setIcon(defaultIcon as any);
        })();
    }, []);

    useEffect(() => {
        setStadiums(getSeedStadiums() as Stadium[]);
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const storedHomeCountryCode = window.localStorage.getItem(homeCountryStorageKey)?.trim().toLowerCase();
        if (storedHomeCountryCode) {
            setPreferredHomeCountryCode(storedHomeCountryCode);
            setCountryFilter(storedHomeCountryCode);
        }
    }, []);

    const visibleStadiums = useMemo(
        () => filterStadiumsForLeaguePackAccess(stadiums, enabledPackIds),
        [stadiums, enabledPackIds]
    );
    const hiddenLeaguePackStadiumCount = stadiums.length - visibleStadiums.length;
    const hasMultipleCountries = useMemo(() => new Set(visibleStadiums.map((stadium) => stadium.countryCode ?? 'dk')).size > 1, [visibleStadiums]);
    const countries = useMemo(
        () => ['Alle', ...Array.from(new Set(visibleStadiums.map((stadium) => stadium.countryCode ?? 'dk'))).sort(compareCountryCodes)],
        [visibleStadiums]
    );
    const resolvedDefaultCountry = useMemo(() => {
        if (countries.includes(preferredHomeCountryCode)) {
            return preferredHomeCountryCode;
        }
        if (countries.includes('dk')) {
            return 'dk';
        }
        return countries[0] ?? 'Alle';
    }, [countries, preferredHomeCountryCode]);

    const points = useMemo(
        () =>
            visibleStadiums
                .filter((stadium) => stadium.lat && stadium.lon)
                .filter((stadium) => countryFilter === 'Alle' || (stadium.countryCode ?? 'dk') === countryFilter)
                .filter((stadium) => (onlyUnvisited ? !visited[stadium.id] : true)),
        [visibleStadiums, visited, countryFilter, onlyUnvisited]
    );

    useEffect(() => {
        if (!countries.includes(countryFilter)) {
            setCountryFilter(resolvedDefaultCountry);
        }
    }, [countries, countryFilter, resolvedDefaultCountry]);

    const center = useMemo<[number, number]>(() => {
        if (countryFilter === 'it') {
            return [42.8, 12.5];
        }

        if (countryFilter === 'es') {
            return [40.2, -3.7];
        }

        if (countryFilter === 'fr') {
            return [46.5, 2.2];
        }

        if (countryFilter === 'de') {
            return [51.2, 10.4];
        }

        if (countryFilter === 'en') {
            return [53.6, -1.7];
        }

        return [56.0, 10.0];
    }, [countryFilter]);
    const zoom = countryFilter === 'de' || countryFilter === 'en' || countryFilter === 'it' || countryFilter === 'es' || countryFilter === 'fr' ? 6 : 7;

    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    const tileUrl = mapboxToken
        ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${mapboxToken}`
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    const tileAttribution = mapboxToken ? '© Mapbox © OpenStreetMap' : '© OpenStreetMap contributors';
    const currentScopeLabel = countryFilter === 'Alle' ? 'Alle aktive lande' : countryLabel(countryFilter);
    const unvisitedCount = points.filter((stadium) => !visited[stadium.id]).length;
    const highlighted = useMemo(() => {
        const ranked = [...points].sort((left, right) => {
            const leftVisited = Boolean(visited[left.id]);
            const rightVisited = Boolean(visited[right.id]);
            if (leftVisited !== rightVisited) {
                return Number(leftVisited) - Number(rightVisited);
            }
            return left.team.localeCompare(right.team, 'da');
        });
        return ranked.slice(0, 6);
    }, [points, visited]);
    const highlightedTitle = onlyUnvisited ? 'Ubesøgte i visningen' : 'Relevante stadions i visningen';

    return (
        <div className="grid gap-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h3 className="text-lg font-semibold">Stadions på kort</h3>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                        Brug kortet som indgang til de stadions, der er relevante i dit aktuelle scope lige nu.
                    </p>
                </div>
                <div className="flex flex-col gap-3 md:items-end">
                    {countries.length > 2 && (
                        <div className="flex flex-wrap justify-start gap-2 md:justify-end">
                            {countries.map((countryCode) => (
                                <button
                                    key={countryCode}
                                    type="button"
                                    onClick={() => setCountryFilter(countryCode)}
                                    className="pill-nav justify-center text-center"
                                    data-active={countryFilter === countryCode ? 'true' : 'false'}
                                >
                                    {countryCode === 'Alle' ? 'Alle' : countryLabel(countryCode)}
                                </button>
                            ))}
                        </div>
                    )}
                    <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={onlyUnvisited} onChange={(e) => setOnlyUnvisited(e.target.checked)} />
                        Vis kun ubesøgte
                    </label>
                </div>
            </div>

            <div className="flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                <span className="rounded-full bg-white/5 px-3 py-1">
                    Scope: {currentScopeLabel}
                </span>
                <span className="rounded-full bg-white/5 px-3 py-1">
                    Stadions i visningen: {points.length}
                </span>
                <span className="rounded-full bg-white/5 px-3 py-1">
                    Ubesøgte: {unvisitedCount}
                </span>
            </div>

            {!hasSupabaseEnv && (
                <div className="text-sm text-[var(--muted)]">
                    Kortet viser stadions allerede nu. Personlig besøgsstatus kommer senere på web.
                </div>
            )}

            {hasSupabaseEnv && !isLoggedIn && (
                <div className="text-sm text-[var(--muted)]">
                    Log ind for at bruge din besøgsstatus som filter på kortet og resten af Tribunetour.
                </div>
            )}

            {hiddenLeaguePackStadiumCount > 0 && !isLoggedIn && (
                <div className="text-sm text-[var(--muted)]">
                    Premium-stadions vises på kortet, når du er logget ind og har adgang til de relevante landepakker.
                </div>
            )}

            {hasSupabaseEnv && isLoggedIn && isLoadingLeaguePackAccess && (
                <div className="text-sm text-[var(--muted)]">
                    Henter din adgang til league packs…
                </div>
            )}

            {hasSupabaseEnv && isLoggedIn && leaguePackAccessError && (
                <div className="text-sm text-[var(--muted)]">
                    {leaguePackAccessError}
                </div>
            )}

            {hasSupabaseEnv && isLoggedIn && isLoadingVisits && (
                <div className="text-sm text-[var(--muted)]">
                    Henter din besøgsstatus…
                </div>
            )}

            <div className="h-[70vh] w-full overflow-hidden rounded-2xl border border-neutral-800">
                <MapContainer key={countryFilter} center={center} zoom={zoom} style={{ height: '100%', width: '100%' }}>
                    <TileLayer url={tileUrl} attribution={tileAttribution} />
                    {points.map((stadium) => (
                        <Marker key={stadium.id} position={[stadium.lat as number, stadium.lon as number]} icon={icon || undefined}>
                            <Popup>
                                <div className="text-sm">
                                    <div className="font-medium">{stadium.name}</div>
                                    <div className="text-neutral-500">
                                        {stadium.team} · {stadium.league} · {stadium.city}
                                    </div>
                                    <div className="mt-2">
                                        {visited[stadium.id] ? (
                                            <span className="text-green-400">Allerede besøgt ✔</span>
                                        ) : (
                                            <span className="text-yellow-300">Endnu ikke besøgt</span>
                                        )}
                                    </div>
                                    <div className="mt-3">
                                        <a href={`/stadiums/${stadium.id}`} className="text-[var(--accent)] underline underline-offset-2">
                                            Se stadion
                                        </a>
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    ))}
                </MapContainer>
            </div>

            {!points.length && (
                <div className="text-sm text-[var(--muted)]">
                    Ingen stadioner matcher visningen på kortet lige nu.
                </div>
            )}

            {!!highlighted.length && (
                <div className="grid gap-3">
                    <div>
                        <h4 className="text-base font-semibold text-white">{highlightedTitle}</h4>
                        <p className="mt-1 text-sm text-[var(--muted)]">
                            Her er de mest oplagte stadions at åbne videre fra i den aktuelle kortvisning.
                        </p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {highlighted.map((stadium) => {
                            const isVisited = Boolean(visited[stadium.id]);
                            return (
                                <a key={stadium.id} href={`/stadiums/${stadium.id}`} className="site-card-soft p-4 transition hover:border-[var(--line-strong)]">
                                    <div className="text-sm font-medium text-white">{stadium.name}</div>
                                    <div className="mt-1 text-sm text-[var(--muted)]">
                                        {stadium.team} · {stadium.league}
                                    </div>
                                    <div
                                        className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                                            isVisited ? 'bg-[rgba(184,255,106,0.12)] text-[var(--accent)]' : 'bg-white/5 text-[var(--muted)]'
                                        }`}
                                    >
                                        {isVisited ? 'Besøgt' : 'Ikke besøgt'}
                                    </div>
                                </a>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
