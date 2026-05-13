#!/usr/bin/env python3
from __future__ import annotations

import argparse
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
CONFIG_PATH = WEBSITE_ROOT / "data" / "fixture-audits" / "audits.json"
REPORT_DIR = WEBSITE_ROOT / "data" / "fixture-audits" / "reports"
FETCH_SCRIPT = WEBSITE_ROOT / "scripts" / "fetch-flashscore-fixtures.py"
GENERATE_DATA_SCRIPT = WEBSITE_ROOT / "scripts" / "generate-reference-data.mjs"
FIXTURES_JSON = WEBSITE_ROOT / "data" / "fixtures.json"
AGGREGATE_STADIUMS_JSON = WEBSITE_ROOT / "data" / "stadiums.json"
LEAGUE_PACKS_DIR = WEBSITE_ROOT / "data" / "league-packs"
ALIASES_JSON = WEBSITE_ROOT / "data" / "fixture-audits" / "flashscore-team-aliases.json"


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
    updates: list[dict]
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


def load_local_fixtures(audit: dict, club_names: dict[str, str], from_date: date, to_date: date) -> tuple[list[dict], list[LocalFixture], dict[str, dict]]:
    source_rows = load_json(FIXTURES_JSON)
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
    return source_rows, selected, rows_by_id


def parse_source_matches(source_path: Path, alias_to_club_id: dict[str, str], from_date: date, to_date: date) -> tuple[list[SourceFixture], list[dict]]:
    fixtures: list[SourceFixture] = []
    unresolved: list[dict] = []

    for raw_line in source_path.read_text(encoding="utf-8").splitlines():
        parts = [part.strip() for part in raw_line.split("|")]
        if len(parts) < 5:
            continue
        dt_token, _country, _round, home, away = parts[:5]
        try:
            kickoff_dt = datetime.strptime(f"{dt_token} 2026", "%d %m %H %M %Y")
        except ValueError:
            continue

        if kickoff_dt.date() < from_date or kickoff_dt.date() > to_date:
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
                kickoff=kickoff_dt.isoformat(),
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

    status = "passed" if not missing_local and not time_mismatches and not missing_source else "needs-attention"
    return status, "\n".join(lines)


def apply_safe_updates(
    audit: dict,
    local_fixtures: list[LocalFixture],
    rows_by_id: dict[str, dict],
    source_fixtures: list[SourceFixture],
) -> DailySyncResult:
    local_by_key = {(fixture.home_team_id, fixture.away_team_id): fixture for fixture in local_fixtures}
    updates: list[dict] = []
    skipped: list[dict] = []

    for source_fixture in source_fixtures:
        key = (source_fixture.home_team_id, source_fixture.away_team_id)
        local_fixture = local_by_key.get(key)
        if not local_fixture:
            skipped.append(
                {
                    "fixtureId": "(missing-local)",
                    "reason": "missing-local-match",
                    "home": source_fixture.home_name,
                    "away": source_fixture.away_name,
                }
            )
            continue
        new_kickoff = iso_with_offset(source_fixture.kickoff, local_fixture.kickoff)
        if new_kickoff == local_fixture.kickoff:
            continue
        rows_by_id[local_fixture.fixture_id]["kickoff"] = new_kickoff
        updates.append(
            {
                "fixtureId": local_fixture.fixture_id,
                "home": local_fixture.home_name,
                "away": local_fixture.away_name,
                "oldKickoff": local_fixture.kickoff,
                "newKickoff": new_kickoff,
            }
        )
    return DailySyncResult(audit["id"], audit["label"], len(updates), updates, len(skipped), skipped)


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
        f"Updated fixtures: **{total_updated}**",
        f"Skipped fixtures: **{total_skipped}**",
        "",
    ]
    for result in sync_results:
        if result.updated_count == 0 and result.skipped_count == 0:
            continue
        update_lines.append(f"## {result.label} (`{result.audit_id}`)")
        update_lines.append(f"Updated: **{result.updated_count}**")
        update_lines.append(f"Skipped: **{result.skipped_count}**")
        update_lines.append("")
        for update in result.updates[:10]:
            update_lines.append(
                f"- `{update['fixtureId']}` {update['home']} vs {update['away']}: `{update['oldKickoff']}` -> `{update['newKickoff']}`"
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
    audit_results: list[DailyAuditResult] = []

    for audit in audits:
        source = WEBSITE_ROOT / audit["source"]
        refresh_error = refreshed_sources.get(source)
        if refresh_error:
            sync_results.append(DailySyncResult(audit["id"], audit["label"], 0, [], 0, []))
            audit_results.append(DailyAuditResult(audit["id"], audit["label"], "fetch-failed", refresh_error))
            continue

        _rows, local_fixtures, rows_by_id = load_local_fixtures(audit, club_names, local_today, local_end)
        source_fixtures, unresolved = parse_source_matches(source, alias_to_club_id, local_today, local_end)

        sync_result = DailySyncResult(audit["id"], audit["label"], 0, [], len(unresolved), unresolved)
        if args.apply_safe_updates:
            sync_result = apply_safe_updates(audit, local_fixtures, rows_by_id_global, source_fixtures)
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

        status, details = compare_audit(audit, local_fixtures, source_fixtures)
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

    if args.apply_safe_updates and any(result.updated_count > 0 for result in sync_results):
        FIXTURES_JSON.write_text(json.dumps(all_rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
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

    write_daily_reports(local_today.isoformat(), local_end.isoformat(), audit_results, sync_results)

    for result in audit_results:
        print(f"[{result.status}] {result.label}")

    if any(result.status != "passed" for result in audit_results):
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
