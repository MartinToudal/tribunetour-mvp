#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import unicodedata
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime
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


@dataclass
class SourceFixture:
    kickoff: str
    round: str
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
    parser.add_argument("--from-date", help="Optional local kickoff date filter (inclusive), format YYYY-MM-DD")
    parser.add_argument("--to-date", help="Optional local kickoff date filter (inclusive), format YYYY-MM-DD")
    return parser.parse_args()


def normalize_text(value: str) -> str:
    folded = unicodedata.normalize("NFKD", value)
    stripped = "".join(character for character in folded if not unicodedata.combining(character))
    lowered = stripped.lower().replace("&", " and ")
    lowered = re.sub(r"[^a-z0-9]+", " ", lowered)
    return re.sub(r"\s+", " ", lowered).strip()


def slugify(value: str) -> str:
    return normalize_text(value).replace(" ", "-")


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def load_aliases() -> dict[str, list[str]]:
    if not ALIASES_JSON.exists():
        return {}
    payload = load_json(ALIASES_JSON)
    return {key: [str(item) for item in value] for key, value in payload.items()}


def source_round_matches_filter(round_label: str, round_prefix: str | None) -> bool:
    if not round_prefix:
        return True
    return round_label.startswith(round_prefix)


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
    from_date: date | None,
    to_date: date | None,
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
        kickoff_dt = datetime.fromisoformat(row["kickoff"])
        kickoff_date = kickoff_dt.date()
        if from_date and kickoff_date < from_date:
            continue
        if to_date and kickoff_date > to_date:
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


def parse_source_matches(
    source_path: Path,
    alias_to_club_id: dict[str, str],
    round_prefix: str | None,
    from_date: date | None,
    to_date: date | None,
) -> tuple[list[SourceFixture], list[dict]]:
    fixtures: list[SourceFixture] = []
    unresolved: list[dict] = []

    for raw_line in source_path.read_text(encoding="utf-8").splitlines():
        parts = [part.strip() for part in raw_line.split("|")]
        if len(parts) < 5:
            continue

        dt_token, _country, round_label, home, away = parts[:5]
        try:
            kickoff = datetime.strptime(f"{dt_token} 2026", "%d %m %H %M %Y")
        except ValueError:
            continue
        if from_date and kickoff.date() < from_date:
            continue
        if to_date and kickoff.date() > to_date:
            continue
        if not source_round_matches_filter(round_label, round_prefix):
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

        fixtures.append(
            SourceFixture(
                kickoff=kickoff.isoformat(),
                round=round_label,
                home_team_id=home_id,
                away_team_id=away_id,
                home_name=home,
                away_name=away,
            )
        )

    return fixtures, unresolved


def iso_with_offset(dt_iso: str, existing_kickoff: str | None = None) -> str:
    offset = "+02:00"
    if existing_kickoff and len(existing_kickoff) >= 6 and existing_kickoff[-6] in ["+", "-"]:
        offset = existing_kickoff[-6:]
    return datetime.fromisoformat(dt_iso).strftime("%Y-%m-%dT%H:%M:%S") + offset


def build_fixture_id(prefix: str, source_fixture: SourceFixture) -> str:
    kickoff_dt = datetime.fromisoformat(source_fixture.kickoff)
    return f"{prefix}{kickoff_dt.strftime('%Y%m%d')}-{slugify(source_fixture.home_name)}-{slugify(source_fixture.away_name)}"


def main() -> int:
    args = parse_args()
    source_path = Path(args.source).expanduser().resolve()
    if not source_path.exists():
        raise SystemExit(f"Missing source file: {source_path}")
    if not args.competition and not args.fixture_prefix and not args.round_prefix:
        raise SystemExit("One of --competition, --fixture-prefix or --round-prefix is required")
    from_date = date.fromisoformat(args.from_date) if args.from_date else None
    to_date = date.fromisoformat(args.to_date) if args.to_date else None

    aliases = load_aliases()
    club_names = load_club_names()
    alias_to_club_id = build_alias_map(club_names, aliases)
    source_rows, fixtures = load_fixtures(
        club_names,
        args.competition,
        args.season,
        args.fixture_prefix,
        args.round_prefix,
        from_date,
        to_date,
    )

    source_fixtures, unresolved = parse_source_matches(
        source_path,
        alias_to_club_id,
        args.round_prefix,
        from_date,
        to_date,
    )
    rows_by_id = {row["id"]: row for row in source_rows}
    local_by_key = {(fixture.home_team_id, fixture.away_team_id): fixture for fixture in fixtures}

    updates: list[dict] = []
    added: list[dict] = []
    removed: list[dict] = []
    skipped: list[dict] = []

    fixture_prefix = args.fixture_prefix or (f"{args.competition}-" if args.competition else "fixture-")

    for source_fixture in source_fixtures:
        key = (source_fixture.home_team_id, source_fixture.away_team_id)
        local_fixture = local_by_key.get(key)
        if not local_fixture:
            fixture_id = build_fixture_id(fixture_prefix, source_fixture)
            new_row = {
                "id": fixture_id,
                "kickoff": iso_with_offset(source_fixture.kickoff),
                "round": source_fixture.round,
                "homeTeamId": source_fixture.home_team_id,
                "awayTeamId": source_fixture.away_team_id,
                "venueClubId": source_fixture.home_team_id,
                "status": "scheduled",
                "homeScore": None,
                "awayScore": None,
                "seasonId": args.season,
            }
            if args.competition:
                new_row["competitionId"] = args.competition
            source_rows.append(new_row)
            rows_by_id[fixture_id] = new_row
            added.append(
                {
                    "fixtureId": fixture_id,
                    "home": source_fixture.home_name,
                    "away": source_fixture.away_name,
                    "kickoff": new_row["kickoff"],
                    "round": source_fixture.round,
                }
            )
            continue

        existing_kickoff = local_fixture.kickoff
        new_kickoff = iso_with_offset(source_fixture.kickoff, existing_kickoff)
        row = rows_by_id[local_fixture.fixture_id]
        changed = False
        visible_change = False
        change_record = {
            "fixtureId": local_fixture.fixture_id,
            "home": local_fixture.home_name,
            "away": local_fixture.away_name,
            "oldKickoff": existing_kickoff,
            "newKickoff": new_kickoff,
            "oldRound": local_fixture.round,
            "newRound": source_fixture.round,
        }
        if new_kickoff != existing_kickoff:
            row["kickoff"] = new_kickoff
            changed = True
            visible_change = True
        if source_fixture.round and row.get("round") != source_fixture.round:
            row["round"] = source_fixture.round
            changed = True
        if args.competition and row.get("competitionId") != args.competition:
            row["competitionId"] = args.competition
            changed = True
        if row.get("seasonId") != args.season:
            row["seasonId"] = args.season
            changed = True
        if changed and visible_change:
            updates.append(change_record)

    source_keys = {(fixture.home_team_id, fixture.away_team_id) for fixture in source_fixtures}
    if args.write:
        for fixture in fixtures:
            key = (fixture.home_team_id, fixture.away_team_id)
            if key in source_keys:
                continue
            row = rows_by_id.get(fixture.fixture_id)
            if not row:
                continue
            try:
                source_rows.remove(row)
            except ValueError:
                continue
            removed.append(
                {
                    "fixtureId": fixture.fixture_id,
                    "home": fixture.home_name,
                    "away": fixture.away_name,
                    "kickoff": fixture.kickoff,
                }
            )

    if args.write and (updates or added or removed):
        FIXTURES_JSON.write_text(json.dumps(source_rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    payload = {
        "competition": args.competition or args.fixture_prefix or args.round_prefix,
        "season": args.season,
        "fixturesConsidered": len(fixtures),
        "updatedCount": len(updates) + len(added) + len(removed),
        "addedCount": len(added),
        "removedCount": len(removed),
        "skippedCount": len(skipped),
        "unresolvedSourceTeams": unresolved,
        "updates": updates,
        "added": added,
        "removed": removed,
        "skipped": skipped,
    }
    print(json.dumps(payload, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
