#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo


WEBSITE_ROOT = Path(__file__).resolve().parent.parent
AGGREGATE_STADIUMS_JSON = WEBSITE_ROOT / "data" / "stadiums.json"
WEB_FIXTURES_JSON = WEBSITE_ROOT / "data" / "fixtures.json"
LEAGUE_PACKS_DIR = WEBSITE_ROOT / "data" / "league-packs"
ALIASES_JSON = WEBSITE_ROOT / "data" / "fixture-audits" / "flashscore-team-aliases.json"
LOCAL_TIMEZONE = ZoneInfo("Europe/Copenhagen")


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
    parser.add_argument(
        "--source-group-prefix",
        help="Optional source group prefix filter, e.g. 'BELGIEN: Jupiler League - Mesterskabet - Slutspil'",
    )
    parser.add_argument(
        "--exclude-source-group-prefix",
        action="append",
        default=[],
        help="Optional source group prefix to exclude; repeatable",
    )
    parser.add_argument(
        "--source-round-prefix",
        help="Optional source round-label prefix filter, e.g. 'Kvartfinalerne'",
    )
    parser.add_argument(
        "--exclude-source-round-prefix",
        action="append",
        default=[],
        help="Optional source round-label prefix to exclude; repeatable",
    )
    parser.add_argument(
        "--from-date",
        help="Optional local kickoff date filter (inclusive), format YYYY-MM-DD",
    )
    parser.add_argument(
        "--to-date",
        help="Optional local kickoff date filter (inclusive), format YYYY-MM-DD",
    )
    parser.add_argument(
        "--from-datetime",
        help="Optional local kickoff datetime filter (inclusive), format YYYY-MM-DDTHH:MM",
    )
    return parser.parse_args()


def normalize_text(value: str) -> str:
    folded = unicodedata.normalize("NFKD", value)
    stripped = "".join(character for character in folded if not unicodedata.combining(character))
    lowered = stripped.lower()
    lowered = lowered.replace("&", " and ")
    lowered = re.sub(r"[^a-z0-9]+", " ", lowered)
    return re.sub(r"\s+", " ", lowered).strip()


def source_round_matches_filter(
    source_group: str,
    round_label: str,
    source_group_prefix: str | None,
    exclude_source_group_prefixes: list[str],
    source_round_prefix: str | None,
    exclude_source_round_prefixes: list[str],
) -> bool:
    if source_group_prefix and not source_group.startswith(source_group_prefix):
        return False
    if any(source_group.startswith(prefix) for prefix in exclude_source_group_prefixes):
        return False
    if source_round_prefix and not round_label.startswith(source_round_prefix):
        return False
    if any(round_label.startswith(prefix) for prefix in exclude_source_round_prefixes):
        return False
    return True


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


def load_competition_club_ids() -> dict[str, set[str]]:
    mapping: dict[str, set[str]] = defaultdict(set)

    def merge_stadium_entries(stadiums: list[dict]) -> None:
        for stadium in stadiums:
            club_id = stadium.get("id")
            competition_id = (stadium.get("competition_id") or stadium.get("primaryCompetitionId") or "").strip()
            secondary_ids = [
                value.strip()
                for value in (
                    stadium.get("secondaryCompetitionIds")
                    if isinstance(stadium.get("secondaryCompetitionIds"), list)
                    else str(stadium.get("secondary_competition_ids") or "").split(",")
                )
                if value.strip()
            ]
            if not club_id:
                continue
            for value in [competition_id, *secondary_ids]:
                if value:
                    mapping[value].add(club_id)

    if AGGREGATE_STADIUMS_JSON.exists():
        merge_stadium_entries(load_json(AGGREGATE_STADIUMS_JSON))

    if LEAGUE_PACKS_DIR.exists():
        for sidecar in sorted(LEAGUE_PACKS_DIR.glob("*/stadiums.json")):
            merge_stadium_entries(load_json(sidecar))

    return mapping


def load_fixtures(
    club_names: dict[str, str],
    competition_id: str | None,
    season_id: str,
    fixture_prefix: str | None,
    round_prefix: str | None,
    from_date: date | None,
    to_date: date | None,
    from_datetime: datetime | None,
) -> list[FixtureRow]:
    rows: list[FixtureRow] = []
    source_rows = load_json(WEB_FIXTURES_JSON)

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
        kickoff_local = kickoff_dt.astimezone(LOCAL_TIMEZONE).replace(tzinfo=None)
        kickoff_date = kickoff_dt.date()
        if from_date and kickoff_date < from_date:
            continue
        if to_date and kickoff_date > to_date:
            continue
        if from_datetime and kickoff_local < from_datetime:
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


def filter_source_lines(
    source_path: Path,
    from_date: date | None,
    to_date: date | None,
    source_group_prefix: str | None,
    exclude_source_group_prefixes: list[str],
    source_round_prefix: str | None,
    exclude_source_round_prefixes: list[str],
    from_datetime: datetime | None,
    allowed_line_aliases: set[str] | None,
) -> list[str]:
    filtered: list[str] = []
    for raw_line in source_path.read_text(encoding="utf-8").splitlines():
        parts = [part.strip() for part in raw_line.split("|")]
        if len(parts) < 5:
            continue
        dt_token, source_group, round_label, home, away = parts[:5]
        try:
            kickoff = datetime.strptime(f"{dt_token} 2026", "%d %m %H %M %Y")
        except ValueError:
            continue
        if from_datetime and kickoff < from_datetime:
            continue
        if from_date and kickoff.date() < from_date:
            continue
        if to_date and kickoff.date() > to_date:
            continue
        if not source_round_matches_filter(
            source_group,
            round_label,
            source_group_prefix,
            exclude_source_group_prefixes,
            source_round_prefix,
            exclude_source_round_prefixes,
        ):
            continue
        if allowed_line_aliases is not None:
            if normalize_text(home) not in allowed_line_aliases or normalize_text(away) not in allowed_line_aliases:
                continue
        filtered.append(raw_line)
    return filtered


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
    from_date = date.fromisoformat(args.from_date) if args.from_date else None
    to_date = date.fromisoformat(args.to_date) if args.to_date else None
    from_datetime = datetime.fromisoformat(args.from_datetime) if args.from_datetime else None
    alias_map = load_aliases()
    source_lines = filter_source_lines(
        source_path,
        from_date,
        to_date,
        args.source_group_prefix,
        list(args.exclude_source_group_prefix or []),
        args.source_round_prefix,
        list(args.exclude_source_round_prefix or []),
        from_datetime,
        None,
    )
    club_names = load_club_names()
    competition_club_ids = load_competition_club_ids()
    allowed_line_aliases: set[str] | None = None
    if args.competition:
        club_ids = competition_club_ids.get(args.competition)
        if club_ids:
            allowed_line_aliases = set()
            for club_id in club_ids:
                canonical_name = club_names.get(club_id)
                if not canonical_name:
                    continue
                allowed_line_aliases.update(build_aliases(club_id, canonical_name, alias_map))
            source_lines = filter_source_lines(
                source_path,
                from_date,
                to_date,
                args.source_group_prefix,
                list(args.exclude_source_group_prefix or []),
                args.source_round_prefix,
                list(args.exclude_source_round_prefix or []),
                from_datetime,
                allowed_line_aliases,
            )
    source_text = normalize_text("\n".join(source_lines))
    fixtures = load_fixtures(
        club_names,
        args.competition,
        args.season,
        args.fixture_prefix,
        args.round_prefix,
        from_date,
        to_date,
        from_datetime,
    )

    if not fixtures:
        if source_lines:
            print(
                f"Source has {len(source_lines)} future fixture(s), but no local fixtures found for competition={args.competition} fixturePrefix={args.fixture_prefix} roundPrefix={args.round_prefix} season={args.season}",
                file=sys.stderr,
            )
            return 2
        print(
            f"No fixtures found in forward window for competition={args.competition} fixturePrefix={args.fixture_prefix} roundPrefix={args.round_prefix} season={args.season}",
            file=sys.stdout,
        )
        return 0

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
