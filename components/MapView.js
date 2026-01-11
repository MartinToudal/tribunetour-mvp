"use client";
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { useEffect, useState } from 'react';
import L from 'leaflet';
import stadiums from '../data/stadiums.json';
import { getVisited, toggleVisited } from '../lib/visited';

const defaultIcon = new L.Icon({ iconUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png', shadowUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png' });
const greenIcon = new L.Icon({ iconUrl: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png' });

export default function MapView({ filter }) {
  const [visited, setVisited] = useState([]);

  useEffect(() => {
    setVisited(getVisited());
  }, []);

  const handleToggle = (id) => {
    const updated = toggleVisited(id);
    setVisited(updated);
  };

  const filteredStadiums = stadiums.filter((s) => {
    if (filter === 'all') return true;
    if (filter === 'visited') return visited.includes(s.id);
    if (filter === 'unvisited') return !visited.includes(s.id);
  });

  return (
    <MapContainer center={[56.2, 10.2]} zoom={7} className="h-[80vh] w-full">
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {filteredStadiums.map((stadium) => (
        <Marker
          key={stadium.id}
          position={[stadium.lat, stadium.lon]}
          icon={visited.includes(stadium.id) ? greenIcon : defaultIcon}
        >
          <Popup>
            <div className="text-sm">
              <strong>{stadium.name}</strong><br />
              {stadium.team}<br />
              <button
                className="mt-2 text-blue-600 underline"
                onClick={() => handleToggle(stadium.id)}
              >
                {visited.includes(stadium.id) ? 'Fjern som besøgt' : 'Markér som besøgt'}
              </button>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}