# TribuneTour MVP

En lille Next.js + Tailwind side klar til upload på Vercel.

## Hurtig start (Vercel Upload)
1) Gå til vercel.com → New Project → Import → Upload.
2) Upload denne zip-fil.
3) Build command: (tom, Vercel finder selv `next build`).
4) Når den er deployet, får du en URL som `https://xxxx.vercel.app`.

## Domæne (tribunetour.dk)
- I Vercel: Project → Settings → Domains → add `tribunetour.dk` og `www.tribunetour.dk`.
- Følg DNS-instruktioner hos one.com (A-record + CNAME).

## Lokal udvikling (valgfrit)
1) `npm install`
2) `npm run dev`
3) Åbn http://localhost:3000

## Næste trin
- Tilføj Supabase (Auth + DB).
- Kort (Leaflet + Mapbox).
- Anmeldelsesformular (med JSON-schema validering).
- Kampprogram via fixtures-API.
