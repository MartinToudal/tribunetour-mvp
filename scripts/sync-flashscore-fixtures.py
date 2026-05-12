#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import unicodedata
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path


WEBSITE_ROOT = Path(__file__).resolve().parent.parent
FIXTURES_JSON = WEBSITE_ROOT / "data" / "fixtures.json"
AGGREGATE_STADIUMS_JSON = WEBSITE_ROOT / "data" / "stadiums.json"
LEAGUE_PACKS_DIR = WEBSITE_ROOT / "data" / "league-packs"
ALIASES_JSON = WEBSITE_ROOT / "data" / "fixture-audits" / "flashscore-team-aliases.json"


@dataclass
class FixtureRow:
    fixture_id: str
    kickoff: str
    round: str
    competition_id: str
    season_id: str
    home_team_id: str
    away_team_id: str
    home_name: str
    away_name: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Synchronize safe fixture kickoff updates from raw Flashscore text."
    )
    parser.add_argument("--competition", help="Competition id from fixtures data, e.g. tr-super-lig")
    parser.add_argument("--source", required=True, help="Path to a raw copied Flashscore text file for one competition")
    parser.add_argument("--season", default="2025-26", help="Season id to sync (default: 2025-26)")
    parser.add_argument("--fixture-prefix", help="Optional fixture id prefix for legacy rows, e.g. sl-")
    parser.add_argument("--round-prefix", help="Optional round prefix for legacy rows, e.g. 'Superliga - '")
    parser.add_argument("--write", action="store_true", help="Persist safe updates to data/fixtures.json")
    return parser.parse_args()


def normalize_text(value: str) -> str:
    folded = unicodedata.normalize("NFKD", value)
    stripped = "".join(character for character in folded if not unicodedata.combining(character))
    lowered = stripped.lower().replace("&", " and ")
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
) -> tuple[list[dict], list[FixtureRow]]:
    source_rows = load_json(FIXTURES_JSON)
    selected: list[FixtureRow] = []

    for row in source_rows:
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
        selected.append(
            FixtureRow(
                fixture_id=row_id,
                kickoff=row["kickoff"],
                round=row_round,
                competition_id=row_competition or (competition_id or fixture_prefix or round_prefix or "legacy"),
                season_id=row_season,
                home_team_id=home_team_id,
                away_team_id=away_team_id,
                home_name=club_names.get(home_team_id, home_team_id),
                away_name=club_names.get(away_team_id, away_team_id),
            )
        )

    return source_rows, selected


def build_alias_map(club_names: dict[str, str], aliases: dict[str, list[str]]) -> dict[str, str]:
    alias_to_club_id: dict[str, str] = {}
    for club_id, canonical_name in club_names.items():
        for value in [canonical_name, *aliases.get(club_id, [])]:
            normalized = normalize_text(value)
            if normalized and normalized not in alias_to_club_id:
                alias_to_club_id[normalized] = club_id
    return alias_to_club_id


def parse_source_matches(source_path: Path, alias_to_club_id: dict[str, str]) -> tuple[dict[tuple[str, str], list[datetime]], list[dict]]:
    matches: dict[tuple[str, str], list[datetime]] = defaultdict(list)
    unresolved: list[dict] = []

    for raw_line in source_path.read_text(encoding="utf-8").splitlines():
        parts = [part.strip() for part in raw_line.split("|")]
        if len(parts) < 5:
            continue

        dt_token, _country, _round, home, away = parts[:5]
        try:
            kickoff = datetime.strptime(f"{dt_token} 2026", "%d %m %H %M %Y")
        except ValueError:
            continue

        home_id = alias_to_club_id.get(normalize_text(home))
        away_id = alias_to_club_id.get(normalize_text(away))

        if not home_id or not away_id:
            unresolved.append(
                {
                    "home": home,
                    "away": away,
                    "homeResolved": bool(home_id),
                    "awayResolved": bool(away_id),
                }
            )
            continue

        matches[(home_id, away_id)].append(kickoff)

    return matches, unresolved


def main() -> int:
    args = parse_args()
    source_path = Path(args.source).expanduser().resolve()
    if not source_path.exists():
        raise SystemExit(f"Missing source file: {source_path}")
    if not args.competition and not args.fixture_prefix and not args.round_prefix:
        raise SystemExit("One of --competition, --fixture-prefix or --round-prefix is required")

    aliases = load_aliases()
    club_names = load_club_names()
    alias_to_club_id = build_alias_map(club_names, aliases)
    source_rows, fixtures = load_fixtures(
        club_names,
        args.competition,
        args.season,
        args.fixture_prefix,
        args.round_prefix,
    )

    source_matches, unresolved = parse_source_matches(source_path, alias_to_club_id)
    rows_by_id = {row["id"]: row for row in source_rows}

    updates: list[dict] = []
    skipped: list[dict] = []

    for fixture in fixtures:
        key = (fixture.home_team_id, fixture.away_team_id)
        matched_kickoffs = source_matches.get(key, [])

        if not matched_kickoffs:
            skipped.append(
                {
                    "fixtureId": fixture.fixture_id,
                    "reason": "missing-source-match",
                    "home": fixture.home_name,
                    "away": fixture.away_name,
                }
            )
            continue

        unique_kickoffs = sorted({kickoff.isoformat() for kickoff in matched_kickoffs})
        if len(unique_kickoffs) > 1:
            skipped.append(
                {
                    "fixtureId": fixture.fixture_id,
                    "reason": "ambiguous-source-match",
                    "home": fixture.home_name,
                    "away": fixture.away_name,
                    "candidates": unique_kickoffs,
                }
            )
            continue

        existing_kickoff = fixture.kickoff
        offset = existing_kickoff[-6:] if len(existing_kickoff) >= 6 and existing_kickoff[-6] in ["+", "-"] else "+02:00"
        new_kickoff = datetime.fromisoformat(unique_kickoffs[0]).strftime("%Y-%m-%dT%H:%M:%S") + offset
        if new_kickoff == existing_kickoff:
            continue

        row = rows_by_id[fixture.fixture_id]
        row["kickoff"] = new_kickoff
        updates.append(
            {
                "fixtureId": fixture.fixture_id,
                "home": fixture.home_name,
                "away": fixture.away_name,
                "oldKickoff": existing_kickoff,
                "newKickoff": new_kickoff,
            }
        )

    if args.write and updates:
        FIXTURES_JSON.write_text(json.dumps(source_rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    payload = {
        "competition": args.competition or args.fixture_prefix or args.round_prefix,
        "season": args.season,
        "fixturesConsidered": len(fixtures),
        "updatedCount": len(updates),
        "skippedCount": len(skipped),
        "unresolvedSourceTeams": unresolved,
        "updates": updates,
        "skipped": skipped,
    }
    print(json.dumps(payload, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
