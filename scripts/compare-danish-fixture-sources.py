#!/usr/bin/env python3
"""Compare the official Danish fixture feed with the current Flashscore feed."""

from __future__ import annotations

import argparse
import importlib.util
import json
import subprocess
import sys
import tempfile
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
AUDIT_RUNNER = ROOT / "scripts" / "run-daily-fixture-check.py"
FLASH_FETCHER = ROOT / "scripts" / "fetch-flashscore-fixtures.py"
OFFICIAL_FETCHER = ROOT / "scripts" / "fetch-official-danish-fixtures.py"
OUTPUT_DEFAULT = ROOT / "data" / "fixture-audits" / "source-comparisons"

TOURNAMENT_IDS = {
    "dk-superliga": 46,
    "dk-1-division": 85,
    "dk-2-division": 239,
    "dk-3-division": 240,
}


def load_audit_module():
    spec = importlib.util.spec_from_file_location("fixture_audit", AUDIT_RUNNER)
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not load fixture audit helpers")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", default=str(OUTPUT_DEFAULT))
    parser.add_argument("--expected-season", default="2026/2027")
    return parser.parse_args()


def run(command: list[str]) -> None:
    completed = subprocess.run(command, cwd=ROOT, capture_output=True, text=True)
    if completed.returncode != 0:
        raise RuntimeError(completed.stdout.strip() or completed.stderr.strip() or "Source fetch failed")


def fixture_key(fixture) -> tuple[str, str, str]:
    return fixture.home_team_id, fixture.away_team_id, fixture.kickoff[:10]


def compare_one(audit, official_path: Path, flashscore_path: Path, helpers) -> dict:
    aliases = helpers.build_alias_map(helpers.load_club_names(), helpers.load_aliases())
    from_date = date(2026, 7, 1)
    to_date = date(2027, 8, 1)
    official, official_unresolved = helpers.parse_source_matches(
        audit, official_path, aliases, None, from_date, to_date
    )
    flashscore, flashscore_unresolved = helpers.parse_source_matches(
        audit, flashscore_path, aliases, None, from_date, to_date
    )

    official_by_key = {fixture_key(fixture): fixture for fixture in official}
    flashscore_by_key = {fixture_key(fixture): fixture for fixture in flashscore}
    shared_keys = set(official_by_key) & set(flashscore_by_key)
    time_changes = [
        {
            "home": official_by_key[key].home_name,
            "away": official_by_key[key].away_name,
            "date": key[2],
            "flashscoreKickoff": flashscore_by_key[key].kickoff,
            "officialKickoff": official_by_key[key].kickoff,
        }
        for key in sorted(shared_keys)
        if flashscore_by_key[key].kickoff != official_by_key[key].kickoff
    ]

    return {
        "auditId": audit["id"],
        "label": audit["label"],
        "flashscoreFixtures": len(flashscore),
        "officialFixtures": len(official),
        "sameTeamAndDate": len(shared_keys),
        "flashscoreOnly": len(set(flashscore_by_key) - set(official_by_key)),
        "officialOnly": len(set(official_by_key) - set(flashscore_by_key)),
        "kickoffChanges": len(time_changes),
        "unresolvedFlashscore": flashscore_unresolved,
        "unresolvedOfficial": official_unresolved,
        "timeChanges": time_changes,
        "status": "matched"
        if not official_unresolved
        and not flashscore_unresolved
        and not (set(flashscore_by_key) - set(official_by_key))
        and not (set(official_by_key) - set(flashscore_by_key))
        else "mismatch",
    }


def render_markdown(report: dict) -> str:
    lines = [
        "# Danish Fixture Source Comparison",
        "",
        f"- Expected season: `{report['expectedSeason']}`",
        f"- Comparisons: `{len(report['results'])}`",
        f"- Status: **{report['status']}**",
        "",
    ]
    for result in report["results"]:
        lines.extend(
            [
                f"## {result['label']}",
                "",
                f"- Flashscore fixtures: `{result['flashscoreFixtures']}`",
                f"- Official fixtures: `{result['officialFixtures']}`",
                f"- Same teams and date: `{result['sameTeamAndDate']}`",
                f"- Kickoff changes: `{result['kickoffChanges']}`",
                f"- Flashscore-only fixtures: `{result['flashscoreOnly']}`",
                f"- Official-only fixtures: `{result['officialOnly']}`",
                f"- Unresolved official fixtures: `{len(result['unresolvedOfficial'])}`",
                "",
            ]
        )
    return "\n".join(lines)


def main() -> int:
    args = parse_args()
    helpers = load_audit_module()
    audits = {audit["id"]: audit for audit in helpers.load_config()}
    results = []

    with tempfile.TemporaryDirectory(prefix="danish-fixture-compare-") as temp_dir:
        temp = Path(temp_dir)
        for audit_id, tournament_id in TOURNAMENT_IDS.items():
            audit = audits[audit_id]
            flashscore_path = temp / f"{audit_id}-flashscore.txt"
            official_path = temp / f"{audit_id}-official.txt"
            fetch = audit["fetch"]
            flash_command = [
                sys.executable,
                str(FLASH_FETCHER),
                "--url",
                fetch["url"],
                "--output",
                str(flashscore_path),
                "--timezone",
                fetch.get("timezone", "Europe/Copenhagen"),
            ]
            if fetch.get("competitionFilter"):
                flash_command.extend(["--competition-filter", fetch["competitionFilter"]])
            run(flash_command)
            run(
                [
                    sys.executable,
                    str(OFFICIAL_FETCHER),
                    "--tournament-id",
                    str(tournament_id),
                    "--expected-season",
                    args.expected_season,
                    "--output",
                    str(official_path),
                ]
            )
            results.append(compare_one(audit, official_path, flashscore_path, helpers))

    report = {
        "generatedAt": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
        "expectedSeason": args.expected_season,
        "status": "matched" if all(result["status"] == "matched" for result in results) else "mismatch",
        "results": results,
    }
    output_dir = Path(args.output_dir).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "latest.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (output_dir / "latest.md").write_text(render_markdown(report) + "\n", encoding="utf-8")
    print(json.dumps({"status": report["status"], "results": results}, ensure_ascii=False))
    return 0 if report["status"] == "matched" else 2


if __name__ == "__main__":
    raise SystemExit(main())
