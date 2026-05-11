## Flashscore fixture audit

Denne mappe bruges til at sanity-tjekke `fixtures.csv` mod et råt tekstudtræk fra Flashscore.

### Workflow

1. Åbn den relevante liga på Flashscore, helst siden `.../kommende/`.
2. Kopiér den synlige tekst for én liga eller playoff-gruppe til en lokal `.txt`-fil.
3. Kør audit-scriptet:

```bash
python3 scripts/audit-flashscore-fixtures.py \
  --competition tr-super-lig \
  --season 2025-26 \
  --source /absolute/path/to/flashscore-tr-super-lig.txt
```

For ældre ligaer uden `competitionId` i `fixtures.csv` kan du bruge id-/runde-prefix:

```bash
python3 scripts/audit-flashscore-fixtures.py \
  --fixture-prefix sl- \
  --round-prefix "Superliga - " \
  --season 2025-26 \
  --source /absolute/path/to/flashscore-dk-superliga.txt
```

### Hvad scriptet rapporterer

- `exact`: dato, tid og hold matcher vores fixtures
- `time-mismatch`: hold og dato matcher, men tiden ser anderledes ud
- `date-mismatch`: hold matcher, men dato/tid ser anderledes ud
- `missing`: kampen kunne ikke findes i Flashscore-udtrækket

### Alias-håndtering

Flashscore bruger nogle gange andre holdnavne end vores reference-data.
Ekstra navne kan lægges i:

- [flashscore-team-aliases.json](/Users/martintoudal/Documents/Tribunetour/Tribunetour/Website repo/data/fixture-audits/flashscore-team-aliases.json)

### Fast audit-rutine

Konfigurationen for faste audits ligger i:

- [audits.json](/Users/martintoudal/Documents/Tribunetour/Tribunetour/Website repo/data/fixture-audits/audits.json)

Den første faste rutine er:

- `dk-superliga`

Kør alle eller kun de audits, der er due i dag:

```bash
python3 scripts/run-fixture-audits.py --all
python3 scripts/run-fixture-audits.py --due
```

Rapporter skrives til:

- `data/fixture-audits/reports/latest.json`
- `data/fixture-audits/reports/latest.md`
