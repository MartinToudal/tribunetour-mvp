#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
import re
import subprocess
import sys
import unicodedata
from dataclasses import asdict, dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo


WEBSITE_ROOT = Path(__file__).resolve().parent.parent
WORKSPACE_ROOT = WEBSITE_ROOT.parent
APP_FIXTURES_CSV = WORKSPACE_ROOT / "Tribunetour" / "fixtures.csv"
CONFIG_PATH = WEBSITE_ROOT / "data" / "fixture-audits" / "audits.json"
REPORT_DIR = WEBSITE_ROOT / "data" / "fixture-audits" / "reports"
FETCH_SCRIPT = WEBSITE_ROOT / "scripts" / "fetch-flashscore-fixtures.py"
FIXTURE_AUDIT_RUNNER = WEBSITE_ROOT / "scripts" / "run-fixture-audits.py"
GENERATE_DATA_SCRIPT = WEBSITE_ROOT / "scripts" / "generate-reference-data.mjs"
FIXTURES_JSON = WEBSITE_ROOT / "data" / "fixtures.json"
AGGREGATE_STADIUMS_JSON = WEBSITE_ROOT / "data" / "stadiums.json"
LEAGUE_PACKS_DIR = WEBSITE_ROOT / "data" / "league-packs"
ALIASES_JSON = WEBSITE_ROOT / "data" / "fixture-audits" / "flashscore-team-aliases.json"
FIXTURE_FIELDNAMES = [
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


@dataclass
class LocalFixture:
    fixture_id: str
    kickoff: str
    round: str
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


@dataclass
class DailyAuditResult:
    audit_id: str
    label: str
    status: str
    details: str


@dataclass
class DailySyncResult:
    audit_id: str
    label: str
    updated_count: int
    added_count: int
    removed_count: int
    updates: list[dict]
    added: list[dict]
    removed: list[dict]
    skipped_count: int
    skipped: list[dict]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run a daily near-term fixture check across all configured competitions.")
    parser.add_argument("--apply-safe-updates", action="store_true", help="Apply safe kickoff updates before auditing")
    parser.add_argument("--days-ahead", type=int, default=2, help="How many days ahead to include after today (default: 2)")
    parser.add_argument("--local-date", help="Override local Copenhagen date for testing, format YYYY-MM-DD")
    return parser.parse_args()


def normalize_text(value: str) -> str:
    folded = unicodedata.normalize("NFKD", value)
    stripped = "".join(character for character in folded if not unicodedata.combining(character))
    lowered = stripped.lower().replace("&", " and ")
    lowered = re.sub(r"[^a-z0-9]+", " ", lowered)
    return re.sub(r"\s+", " ", lowered).strip()


def persist_fixture_rows(source_rows: list[dict]) -> None:
    FIXTURES_JSON.write_text(json.dumps(source_rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    csv_rows: list[dict[str, str]] = []
    for row in source_rows:
        csv_rows.append(
            {
                key: "" if row.get(key) is None else str(row.get(key, ""))
                for key in FIXTURE_FIELDNAMES
            }
        )

    if APP_FIXTURES_CSV.parent.exists():
        with APP_FIXTURES_CSV.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=FIXTURE_FIELDNAMES)
            writer.writeheader()
            writer.writerows(csv_rows)
    else:
        print(f"Skipping app fixtures CSV sync because directory is missing: {APP_FIXTURES_CSV.parent}")


def slugify(value: str) -> str:
    return normalize_text(value).replace(" ", "-")


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def load_config() -> list[dict]:
    payload = load_json(CONFIG_PATH)
    return payload.get("audits", [])


def load_aliases() -> dict[str, list[str]]:
    if not ALIASES_JSON.exists():
        return {}
    payload = load_json(ALIASES_JSON)
    return {key: [str(item) for item in value] for key, value in payload.items()}


def source_round_matches_audit(audit: dict, source_group: str, round_label: str) -> bool:
    include_group_prefix = str(audit.get("sourceGroupPrefix") or "").strip()
    exclude_group_prefixes = [str(value).strip() for value in audit.get("excludeSourceGroupPrefixes", []) if str(value).strip()]
    include_prefix = str(audit.get("sourceRoundPrefix") or "").strip()
    exclude_prefixes = [str(value).strip() for value in audit.get("excludeSourceRoundPrefixes", []) if str(value).strip()]

    if include_group_prefix and not source_group.startswith(include_group_prefix):
        return False
    if any(source_group.startswith(prefix) for prefix in exclude_group_prefixes):
        return False
    if include_prefix and not round_label.startswith(include_prefix):
        return False
    if any(round_label.startswith(prefix) for prefix in exclude_prefixes):
        return False
    return True


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


def build_alias_map(club_names: dict[str, str], aliases: dict[str, list[str]]) -> dict[str, str]:
    alias_to_club_id: dict[str, str] = {}
    for club_id, canonical_name in club_names.items():
        for value in [canonical_name, *aliases.get(club_id, [])]:
            normalized = normalize_text(value)
            if normalized and normalized not in alias_to_club_id:
                alias_to_club_id[normalized] = club_id
    return alias_to_club_id


def report_paths() -> dict[str, Path]:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    return {
        "json": REPORT_DIR / "latest-daily.json",
        "md": REPORT_DIR / "latest-daily.md",
        "updates_json": REPORT_DIR / "latest-daily-updates.json",
        "updates_md": REPORT_DIR / "latest-daily-updates.md",
    }


def refresh_source(audit: dict, source: Path) -> str | None:
    fetch = audit.get("fetch")
    if not fetch:
        return None

    cmd = [
        sys.executable,
        str(FETCH_SCRIPT),
        "--url",
        fetch["url"],
        "--output",
        str(source),
        "--timezone",
        fetch.get("timezone", "Europe/Copenhagen"),
    ]
    if fetch.get("competitionFilter"):
        cmd.extend(["--competition-filter", fetch["competitionFilter"]])

    completed = subprocess.run(cmd, capture_output=True, text=True, cwd=WEBSITE_ROOT)
    if completed.returncode == 0:
        return None
    return completed.stdout.strip() or completed.stderr.strip() or "(no output)"


def run_targeted_fixture_audits(audit_ids: list[str]) -> dict[str, DailySyncResult]:
    if not audit_ids:
        return {}
    completed = subprocess.run(
        [
            sys.executable,
            str(FIXTURE_AUDIT_RUNNER),
            "--apply-safe-updates",
            "--skip-report-write",
            "--json-output",
            *[argument for audit_id in audit_ids for argument in ("--audit-id", audit_id)],
        ],
        capture_output=True,
        text=True,
        cwd=WEBSITE_ROOT,
    )
    if completed.returncode not in (0, 2):
        raise RuntimeError(completed.stdout.strip() or completed.stderr.strip() or "Targeted fixture audit failed")
    payload = json.loads(completed.stdout.strip())
    sync_map: dict[str, DailySyncResult] = {}
    for result in payload.get("syncResults", []):
        sync_map[result["audit_id"]] = DailySyncResult(
            result["audit_id"],
            result["label"],
            int(result.get("updated_count", 0)),
            int(result.get("added_count", 0)),
            int(result.get("removed_count", 0)),
            result.get("updates", []),
            result.get("added", []),
            result.get("removed", []),
            int(result.get("skipped_count", 0)),
            result.get("skipped", []),
        )
    return sync_map


def merge_sync_results(primary: DailySyncResult, follow_up: DailySyncResult) -> DailySyncResult:
    updates = [*primary.updates, *follow_up.updates]
    added = [*primary.added, *follow_up.added]
    removed = [*primary.removed, *follow_up.removed]
    skipped = [*primary.skipped, *follow_up.skipped]
    return DailySyncResult(
        primary.audit_id,
        primary.label,
        len(updates) + len(added) + len(removed),
        len(added),
        len(removed),
        updates,
        added,
        removed,
        len(skipped),
        skipped,
    )


def matches_audit(row: dict, audit: dict) -> bool:
    row_id = row["id"]
    row_round = row.get("round") or ""
    row_competition = (row.get("competitionId") or "").strip()

    matches_competition = bool(audit.get("competitionId") and row_competition == audit["competitionId"])
    matches_fixture_prefix = bool(audit.get("fixturePrefix") and row_id.startswith(audit["fixturePrefix"]))
    matches_round_prefix = bool(audit.get("roundPrefix") and row_round.startswith(audit["roundPrefix"]))
    return any([matches_competition, matches_fixture_prefix, matches_round_prefix])


def local_date_from_kickoff(kickoff: str) -> date:
    return datetime.fromisoformat(kickoff).date()


def select_local_fixtures(source_rows: list[dict], audit: dict, club_names: dict[str, str], from_date: date, to_date: date) -> tuple[list[LocalFixture], dict[str, dict]]:
    selected: list[LocalFixture] = []
    rows_by_id: dict[str, dict] = {}

    for row in source_rows:
        if not matches_audit(row, audit):
            continue
        row_season = (row.get("seasonId") or audit["season"]).strip() or audit["season"]
        if row_season != audit["season"]:
            continue
        kickoff_date = local_date_from_kickoff(row["kickoff"])
        if kickoff_date < from_date or kickoff_date > to_date:
            continue
        home_team_id = row["homeTeamId"]
        away_team_id = row["awayTeamId"]
        fixture = LocalFixture(
            fixture_id=row["id"],
            kickoff=row["kickoff"],
            round=row.get("round") or "",
            home_team_id=home_team_id,
            away_team_id=away_team_id,
            home_name=club_names.get(home_team_id, home_team_id),
            away_name=club_names.get(away_team_id, away_team_id),
        )
        selected.append(fixture)
        rows_by_id[fixture.fixture_id] = row
    return selected, rows_by_id


def load_local_fixtures(audit: dict, club_names: dict[str, str], from_date: date, to_date: date) -> tuple[list[dict], list[LocalFixture], dict[str, dict]]:
    source_rows = load_json(FIXTURES_JSON)
    selected, rows_by_id = select_local_fixtures(source_rows, audit, club_names, from_date, to_date)
    return source_rows, selected, rows_by_id


def has_duplicate_future_pairings(audit: dict, rows: list[dict], from_date: date) -> bool:
    pair_counts: dict[tuple[str, str], int] = {}
    for row in rows:
        if not matches_audit(row, audit):
            continue
        row_season = (row.get("seasonId") or audit["season"]).strip() or audit["season"]
        if row_season != audit["season"]:
            continue
        kickoff_date = local_date_from_kickoff(row["kickoff"])
        if kickoff_date < from_date:
            continue
        key = (row["homeTeamId"], row["awayTeamId"])
        pair_counts[key] = pair_counts.get(key, 0) + 1
        if pair_counts[key] > 1:
            return True
    return False


def parse_source_matches(
    audit: dict,
    source_path: Path,
    alias_to_club_id: dict[str, str],
    allowed_club_ids: set[str] | None,
    from_date: date,
    to_date: date,
) -> tuple[list[SourceFixture], list[dict]]:
    fixtures: list[SourceFixture] = []
    unresolved: list[dict] = []

    for raw_line in source_path.read_text(encoding="utf-8").splitlines():
        parts = [part.strip() for part in raw_line.split("|")]
        if len(parts) < 5:
            continue
        dt_token, source_group, round_label, home, away = parts[:5]
        try:
            kickoff_dt = datetime.strptime(f"{dt_token} 2026", "%d %m %H %M %Y")
        except ValueError:
            continue

        if kickoff_dt.date() < from_date or kickoff_dt.date() > to_date:
            continue
        if not source_round_matches_audit(audit, source_group, round_label):
            continue

        home_id = alias_to_club_id.get(normalize_text(home))
        away_id = alias_to_club_id.get(normalize_text(away))
        if allowed_club_ids is not None and not (home_id in allowed_club_ids and away_id in allowed_club_ids):
            continue
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
                kickoff=kickoff_dt.isoformat(),
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


def build_fixture_id(audit: dict, source_fixture: SourceFixture) -> str:
    prefix = audit.get("fixturePrefix") or f"{audit['id']}-"
    kickoff_dt = datetime.fromisoformat(source_fixture.kickoff)
    home_slug = slugify(source_fixture.home_name)
    away_slug = slugify(source_fixture.away_name)
    return f"{prefix}{kickoff_dt.strftime('%Y%m%d')}-{home_slug}-{away_slug}"


def compare_audit(
    audit: dict,
    local_fixtures: list[LocalFixture],
    source_fixtures: list[SourceFixture],
) -> tuple[str, str]:
    local_by_key = {(fixture.home_team_id, fixture.away_team_id): fixture for fixture in local_fixtures}
    source_by_key = {(fixture.home_team_id, fixture.away_team_id): fixture for fixture in source_fixtures}

    exact: list[str] = []
    time_mismatches: list[str] = []
    missing_local: list[str] = []
    missing_source: list[str] = []

    for key, source_fixture in source_by_key.items():
        local_fixture = local_by_key.get(key)
        if not local_fixture:
            missing_local.append(
                f"{datetime.fromisoformat(source_fixture.kickoff).strftime('%d.%m %H:%M')} {source_fixture.home_name} vs {source_fixture.away_name}"
            )
            continue
        local_time = datetime.fromisoformat(local_fixture.kickoff).strftime("%d.%m %H:%M")
        source_time = datetime.fromisoformat(source_fixture.kickoff).strftime("%d.%m %H:%M")
        if local_fixture.kickoff == iso_with_offset(source_fixture.kickoff, local_fixture.kickoff):
            exact.append(f"{local_time} {local_fixture.home_name} vs {local_fixture.away_name} [{local_fixture.fixture_id}]")
        else:
            time_mismatches.append(
                f"{local_fixture.home_name} vs {local_fixture.away_name} [{local_fixture.fixture_id}] local={local_time} source={source_time}"
            )

    for key, local_fixture in local_by_key.items():
        if key not in source_by_key:
            missing_source.append(
                f"{datetime.fromisoformat(local_fixture.kickoff).strftime('%d.%m %H:%M')} {local_fixture.home_name} vs {local_fixture.away_name} [{local_fixture.fixture_id}]"
            )

    lines = [
        f"Local fixtures in window: {len(local_fixtures)}",
        f"Source fixtures in window: {len(source_fixtures)}",
        "",
        f"missing-local: {len(missing_local)}",
    ]
    if missing_local:
        lines.extend(f"  - {item}" for item in missing_local[:20])
    lines.extend(["", f"time-mismatch: {len(time_mismatches)}"])
    if time_mismatches:
        lines.extend(f"  - {item}" for item in time_mismatches[:20])
    lines.extend(["", f"missing-source: {len(missing_source)}"])
    if missing_source:
        lines.extend(f"  - {item}" for item in missing_source[:20])
    lines.extend(["", f"exact: {len(exact)}"])
    if exact:
        lines.extend(f"  - {item}" for item in exact[:20])

    status = "passed" if not missing_local and not time_mismatches else "needs-attention"
    return status, "\n".join(lines)


def apply_safe_updates(
    audit: dict,
    local_fixtures: list[LocalFixture],
    all_rows: list[dict],
    rows_by_id: dict[str, dict],
    source_fixtures: list[SourceFixture],
) -> DailySyncResult:
    local_by_key = {(fixture.home_team_id, fixture.away_team_id): fixture for fixture in local_fixtures}
    source_by_key = {(fixture.home_team_id, fixture.away_team_id): fixture for fixture in source_fixtures}
    updates: list[dict] = []
    added: list[dict] = []
    removed: list[dict] = []
    skipped: list[dict] = []

    for source_fixture in source_fixtures:
        key = (source_fixture.home_team_id, source_fixture.away_team_id)
        local_fixture = local_by_key.get(key)
        if not local_fixture:
            fixture_id = build_fixture_id(audit, source_fixture)
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
                "seasonId": audit["season"],
            }
            if audit.get("competitionId"):
                new_row["competitionId"] = audit["competitionId"]
            all_rows.append(new_row)
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
        new_kickoff = iso_with_offset(source_fixture.kickoff, local_fixture.kickoff)
        row = rows_by_id[local_fixture.fixture_id]
        changed = False
        visible_change = False
        change_record = {
            "fixtureId": local_fixture.fixture_id,
            "home": local_fixture.home_name,
            "away": local_fixture.away_name,
            "oldKickoff": local_fixture.kickoff,
            "newKickoff": new_kickoff,
            "oldRound": local_fixture.round,
            "newRound": source_fixture.round,
        }
        if new_kickoff != local_fixture.kickoff:
            row["kickoff"] = new_kickoff
            changed = True
            visible_change = True
        if source_fixture.round and row.get("round") != source_fixture.round:
            row["round"] = source_fixture.round
            changed = True
        if audit.get("competitionId") and row.get("competitionId") != audit["competitionId"]:
            row["competitionId"] = audit["competitionId"]
            changed = True
        if row.get("seasonId") != audit["season"]:
            row["seasonId"] = audit["season"]
            changed = True
        if changed and visible_change:
            updates.append(change_record)

    if not source_fixtures and local_fixtures:
        skipped.append(
            {
                "fixtureId": "(bulk-removal-guard)",
                "reason": "empty-source-window",
                "home": audit["label"],
                "away": f"{len(local_fixtures)} local fixture(s) retained",
            }
        )
        total_updated = len(updates) + len(added) + len(removed)
        return DailySyncResult(
            audit["id"],
            audit["label"],
            total_updated,
            len(added),
            len(removed),
            updates,
            added,
            removed,
            len(skipped),
            skipped,
        )

    for local_fixture in local_fixtures:
        key = (local_fixture.home_team_id, local_fixture.away_team_id)
        if key in source_by_key:
            continue
        row = rows_by_id.get(local_fixture.fixture_id)
        if not row:
            continue
        if row in all_rows:
            all_rows.remove(row)
        rows_by_id.pop(local_fixture.fixture_id, None)
        removed.append(
            {
                "fixtureId": local_fixture.fixture_id,
                "home": local_fixture.home_name,
                "away": local_fixture.away_name,
                "kickoff": local_fixture.kickoff,
                "round": local_fixture.round,
            }
        )

    total_updated = len(updates) + len(added) + len(removed)
    return DailySyncResult(
        audit["id"],
        audit["label"],
        total_updated,
        len(added),
        len(removed),
        updates,
        added,
        removed,
        len(skipped),
        skipped,
    )


def write_daily_reports(
    local_date: str,
    to_date: str,
    audit_results: list[DailyAuditResult],
    sync_results: list[DailySyncResult],
) -> None:
    paths = report_paths()
    generated_at = datetime.now(timezone.utc).isoformat()
    failures = [result for result in audit_results if result.status != "passed"]
    total_updated = sum(result.updated_count for result in sync_results)
    total_skipped = sum(result.skipped_count for result in sync_results)

    summary = {
        "generatedAt": generated_at,
        "window": {"from": local_date, "to": to_date},
        "checkedCompetitions": len(audit_results),
        "failingCompetitions": len(failures),
        "totalUpdated": total_updated,
        "totalSkipped": total_skipped,
    }

    payload = {**summary, "results": [asdict(result) for result in audit_results]}
    paths["json"].write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    lines = [
        "# Daily fixture check",
        "",
        f"Generated at: {generated_at}",
        f"Window: {local_date} → {to_date}",
        f"Checked competitions: {len(audit_results)}",
        f"Failing competitions: {len(failures)}",
        f"Automatic fixture updates: {total_updated}",
        "",
    ]
    for result in audit_results:
        lines.append(f"## {result.label} (`{result.audit_id}`)")
        lines.append(f"Status: **{result.status}**")
        lines.append("")
        lines.append("```text")
        lines.append(result.details.rstrip())
        lines.append("```")
        lines.append("")
    paths["md"].write_text("\n".join(lines), encoding="utf-8")

    update_payload = {**summary, "results": [asdict(result) for result in sync_results]}
    paths["updates_json"].write_text(json.dumps(update_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    update_lines = [
        "# Daily fixture check updates",
        "",
        f"Generated at: {generated_at}",
        f"Window: {local_date} → {to_date}",
        f"Changed fixtures: **{total_updated}**",
        f"Skipped fixtures: **{total_skipped}**",
        "",
    ]
    for result in sync_results:
        if result.updated_count == 0 and result.skipped_count == 0:
            continue
        update_lines.append(f"## {result.label} (`{result.audit_id}`)")
        update_lines.append(f"Changed: **{result.updated_count}**")
        update_lines.append(f"Added: **{result.added_count}**")
        update_lines.append(f"Removed: **{result.removed_count}**")
        update_lines.append(f"Skipped: **{result.skipped_count}**")
        update_lines.append("")
        for update in result.updates[:10]:
            update_lines.append(
                f"- `{update['fixtureId']}` {update['home']} vs {update['away']}: `{update['oldKickoff']}` -> `{update['newKickoff']}`"
            )
        for added in result.added[:10]:
            update_lines.append(
                f"- added `{added['fixtureId']}` {added['home']} vs {added['away']}: `{added['kickoff']}`"
            )
        for removed in result.removed[:10]:
            update_lines.append(
                f"- removed `{removed['fixtureId']}` {removed['home']} vs {removed['away']}: `{removed['kickoff']}`"
            )
        for skipped in result.skipped[:10]:
            update_lines.append(
                f"- skipped `{skipped['fixtureId']}` {skipped['home']} vs {skipped['away']}: {skipped['reason']}"
            )
        update_lines.append("")
    paths["updates_md"].write_text("\n".join(update_lines), encoding="utf-8")


def main() -> int:
    args = parse_args()
    audits = load_config()
    if not audits:
        print("No audits configured", file=sys.stderr)
        return 1

    tz = ZoneInfo("Europe/Copenhagen")
    local_today = date.fromisoformat(args.local_date) if args.local_date else datetime.now(tz).date()
    local_end = local_today + timedelta(days=max(args.days_ahead, 0))

    aliases = load_aliases()
    club_names = load_club_names()
    competition_club_ids = load_competition_club_ids()
    alias_to_club_id = build_alias_map(club_names, aliases)

    refreshed_sources: dict[Path, str | None] = {}
    for audit in audits:
        source = WEBSITE_ROOT / audit["source"]
        if source in refreshed_sources:
            continue
        refreshed_sources[source] = refresh_source(audit, source)

    all_rows = load_json(FIXTURES_JSON)
    rows_by_id_global = {row["id"]: row for row in all_rows}

    sync_results: list[DailySyncResult] = []
    source_fixtures_by_audit: dict[str, list[SourceFixture]] = {}
    unresolved_by_audit: dict[str, list[dict]] = {}
    audit_by_id = {audit["id"]: audit for audit in audits}

    for audit in audits:
        source = WEBSITE_ROOT / audit["source"]
        refresh_error = refreshed_sources.get(source)
        if refresh_error:
            sync_results.append(DailySyncResult(audit["id"], audit["label"], 0, 0, 0, [], [], [], 0, []))
            source_fixtures_by_audit[audit["id"]] = []
            unresolved_by_audit[audit["id"]] = [{"home": refresh_error, "away": "", "homeResolved": False, "awayResolved": False}]
            continue

        _rows, local_fixtures, _rows_by_id = load_local_fixtures(audit, club_names, local_today, local_end)
        source_fixtures, unresolved = parse_source_matches(
            audit,
            source,
            alias_to_club_id,
            competition_club_ids.get(audit.get("competitionId", "")) if audit.get("competitionId") else None,
            local_today,
            local_end,
        )
        source_fixtures_by_audit[audit["id"]] = source_fixtures
        unresolved_by_audit[audit["id"]] = unresolved

        sync_result = DailySyncResult(audit["id"], audit["label"], 0, 0, 0, [], [], [], len(unresolved), unresolved)
        if args.apply_safe_updates:
            sync_result = apply_safe_updates(audit, local_fixtures, all_rows, rows_by_id_global, source_fixtures)
            sync_result.skipped.extend(
                {
                    "fixtureId": "(unresolved-source)",
                    "reason": "unresolved-source-team",
                    "home": item["home"],
                    "away": item["away"],
                }
                for item in unresolved
            )
            sync_result.skipped_count = len(sync_result.skipped)
        sync_results.append(sync_result)

    if args.apply_safe_updates and any(result.updated_count > 0 for result in sync_results):
        persist_fixture_rows(all_rows)
        completed = subprocess.run(
            ["node", str(GENERATE_DATA_SCRIPT)],
            capture_output=True,
            text=True,
            cwd=WEBSITE_ROOT,
        )
        if completed.returncode != 0:
            print(completed.stdout)
            print(completed.stderr, file=sys.stderr)
            return completed.returncode

        follow_up_ids = [
            result.audit_id
            for result in sync_results
            if result.updated_count > 0
            or has_duplicate_future_pairings(audit_by_id[result.audit_id], all_rows, local_today)
        ]
        if follow_up_ids:
            sync_result_map = {result.audit_id: result for result in sync_results}
            follow_up_results = run_targeted_fixture_audits(follow_up_ids)
            follow_up_changed = any(result.updated_count > 0 for result in follow_up_results.values())
            for audit_id, follow_up_result in follow_up_results.items():
                original = sync_result_map.get(audit_id)
                if not original:
                    continue
                sync_result_map[audit_id] = merge_sync_results(original, follow_up_result)

            sync_results = [sync_result_map.get(result.audit_id, result) for result in sync_results]
            if follow_up_changed:
                all_rows = load_json(FIXTURES_JSON)
                rows_by_id_global = {row["id"]: row for row in all_rows}

    audit_results: list[DailyAuditResult] = []
    for audit in audits:
        source = WEBSITE_ROOT / audit["source"]
        refresh_error = refreshed_sources.get(source)
        if refresh_error:
            audit_results.append(DailyAuditResult(audit["id"], audit["label"], "fetch-failed", refresh_error))
            continue

        synced_local_fixtures, _ = select_local_fixtures(all_rows, audit, club_names, local_today, local_end)
        source_fixtures = source_fixtures_by_audit.get(audit["id"], [])
        unresolved = unresolved_by_audit.get(audit["id"], [])
        status, details = compare_audit(audit, synced_local_fixtures, source_fixtures)
        if unresolved:
            unresolved_lines = [
                "",
                f"unresolved-source-teams: {len(unresolved)}",
                *[
                    f"  - {item['home']} vs {item['away']} (homeResolved={item['homeResolved']}, awayResolved={item['awayResolved']})"
                    for item in unresolved[:20]
                ],
            ]
            details = details + "\n" + "\n".join(unresolved_lines)
            status = "needs-attention"
        audit_results.append(DailyAuditResult(audit["id"], audit["label"], status, details))

    write_daily_reports(local_today.isoformat(), local_end.isoformat(), audit_results, sync_results)

    for result in audit_results:
        print(f"[{result.status}] {result.label}")

    if any(result.status != "passed" for result in audit_results):
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
