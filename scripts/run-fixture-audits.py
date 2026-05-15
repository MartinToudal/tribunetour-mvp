#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path


WEBSITE_ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = WEBSITE_ROOT / "data" / "fixture-audits" / "audits.json"
REPORT_DIR = WEBSITE_ROOT / "data" / "fixture-audits" / "reports"
AUDIT_SCRIPT = WEBSITE_ROOT / "scripts" / "audit-flashscore-fixtures.py"
FETCH_SCRIPT = WEBSITE_ROOT / "scripts" / "fetch-flashscore-fixtures.py"
SYNC_SCRIPT = WEBSITE_ROOT / "scripts" / "sync-flashscore-fixtures.py"
GENERATE_DATA_SCRIPT = WEBSITE_ROOT / "scripts" / "generate-reference-data.mjs"


@dataclass
class AuditResult:
    audit_id: str
    label: str
    status: str
    details: str


@dataclass
class SyncResult:
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
    unresolved_source_teams: list[dict]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run configured Flashscore fixture audits.")
    parser.add_argument("--all", action="store_true", help="Run all configured audits regardless of cadence")
    parser.add_argument("--due", action="store_true", help="Run only audits that are due today")
    parser.add_argument("--apply-safe-updates", action="store_true", help="Apply safe kickoff updates before auditing")
    return parser.parse_args()


def load_config() -> list[dict]:
    payload = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    return payload.get("audits", [])


def is_due_today(anchor_date: str, interval_days: int) -> bool:
    anchor = date.fromisoformat(anchor_date)
    today = datetime.now(timezone.utc).date()
    delta = (today - anchor).days
    return delta >= 0 and delta % interval_days == 0


def write_report(results: list[AuditResult]) -> None:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).isoformat()
    json_path = REPORT_DIR / "latest.json"
    markdown_path = REPORT_DIR / "latest.md"

    json_payload = {
        "generatedAt": timestamp,
        "checkedCompetitions": len(results),
        "failingCompetitions": len([result for result in results if result.status != "passed"]),
        "results": [
            {
                "id": result.audit_id,
                "label": result.label,
                "status": result.status,
                "details": result.details,
            }
            for result in results
        ],
    }
    json_path.write_text(json.dumps(json_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    lines = [f"# Fixture audit report", "", f"Generated at: {timestamp}", ""]
    for result in results:
        lines.append(f"## {result.label} (`{result.audit_id}`)")
        lines.append(f"Status: **{result.status}**")
        lines.append("")
        lines.append("```text")
        lines.append(result.details.rstrip())
        lines.append("```")
        lines.append("")
    markdown_path.write_text("\n".join(lines), encoding="utf-8")


def write_update_report(results: list[SyncResult]) -> None:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).isoformat()
    json_path = REPORT_DIR / "latest-updates.json"
    markdown_path = REPORT_DIR / "latest-updates.md"

    total_updated = sum(result.updated_count for result in results)
    total_skipped = sum(result.skipped_count for result in results)
    json_payload = {
        "generatedAt": timestamp,
        "totalUpdated": total_updated,
        "totalSkipped": total_skipped,
        "results": [
            {
                "id": result.audit_id,
                "label": result.label,
                "updatedCount": result.updated_count,
                "addedCount": result.added_count,
                "removedCount": result.removed_count,
                "updates": result.updates,
                "added": result.added,
                "removed": result.removed,
                "skippedCount": result.skipped_count,
                "skipped": result.skipped,
                "unresolvedSourceTeams": result.unresolved_source_teams,
            }
            for result in results
        ],
    }
    json_path.write_text(json.dumps(json_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    lines = [
        "# Fixture auto-update report",
        "",
        f"Generated at: {timestamp}",
        "",
        f"Updated fixtures: **{total_updated}**",
        f"Skipped fixtures: **{total_skipped}**",
        "",
    ]
    for result in results:
        if result.updated_count == 0 and result.skipped_count == 0 and not result.unresolved_source_teams:
            continue
        lines.append(f"## {result.label} (`{result.audit_id}`)")
        lines.append(f"Changed: **{result.updated_count}**")
        lines.append(f"Added: **{result.added_count}**")
        lines.append(f"Removed: **{result.removed_count}**")
        lines.append(f"Skipped: **{result.skipped_count}**")
        lines.append("")
        if result.updates:
            lines.append("### Updated fixtures")
            for update in result.updates:
                lines.append(
                    f"- `{update['fixtureId']}` {update['home']} vs {update['away']}: "
                    f"`{update['oldKickoff']}` -> `{update['newKickoff']}`"
                )
            lines.append("")
        if result.added:
            lines.append("### Added fixtures")
            for item in result.added[:30]:
                lines.append(f"- `{item['fixtureId']}` {item['home']} vs {item['away']}: `{item['kickoff']}`")
            lines.append("")
        if result.removed:
            lines.append("### Removed fixtures")
            for item in result.removed[:30]:
                lines.append(f"- `{item['fixtureId']}` {item['home']} vs {item['away']}: `{item['kickoff']}`")
            lines.append("")
        if result.skipped:
            lines.append("### Skipped fixtures")
            for skipped in result.skipped[:20]:
                lines.append(
                    f"- `{skipped['fixtureId']}` {skipped['home']} vs {skipped['away']}: {skipped['reason']}"
                )
            lines.append("")
        if result.unresolved_source_teams:
            lines.append("### Unresolved source teams")
            for item in result.unresolved_source_teams[:20]:
                lines.append(
                    f"- `{item['home']}` vs `{item['away']}` (home resolved: {item['homeResolved']}, away resolved: {item['awayResolved']})"
                )
            lines.append("")
    markdown_path.write_text("\n".join(lines), encoding="utf-8")


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

    output = completed.stdout.strip() or completed.stderr.strip() or "(no output)"
    return f"Automatic source refresh failed: {output}"


def run_single_audit(audit: dict, refreshed_sources: dict[Path, str | None]) -> AuditResult:
    source = WEBSITE_ROOT / audit["source"]
    refresh_error = refreshed_sources.get(source)
    if refresh_error:
        return AuditResult(
            audit_id=audit["id"],
            label=audit["label"],
            status="fetch-failed",
            details=refresh_error,
        )

    if not source.exists():
        return AuditResult(
            audit_id=audit["id"],
            label=audit["label"],
            status="missing-source",
            details=f"Missing source file: {source}",
        )

    cmd = [
        sys.executable,
        str(AUDIT_SCRIPT),
        "--source",
        str(source),
        "--season",
        audit["season"],
    ]

    if audit.get("competitionId"):
        cmd.extend(["--competition", audit["competitionId"]])
    if audit.get("fixturePrefix"):
        cmd.extend(["--fixture-prefix", audit["fixturePrefix"]])
    if audit.get("roundPrefix"):
        cmd.extend(["--round-prefix", audit["roundPrefix"]])
    if audit.get("sourceGroupPrefix"):
        cmd.extend(["--source-group-prefix", audit["sourceGroupPrefix"]])
    for value in audit.get("excludeSourceGroupPrefixes", []):
        cmd.extend(["--exclude-source-group-prefix", value])
    if audit.get("sourceRoundPrefix"):
        cmd.extend(["--source-round-prefix", audit["sourceRoundPrefix"]])
    for value in audit.get("excludeSourceRoundPrefixes", []):
        cmd.extend(["--exclude-source-round-prefix", value])

    completed = subprocess.run(cmd, capture_output=True, text=True, cwd=WEBSITE_ROOT)
    output = completed.stdout.strip() or completed.stderr.strip() or "(no output)"
    status = "passed" if completed.returncode == 0 else "needs-attention"
    return AuditResult(audit_id=audit["id"], label=audit["label"], status=status, details=output)


def run_single_sync(audit: dict, refreshed_sources: dict[Path, str | None]) -> SyncResult:
    source = WEBSITE_ROOT / audit["source"]
    refresh_error = refreshed_sources.get(source)
    if refresh_error or not source.exists():
        return SyncResult(
            audit_id=audit["id"],
            label=audit["label"],
            updated_count=0,
            added_count=0,
            removed_count=0,
            updates=[],
            added=[],
            removed=[],
            skipped_count=0,
            skipped=[],
            unresolved_source_teams=[],
        )

    cmd = [
        sys.executable,
        str(SYNC_SCRIPT),
        "--source",
        str(source),
        "--season",
        audit["season"],
        "--write",
    ]

    if audit.get("competitionId"):
        cmd.extend(["--competition", audit["competitionId"]])
    if audit.get("fixturePrefix"):
        cmd.extend(["--fixture-prefix", audit["fixturePrefix"]])
    if audit.get("roundPrefix"):
        cmd.extend(["--round-prefix", audit["roundPrefix"]])
    if audit.get("sourceGroupPrefix"):
        cmd.extend(["--source-group-prefix", audit["sourceGroupPrefix"]])
    for value in audit.get("excludeSourceGroupPrefixes", []):
        cmd.extend(["--exclude-source-group-prefix", value])
    if audit.get("sourceRoundPrefix"):
        cmd.extend(["--source-round-prefix", audit["sourceRoundPrefix"]])
    for value in audit.get("excludeSourceRoundPrefixes", []):
        cmd.extend(["--exclude-source-round-prefix", value])

    completed = subprocess.run(cmd, capture_output=True, text=True, cwd=WEBSITE_ROOT)
    if completed.returncode != 0:
        raise RuntimeError(completed.stdout.strip() or completed.stderr.strip() or f"Sync failed for {audit['id']}")

    payload = json.loads(completed.stdout.strip())
    return SyncResult(
        audit_id=audit["id"],
        label=audit["label"],
        updated_count=int(payload.get("updatedCount", 0)),
        added_count=int(payload.get("addedCount", 0)),
        removed_count=int(payload.get("removedCount", 0)),
        updates=payload.get("updates", []),
        added=payload.get("added", []),
        removed=payload.get("removed", []),
        skipped_count=int(payload.get("skippedCount", 0)),
        skipped=payload.get("skipped", []),
        unresolved_source_teams=payload.get("unresolvedSourceTeams", []),
    )


def main() -> int:
    args = parse_args()
    audits = load_config()
    if not audits:
        print("No audits configured", file=sys.stderr)
        return 1

    selected = []
    for audit in audits:
        if args.all:
            selected.append(audit)
            continue
        if args.due:
            if is_due_today(audit["anchorDate"], int(audit["intervalDays"])):
                selected.append(audit)
            continue
        selected.append(audit)

    if not selected:
        print("No audits due today")
        return 0

    refreshed_sources: dict[Path, str | None] = {}
    for audit in selected:
        source = WEBSITE_ROOT / audit["source"]
        if source in refreshed_sources:
            continue
        refreshed_sources[source] = refresh_source(audit, source)

    sync_results: list[SyncResult] = []
    if args.apply_safe_updates:
        sync_results = [run_single_sync(audit, refreshed_sources) for audit in selected]
        write_update_report(sync_results)
        if any(result.updated_count > 0 for result in sync_results):
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

    results = [run_single_audit(audit, refreshed_sources) for audit in selected]
    write_report(results)

    if args.apply_safe_updates:
        total_updated = sum(result.updated_count for result in sync_results)
        total_skipped = sum(result.skipped_count for result in sync_results)
        print(f"[auto-update] updated={total_updated} skipped={total_skipped}")

    for result in results:
        print(f"[{result.status}] {result.label}")

    if any(result.status != "passed" for result in results):
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
