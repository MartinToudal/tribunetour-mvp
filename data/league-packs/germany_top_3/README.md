# Germany Top 3 League Pack

Sidecar reference-data for the experimental `germany_top_3` league pack.

Status:

- not active in production UI
- generated from `GERMAN_STADIUM_REFERENCE_DRAFT.md`
- validated for duplicate ids, duplicate short codes per league, required fields and coordinates

Regenerate with:

```sh
node scripts/generate-germany-league-pack.mjs
```

This dataset must stay feature-gated until the TestFlight/hotfix track is stable.
