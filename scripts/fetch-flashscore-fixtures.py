#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fetch and normalize fixture data from a public Flashscore league page."
    )
    parser.add_argument("--url", required=True, help="Flashscore URL to fetch")
    parser.add_argument("--output", required=True, help="Output text file path")
    parser.add_argument(
        "--timezone",
        default="Europe/Copenhagen",
        help="IANA timezone used for rendered kickoff times",
    )
    parser.add_argument(
        "--competition-filter",
        help="Optional substring that must be present in the Flashscore group label",
    )
    return parser.parse_args()


def fetch_html(url: str) -> str:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Tribunetour/1.0 (fixture-audit)",
            "Accept-Language": "da-DK,da;q=0.9,en;q=0.8",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8", "ignore")


def extract_field(block: str, key: str) -> str | None:
    match = re.search(rf"(?:^|¬){re.escape(key)}÷([^¬]*)", block)
    if not match:
        return None
    return match.group(1).strip()


def parse_events(html: str, timezone_name: str, competition_filter: str | None) -> list[dict[str, str]]:
    tz = ZoneInfo(timezone_name)
    parts = html.split("¬~")
    current_group = ""
    events_by_id: dict[str, dict[str, str]] = {}

    for part in parts:
        if part.startswith("ZA÷"):
            current_group = extract_field(part, "ZA") or current_group
            continue

        if not part.startswith("AA÷"):
            continue

        if competition_filter and competition_filter.lower() not in current_group.lower():
            continue

        event_id = extract_field(part, "AA")
        kickoff_timestamp = extract_field(part, "AD")
        home_name = extract_field(part, "AE")
        away_name = extract_field(part, "AF")

        if not all([event_id, kickoff_timestamp, home_name, away_name]):
            continue

        kickoff_local = datetime.fromtimestamp(int(kickoff_timestamp), timezone.utc).astimezone(tz)
        events_by_id[event_id] = {
            "id": event_id,
            "group": current_group,
            "round": extract_field(part, "ER") or "",
            "date_token": kickoff_local.strftime("%d %m"),
            "time_token": kickoff_local.strftime("%H %M"),
            "home": home_name,
            "away": away_name,
        }

    return sorted(
        events_by_id.values(),
        key=lambda event: (event["date_token"], event["time_token"], event["home"], event["away"]),
    )


def render_events(events: list[dict[str, str]]) -> str:
    lines = []
    for event in events:
        lines.append(
            " | ".join(
                [
                    f"{event['date_token']} {event['time_token']}",
                    event["group"],
                    event["round"],
                    event["home"],
                    event["away"],
                ]
            )
        )
    return "\n".join(lines) + ("\n" if lines else "")


def main() -> int:
    args = parse_args()
    html = fetch_html(args.url)
    events = parse_events(html, args.timezone, args.competition_filter)

    output_path = Path(args.output).expanduser().resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(render_events(events), encoding="utf-8")

    print(f"Fetched {len(events)} fixtures from {args.url}")
    print(f"Wrote normalized source to {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
