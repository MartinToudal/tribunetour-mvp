## Flashscore fixture audit

Denne mappe bruges til at sanity-tjekke `fixtures.csv` mod et råt eller automatisk hentet kontroludtræk fra Flashscore.

### Workflow

1. Åbn den relevante liga på Flashscore, helst siden `.../kommende/`.
2. Enten:
   - kopier den synlige tekst for én liga eller playoff-gruppe til en lokal `.txt`-fil
   - eller brug den automatiske fetcher, hvis auditten er sat op til det
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

Konfigurationen kan nu dække alle de fixture-rækker, vi aktuelt har i systemet.
Hver audit beskriver:

- hvilken fixture-række den matcher
- hvilken Flashscore-side der bruges som kontrolkilde
- om vi matcher via `competitionId` eller legacy `fixturePrefix`/`roundPrefix`

Kør alle eller kun de audits, der er due i dag:

```bash
python3 scripts/run-fixture-audits.py --all
python3 scripts/run-fixture-audits.py --due
```

Hvis du vil hente en kildefil manuelt via fetcheren, kan du også køre:

```bash
python3 scripts/fetch-flashscore-fixtures.py \
  --url "https://www.flashscore.dk/fodbold/danmark/superliga/kommende/" \
  --output data/fixture-audits/raw/dk-superliga.txt \
  --timezone Europe/Copenhagen \
  --competition-filter Superliga
```

Rapporter skrives til:

- `data/fixture-audits/reports/latest.json`
- `data/fixture-audits/reports/latest.md`

### Dagligt nær-check

Ud over den brede 14-dages audit har vi nu også et særskilt dagligt check af det nære kampprogram.

Det daglige check:

- kører mod kampvinduet `i dag -> de næste N dage`
- sammenligner både vores egne fixtures og Flashscore-kilden i samme vindue
- kan derfor opdage både:
  - manglende kampe i vores data
  - forkerte kickoff-tider
  - lokale kampe som ikke længere findes i kilden
- kan automatisk skrive sikre kickoff-opdateringer tilbage i web-fixturedata

Manuel kørsel:

```bash
python3 scripts/run-daily-fixture-check.py --apply-safe-updates
```

Rapporter skrives til:

- `data/fixture-audits/reports/latest-daily.json`
- `data/fixture-audits/reports/latest-daily.md`
- `data/fixture-audits/reports/latest-daily-updates.json`
- `data/fixture-audits/reports/latest-daily-updates.md`

### Natlig kørsel og mail

GitHub Actions-workflowet for det daglige check ligger i:

- `.github/workflows/daily-fixture-check.yml`

Det er sat op til at ramme `03:00` i `Europe/Copenhagen` ved at køre på to UTC-crons og derefter kun fortsætte, når den lokale tid faktisk er 03.

For at mails virker fra GitHub Actions, skal disse repo secrets sættes:

- `RESEND_API_KEY`
- `FIXTURE_CHECK_NOTIFY_TO`
- `FIXTURE_CHECK_NOTIFY_FROM` (valgfri; der bruges ellers en standard-afsender)
