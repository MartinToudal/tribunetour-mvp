'use client';
import { useState } from 'react';
import MapView from '../components/MapView';

export default function HomePage() {
  const [filter, setFilter] = useState('all');

  return (
    <main className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Tribunetour Kort</h1>

      <div className="flex gap-2 mb-4">
        <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => setFilter('all')}>Alle</button>
        <button className="px-3 py-1 bg-green-200 rounded" onClick={() => setFilter('visited')}>Besøgte</button>
        <button className="px-3 py-1 bg-red-200 rounded" onClick={() => setFilter('unvisited')}>Ikke besøgte</button>
      </div>

      <MapView filter={filter} />
    </main>
  );
}