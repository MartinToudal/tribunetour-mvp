# TribuneTour MVP + Supabase Login (exchangeCodeForSession fix)

- Opdaterer callback til: `await supabase.auth.exchangeCodeForSession(window.location.href)`
- Relativ import for supabaseClient
- Klar til build på Vercel

Se tidligere instruktion for ENV vars og Supabase redirect-URLs.
