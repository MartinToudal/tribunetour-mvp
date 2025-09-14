# Patch: Fix Leaflet TypeScript build error
Adds devDependency `@types/leaflet` so Vercel can compile MapView.tsx.
Steps:
1) Upload this package.json to your repo (replace existing).
2) Commit → Vercel rebuilds and installs the new types.
