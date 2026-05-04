import csv
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path


WEBSITE_ROOT = Path(__file__).resolve().parent.parent
WORKSPACE_ROOT = WEBSITE_ROOT.parent
APP_DIR = WORKSPACE_ROOT / "Tribunetour"
APP_FIXTURES_CSV = APP_DIR / "fixtures.csv"
APP_NETHERLANDS_CSV = APP_DIR / "netherlands_top_3.csv"
WEB_NETHERLANDS_DIR = WEBSITE_ROOT / "data" / "league-packs" / "netherlands_top_3"
WEB_NETHERLANDS_JSON = WEB_NETHERLANDS_DIR / "stadiums.json"
WEB_NETHERLANDS_README = WEB_NETHERLANDS_DIR / "README.md"

USER_AGENT = "Tribunetour/1.0 (martin@toudal.dk)"
SEASON_ID = "2025-26"
LEAGUE_PACK = "netherlands_top_3"

EREDIVISIE_FIXTURES = """
RUNDE 33
10.05. 16:45 Ajax Utrecht
10.05. 16:45 Breda Heerenveen
10.05. 16:45 Excelsior FC Volendam
10.05. 16:45 Feyenoord Alkmaar
10.05. 16:45 G.A. Eagles PSV
10.05. 16:45 Groningen Nijmegen
10.05. 16:45 Sittard Zwolle
10.05. 16:45 Telstar Heracles
10.05. 16:45 Twente Sparta Rotterdam
RUNDE 34
17.05. 14:30 Alkmaar Breda
17.05. 14:30 FC Volendam Telstar
17.05. 14:30 Heerenveen Ajax
17.05. 14:30 Heracles Groningen
17.05. 14:30 Nijmegen G.A. Eagles
17.05. 14:30 PSV Twente
17.05. 14:30 Sparta Rotterdam Excelsior
17.05. 14:30 Utrecht Sittard
17.05. 14:30 Zwolle Feyenoord
""".strip()

TWEEDE_DIVISIE_FIXTURES = """
RUNDE 32
09.05. 14:30 ACV Assen Quick Boys
09.05. 14:30 Barendrecht Hoek
09.05. 14:30 Rijnsburgse Boys Jong Sparta Rotterdam
09.05. 15:00 IJsselmeervogels Hardenberg
09.05. 15:00 Kozakken Boys GVVV
09.05. 15:15 AFC Excelsior Maassluis
09.05. 15:30 Jong Almere City RKAV Volendam
09.05. 15:30 Katwijk HFC
09.05. 18:00 De Treffers Spakenburg
RUNDE 33
16.05. 15:30 ACV Assen HFC
16.05. 15:30 Excelsior Maassluis Jong Almere City
16.05. 15:30 GVVV AFC
16.05. 15:30 Hardenberg Kozakken Boys
16.05. 15:30 Hoek Rijnsburgse Boys
16.05. 15:30 Jong Sparta Rotterdam De Treffers
16.05. 15:30 Quick Boys IJsselmeervogels
16.05. 15:30 RKAV Volendam Barendrecht
16.05. 15:30 Spakenburg Katwijk
RUNDE 34
23.05. 15:30 AFC Hardenberg
23.05. 15:30 Barendrecht Excelsior Maassluis
23.05. 15:30 De Treffers Hoek
23.05. 15:30 HFC Spakenburg
23.05. 15:30 IJsselmeervogels ACV Assen
23.05. 15:30 Jong Almere City GVVV
23.05. 15:30 Katwijk Jong Sparta Rotterdam
23.05. 15:30 Kozakken Boys Quick Boys
23.05. 15:30 Rijnsburgse Boys RKAV Volendam
""".strip()

PLAYOFF_FIXTURES = """
KVARTFINALERNE
05.05. 18:45 Waalwijk Willem II
06.05. 18:45 Almere City De Graafschap
09.05. 16:30 Willem II Waalwijk
09.05. 20:00 De Graafschap Almere City
""".strip()

TEAM_ROWS = [
    {"team": "Ajax", "league": "Eredivisie", "league_code": "nl-eredivisie", "competition_id": "nl-eredivisie", "secondary_competition_ids": "", "city": "Amsterdam", "stadium": "Johan Cruyff Arena", "short_code": "AJA"},
    {"team": "Alkmaar", "league": "Eredivisie", "league_code": "nl-eredivisie", "competition_id": "nl-eredivisie", "secondary_competition_ids": "", "city": "Alkmaar", "stadium": "AFAS Stadion", "short_code": "AZA"},
    {"team": "Breda", "league": "Eredivisie", "league_code": "nl-eredivisie", "competition_id": "nl-eredivisie", "secondary_competition_ids": "", "city": "Breda", "stadium": "Rat Verlegh Stadion", "short_code": "BRE"},
    {"team": "Excelsior", "league": "Eredivisie", "league_code": "nl-eredivisie", "competition_id": "nl-eredivisie", "secondary_competition_ids": "", "city": "Rotterdam", "stadium": "Van Donge & De Roo Stadion", "short_code": "EXC"},
    {"team": "Feyenoord", "league": "Eredivisie", "league_code": "nl-eredivisie", "competition_id": "nl-eredivisie", "secondary_competition_ids": "", "city": "Rotterdam", "stadium": "De Kuip", "short_code": "FEY"},
    {"team": "G.A. Eagles", "league": "Eredivisie", "league_code": "nl-eredivisie", "competition_id": "nl-eredivisie", "secondary_competition_ids": "", "city": "Deventer", "stadium": "De Adelaarshorst", "short_code": "GAE"},
    {"team": "Groningen", "league": "Eredivisie", "league_code": "nl-eredivisie", "competition_id": "nl-eredivisie", "secondary_competition_ids": "", "city": "Groningen", "stadium": "Euroborg", "short_code": "GRO"},
    {"team": "Heerenveen", "league": "Eredivisie", "league_code": "nl-eredivisie", "competition_id": "nl-eredivisie", "secondary_competition_ids": "", "city": "Heerenveen", "stadium": "Abe Lenstra Stadion", "short_code": "HEE"},
    {"team": "Heracles", "league": "Eredivisie", "league_code": "nl-eredivisie", "competition_id": "nl-eredivisie", "secondary_competition_ids": "", "city": "Almelo", "stadium": "Asito Stadion", "short_code": "HER"},
    {"team": "Nijmegen", "league": "Eredivisie", "league_code": "nl-eredivisie", "competition_id": "nl-eredivisie", "secondary_competition_ids": "", "city": "Nijmegen", "stadium": "Goffertstadion", "short_code": "NEC"},
    {"team": "PSV", "league": "Eredivisie", "league_code": "nl-eredivisie", "competition_id": "nl-eredivisie", "secondary_competition_ids": "", "city": "Eindhoven", "stadium": "Philips Stadion", "short_code": "PSV"},
    {"team": "Sittard", "league": "Eredivisie", "league_code": "nl-eredivisie", "competition_id": "nl-eredivisie", "secondary_competition_ids": "", "city": "Sittard", "stadium": "Fortuna Sittard Stadion", "short_code": "SIT"},
    {"team": "Sparta Rotterdam", "league": "Eredivisie", "league_code": "nl-eredivisie", "competition_id": "nl-eredivisie", "secondary_competition_ids": "", "city": "Rotterdam", "stadium": "Spartastadion Het Kasteel", "short_code": "SPR"},
    {"team": "Telstar", "league": "Eredivisie", "league_code": "nl-eredivisie", "competition_id": "nl-eredivisie", "secondary_competition_ids": "", "city": "Velsen", "stadium": "BUKO Stadion", "short_code": "TEL"},
    {"team": "Twente", "league": "Eredivisie", "league_code": "nl-eredivisie", "competition_id": "nl-eredivisie", "secondary_competition_ids": "", "city": "Enschede", "stadium": "De Grolsch Veste", "short_code": "TWE"},
    {"team": "Utrecht", "league": "Eredivisie", "league_code": "nl-eredivisie", "competition_id": "nl-eredivisie", "secondary_competition_ids": "", "city": "Utrecht", "stadium": "Stadion Galgenwaard", "short_code": "UTR"},
    {"team": "FC Volendam", "league": "Eredivisie", "league_code": "nl-eredivisie", "competition_id": "nl-eredivisie", "secondary_competition_ids": "", "city": "Volendam", "stadium": "Kras Stadion", "short_code": "VOL"},
    {"team": "Zwolle", "league": "Eredivisie", "league_code": "nl-eredivisie", "competition_id": "nl-eredivisie", "secondary_competition_ids": "", "city": "Zwolle", "stadium": "MAC³PARK Stadion", "short_code": "ZWO"},
    {"team": "ADO Den Haag", "league": "Eerste Divisie", "league_code": "nl-eerste-divisie", "competition_id": "nl-eerste-divisie", "secondary_competition_ids": "", "city": "The Hague", "stadium": "WerkTalent Stadion", "short_code": "ADO"},
    {"team": "Almere City", "league": "Eerste Divisie", "league_code": "nl-eerste-divisie", "competition_id": "nl-eerste-divisie", "secondary_competition_ids": "nl-promotion-relegation-playoffs", "city": "Almere", "stadium": "Yanmar Stadion", "short_code": "ALM"},
    {"team": "Cambuur", "league": "Eerste Divisie", "league_code": "nl-eerste-divisie", "competition_id": "nl-eerste-divisie", "secondary_competition_ids": "", "city": "Leeuwarden", "stadium": "Kooi Stadion", "short_code": "CAM"},
    {"team": "De Graafschap", "league": "Eerste Divisie", "league_code": "nl-eerste-divisie", "competition_id": "nl-eerste-divisie", "secondary_competition_ids": "nl-promotion-relegation-playoffs", "city": "Doetinchem", "stadium": "Stadion De Vijverberg", "short_code": "DEG"},
    {"team": "Den Bosch", "league": "Eerste Divisie", "league_code": "nl-eerste-divisie", "competition_id": "nl-eerste-divisie", "secondary_competition_ids": "", "city": "'s-Hertogenbosch", "stadium": "Stadion De Vliert", "short_code": "DBO"},
    {"team": "Dordrecht", "league": "Eerste Divisie", "league_code": "nl-eerste-divisie", "competition_id": "nl-eerste-divisie", "secondary_competition_ids": "", "city": "Dordrecht", "stadium": "M-Scores Stadion", "short_code": "DOR"},
    {"team": "Eindhoven", "league": "Eerste Divisie", "league_code": "nl-eerste-divisie", "competition_id": "nl-eerste-divisie", "secondary_competition_ids": "", "city": "Eindhoven", "stadium": "Jan Louwers Stadion", "short_code": "EIN"},
    {"team": "Emmen", "league": "Eerste Divisie", "league_code": "nl-eerste-divisie", "competition_id": "nl-eerste-divisie", "secondary_competition_ids": "", "city": "Emmen", "stadium": "De Oude Meerdijk", "short_code": "EMM"},
    {"team": "Helmond Sport", "league": "Eerste Divisie", "league_code": "nl-eerste-divisie", "competition_id": "nl-eerste-divisie", "secondary_competition_ids": "", "city": "Helmond", "stadium": "GS Staalwerken Stadion", "short_code": "HEL"},
    {"team": "Jong Ajax", "league": "Eerste Divisie", "league_code": "nl-eerste-divisie", "competition_id": "nl-eerste-divisie", "secondary_competition_ids": "", "city": "Amsterdam", "stadium": "Sportpark De Toekomst", "short_code": "JAJ"},
    {"team": "Jong AZ", "league": "Eerste Divisie", "league_code": "nl-eerste-divisie", "competition_id": "nl-eerste-divisie", "secondary_competition_ids": "", "city": "Alkmaar", "stadium": "AFAS Trainingscomplex", "short_code": "JAZ"},
    {"team": "Jong PSV", "league": "Eerste Divisie", "league_code": "nl-eerste-divisie", "competition_id": "nl-eerste-divisie", "secondary_competition_ids": "", "city": "Eindhoven", "stadium": "PSV Campus De Herdgang", "short_code": "JPS"},
    {"team": "Jong FC Utrecht", "league": "Eerste Divisie", "league_code": "nl-eerste-divisie", "competition_id": "nl-eerste-divisie", "secondary_competition_ids": "", "city": "Utrecht", "stadium": "Sportcomplex Zoudenbalch", "short_code": "JUT"},
    {"team": "MVV Maastricht", "league": "Eerste Divisie", "league_code": "nl-eerste-divisie", "competition_id": "nl-eerste-divisie", "secondary_competition_ids": "", "city": "Maastricht", "stadium": "Stadion De Geusselt", "short_code": "MVV"},
    {"team": "RKC Waalwijk", "league": "Eerste Divisie", "league_code": "nl-eerste-divisie", "competition_id": "nl-eerste-divisie", "secondary_competition_ids": "nl-promotion-relegation-playoffs", "city": "Waalwijk", "stadium": "Mandemakers Stadion", "short_code": "RKC"},
    {"team": "Roda JC", "league": "Eerste Divisie", "league_code": "nl-eerste-divisie", "competition_id": "nl-eerste-divisie", "secondary_competition_ids": "", "city": "Kerkrade", "stadium": "Parkstad Limburg Stadion", "short_code": "ROD"},
    {"team": "TOP Oss", "league": "Eerste Divisie", "league_code": "nl-eerste-divisie", "competition_id": "nl-eerste-divisie", "secondary_competition_ids": "", "city": "Oss", "stadium": "Frans Heesenstadion", "short_code": "TOP"},
    {"team": "Vitesse", "league": "Eerste Divisie", "league_code": "nl-eerste-divisie", "competition_id": "nl-eerste-divisie", "secondary_competition_ids": "", "city": "Arnhem", "stadium": "GelreDome", "short_code": "VIT"},
    {"team": "VVV-Venlo", "league": "Eerste Divisie", "league_code": "nl-eerste-divisie", "competition_id": "nl-eerste-divisie", "secondary_competition_ids": "", "city": "Venlo", "stadium": "Covebo Stadion - De Koel", "short_code": "VVV"},
    {"team": "Willem II", "league": "Eerste Divisie", "league_code": "nl-eerste-divisie", "competition_id": "nl-eerste-divisie", "secondary_competition_ids": "nl-promotion-relegation-playoffs", "city": "Tilburg", "stadium": "Koning Willem II Stadion", "short_code": "WIL"},
    {"team": "ACV Assen", "league": "Tweede Divisie", "league_code": "nl-tweede-divisie", "competition_id": "nl-tweede-divisie", "secondary_competition_ids": "", "city": "Assen", "stadium": "Univé Sportpark", "short_code": "ACV"},
    {"team": "AFC", "league": "Tweede Divisie", "league_code": "nl-tweede-divisie", "competition_id": "nl-tweede-divisie", "secondary_competition_ids": "", "city": "Amsterdam", "stadium": "Sportpark Goed Genoeg", "short_code": "AFC"},
    {"team": "Barendrecht", "league": "Tweede Divisie", "league_code": "nl-tweede-divisie", "competition_id": "nl-tweede-divisie", "secondary_competition_ids": "", "city": "Barendrecht", "stadium": "Sportpark De Bongerd", "short_code": "BAR"},
    {"team": "Excelsior Maassluis", "league": "Tweede Divisie", "league_code": "nl-tweede-divisie", "competition_id": "nl-tweede-divisie", "secondary_competition_ids": "", "city": "Maassluis", "stadium": "Sportpark Dijkpolder", "short_code": "EXM"},
    {"team": "GVVV", "league": "Tweede Divisie", "league_code": "nl-tweede-divisie", "competition_id": "nl-tweede-divisie", "secondary_competition_ids": "", "city": "Veenendaal", "stadium": "Sportpark Panhuis", "short_code": "GVV"},
    {"team": "Hardenberg", "league": "Tweede Divisie", "league_code": "nl-tweede-divisie", "competition_id": "nl-tweede-divisie", "secondary_competition_ids": "", "city": "Hardenberg", "stadium": "Sportpark De Boshoek", "short_code": "HHC"},
    {"team": "HFC", "league": "Tweede Divisie", "league_code": "nl-tweede-divisie", "competition_id": "nl-tweede-divisie", "secondary_competition_ids": "", "city": "Haarlem", "stadium": "Sportpark Spanjaardslaan", "short_code": "HFC"},
    {"team": "Hoek", "league": "Tweede Divisie", "league_code": "nl-tweede-divisie", "competition_id": "nl-tweede-divisie", "secondary_competition_ids": "", "city": "Hoek", "stadium": "Sportpark Denoek", "short_code": "HOE"},
    {"team": "IJsselmeervogels", "league": "Tweede Divisie", "league_code": "nl-tweede-divisie", "competition_id": "nl-tweede-divisie", "secondary_competition_ids": "", "city": "Spakenburg", "stadium": "Sportpark De Westmaat", "short_code": "IJS"},
    {"team": "Jong Almere City", "league": "Tweede Divisie", "league_code": "nl-tweede-divisie", "competition_id": "nl-tweede-divisie", "secondary_competition_ids": "", "city": "Almere", "stadium": "Yanmar Stadion", "short_code": "JAC"},
    {"team": "Jong Sparta Rotterdam", "league": "Tweede Divisie", "league_code": "nl-tweede-divisie", "competition_id": "nl-tweede-divisie", "secondary_competition_ids": "", "city": "Rotterdam", "stadium": "Het Kasteel", "short_code": "JSP"},
    {"team": "Katwijk", "league": "Tweede Divisie", "league_code": "nl-tweede-divisie", "competition_id": "nl-tweede-divisie", "secondary_competition_ids": "", "city": "Katwijk", "stadium": "Sportpark De Krom", "short_code": "KAT"},
    {"team": "Kozakken Boys", "league": "Tweede Divisie", "league_code": "nl-tweede-divisie", "competition_id": "nl-tweede-divisie", "secondary_competition_ids": "", "city": "Werkendam", "stadium": "Sportpark De Zwaaier", "short_code": "KOZ"},
    {"team": "Quick Boys", "league": "Tweede Divisie", "league_code": "nl-tweede-divisie", "competition_id": "nl-tweede-divisie", "secondary_competition_ids": "", "city": "Katwijk aan Zee", "stadium": "Sportpark Nieuw Zuid", "short_code": "QUI"},
    {"team": "Rijnsburgse Boys", "league": "Tweede Divisie", "league_code": "nl-tweede-divisie", "competition_id": "nl-tweede-divisie", "secondary_competition_ids": "", "city": "Rijnsburg", "stadium": "Sportpark Middelmors", "short_code": "RIJ"},
    {"team": "Spakenburg", "league": "Tweede Divisie", "league_code": "nl-tweede-divisie", "competition_id": "nl-tweede-divisie", "secondary_competition_ids": "", "city": "Spakenburg", "stadium": "Sportpark De Westmaat", "short_code": "SPA"},
    {"team": "De Treffers", "league": "Tweede Divisie", "league_code": "nl-tweede-divisie", "competition_id": "nl-tweede-divisie", "secondary_competition_ids": "", "city": "Groesbeek", "stadium": "Sportpark Zuid", "short_code": "TRE"},
    {"team": "RKAV Volendam", "league": "Tweede Divisie", "league_code": "nl-tweede-divisie", "competition_id": "nl-tweede-divisie", "secondary_competition_ids": "", "city": "Volendam", "stadium": "KWABO-stadion", "short_code": "RKV"},
]

FIXTURE_SPECS = [
    {
        "source": EREDIVISIE_FIXTURES,
        "fixture_prefix": "nl1",
        "round_prefix": "Eredivisie - Runde",
        "timezone_offset": "+02:00",
        "competition_id": "nl-eredivisie",
    },
    {
        "source": TWEEDE_DIVISIE_FIXTURES,
        "fixture_prefix": "nl3",
        "round_prefix": "Tweede Divisie - Runde",
        "timezone_offset": "+02:00",
        "competition_id": "nl-tweede-divisie",
    },
    {
        "source": PLAYOFF_FIXTURES,
        "fixture_prefix": "nlpo",
        "round_prefix": "Eredivisie Playoffs - Kvartfinale",
        "timezone_offset": "+02:00",
        "competition_id": "nl-promotion-relegation-playoffs",
    },
]

FIXTURE_TEAM_ALIASES = {
    "Waalwijk": "RKC Waalwijk",
}


def slugify_team(team: str) -> str:
    return (
        team.lower()
        .replace("g.a. ", "ga-")
        .replace("&", "and")
        .replace("'", "")
        .replace(".", "")
        .replace("³", "3")
        .replace(" ", "-")
    )


def fetch_coordinates(stadium: str, city: str) -> tuple[float, float]:
    query = f"{stadium}, {city}, Netherlands"
    params = urllib.parse.urlencode(
        {
            "q": query,
            "format": "jsonv2",
            "limit": 1,
        }
    )
    request = urllib.request.Request(
        f"https://nominatim.openstreetmap.org/search?{params}",
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        payload = json.loads(response.read().decode("utf-8"))

    if not payload:
        fallback_query = f"{city}, Netherlands"
        fallback_params = urllib.parse.urlencode(
            {
                "q": fallback_query,
                "format": "jsonv2",
                "limit": 1,
            }
        )
        fallback_request = urllib.request.Request(
            f"https://nominatim.openstreetmap.org/search?{fallback_params}",
            headers={
                "User-Agent": USER_AGENT,
                "Accept": "application/json",
            },
        )
        with urllib.request.urlopen(fallback_request, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8"))

    if not payload:
        raise RuntimeError(f"Missing coordinates for {stadium} ({city})")

    return float(payload[0]["lat"]), float(payload[0]["lon"])


def load_coordinate_cache() -> dict[str, tuple[float, float]]:
    if not WEB_NETHERLANDS_JSON.exists():
        return {}

    existing = json.loads(WEB_NETHERLANDS_JSON.read_text(encoding="utf-8"))
    return {
        row["id"]: (float(row["lat"]), float(row["lon"]))
        for row in existing
        if "id" in row and "lat" in row and "lon" in row
    }


def enrich_team_rows() -> list[dict]:
    coordinate_cache = load_coordinate_cache()
    rows = []

    for row in TEAM_ROWS:
        team_id = f"nl-{slugify_team(row['team'])}"
        lat_lon = coordinate_cache.get(team_id)
        if lat_lon is None:
            lat_lon = fetch_coordinates(row["stadium"], row["city"])
            time.sleep(1)

        rows.append(
            {
                "id": team_id,
                "name": row["stadium"],
                "team": row["team"],
                "league": row["league"],
                "city": row["city"],
                "lat": lat_lon[0],
                "lon": lat_lon[1],
                "country_code": "nl",
                "league_code": row["league_code"],
                "league_pack": LEAGUE_PACK,
                "short_code": row["short_code"],
                "competition_id": row["competition_id"],
                "season_id": SEASON_ID,
                "membership_status": "active",
                "secondary_competition_ids": row["secondary_competition_ids"],
            }
        )

    return rows


def parse_fixture_source(source: str, round_prefix: str):
    fixtures = []
    current_round = None

    for raw_line in source.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        if line.startswith("RUNDE "):
            current_round = line.split()[-1]
            continue

        if line == "KVARTFINALERNE":
            current_round = "Kvartfinale"
            continue

        parts = line.split()
        date_part, time_part = parts[0], parts[1]
        teams = " ".join(parts[2:])

        matched = None
        for home in sorted(TEAM_BY_NAME.keys(), key=len, reverse=True):
            prefix = f"{home} "
            if teams.startswith(prefix):
                away = teams[len(prefix):]
                if away in TEAM_BY_NAME:
                    matched = (home, away)
                    break

        if matched is None:
            alias_teams = teams
            for alias, canonical in FIXTURE_TEAM_ALIASES.items():
                alias_teams = alias_teams.replace(alias, canonical)

            for home in sorted(TEAM_BY_NAME.keys(), key=len, reverse=True):
                prefix = f"{home} "
                if alias_teams.startswith(prefix):
                    away = alias_teams[len(prefix):]
                    if away in TEAM_BY_NAME:
                        matched = (home, away)
                        break

        if matched is None:
            raise RuntimeError(f"Unable to parse fixture line: {line}")

        day, month = date_part.split(".")[:2]
        home, away = matched
        fixtures.append(
            {
                "kickoff": f"2026-{month}-{day}T{time_part}:00",
                "round": f"{round_prefix} {current_round}" if current_round != "Kvartfinale" else round_prefix,
                "home": home,
                "away": away,
            }
        )

    return fixtures


def build_fixture_rows():
    rows = []
    for spec in FIXTURE_SPECS:
        parsed = parse_fixture_source(spec["source"], spec["round_prefix"])
        for index, fixture in enumerate(parsed, start=1):
            home = TEAM_BY_NAME[fixture["home"]]
            away = TEAM_BY_NAME[fixture["away"]]
            kickoff = f"{fixture['kickoff']}{spec['timezone_offset']}"
            rows.append(
                {
                    "id": f"{spec['fixture_prefix']}-{index:02d}-{home['id'].split('nl-')[1]}-{away['id'].split('nl-')[1]}",
                    "kickoff": kickoff,
                    "round": fixture["round"],
                    "homeTeamId": home["id"],
                    "awayTeamId": away["id"],
                    "venueClubId": home["id"],
                    "status": "scheduled",
                    "homeScore": "",
                    "awayScore": "",
                    "competitionId": spec["competition_id"],
                    "seasonId": SEASON_ID,
                }
            )
    return rows


def write_app_csv(rows: list[dict]):
    header = [
        "id",
        "name",
        "team",
        "league",
        "city",
        "lat",
        "lon",
        "country_code",
        "league_code",
        "league_pack",
        "short_code",
        "competition_id",
        "season_id",
        "membership_status",
        "secondary_competition_ids",
    ]

    with APP_NETHERLANDS_CSV.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=header)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def write_web_json(rows: list[dict]):
    payload = []
    for row in rows:
        payload.append(
            {
                "id": row["id"],
                "name": row["name"],
                "team": row["team"],
                "league": row["league"],
                "city": row["city"],
                "lat": row["lat"],
                "lon": row["lon"],
                "countryCode": row["country_code"],
                "leagueCode": row["league_code"],
                "leaguePack": row["league_pack"],
                "shortCode": row["short_code"],
                "primaryCompetitionId": row["competition_id"],
                "primarySeasonId": row["season_id"],
                "membershipStatus": row["membership_status"],
                "secondaryCompetitionIds": [
                    value
                    for value in row["secondary_competition_ids"].split("|")
                    if value
                ],
            }
        )

    WEB_NETHERLANDS_DIR.mkdir(parents=True, exist_ok=True)
    WEB_NETHERLANDS_JSON.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    WEB_NETHERLANDS_README.write_text(
        "# Netherlands Top 3\n\n"
        "Generated by `scripts/generate-netherlands-league-pack.py`.\n"
        "Includes Eredivisie, Eerste Divisie, Tweede Divisie and the current promotion/relegation playoff fixtures.\n",
        encoding="utf-8",
    )


def update_fixtures_csv(new_rows: list[dict]):
    desired_header = [
        "id",
        "kickoff",
        "round",
        "homeTeamId",
        "awayTeamId",
        "venueClubId",
        "status",
        "homeScore",
        "awayScore",
        "competitionId",
        "seasonId",
    ]

    existing_rows = []
    if APP_FIXTURES_CSV.exists():
        with APP_FIXTURES_CSV.open("r", encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                if row["id"].startswith(("nl1-", "nl3-", "nlpo-")):
                    continue
                existing_rows.append({key: row.get(key, "") for key in desired_header})

    existing_rows.extend(new_rows)

    with APP_FIXTURES_CSV.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=desired_header)
        writer.writeheader()
        writer.writerows(existing_rows)


TEAM_BY_NAME = {}


def main():
    rows = enrich_team_rows()
    TEAM_BY_NAME.update({row["team"]: row for row in rows})
    write_app_csv(rows)
    write_web_json(rows)
    fixture_rows = build_fixture_rows()
    update_fixtures_csv(fixture_rows)
    print(f"Wrote {len(rows)} clubs to {APP_NETHERLANDS_CSV.name}")
    print(f"Wrote {len(fixture_rows)} fixtures into {APP_FIXTURES_CSV.name}")


if __name__ == "__main__":
    main()
