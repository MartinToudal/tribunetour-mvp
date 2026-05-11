#!/usr/bin/env python3
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


@dataclass
class AuditResult:
    audit_id: str
    label: str
    status: str
    details: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run configured Flashscore fixture audits.")
    parser.add_argument("--all", action="store_true", help="Run all configured audits regardless of cadence")
    parser.add_argument("--due", action="store_true", help="Run only audits that are due today")
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


def run_single_audit(audit: dict) -> AuditResult:
    source = WEBSITE_ROOT / audit["source"]
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

    completed = subprocess.run(cmd, capture_output=True, text=True, cwd=WEBSITE_ROOT)
    output = completed.stdout.strip() or completed.stderr.strip() or "(no output)"
    status = "passed" if completed.returncode == 0 else "needs-attention"
    return AuditResult(audit_id=audit["id"], label=audit["label"], status=status, details=output)


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

    results = [run_single_audit(audit) for audit in selected]
    write_report(results)

    for result in results:
        print(f"[{result.status}] {result.label}")

    if any(result.status != "passed" for result in results):
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
