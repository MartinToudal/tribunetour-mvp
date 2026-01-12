# TribuneTour MVP — fuld pakke
- Next.js 14 + Tailwind
- Supabase login (Magic Link) + callback
- Stadions hentes fra `public.stadiums`
- "Marker som besøgt" gemmer/sletter i `public.visits` (RLS)

## Forudsætninger i Supabase
Kør SQL (allerede gjort hos dig):
- `stadiums`-tabel m. kolonner: id, name, team, league, city, lat, lon
- `visits`-tabel m. RLS-policies (select/insert/delete own)

## Env vars i Vercel
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY

## Deploy
1) Upload til GitHub (alle filer i denne mappe).
2) Vercel bygger automatisk.
3) Gå til https://tribunetour.dk og test login + marker besøgt.

## Næste trin (forslag)
- /my side med filter (besøgte/ubesøgte)
- Kort (Leaflet + Mapbox)
- Kampprogram (API) + personaliseret visning
- Din egen review-model, når du er klar
