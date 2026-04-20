# Tribunetour Web

Webfladen er den anden produktflade i Tribunetour ved siden af iOS-appen.

Den aktuelle retning er:
- Next.js 14 + React 18
- Supabase auth med e-mail + adgangskode
- shared `visited`-model i tabellen `visited`
- fælles reference-data-lag i `app/(site)/_lib/referenceData.ts`
- lokale seed-data som fallback for reference-data

Web er ikke længere kun et marketing- eller MVP-spor.
Det er en reel produktflade for:
- `Stadions`
- `Kampe`
- `Min tur`
- auth og personlig visited-status

## Nuværende arkitektur

### Auth
Web bruger Supabase auth fra klienten.

Nuværende loginflow:
- log ind med e-mail og adgangskode
- opret konto med e-mail og adgangskode
- nulstil adgangskode via e-mail-link

Centrale filer:
- `app/(site)/_lib/supabaseClient.ts`
- `app/(site)/_components/LoginButton.tsx`
- `app/auth/reset-password/page.tsx`

### Visited
Web bruger den fælles `visited`-model.

Det betyder:
- visited-status læses fra tabellen `visited`
- visited-status skrives via upsert på `(user_id, club_id)`
- `visited_date`, `updated_at` og `source` følger med i write-modellen

Centrale filer:
- `app/(site)/_lib/visitedRepository.ts`
- `app/(site)/_hooks/useVisitedModel.ts`

### Reference-data
Web læser reference-data gennem ét fælles lag:
- `app/(site)/_lib/referenceData.ts`

Det lag:
- samler stadium- og fixture-typer
- læser stadiumdata fra Supabase når muligt
- falder tilbage til seed-data når nødvendigt
- leverer seed-baserede detailopslag og static params

Aktuelle datafiler:
- `data/stadiums.json`
- `data/fixtures.json`

Validering:
- `npm run validate:data`

## Forudsætninger

### Env vars
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Forventet Supabase-setup
- `stadiums`-tabel med mindst: `id`, `name`, `team`, `league`, `city`, `lat`, `lon`
- `visited`-tabel med shared visited-model
- auth slået til for e-mail/password-flow
- `user_league_pack_access` til premium-/league-pack adgang

### League pack access
Premium-ligaer og ekstra lande styres via:
- `supabase/user_league_pack_access.sql`

Tabellen bruges til at afgøre hvilke `pack_key`s den enkelte bruger må se.

Eksempel:
- `germany_top_3`
- `england_top_4`
- `italy_top_3`
- `premium_full`

Aktuel retning:
- brugeren ser en pakke hvis de har entitlement til den konkrete `pack_key`
- `premium_full` giver adgang til alle premium-pakker, der er bygget ind i den aktuelle version

Se også:
- `../Tribunetour/Tribunetour_docs/docs/VISITED_BACKEND_CONTRACT.md`
- `../Tribunetour/Tribunetour_docs/docs/REFERENCE_DATA_CONTRACT.md`

## Scripts
- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run validate:data`
- `npm run test:e2e`

## Automatisk regressionstest

Webrepoet har nu en Playwright-baseret regressionstest.

Den er delt i to lag:
- `tests/e2e/smoke.spec.ts`
  - gæste-smoke for `/`, `/matches` og `/my`
- `tests/e2e/auth-regression.spec.ts`
  - login-baseret regression for `visited`, `weekend plan` og note-flow
  - kræver en dedikeret testkonto

### Forudsætninger for auth-regression
- `E2E_EMAIL`
- `E2E_PASSWORD`
- valgfrit: `E2E_STADIUM_ID` (default er `dk-viborg-ff`)
- valgfrit: `E2E_BASE_URL` hvis testen skal køre mod en allerede kørende server

### Anbefalet release-gate
1. Kør `npm run build`
2. Kør `npm run test:e2e`
3. Brug en dedikeret testkonto til auth-regressionen, så testen kan rydde op efter sig selv uden at røre din normale bruger

## Drift lige nu

Web og app er koblet sammen på:
- auth-retning
- begyndende shared `visited`
- fælles reference-data-kontrakt

De er endnu ikke helt færdige som ét konsolideret produkt, fordi:
- reference-data endnu ikke kommer fra én fuld fælles pipeline
- appen stadig bærer overgangslag omkring CloudKit/shared sync
- ikke alle brugerdatafelter er shared endnu

## Næste naturlige spor
- fortsat reference-data-konsolidering
- reduktion af migrationscopy
- tydeligere release- og driftsflow
- afklaring af paritet mellem web og app
