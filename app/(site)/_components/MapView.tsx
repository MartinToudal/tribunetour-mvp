'use client';

import React, { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import stadiumSeed from '../../../data/stadiums.json';
import { useVisitedModel } from '../_hooks/useVisitedModel';

const MapContainer = dynamic(() => import('react-leaflet').then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then((m) => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then((m) => m.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then((m) => m.Popup), { ssr: false });

type Stadium = {
    id: string;
    name: string;
    team: string;
    league: string;
    city: string;
    lat?: number | null;
    lon?: number | null;
};

export default function MapView() {
    const [stadiums, setStadiums] = useState<Stadium[]>([]);
    const [onlyUnvisited, setOnlyUnvisited] = useState(false);
    const [icon, setIcon] = useState<any>(null);
    const { hasSupabaseEnv, isLoggedIn, isLoadingVisits, visited } = useVisitedModel();

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
        setStadiums(stadiumSeed as Stadium[]);
    }, []);

    const points = useMemo(
        () =>
            stadiums
                .filter((stadium) => stadium.lat && stadium.lon)
                .filter((stadium) => (onlyUnvisited ? !visited[stadium.id] : true)),
        [stadiums, visited, onlyUnvisited]
    );

    const highlighted = useMemo(() => points.slice(0, 6), [points]);
    const center = useMemo<[number, number]>(() => [56.0, 10.0], []);

    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    const tileUrl = mapboxToken
        ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${mapboxToken}`
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    const tileAttribution = mapboxToken ? '© Mapbox © OpenStreetMap' : '© OpenStreetMap contributors';

    return (
        <div className="grid gap-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h3 className="text-lg font-semibold">Stadions på kort</h3>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                        Brug kortet som indgang til stadioner, du vil udforske eller markere som besøgt.
                    </p>
                </div>
                <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={onlyUnvisited} onChange={(e) => setOnlyUnvisited(e.target.checked)} />
                    Vis kun ubesøgte
                </label>
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

            {hasSupabaseEnv && isLoggedIn && isLoadingVisits && (
                <div className="text-sm text-[var(--muted)]">
                    Henter din besøgsstatus…
                </div>
            )}

            <div className="h-[70vh] w-full overflow-hidden rounded-2xl border border-neutral-800">
                <MapContainer center={center} zoom={7} style={{ height: '100%', width: '100%' }}>
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
            )}
        </div>
    );
}
