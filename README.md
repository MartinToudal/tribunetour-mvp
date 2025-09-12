# TribuneTour MVP + Supabase Login (fixed import)

Denne version retter import-stien i `/app/auth/callback/page.tsx` til en relativ sti.

## Deploy
1. Commit/push til GitHub (hele mappen).
2. Vercel bygger automatisk.

## Env vars i Vercel
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY

## Supabase auth redirect
- Site URL + Redirect URLs som tidligere beskrevet.
