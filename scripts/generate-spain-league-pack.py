import csv
import html
import json
import re
import time
import unicodedata
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen


WEBSITE_ROOT = Path(__file__).resolve().parent.parent
WORKSPACE_ROOT = WEBSITE_ROOT.parent
APP_DIR = WORKSPACE_ROOT / "Tribunetour"
APP_FIXTURES_CSV = APP_DIR / "fixtures.csv"
APP_SPAIN_CSV = APP_DIR / "spain_top_4.csv"
WEB_SPAIN_DIR = WEBSITE_ROOT / "data" / "league-packs" / "spain_top_4"
WEB_SPAIN_JSON = WEB_SPAIN_DIR / "stadiums.json"
WEB_SPAIN_README = WEB_SPAIN_DIR / "README.md"

USER_AGENT = "Tribunetour/1.0 (martin@toudal.dk)"

LA_LIGA_FIXTURES = """
RUNDE 34
01.05. 21:00 Girona Mallorca
02.05. 14:00 Villarreal Levante
02.05. 16:15 Valencia Atl. Madrid
02.05. 18:30 Alaves Ath. Bilbao
02.05. 21:00 Osasuna Barcelona
03.05. 14:00 Celta Vigo Elche
03.05. 16:15 Getafe Vallecano
03.05. 18:30 Betis Oviedo
03.05. 21:00 Espanyol Real Madrid
04.05. 21:00 Sevilla Real Sociedad
RUNDE 35
08.05. 21:00 Levante Osasuna
09.05. 14:00 Elche Alaves
09.05. 16:15 Sevilla Espanyol
09.05. 18:30 Atl. Madrid Celta Vigo
09.05. 21:00 Real Sociedad Betis
10.05. 14:00 Mallorca Villarreal
10.05. 16:15 Ath. Bilbao Valencia
10.05. 18:30 Oviedo Getafe
10.05. 21:00 Barcelona Real Madrid
11.05. 21:00 Vallecano Girona
RUNDE 36
12.05. 19:00 Celta Vigo Levante
12.05. 20:00 Betis Elche
12.05. 21:30 Osasuna Atl. Madrid
13.05. 19:00 Espanyol Ath. Bilbao
13.05. 19:00 Villarreal Sevilla
13.05. 21:30 Alaves Barcelona
13.05. 21:30 Getafe Mallorca
14.05. 19:00 Valencia Vallecano
14.05. 20:00 Girona Real Sociedad
14.05. 21:30 Real Madrid Oviedo
RUNDE 37
17.05. 18:00 Ath. Bilbao Celta Vigo
17.05. 18:00 Atl. Madrid Girona
17.05. 18:00 Barcelona Betis
17.05. 18:00 Elche Getafe
17.05. 18:00 Levante Mallorca
17.05. 18:00 Osasuna Espanyol
17.05. 18:00 Oviedo Alaves
17.05. 18:00 Real Sociedad Valencia
17.05. 18:00 Sevilla Real Madrid
17.05. 18:00 Vallecano Villarreal
RUNDE 38
24.05. 18:00 Alaves Vallecano
24.05. 18:00 Betis Levante
24.05. 18:00 Celta Vigo Sevilla
24.05. 18:00 Espanyol Real Sociedad
24.05. 18:00 Getafe Osasuna
24.05. 18:00 Girona Elche
24.05. 18:00 Mallorca Oviedo
24.05. 18:00 Real Madrid Ath. Bilbao
24.05. 18:00 Valencia Barcelona
24.05. 18:00 Villarreal Atl. Madrid
""".strip()

SEGUNDA_FIXTURES = """
RUNDE 38
01.05. 16:15 Andorra Albacete
01.05. 18:30 La Coruna Leganes
01.05. 21:00 Zaragoza Granada
02.05. 16:15 Cultural Leonesa Cadiz
02.05. 18:30 Castellon Cordoba
02.05. 21:00 Eibar Malaga
03.05. 14:00 Racing Santander Huesca
03.05. 16:15 Gijon Ceuta
03.05. 18:30 Real Sociedad B Burgos CF
03.05. 21:00 Las Palmas Valladolid
04.05. 20:30 Almeria Mirandes
RUNDE 39
08.05. 20:30 Cadiz La Coruna
09.05. 14:00 Ceuta Castellon
09.05. 16:15 Albacete Cultural Leonesa
09.05. 16:15 Burgos CF Almeria
09.05. 18:30 Valladolid Zaragoza
09.05. 21:00 Malaga Gijon
10.05. 14:00 Andorra Las Palmas
10.05. 16:15 Leganes Racing Santander
10.05. 18:30 Cordoba Granada
10.05. 18:30 Mirandes Eibar
11.05. 20:30 Huesca Real Sociedad B
RUNDE 40
15.05. 20:30 Castellon Cadiz
15.05. 21:00 Cordoba Albacete
16.05. 14:00 Real Sociedad B Mirandes
16.05. 16:15 Ceuta Malaga
16.05. 16:15 Cultural Leonesa Eibar
16.05. 18:30 Almeria Las Palmas
16.05. 18:30 Granada Burgos CF
16.05. 18:30 Racing Santander Valladolid
17.05. 14:00 La Coruna Andorra
17.05. 21:15 Zaragoza Gijon
18.05. 20:30 Leganes Huesca
RUNDE 41
24.05. 18:00 Albacete Real Sociedad B
24.05. 18:00 Andorra Ceuta
24.05. 18:00 Cadiz Leganes
24.05. 18:00 Cultural Leonesa Burgos CF
24.05. 18:00 Eibar Cordoba
24.05. 18:00 Gijon Almeria
24.05. 18:00 Huesca Castellon
24.05. 18:00 Las Palmas Zaragoza
24.05. 18:00 Malaga Racing Santander
24.05. 18:00 Mirandes Granada
24.05. 18:00 Valladolid La Coruna
RUNDE 42
31.05. 18:00 Almeria Valladolid
31.05. 18:00 Burgos CF Andorra
31.05. 18:00 Castellon Eibar
31.05. 18:00 Ceuta Albacete
31.05. 18:00 Cordoba Huesca
31.05. 18:00 Granada Gijon
31.05. 18:00 La Coruna Las Palmas
31.05. 18:00 Leganes Mirandes
31.05. 18:00 Racing Santander Cadiz
31.05. 18:00 Real Sociedad B Cultural Leonesa
31.05. 18:00 Zaragoza Malaga
""".strip()

PRIMERA_FED_G1_FIXTURES = """
RUNDE 35
01.05. 16:15 Celta Vigo B Osasuna B
01.05. 19:00 Tenerife Barakaldo
02.05. 16:15 Ferrol Pontevedra
02.05. 18:30 CF Talavera Arenas Getxo
02.05. 18:30 Real Aviles Guadalajara
02.05. 18:30 Zamora Ponferradina
02.05. 21:00 Real Madrid B Unionistas
03.05. 12:00 Arenteiro Cacereno
03.05. 16:00 AD Merida Lugo
03.05. 16:00 Ath. Bilbao B Ourense CF
RUNDE 36
08.05. 20:30 Arenas Getxo Ferrol
09.05. 14:00 Barakaldo AD Merida
09.05. 16:15 Pontevedra Ath. Bilbao B
09.05. 18:30 Guadalajara Arenteiro
09.05. 18:30 Ponferradina Real Aviles
09.05. 18:30 Unionistas Tenerife
09.05. 21:00 Cacereno Real Madrid B
10.05. 12:00 Osasuna B CF Talavera
10.05. 14:15 Lugo Zamora
10.05. 16:30 Ourense CF Celta Vigo B
RUNDE 37
17.05. 18:00 AD Merida Unionistas
17.05. 18:00 Arenteiro Ponferradina
17.05. 18:00 Ath. Bilbao B Guadalajara
17.05. 18:00 Celta Vigo B Lugo
17.05. 18:00 CF Talavera Ourense CF
17.05. 18:00 Ferrol Osasuna B
17.05. 18:00 Real Aviles Barakaldo
17.05. 18:00 Real Madrid B Arenas Getxo
17.05. 18:00 Tenerife Pontevedra
17.05. 18:00 Zamora Cacereno
RUNDE 38
24.05. 18:00 Arenas Getxo Zamora
24.05. 18:00 Barakaldo Celta Vigo B
24.05. 18:00 Cacereno CF Talavera
24.05. 18:00 Guadalajara Real Madrid B
24.05. 18:00 Lugo Arenteiro
24.05. 18:00 Osasuna B AD Merida
24.05. 18:00 Ourense CF Tenerife
24.05. 18:00 Ponferradina Ath. Bilbao B
24.05. 18:00 Pontevedra Real Aviles
24.05. 18:00 Unionistas Ferrol
""".strip()

PRIMERA_FED_G2_FIXTURES = """
RUNDE 35
01.05. 16:15 Alcorcon CE Europa
01.05. 21:15 Algeciras CF Cartagena
02.05. 16:15 Gimnastic Sevilla B
02.05. 18:30 Betis B Antequera
03.05. 12:00 Teruel Tarazona
03.05. 12:00 Torremolinos Atl. Madrid B
03.05. 12:00 Villarreal B Hercules
03.05. 17:45 UD Ibiza Sanluqueno
03.05. 18:15 Sabadell Murcia
03.05. 20:30 Eldense UD Marbella
RUNDE 36
08.05. 19:00 Cartagena Alcorcon
08.05. 21:15 Atl. Madrid B Sabadell
09.05. 16:15 Hercules UD Ibiza
09.05. 18:30 Sanluqueno Algeciras CF
10.05. 12:00 Sevilla B Eldense
10.05. 12:00 UD Marbella Torremolinos
10.05. 16:30 CE Europa Villarreal B
10.05. 16:30 Tarazona Gimnastic
10.05. 18:45 Antequera Teruel
10.05. 18:45 Murcia Betis B
RUNDE 37
17.05. 18:00 Alcorcon UD Marbella
17.05. 18:00 Algeciras CF Hercules
17.05. 18:00 Betis B Tarazona
17.05. 18:00 Eldense Atl. Madrid B
17.05. 18:00 Gimnastic CE Europa
17.05. 18:00 Sabadell Antequera
17.05. 18:00 Teruel Sanluqueno
17.05. 18:00 Torremolinos Murcia
17.05. 18:00 UD Ibiza Cartagena
17.05. 18:00 Villarreal B Sevilla B
RUNDE 38
24.05. 18:00 Antequera Torremolinos
24.05. 18:00 Atl. Madrid B Algeciras CF
24.05. 18:00 Cartagena Betis B
24.05. 18:00 CE Europa UD Ibiza
24.05. 18:00 Hercules Gimnastic
24.05. 18:00 Murcia Eldense
24.05. 18:00 Sanluqueno Villarreal B
24.05. 18:00 Sevilla B Alcorcon
24.05. 18:00 Tarazona Sabadell
24.05. 18:00 UD Marbella Teruel
""".strip()

DISPLAY_OVERRIDES = {
    "Deportivo": "La Coruna",
    "Deportivo de La Coruña": "La Coruna",
    "Deportivo La Coruña": "La Coruna",
    "Sporting Gijón": "Gijon",
    "Athletic Bilbao": "Ath. Bilbao",
    "Atlético Madrid": "Atl. Madrid",
    "Deportivo Alavés": "Alaves",
    "Alavés": "Alaves",
    "Rayo Vallecano": "Vallecano",
    "Real Betis": "Betis",
    "Arenas": "Arenas Getxo",
    "Avilés Industrial": "Real Aviles",
    "Bilbao Athletic": "Ath. Bilbao B",
    "Celta Fortuna": "Celta Vigo B",
    "Mérida": "AD Merida",
    "Real Madrid Castilla": "Real Madrid B",
    "Alcorcón": "Alcorcon",
    "Almería": "Almeria",
    "Atlético Madrileño": "Atl. Madrid B",
    "Atlético Sanluqueño": "Sanluqueno",
    "Castellón": "Castellon",
    "Burgos": "Burgos CF",
    "Cádiz": "Cadiz",
    "Córdoba": "Cordoba",
    "Leganés": "Leganes",
    "Mirandés": "Mirandes",
    "Málaga": "Malaga",
    "Cacereño": "Cacereno",
    "Racing Ferrol": "Ferrol",
    "Talavera de la Reina": "CF Talavera",
    "Algeciras": "Algeciras CF",
    "Betis Deportivo": "Betis B",
    "Europa": "CE Europa",
    "Gimnàstic Tarragona": "Gimnastic",
    "Gimnàstic de Tarragona": "Gimnastic",
    "Gimnàstic": "Gimnastic",
    "Hércules": "Hercules",
    "Real Betis Deportivo": "Betis B",
    "Real Betis Deportivo Balompié": "Betis B",
    "Ibiza": "UD Ibiza",
    "Juventud Torremolinos": "Torremolinos",
    "Marbella": "UD Marbella",
    "Sevilla Atlético": "Sevilla B",
    "Real Murcia": "Murcia",
}

STADIUM_SELECTION_OVERRIDES = {
    "Barcelona": "Camp Nou",
}

CITY_OVERRIDES = {
    "Barcelona": "Barcelona",
    "Andorra": "Encamp",
}

LEAGUE_SPECS = [
    {
        "page": "2025%E2%80%9326_La_Liga",
        "heading": "===Stadiums and locations===",
        "league": "La Liga",
        "league_code": "es-la-liga",
        "fixtures": LA_LIGA_FIXTURES,
        "fixture_prefix": "esl",
        "group": None,
    },
    {
        "page": "2025%E2%80%9326_Segunda_Divisi%C3%B3n",
        "heading": "===Stadiums and locations===",
        "league": "Segunda División",
        "league_code": "es-segunda-division",
        "fixtures": SEGUNDA_FIXTURES,
        "fixture_prefix": "es2",
        "group": None,
    },
    {
        "page": "2025%E2%80%9326_Primera_Federaci%C3%B3n",
        "heading": "===Group 1",
        "league": "Primera Federación - Gruppe 1",
        "league_code": "es-primera-federacion-g1",
        "fixtures": PRIMERA_FED_G1_FIXTURES,
        "fixture_prefix": "esf1-a",
        "group": "1",
    },
    {
        "page": "2025%E2%80%9326_Primera_Federaci%C3%B3n",
        "heading": "===Group 2",
        "league": "Primera Federación - Gruppe 2",
        "league_code": "es-primera-federacion-g2",
        "fixtures": PRIMERA_FED_G2_FIXTURES,
        "fixture_prefix": "esf1-b",
        "group": "2",
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
        raise ValueError(f"Kunne ikke finde heading {heading}")
    table_start = page_text.find("{|", start)
    table_end = page_text.find("|}", table_start)
    return page_text[table_start:table_end + 2]


def parse_stadium_rows(table_text: str):
    rows_by_team = {}

    for raw_row in split_wikitable_rows(table_text):
        cleaned = [clean_wiki_text(cell) for cell in raw_row]
        cleaned = [cell for cell in cleaned if cell]
        if len(cleaned) < 4:
            continue

        team_raw = cleaned[0]
        city = cleaned[1]
        stadium = cleaned[2]

        team = DISPLAY_OVERRIDES.get(team_raw, team_raw)
        stadium = STADIUM_SELECTION_OVERRIDES.get(team, stadium)
        city = CITY_OVERRIDES.get(team, city)

        row = {
            "team": team,
            "city": city,
            "stadium": stadium,
        }
        existing = rows_by_team.get(team)
        if existing is None or STADIUM_SELECTION_OVERRIDES.get(team) == stadium:
            rows_by_team[team] = row

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
        f"{stadium}, {city}, Spain",
        f"{stadium}, {city}",
        f"{city}, Spain",
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
    tokens = [token for token in re.split(r"[^A-Za-z0-9]+", unicodedata.normalize("NFKD", team).encode("ascii", "ignore").decode("ascii")) if token]
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


def build_kickoff(date_token: str, time_token: str) -> str:
    day, month = date_token.rstrip(".").split(".")
    dt = datetime(2026, int(month), int(day), int(time_token[:2]), int(time_token[3:]))
    return dt.strftime("%Y-%m-%dT%H:%M:00+02:00")


def resolve_matchup(matchup_text: str, known_teams: set[str]):
    for home_team in sorted(known_teams, key=len, reverse=True):
        prefix = f"{home_team} "
        if not matchup_text.startswith(prefix):
            continue
        away_team = matchup_text[len(prefix):].strip()
        if away_team in known_teams:
            return home_team, away_team
    raise ValueError(f"Kan ikke matche kamplinje til hold: {matchup_text}")


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

    for spec, fixtures in zip(LEAGUE_SPECS, parsed_fixture_sets):
        page_text = cached_pages.get(spec["page"])
        if page_text is None:
            page_text = fetch_text(f"https://en.wikipedia.org/w/index.php?title={spec['page']}&action=raw")
            cached_pages[spec["page"]] = page_text

        table_text = extract_table_for_heading(page_text, spec["heading"])
        stadium_rows = parse_stadium_rows(table_text)
        map_coords = parse_map_coordinates(page_text)
        known_teams = {row["team"] for row in stadium_rows}

        resolved_fixtures = []
        teams_for_league = set()
        for fixture in fixtures:
            home_team, away_team = resolve_matchup(fixture["matchup_text"], known_teams)
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

        used_codes = set()
        for row in sorted(filtered_rows, key=lambda item: item["team"]):
            team_id = f"es-{slugify(row['team'])}"
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
                "countryCode": "es",
                "leagueCode": spec["league_code"],
                "leaguePack": "spain_top_4",
                "shortCode": short_code,
            }
            stadiums_by_team[row["team"]] = item
            all_rows.append(item)
            time.sleep(1.0)

        spec["resolved_fixtures"] = resolved_fixtures

    fixture_rows = []
    for spec in LEAGUE_SPECS:
        fixtures = spec["resolved_fixtures"]
        for fixture in fixtures:
            home = stadiums_by_team[fixture["home_team"]]
            away = stadiums_by_team[fixture["away_team"]]
            fixture_rows.append({
                "id": build_fixture_id(spec["fixture_prefix"], fixture["round_number"], home["id"], away["id"]),
                "kickoff": build_kickoff(fixture["date_token"], fixture["time_token"]),
                "round": f"{spec['league']} - {fixture['round_number']}. runde",
                "homeTeamId": home["id"],
                "awayTeamId": away["id"],
                "venueClubId": home["id"],
                "status": "scheduled",
                "homeScore": "",
                "awayScore": "",
            })

    all_rows.sort(key=lambda row: (row["leagueCode"], row["team"]))

    WEB_SPAIN_DIR.mkdir(parents=True, exist_ok=True)
    APP_SPAIN_CSV.write_text(format_csv_rows(all_rows), encoding="utf-8")
    WEB_SPAIN_JSON.write_text(stable_json(all_rows), encoding="utf-8")
    WEB_SPAIN_README.write_text(
        "# Spain top 4\n\n"
        "Sidecar reference-data for the experimental `spain_top_4` league pack.\n",
        encoding="utf-8",
    )

    existing_rows = list(csv.DictReader(APP_FIXTURES_CSV.read_text(encoding="utf-8").splitlines()))
    prefixes = ("esl-", "es2-", "esf1-a-", "esf1-b-")
    kept_rows = [row for row in existing_rows if not row["id"].startswith(prefixes)]
    merged_rows = kept_rows + fixture_rows
    merged_rows.sort(key=lambda row: (row["kickoff"], row["id"]))

    with APP_FIXTURES_CSV.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=[
            "id", "kickoff", "round", "homeTeamId", "awayTeamId", "venueClubId", "status", "homeScore", "awayScore"
        ])
        writer.writeheader()
        writer.writerows(merged_rows)

    print(f"Generated {len(all_rows)} Spain stadium rows")
    print(f"Generated {len(fixture_rows)} Spain fixtures")
    print(f"Updated {APP_SPAIN_CSV}")
    print(f"Updated {WEB_SPAIN_JSON}")
    print(f"Updated {APP_FIXTURES_CSV}")


if __name__ == "__main__":
    main()
