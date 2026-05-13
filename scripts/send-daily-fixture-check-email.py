#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path


WEBSITE_ROOT = Path(__file__).resolve().parent.parent
REPORT_PATH = WEBSITE_ROOT / "data" / "fixture-audits" / "reports" / "latest-daily.json"
UPDATES_PATH = WEBSITE_ROOT / "data" / "fixture-audits" / "reports" / "latest-daily-updates.json"


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def summarize_failures(payload: dict) -> str:
    failing = [result for result in payload.get("results", []) if result.get("status") != "passed"]
    if not failing:
        return "Alt så grønt ud i dagens check."
    lines = [f"{len(failing)} række(r) kræver opmærksomhed:"]
    for result in failing[:12]:
        lines.append(f"- {result['label']} ({result['status']})")
    return "\n".join(lines)


def summarize_updates(update_payload: dict) -> str:
    total = int(update_payload.get("totalUpdated", 0))
    if total <= 0:
        return "Ingen fixtures blev automatisk opdateret i nat."
    lines = [f"Automatiske fixture-opdateringer: {total}"]
    for result in update_payload.get("results", []):
        if int(result.get("updated_count", 0) or result.get("updatedCount", 0) or 0) <= 0:
            continue
        updates = result.get("updates", [])
        added = result.get("added", [])
        removed = result.get("removed", [])
        lines.append(
            f"- {result['label']}: {len(updates)} opdateret, {len(added)} tilføjet, {len(removed)} fjernet"
        )
        for update in updates[:5]:
            lines.append(
                f"  - {update['home']} vs {update['away']}: {update['oldKickoff']} -> {update['newKickoff']}"
            )
        for item in added[:5]:
            lines.append(f"  - added {item['home']} vs {item['away']}: {item['kickoff']}")
        for item in removed[:5]:
            lines.append(f"  - removed {item['home']} vs {item['away']}: {item['kickoff']}")
    return "\n".join(lines)


def build_html(payload: dict, updates_payload: dict) -> str:
    window = payload.get("window", {})
    failing = [result for result in payload.get("results", []) if result.get("status") != "passed"]
    total_updated = int(updates_payload.get("totalUpdated", 0))
    items = "".join(
        f"<li><strong>{result['label']}</strong> — {result['status']}</li>" for result in failing[:12]
    ) or "<li>Ingen fejl fundet.</li>"
    update_items = []
    for result in updates_payload.get("results", []):
        updates = result.get("updates", [])
        added = result.get("added", [])
        removed = result.get("removed", [])
        if not updates and not added and not removed:
            continue
        update_inner = "".join(
            f"<li>{u['home']} vs {u['away']}: {u['oldKickoff']} → {u['newKickoff']}</li>" for u in updates[:5]
        )
        added_inner = "".join(
            f"<li>added {u['home']} vs {u['away']}: {u['kickoff']}</li>" for u in added[:5]
        )
        removed_inner = "".join(
            f"<li>removed {u['home']} vs {u['away']}: {u['kickoff']}</li>" for u in removed[:5]
        )
        inner = update_inner + added_inner + removed_inner
        update_items.append(f"<li><strong>{result['label']}</strong><ul>{inner}</ul></li>")
    updates_html = "".join(update_items) or "<li>Ingen automatiske opdateringer.</li>"
    return f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #162016;">
      <h1 style="font-size: 22px; margin-bottom: 12px;">Dagligt fixture-check</h1>
      <p><strong>Vindue:</strong> {window.get('from')} → {window.get('to')}</p>
      <p><strong>Tjekkede rækker:</strong> {payload.get('checkedCompetitions', 0)}</p>
      <p><strong>Fejl fundet:</strong> {payload.get('failingCompetitions', 0)}</p>
      <p><strong>Automatiske opdateringer:</strong> {total_updated}</p>
      <h2 style="font-size: 18px; margin-top: 24px;">Status</h2>
      <ul>{items}</ul>
      <h2 style="font-size: 18px; margin-top: 24px;">Opdateringer</h2>
      <ul>{updates_html}</ul>
    </div>
    """


def main() -> int:
    resend_api_key = os.environ.get("RESEND_API_KEY")
    notify_to = os.environ.get("FIXTURE_CHECK_NOTIFY_TO")
    notify_from = (os.environ.get("FIXTURE_CHECK_NOTIFY_FROM") or "").strip() or "Tribunetour <onboarding@resend.dev>"
    if not resend_api_key or not notify_to:
        print("Missing RESEND_API_KEY or FIXTURE_CHECK_NOTIFY_TO", file=sys.stderr)
        return 1
    if not REPORT_PATH.exists() or not UPDATES_PATH.exists():
        print("Missing daily fixture check report output", file=sys.stderr)
        return 1

    payload = load_json(REPORT_PATH)
    updates_payload = load_json(UPDATES_PATH)
    failing_count = int(payload.get("failingCompetitions", 0))
    total_updated = int(updates_payload.get("totalUpdated", 0))
    window = payload.get("window", {})
    status = "FEJL" if failing_count > 0 else "OK"
    subject = f"[Tribunetour] Dagligt fixture-check {status} · {window.get('from')}"

    text = "\n\n".join(
        [
            f"Dagligt fixture-check for {window.get('from')} → {window.get('to')}",
            f"Tjekkede rækker: {payload.get('checkedCompetitions', 0)}",
            f"Fejl fundet: {failing_count}",
            f"Automatiske opdateringer: {total_updated}",
            summarize_failures(payload),
            summarize_updates(updates_payload),
        ]
    )

    body_payload = {
        "from": notify_from,
        "to": notify_to,
        "subject": subject,
        "text": text,
        "html": build_html(payload, updates_payload),
    }

    def send_email(from_address: str) -> tuple[bool, str]:
        request = urllib.request.Request(
            "https://api.resend.com/emails",
            data=json.dumps({**body_payload, "from": from_address}).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {resend_api_key}",
                "Content-Type": "application/json",
                "User-Agent": "Tribunetour-Daily-Fixture-Check/1.0",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return True, response.read().decode("utf-8", "ignore")
        except urllib.error.HTTPError as error:
            return False, error.read().decode("utf-8", "ignore")

    success, response_body = send_email(notify_from)
    if success:
        print(response_body)
        return 0

    fallback_from = "Tribunetour <onboarding@resend.dev>"
    if notify_from != fallback_from and "domain is not verified" in response_body:
        print(
            f"Primary from-address failed domain verification, retrying with fallback sender {fallback_from}.",
            file=sys.stderr,
        )
        success, fallback_body = send_email(fallback_from)
        if success:
            print(fallback_body)
            return 0
        response_body = fallback_body

    print(f"Resend send failed: {response_body}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
