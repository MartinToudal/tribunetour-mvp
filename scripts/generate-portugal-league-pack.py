import csv
import html
import json
import re
import time
import unicodedata
from datetime import datetime
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen


WEBSITE_ROOT = Path(__file__).resolve().parent.parent
WORKSPACE_ROOT = WEBSITE_ROOT.parent
APP_DIR = WORKSPACE_ROOT / "Tribunetour"
APP_FIXTURES_CSV = APP_DIR / "fixtures.csv"
APP_PORTUGAL_CSV = APP_DIR / "portugal_top_3.csv"
WEB_PORTUGAL_DIR = WEBSITE_ROOT / "data" / "league-packs" / "portugal_top_3"
WEB_PORTUGAL_JSON = WEB_PORTUGAL_DIR / "stadiums.json"
WEB_PORTUGAL_README = WEB_PORTUGAL_DIR / "README.md"

USER_AGENT = "Tribunetour/1.0 (martin@toudal.dk)"

LIGA_PORTUGAL_FIXTURES = """
RUNDE 33
10.05. 18:00 AFS FC Porto
10.05. 18:00 Alverca Estoril
10.05. 18:00 Benfica Braga
10.05. 18:00 Estrela Famalicao
10.05. 18:00 Gil Vicente Arouca
10.05. 18:00 Guimaraes Casa Pia
10.05. 18:00 Rio Ave Sporting
10.05. 18:00 Santa Clara Nacional
10.05. 18:00 Tondela Moreirense
RUNDE 34
17.05. 18:00 Arouca Tondela
17.05. 18:00 Braga Estrela
17.05. 18:00 Casa Pia Rio Ave
17.05. 18:00 Estoril Benfica
17.05. 18:00 Famalicao Alverca
17.05. 18:00 FC Porto Santa Clara
17.05. 18:00 Moreirense AFS
17.05. 18:00 Nacional Guimaraes
17.05. 18:00 Sporting Gil Vicente
""".strip()

LIGA_PORTUGAL_2_FIXTURES = """
RUNDE 33
10.05. 17:00 Benfica B Academico Viseu
10.05. 17:00 Chaves Leixoes
10.05. 17:00 Farense Ferreira
10.05. 17:00 Feirense Oliveirense
10.05. 17:00 Felgueiras Portimonense
10.05. 17:00 Lusitania FC Torreense
10.05. 17:00 Penafiel Maritimo
10.05. 17:00 Sporting B FC Porto B
10.05. 17:00 Vizela Leiria
RUNDE 34
17.05. 17:00 Academico Viseu Sporting B
17.05. 17:00 FC Porto B Benfica B
17.05. 17:00 Ferreira Penafiel
17.05. 17:00 Leiria Feirense
17.05. 17:00 Leixoes Lusitania FC
17.05. 17:00 Maritimo Chaves
17.05. 17:00 Oliveirense Felgueiras
17.05. 17:00 Portimonense Farense
17.05. 17:00 Torreense Vizela
""".strip()

LIGA_3_PROMOTION_FIXTURES = """
RUNDE 13
09.05. 16:00 Trofense Guimaraes B
09.05. 21:00 Mafra Academica
10.05. 12:00 Amarante Santarem
10.05. 20:30 Varzim Os Belenenses
RUNDE 14
16.05. 17:30 Academica Trofense
16.05. 17:30 Guimaraes B Amarante
16.05. 17:30 Os Belenenses Mafra
16.05. 17:30 Santarem Varzim
""".strip()

DISPLAY_OVERRIDES = {
    "Académica": "Academica",
    "Académico de Viseu": "Academico Viseu",
    "AVS": "AFS",
    "Famalicão": "Famalicao",
    "Leixões": "Leixoes",
    "Lusitânia Lourosa": "Lusitania FC",
    "Marítimo": "Maritimo",
    "Moreirense": "Moreirense",
    "Paços de Ferreira": "Ferreira",
    "Rio Ave": "Rio Ave",
    "Sporting CP": "Sporting",
    "Sporting CP B": "Sporting B",
    "União de Leiria": "Leiria",
    "União de Santarém": "Santarem",
    "Vitória de Guimarães": "Guimaraes",
    "Vitória SC": "Guimaraes",
    "Vitória SC B": "Guimaraes B",
    "Belenenses": "Os Belenenses",
    "Estrela da Amadora": "Estrela",
}

TEAM_DATA_OVERRIDES = {
    "Casa Pia": {
        "city": "Rio Maior",
        "stadium": "Estádio Municipal de Rio Maior",
    },
    "Lusitania FC": {
        "city": "Lourosa",
        "stadium": "Estádio do Lusitânia de Lourosa FC",
    },
    "Sporting B": {
        "city": "Alcochete",
        "stadium": "Estádio Aurélio Pereira",
    },
}

MATCHUP_TEAM_ALIASES = {
    "Academica": "Académica",
    "Academico Viseu": "Académico de Viseu",
    "AFS": "AVS",
    "Estrela": "Estrela da Amadora",
    "Estoril": "Estoril Praia",
    "FC Porto": "Porto",
    "FC Porto B": "Porto B",
    "Famalicao": "Famalicão",
    "Ferreira": "Paços de Ferreira",
    "Guimaraes": "Vitória SC",
    "Guimaraes B": "Vitória SC B",
    "Leiria": "União de Leiria",
    "Leixoes": "Leixões",
    "Lusitania FC": "Lusitânia Lourosa",
    "Maritimo": "Marítimo",
    "Os Belenenses": "Belenenses",
    "Santarem": "União de Santarém",
    "Sporting": "Sporting CP",
    "Sporting B": "Sporting CP B",
}

LEAGUE_SPECS = [
    {
        "page": "2025%E2%80%9326_Primeira_Liga",
        "heading": "===Location and stadiums===",
        "league": "Liga Portugal",
        "league_code": "pt-liga-portugal",
        "fixtures": LIGA_PORTUGAL_FIXTURES,
        "fixture_prefix": "pt1",
        "league_pack": "portugal_top_3",
        "country_code": "pt",
        "timezone_offset": "+01:00",
        "additional_teams": [],
    },
    {
        "page": "2025%E2%80%9326_Liga_Portugal_2",
        "heading": "===Location and stadiums===",
        "league": "Liga Portugal 2",
        "league_code": "pt-liga-portugal-2",
        "fixtures": LIGA_PORTUGAL_2_FIXTURES,
        "fixture_prefix": "pt2",
        "league_pack": "portugal_top_3",
        "country_code": "pt",
        "timezone_offset": "+01:00",
        "additional_teams": [],
    },
    {
        "page": "2025%E2%80%9326_Liga_3_%28Portugal%29",
        "heading": "Stadium and locations",
        "league": "Liga 3 - Oprykningsgruppe",
        "league_code": "pt-liga-3-oprykningsgruppe",
        "fixtures": LIGA_3_PROMOTION_FIXTURES,
        "fixture_prefix": "pt3",
        "league_pack": "portugal_top_3",
        "country_code": "pt",
        "timezone_offset": "+01:00",
        "additional_teams": [],
    },
]


def fetch_text(url: str) -> str:
    request = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8")


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
    ascii_value = ascii_value.lower().replace("&", " and ")
    ascii_value = re.sub(r"[^a-z0-9]+", "-", ascii_value).strip("-")
    return ascii_value


def clean_template(value: str) -> str:
    previous = None
    while previous != value:
        previous = value
        value = re.sub(r"\{\{(?:small|nowrap|Nts|nts)\|([^{}]+)\}\}", r"\1", value)
        value = re.sub(r"\{\{flagicon\|[^{}]+\}\}", "", value)
        value = re.sub(r"\{\{efn\|[^{}]+\}\}", "", value)
        value = re.sub(r"\{\{sortname\|([^|{}]+)\|([^{}]+)\}\}", r"\1 \2", value)
        value = re.sub(r"\{\{no wrap\|([^{}]+)\}\}", r"\1", value)
        value = re.sub(r"\{\{nbsp\}\}", " ", value)
    value = re.sub(r"\{\{[^{}]+\}\}", "", value)
    return value


def clean_wiki_text(value: str) -> str:
    value = value.strip()
    if not value:
        return value
    value = re.sub(r"<ref[^>]*>.*?</ref>", "", value)
    value = re.sub(r"<ref[^/]*/>", "", value)
    value = re.sub(r"<[^>]+>", "", value)
    value = re.sub(r"<!--.*?-->", "", value, flags=re.S)
    if not value.startswith("[[") and "|" in value:
        value = value.split("|", 1)[1]
    value = clean_template(value)
    value = re.sub(r"\[\[([^|\]]+)\|([^\]]+)\]\]", r"\2", value)
    value = re.sub(r"\[\[([^\]]+)\]\]", r"\1", value)
    value = value.replace("{{", "").replace("}}", "")
    if "|" in value:
        value = value.split("|")[-1]
    value = value.replace("↑", "").replace("↓", "").replace("^", "")
    value = html.unescape(value)
    value = value.replace("–", "-").replace("—", "-")
    value = re.sub(r"\s+", " ", value).strip()
    return value


def parse_fixture_source(source: str):
    fixtures = []
    current_round = None

    for line in [line.strip() for line in source.splitlines() if line.strip()]:
        if line.startswith("RUNDE "):
            current_round = int(line.split()[-1])
            continue

        match = re.match(r"(\d{2}\.\d{2}\.)\s+(\d{2}:\d{2})\s+(.+)$", line)
        if not match:
            raise ValueError(f"Kan ikke parse fixture-linje: {line}")

        if current_round is None:
            raise ValueError(f"Mangler rundekontekst for: {line}")

        date_token, time_token, matchup_text = match.groups()
        fixtures.append({
            "round_number": current_round,
            "date_token": date_token,
            "time_token": time_token,
            "matchup_text": matchup_text.strip(),
        })

    return fixtures


def split_wikitable_rows(table_text: str):
    rows = []
    current = []

    for raw_line in table_text.splitlines():
        line = raw_line.rstrip()
        if line.startswith("|-"):
            if current:
                rows.append(current)
                current = []
            continue
        if line.startswith("!"):
            continue
        if not line.startswith("|"):
            continue
        payload = line[1:]
        parts = [part.strip() for part in payload.split("||")]
        current.extend(parts)

    if current:
        rows.append(current)

    return rows


def extract_table_for_heading(page_text: str, heading: str) -> str:
    start = page_text.find(heading)
    if start == -1:
        fallback = heading.replace("=", "").strip()
        start = page_text.find(fallback)
    if start == -1:
        raise ValueError(f"Kunne ikke finde heading {heading}")
    table_start = page_text.find("{|", start)
    table_end = page_text.find("|}", table_start)
    return page_text[table_start:table_end + 2]


def parse_stadium_rows(table_text: str):
    rows_by_team = {}

    for raw_row in split_wikitable_rows(table_text):
        cleaned = [clean_wiki_text(cell) for cell in raw_row]
        cleaned = [cell for cell in cleaned if cell]
        if len(cleaned) < 3:
            continue

        team_raw = cleaned[0]
        city = cleaned[1]
        stadium = cleaned[2]

        team = DISPLAY_OVERRIDES.get(team_raw, team_raw)
        override = TEAM_DATA_OVERRIDES.get(team, {})
        city = override.get("city", city)
        stadium = override.get("stadium", stadium)

        rows_by_team[team] = {
            "team": team,
            "city": city,
            "stadium": stadium,
        }

    for team, override in TEAM_DATA_OVERRIDES.items():
        if team not in rows_by_team:
            rows_by_team[team] = {
                "team": team,
                "city": override["city"],
                "stadium": override["stadium"],
            }

    return list(rows_by_team.values())


def parse_map_coordinates(page_text: str):
    coordinates = {}
    pattern = re.compile(
        r"\{\{Location map~[^}]*?\|lat(?:_deg)?=([^|}]+)(?:\|lat_min=([^|}]+)\|lat_dir=([NS]))?"
        r"[^}]*?\|long(?:_deg)?=([^|}]+)(?:\|lon_min=([^|}]+)\|lon_dir=([EW]))?"
        r"[^}]*?\|label=.*?\[\[([^|\]]+)(?:\|([^\]]+))?\]\]",
        re.S,
    )

    def parse_coord(deg_value, min_value, direction):
        deg_value = deg_value.strip()
        if min_value:
            degrees = float(deg_value) + float(min_value.strip()) / 60
            if direction in {"S", "W"}:
                degrees *= -1
            return degrees
        return float(deg_value)

    for match in pattern.finditer(page_text):
        lat = parse_coord(match.group(1), match.group(2), match.group(3))
        lon = parse_coord(match.group(4), match.group(5), match.group(6))
        label = clean_wiki_text(match.group(8) or match.group(7))
        team = DISPLAY_OVERRIDES.get(label, label)
        coordinates[team] = (lat, lon)

    return coordinates


def geocode_stadium(stadium: str, city: str):
    query_variants = [
        f"{stadium}, {city}, Portugal",
        f"{stadium}, {city}",
        f"{city}, Portugal",
    ]

    for index, query in enumerate(query_variants):
        if index > 0:
            time.sleep(1.0)
        url = "https://nominatim.openstreetmap.org/search?" + urlencode({
            "q": query,
            "format": "jsonv2",
            "limit": 1,
        })
        payload = fetch_text(url)
        results = json.loads(payload)
        if not results:
            continue
        candidate = results[0]
        return float(candidate["lat"]), float(candidate["lon"])

    return None


def make_short_code(team: str, used_codes: set[str]):
    tokens = [
        token
        for token in re.split(
            r"[^A-Za-z0-9]+",
            unicodedata.normalize("NFKD", team).encode("ascii", "ignore").decode("ascii"),
        )
        if token
    ]
    if not tokens:
        base = "CLB"
    elif len(tokens) == 1:
        base = tokens[0][:3].upper()
    else:
        base = "".join(token[0] for token in tokens[:3]).upper()
        if len(base) < 3:
            base = (base + tokens[0][1:3].upper())[:3]
    base = (base + "XXX")[:3]

    candidate = base
    suffix = 2
    while candidate in used_codes:
        candidate = f"{base[:2]}{suffix}"
        suffix += 1

    used_codes.add(candidate)
    return candidate


def build_fixture_id(prefix: str, round_number: int, home_team_id: str, away_team_id: str) -> str:
    return f"{prefix}-r{round_number}-{home_team_id[3:]}-{away_team_id[3:]}"


def build_kickoff(date_token: str, time_token: str, timezone_offset: str) -> str:
    day, month = date_token.rstrip(".").split(".")
    dt = datetime(2026, int(month), int(day), int(time_token[:2]), int(time_token[3:]))
    return dt.strftime("%Y-%m-%dT%H:%M:00") + timezone_offset


def resolve_matchup(matchup_text: str, team_lookup: dict[str, str]):
    for home_team in sorted(team_lookup.keys(), key=len, reverse=True):
        prefix = f"{home_team} "
        if not matchup_text.startswith(prefix):
            continue
        away_team = matchup_text[len(prefix):].strip()
        if away_team in team_lookup:
            return team_lookup[home_team], team_lookup[away_team]
    raise ValueError(f"Kan ikke matche kamplinje til hold: {matchup_text}. Kendte hold: {sorted(team_lookup.keys())}")


def stable_json(value) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2) + "\n"


def csv_escape(value: str) -> str:
    if any(char in value for char in [",", "\"", "\n"]):
        return "\"" + value.replace("\"", "\"\"") + "\""
    return value


def format_csv_rows(rows):
    header = ["id", "name", "team", "league", "city", "lat", "lon", "country_code", "league_code", "league_pack", "short_code"]
    lines = [",".join(header)]
    for row in rows:
        values = [
            row["id"],
            row["name"],
            row["team"],
            row["league"],
            row["city"],
            f"{row['lat']:.6f}".rstrip("0").rstrip("."),
            f"{row['lon']:.6f}".rstrip("0").rstrip("."),
            row["countryCode"],
            row["leagueCode"],
            row["leaguePack"],
            row["shortCode"],
        ]
        lines.append(",".join(csv_escape(value) for value in values))
    return "\n".join(lines) + "\n"


def main():
    parsed_fixture_sets = [parse_fixture_source(spec["fixtures"]) for spec in LEAGUE_SPECS]

    cached_pages = {}
    all_rows = []
    stadiums_by_team = {}
    used_codes = set()

    for spec, fixtures in zip(LEAGUE_SPECS, parsed_fixture_sets):
        page_text = cached_pages.get(spec["page"])
        if page_text is None:
            page_text = fetch_text(f"https://en.wikipedia.org/w/index.php?title={spec['page']}&action=raw")
            cached_pages[spec["page"]] = page_text

        table_text = extract_table_for_heading(page_text, spec["heading"])
        stadium_rows = parse_stadium_rows(table_text)
        map_coords = parse_map_coordinates(page_text)
        known_teams = {row["team"] for row in stadium_rows}
        team_lookup = {team: team for team in known_teams}
        for alias, canonical in MATCHUP_TEAM_ALIASES.items():
            displayed_canonical = DISPLAY_OVERRIDES.get(canonical, canonical)
            if displayed_canonical in known_teams:
                team_lookup[alias] = displayed_canonical
            elif canonical in known_teams:
                team_lookup[alias] = canonical

        resolved_fixtures = []
        teams_for_league = set(spec["additional_teams"])
        for fixture in fixtures:
            home_team, away_team = resolve_matchup(fixture["matchup_text"], team_lookup)
            resolved = {
                **fixture,
                "home_team": home_team,
                "away_team": away_team,
            }
            resolved_fixtures.append(resolved)
            teams_for_league.add(home_team)
            teams_for_league.add(away_team)

        filtered_rows = [row for row in stadium_rows if row["team"] in teams_for_league]
        if len(filtered_rows) != len(teams_for_league):
            missing = sorted(teams_for_league - {row["team"] for row in filtered_rows})
            raise ValueError(
                f"League {spec['league']} gav {len(filtered_rows)} stadionrækker for {len(teams_for_league)} hold. "
                f"Mangler: {missing}"
            )

        for row in sorted(filtered_rows, key=lambda item: item["team"]):
            team_id = f"pt-{slugify(row['team'])}"
            coords = geocode_stadium(row["stadium"], row["city"])
            if coords is None:
                coords = map_coords.get(row["team"])
            if coords is None:
                raise ValueError(f"Mangler koordinater for {row['team']} / {row['stadium']} / {row['city']}")
            lat, lon = coords
            short_code = make_short_code(row["team"], used_codes)

            item = {
                "id": team_id,
                "name": row["stadium"],
                "team": row["team"],
                "league": spec["league"],
                "city": row["city"],
                "lat": lat,
                "lon": lon,
                "countryCode": spec["country_code"],
                "leagueCode": spec["league_code"],
                "leaguePack": spec["league_pack"],
                "shortCode": short_code,
            }
            stadiums_by_team[row["team"]] = item
            all_rows.append(item)
            time.sleep(1.0)

        spec["resolved_fixtures"] = resolved_fixtures

    fixture_rows = []
    for spec in LEAGUE_SPECS:
        for fixture in spec["resolved_fixtures"]:
            home = stadiums_by_team[fixture["home_team"]]
            away = stadiums_by_team[fixture["away_team"]]
            fixture_rows.append({
                "id": build_fixture_id(spec["fixture_prefix"], fixture["round_number"], home["id"], away["id"]),
                "kickoff": build_kickoff(fixture["date_token"], fixture["time_token"], spec["timezone_offset"]),
                "round": f"{spec['league']} - {fixture['round_number']}. runde",
                "homeTeamId": home["id"],
                "awayTeamId": away["id"],
                "venueClubId": home["id"],
                "status": "scheduled",
                "homeScore": "",
                "awayScore": "",
            })

    all_rows.sort(key=lambda row: (row["leagueCode"], row["team"]))

    WEB_PORTUGAL_DIR.mkdir(parents=True, exist_ok=True)
    APP_PORTUGAL_CSV.write_text(format_csv_rows(all_rows), encoding="utf-8")
    WEB_PORTUGAL_JSON.write_text(stable_json(all_rows), encoding="utf-8")
    WEB_PORTUGAL_README.write_text(
        "# Portugal top 3\n\n"
        "Sidecar reference-data for the experimental `portugal_top_3` league pack.\n",
        encoding="utf-8",
    )

    existing_rows = list(csv.DictReader(APP_FIXTURES_CSV.read_text(encoding="utf-8").splitlines()))
    prefixes = ("pt1-", "pt2-", "pt3-")
    kept_rows = [row for row in existing_rows if not row["id"].startswith(prefixes)]
    merged_rows = kept_rows + fixture_rows
    merged_rows.sort(key=lambda row: (row["kickoff"], row["id"]))

    with APP_FIXTURES_CSV.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=[
            "id", "kickoff", "round", "homeTeamId", "awayTeamId", "venueClubId", "status", "homeScore", "awayScore"
        ])
        writer.writeheader()
        writer.writerows(merged_rows)

    print(f"Generated {len(all_rows)} Portugal stadium rows")
    print(f"Generated {len(fixture_rows)} Portugal fixtures")
    print(f"Updated {APP_PORTUGAL_CSV}")
    print(f"Updated {WEB_PORTUGAL_JSON}")
    print(f"Updated {APP_FIXTURES_CSV}")


if __name__ == "__main__":
    main()
