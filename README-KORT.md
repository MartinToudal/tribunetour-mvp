# TribuneTour: Kortmodul (Leaflet + react-leaflet)

Dette patch tilføjer en /map-side der viser alle stadions med lat/lon på et Leaflet-kort.
- Farvekode sker i popup-teksten (besøgt/ubesøgt).
- Toggle for "Vis kun ubesøgte".
- Tile source: OpenStreetMap (default) eller Mapbox hvis du sætter NEXT_PUBLIC_MAPBOX_TOKEN.

## Filer i denne pakke
- package.json (tilføjer dependencies: leaflet, react-leaflet)
- app/layout.tsx (importerer Leaflet CSS globalt)
- app/(site)/_components/MapView.tsx (selve kortkomponenten)
- app/map/page.tsx (route til kortet)

## Sådan installerer du
1. Upload alle filer til GitHub (overskriv `package.json` og `app/layout.tsx`, og tilføj de nye filer).
2. Commit → Vercel kører build (det installerer leaflet/react-leaflet).
3. Besøg https://tribunetour.dk/map

## (Valgfrit) Brug Mapbox-stil i stedet for OSM
- Sæt ENV var i Vercel: NEXT_PUBLIC_MAPBOX_TOKEN
- Kortet vil automatisk skifte til Mapbox tiles.

## Husk lat/lon i `stadiums`
Eksempel (kør i Supabase SQL Editor):
```
update public.stadiums set lat=55.6488, lon=12.4187 where id='bif';  -- Brøndby
update public.stadiums set lat=55.7026, lon=12.5726 where id='fck';  -- Parken
update public.stadiums set lat=56.1325, lon=8.9799 where id='fcm';   -- Herning
```
