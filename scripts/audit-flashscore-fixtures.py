#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import unicodedata
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path


WEBSITE_ROOT = Path(__file__).resolve().parent.parent
WORKSPACE_ROOT = WEBSITE_ROOT.parent
APP_DIR = WORKSPACE_ROOT / "Tribunetour"
APP_FIXTURES_CSV = APP_DIR / "fixtures.csv"
AGGREGATE_STADIUMS_JSON = WEBSITE_ROOT / "data" / "stadiums.json"
LEAGUE_PACKS_DIR = WEBSITE_ROOT / "data" / "league-packs"
ALIASES_JSON = WEBSITE_ROOT / "data" / "fixture-audits" / "flashscore-team-aliases.json"


@dataclass
class FixtureRow:
    fixture_id: str
    kickoff: str
    competition_id: str
    season_id: str
    home_team_id: str
    away_team_id: str
    home_name: str
    away_name: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Audit Tribunetour fixtures against raw Flashscore text."
    )
    parser.add_argument(
        "--competition",
        help="Competition id from fixtures.csv, e.g. tr-super-lig",
    )
    parser.add_argument(
        "--source",
        required=True,
        help="Path to a raw copied Flashscore text file for one competition",
    )
    parser.add_argument(
        "--season",
        default="2025-26",
        help="Season id to audit (default: 2025-26)",
    )
    parser.add_argument(
        "--fixture-prefix",
        help="Optional fixture id prefix for legacy rows, e.g. sl-",
    )
    parser.add_argument(
        "--round-prefix",
        help="Optional round prefix for legacy rows, e.g. 'Superliga - '",
    )
    return parser.parse_args()


def normalize_text(value: str) -> str:
    folded = unicodedata.normalize("NFKD", value)
    stripped = "".join(character for character in folded if not unicodedata.combining(character))
    lowered = stripped.lower()
    lowered = lowered.replace("&", " and ")
    lowered = re.sub(r"[^a-z0-9]+", " ", lowered)
    return re.sub(r"\s+", " ", lowered).strip()


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def load_aliases() -> dict[str, list[str]]:
    if not ALIASES_JSON.exists():
        return {}
    payload = load_json(ALIASES_JSON)
    return {key: [str(item) for item in value] for key, value in payload.items()}


def load_club_names() -> dict[str, str]:
    names: dict[str, str] = {}

    def merge_stadium_entries(stadiums: list[dict]) -> None:
        for stadium in stadiums:
            club_id = stadium.get("id")
            team = stadium.get("team")
            if club_id and team and club_id not in names:
                names[club_id] = team

    if AGGREGATE_STADIUMS_JSON.exists():
        merge_stadium_entries(load_json(AGGREGATE_STADIUMS_JSON))

    if LEAGUE_PACKS_DIR.exists():
        for sidecar in sorted(LEAGUE_PACKS_DIR.glob("*/stadiums.json")):
            merge_stadium_entries(load_json(sidecar))

    return names


def load_fixtures(
    club_names: dict[str, str],
    competition_id: str | None,
    season_id: str,
    fixture_prefix: str | None,
    round_prefix: str | None,
) -> list[FixtureRow]:
    rows: list[FixtureRow] = []
    with APP_FIXTURES_CSV.open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            row_competition = (row.get("competitionId") or "").strip()
            row_season = (row.get("seasonId") or season_id).strip() or season_id
            row_id = row["id"]
            row_round = row.get("round") or ""

            matches_competition = bool(competition_id and row_competition == competition_id)
            matches_fixture_prefix = bool(fixture_prefix and row_id.startswith(fixture_prefix))
            matches_round_prefix = bool(round_prefix and row_round.startswith(round_prefix))

            if not any([matches_competition, matches_fixture_prefix, matches_round_prefix]):
                continue
            if row_season != season_id:
                continue
            home_team_id = row["homeTeamId"]
            away_team_id = row["awayTeamId"]
            rows.append(
                FixtureRow(
                    fixture_id=row["id"],
                    kickoff=row["kickoff"],
                    competition_id=row_competition or (competition_id or fixture_prefix or round_prefix or "legacy"),
                    season_id=row_season,
                    home_team_id=home_team_id,
                    away_team_id=away_team_id,
                    home_name=club_names.get(home_team_id, home_team_id),
                    away_name=club_names.get(away_team_id, away_team_id),
                )
            )
    return rows


def kickoff_tokens(kickoff: str) -> tuple[str, str]:
    dt = datetime.fromisoformat(kickoff)
    return dt.strftime("%d %m"), dt.strftime("%H %M")


def build_aliases(club_id: str, canonical_name: str, alias_map: dict[str, list[str]]) -> list[str]:
    raw_values = [canonical_name, *alias_map.get(club_id, [])]
    seen = set()
    aliases = []
    for value in raw_values:
        normalized = normalize_text(value)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        aliases.append(normalized)
    return aliases


def build_exact_patterns(date_token: str, time_token: str, home_aliases: list[str], away_aliases: list[str]) -> list[re.Pattern]:
    patterns: list[re.Pattern] = []
    for home in home_aliases:
        for away in away_aliases:
            patterns.append(
                re.compile(
                    rf"{re.escape(date_token)}\s+{re.escape(time_token)}(?:\s+\w+)*\s+{re.escape(home)}(?:\s+\w+)*\s+{re.escape(away)}",
                    re.IGNORECASE,
                )
            )
    return patterns


def build_date_patterns(date_token: str, home_aliases: list[str], away_aliases: list[str]) -> list[re.Pattern]:
    patterns: list[re.Pattern] = []
    for home in home_aliases:
        for away in away_aliases:
            patterns.append(
                re.compile(
                    rf"{re.escape(date_token)}(?:\s+\w+)*\s+{re.escape(home)}(?:\s+\w+)*\s+{re.escape(away)}",
                    re.IGNORECASE,
                )
            )
    return patterns


def build_team_patterns(home_aliases: list[str], away_aliases: list[str]) -> list[re.Pattern]:
    patterns: list[re.Pattern] = []
    for home in home_aliases:
        for away in away_aliases:
            patterns.append(
                re.compile(
                    rf"{re.escape(home)}(?:\s+\w+)*\s+{re.escape(away)}",
                    re.IGNORECASE,
                )
            )
    return patterns


def evaluate_fixture(
    fixture: FixtureRow,
    source_text: str,
    alias_map: dict[str, list[str]],
) -> tuple[str, str]:
    home_aliases = build_aliases(fixture.home_team_id, fixture.home_name, alias_map)
    away_aliases = build_aliases(fixture.away_team_id, fixture.away_name, alias_map)
    date_token, time_token = kickoff_tokens(fixture.kickoff)

    exact_patterns = build_exact_patterns(date_token, time_token, home_aliases, away_aliases)
    if any(pattern.search(source_text) for pattern in exact_patterns):
        return ("exact", "Eksakt match på dato, tid og hold")

    if any(pattern.search(source_text) for pattern in build_date_patterns(date_token, home_aliases, away_aliases)):
        return ("time-mismatch", f"Hold og dato matcher, men tiden {time_token.replace(' ', ':')} blev ikke fundet")

    if any(pattern.search(source_text) for pattern in build_team_patterns(home_aliases, away_aliases)):
        return ("date-mismatch", "Hold matcher, men dato/tid ser anderledes ud")

    return ("missing", "Kunne ikke finde kampen i Flashscore-udtrækket")


def main() -> int:
    args = parse_args()
    source_path = Path(args.source).expanduser().resolve()
    if not source_path.exists():
        print(f"Missing source file: {source_path}", file=sys.stderr)
        return 1
    if not args.competition and not args.fixture_prefix and not args.round_prefix:
        print("One of --competition, --fixture-prefix or --round-prefix is required", file=sys.stderr)
        return 1

    source_text = normalize_text(source_path.read_text(encoding="utf-8"))
    alias_map = load_aliases()
    club_names = load_club_names()
    fixtures = load_fixtures(
        club_names,
        args.competition,
        args.season,
        args.fixture_prefix,
        args.round_prefix,
    )

    if not fixtures:
        print(
            f"No fixtures found for competition={args.competition} fixturePrefix={args.fixture_prefix} roundPrefix={args.round_prefix} season={args.season}",
            file=sys.stderr,
        )
        return 1

    grouped: dict[str, list[tuple[FixtureRow, str]]] = defaultdict(list)
    for fixture in fixtures:
        status, message = evaluate_fixture(fixture, source_text, alias_map)
        grouped[status].append((fixture, message))

    print(f"Competition: {args.competition or args.fixture_prefix or args.round_prefix}")
    print(f"Season: {args.season}")
    print(f"Fixtures audited: {len(fixtures)}")
    print("")

    order = ["missing", "time-mismatch", "date-mismatch", "exact"]
    for key in order:
        items = grouped.get(key, [])
        print(f"{key}: {len(items)}")
        for fixture, message in items:
            kickoff = datetime.fromisoformat(fixture.kickoff).strftime("%d.%m %H:%M")
            print(f"  - {kickoff} {fixture.home_name} vs {fixture.away_name} [{fixture.fixture_id}] -> {message}")
        print("")

    return 0 if not grouped.get("missing") and not grouped.get("time-mismatch") and not grouped.get("date-mismatch") else 2


if __name__ == "__main__":
    raise SystemExit(main())
