#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path


WEBSITE_ROOT = Path(__file__).resolve().parent.parent
REPORT_PATH = WEBSITE_ROOT / "data" / "manual-club-checks" / "reports" / "latest.json"


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def build_text(payload: dict) -> str:
    lines = [
        "Dagligt manuelt klubtjek",
        "",
        f"Genereret: {payload.get('generatedAt', '?')}",
        f"Seed: {payload.get('seed', '?')}",
        "",
        "Tjek på hver klub:",
        "1. Ligger stadion korrekt på kortet?",
        "2. Ser det kommende kampprogram komplet ud for klubben?",
        "3. Ser årstal, række eller modstandere forkerte ud?",
        "",
    ]

    for index, club in enumerate(payload.get("clubs", []), start=1):
        lines.extend(
            [
                f"{index}. {club['team']} — {club['league']}",
                f"   Stadion: {club['stadiumName']} ({club['city']})",
                f"   Web: {club['stadiumUrl']}",
                f"   Kort: {club['mapUrl']}",
                f"   Koordinater: {club['lat']}, {club['lon']}",
                f"   Kommende kampe i data: {club['upcomingMatchCount']}",
                f"   Kommende hjemmekampe i data: {club['upcomingHomeMatchCount']}",
                f"   Første hjemmekamp i data: {club['firstHomeMatchKickoff'] or '-'}",
                f"   Sidste hjemmekamp i data: {club['lastHomeMatchKickoff'] or '-'}",
                f"   Sidste kamp i rækken lige nu: {club['lastCompetitionMatchKickoff'] or '-'}",
            ]
        )

        sample_matches = club.get("sampleHomeMatches", [])
        if sample_matches:
            lines.append("   Eksempel på hjemmekampe:")
            for match in sample_matches:
                round_label = match.get("round") or "Kamp"
                lines.append(
                    f"   - {match['kickoff']} · {round_label} · {match['homeTeamId']} vs {match['awayTeamId']}"
                )
        lines.append("")

    return "\n".join(lines).strip() + "\n"


def build_html(payload: dict) -> str:
    cards = []
    for club in payload.get("clubs", []):
        samples = "".join(
            (
                "<li>"
                f"{match['kickoff']} · {(match.get('round') or 'Kamp')} · "
                f"{match['homeTeamId']} vs {match['awayTeamId']}"
                "</li>"
            )
            for match in club.get("sampleHomeMatches", [])
        ) or "<li>Ingen eksempelkampe fundet.</li>"

        cards.append(
            f"""
            <div style="border: 1px solid #d7e5d6; border-radius: 14px; padding: 18px; margin-bottom: 16px;">
              <h2 style="font-size: 18px; margin: 0 0 8px 0;">{club['team']}</h2>
              <p style="margin: 4px 0;"><strong>Række:</strong> {club['league']}</p>
              <p style="margin: 4px 0;"><strong>Stadion:</strong> {club['stadiumName']} · {club['city']}</p>
              <p style="margin: 4px 0;"><strong>Koordinater:</strong> {club['lat']}, {club['lon']}</p>
              <p style="margin: 4px 0;"><strong>Kampe i data:</strong> {club['upcomingMatchCount']} kommende kampe, {club['upcomingHomeMatchCount']} kommende hjemmekampe</p>
              <p style="margin: 4px 0;"><strong>Første hjemmekamp:</strong> {club['firstHomeMatchKickoff'] or '-'}</p>
              <p style="margin: 4px 0;"><strong>Sidste hjemmekamp:</strong> {club['lastHomeMatchKickoff'] or '-'}</p>
              <p style="margin: 4px 0;"><strong>Sidste kamp i rækken lige nu:</strong> {club['lastCompetitionMatchKickoff'] or '-'}</p>
              <p style="margin: 12px 0 8px 0;">
                <a href="{club['stadiumUrl']}" style="margin-right: 12px;">Åbn stadion i Tribunetour</a>
                <a href="{club['mapUrl']}">Åbn i Google Maps</a>
              </p>
              <p style="margin: 12px 0 6px 0;"><strong>Tjek:</strong></p>
              <ol style="margin: 0 0 12px 18px; padding: 0;">
                <li>Ligger stadion korrekt på kortet?</li>
                <li>Ser det kommende kampprogram komplet ud for klubben?</li>
                <li>Ser årstal, række eller modstandere forkerte ud?</li>
              </ol>
              <p style="margin: 12px 0 6px 0;"><strong>Eksempel på hjemmekampe i data:</strong></p>
              <ul style="margin: 0 0 0 18px; padding: 0;">{samples}</ul>
            </div>
            """
        )

    cards_html = "".join(cards) or "<p>Ingen klubber fundet.</p>"
    return f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #162016;">
      <h1 style="font-size: 22px; margin-bottom: 12px;">Dagligt manuelt klubtjek</h1>
      <p>Her er 3 tilfældige aktive klubber fra databasen til dagens manuelle kvalitetstjek.</p>
      <p><strong>Genereret:</strong> {payload.get('generatedAt', '?')}</p>
      <p><strong>Seed:</strong> {payload.get('seed', '?')}</p>
      {cards_html}
    </div>
    """


def main() -> int:
    resend_api_key = os.environ.get("RESEND_API_KEY")
    notify_to = (
        os.environ.get("MANUAL_SPOTCHECK_NOTIFY_TO")
        or os.environ.get("FIXTURE_CHECK_NOTIFY_TO")
    )
    notify_from = (
        os.environ.get("MANUAL_SPOTCHECK_NOTIFY_FROM")
        or os.environ.get("FIXTURE_CHECK_NOTIFY_FROM")
        or "Tribunetour <onboarding@resend.dev>"
    ).strip() or "Tribunetour <onboarding@resend.dev>"

    if not resend_api_key or not notify_to:
        print("Missing RESEND_API_KEY or recipient for manual spotcheck", file=sys.stderr)
        return 1
    if not REPORT_PATH.exists():
        print("Missing manual club spotcheck report output", file=sys.stderr)
        return 1

    payload = load_json(REPORT_PATH)
    subject = f"[Tribunetour] Dagligt manuelt klubtjek · {str(payload.get('generatedAt', 'today'))[:10]}"
    body_payload = {
        "to": notify_to,
        "subject": subject,
        "text": build_text(payload),
        "html": build_html(payload),
    }

    def send_email(from_address: str) -> tuple[bool, str]:
        request = urllib.request.Request(
            "https://api.resend.com/emails",
            data=json.dumps({**body_payload, "from": from_address}).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {resend_api_key}",
                "Content-Type": "application/json",
                "User-Agent": "Tribunetour-Manual-Club-Spotcheck/1.0",
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
