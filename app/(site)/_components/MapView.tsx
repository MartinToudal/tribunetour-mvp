'use client';
import React, { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import L from 'leaflet';
import { supabase } from '../_lib/supabaseClient';

// Dynamisk import så Leaflet kun loader i browseren
const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(m => m.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(m => m.Popup), { ssr: false });

type Stadium = {
  id: string; name: string; team: string; league: string; city: string;
  lat?: number | null; lon?: number | null;
};

// Default Leaflet-ikon (bundlers mister ofte standard-paths, så vi sætter dem manuelt)
const defaultIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

export default function MapView() {
  const [stadiums, setStadiums] = useState<Stadium[]>([]);
  const [visited, setVisited] = useState<Record<string, boolean>>({});
  const [userId, setUserId] = useState<string|null>(null);
  const [onlyUnvisited, setOnlyUnvisited] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    supabase.from('stadiums').select('*').then(({ data }) => setStadiums(data ?? []));
  }, []);

  useEffect(() => {
    if (!userId) return;
    supabase.from('visits').select('stadium_id').then(({ data }) => {
      const m: Record<string, boolean> = {};
      data?.forEach((r:any)=> m[r.stadium_id] = true);
      setVisited(m);
    });
  }, [userId]);

  const points = useMemo(() => stadiums.filter(s => s.lat && s.lon).filter(s => onlyUnvisited ? !visited[s.id] : true), [stadiums, visited, onlyUnvisited]);

  const center = useMemo<[number, number]>(() => {
    // Midt i DK ish
    return [56.0, 10.0];
  }, []);

  // Mapbox tile URL hvis token er sat; ellers OSM
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const tileUrl = mapboxToken
    ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${mapboxToken}`
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  const tileAttribution = mapboxToken
    ? '© Mapbox © OpenStreetMap'
    : '© OpenStreetMap contributors';

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Stadions på kort</h3>
        <label className="text-sm flex items-center gap-2">
          <input type="checkbox" checked={onlyUnvisited} onChange={(e)=>setOnlyUnvisited(e.target.checked)} />
          Vis kun ubesøgte
        </label>
      </div>

      <div className="h-[70vh] w-full overflow-hidden rounded-2xl border border-neutral-800">
        <MapContainer center={center} zoom={7} style={{ height: '100%', width: '100%' }}>
          <TileLayer url={tileUrl} attribution={tileAttribution} />
          {points.map((s) => (
            <Marker key={s.id} position={[s.lat as number, s.lon as number]} icon={defaultIcon}>
              <Popup>
                <div className="text-sm">
                  <div className="font-medium">{s.name}</div>
                  <div className="text-neutral-500">{s.team} · {s.league} · {s.city}</div>
                  <div className="mt-2">
                    {visited[s.id]
                      ? <span className="text-green-400">Allerede besøgt ✔</span>
                      : <span className="text-yellow-300">Endnu ikke besøgt</span>}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {!points.length && (
        <div className="text-sm text-neutral-400">
          Ingen punkter at vise endnu. Sørg for at dine <code>stadiums</code> har <b>lat</b> og <b>lon</b> felter udfyldt.
        </div>
      )}
    </div>
  );
}
