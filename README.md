# TribuneTour MVP + Supabase Login

Indeholder Next.js + Tailwind, Supabase klient, login med e-mail (Magic Link), callback-side.

## Deploy
1. Commit/push til GitHub (hele mappen).
2. Vercel bygger automatisk.

## Env vars i Vercel (Settings → Environment Variables)
- NEXT_PUBLIC_SUPABASE_URL = (Supabase → Settings → General → Project URL)
- NEXT_PUBLIC_SUPABASE_ANON_KEY = (Supabase → Settings → API Keys → anon public)

## Supabase auth redirect
Supabase → Authentication → URL Configuration:
- Site URL: https://tribunetour.dk
- Redirect URLs:
  - https://tribunetour.dk/auth/callback
  - https://www.tribunetour.dk/auth/callback
  - https://YOURPROJECT.vercel.app/auth/callback
  - http://localhost:3000/auth/callback
