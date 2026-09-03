#!/usr/bin/env python3
"""Fetch a complete Danish league season from the official SI widget API.

This is intentionally a standalone provider. It is not wired into the live
audits until its output has been validated against the local club aliases.
"""

from __future__ import annotations

import argparse
import json
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo


API_BASE = "https://ss2.si-ab.com"
APP_NAME = "dk.releaze.livecenter.spdk"
LOCAL_TIMEZONE = ZoneInfo("Europe/Copenhagen")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fetch a complete current-season fixture list from the official Danish league widget API."
    )
    parser.add_argument("--tournament-id", type=int, required=True)
    parser.add_argument("--expected-season", default="2026/2027")
    parser.add_argument("--output", required=True)
    parser.add_argument("--limit", type=int, default=500)
    return parser.parse_args()


def get_json(path: str, **params: object) -> dict:
    query = urllib.parse.urlencode(
        {
            "appName": APP_NAME,
            "locale": "da",
            **params,
        }
    )
    request = urllib.request.Request(
        f"{API_BASE}{path}?{query}",
        headers={
            "Accept": "application/json",
            "User-Agent": "Tribunetour/1.0 (official fixture feed)",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def current_season(tournament_id: int) -> dict:
    payload = get_json(f"/tournaments/{tournament_id}/season")
    season = payload.get("season")
    if not isinstance(season, dict):
        raise RuntimeError("Official source returned no season metadata")
    return season


def parse_kickoff(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(LOCAL_TIMEZONE)


def normalize_event(event: dict, expected_tournament_id: int, expected_season: str) -> dict[str, str]:
    required = ["eventId", "startDate", "homeName", "awayName", "round", "tournamentYear"]
    missing = [key for key in required if event.get(key) in (None, "")]
    if missing:
        raise RuntimeError(f"Official source returned an incomplete event: missing {', '.join(missing)}")
    if event.get("tournamentTemplateId") != expected_tournament_id:
        raise RuntimeError("Official source returned an event from another tournament")
    if event.get("tournamentYear") != expected_season:
        raise RuntimeError(
            f"Official source returned season {event.get('tournamentYear')!r}, expected {expected_season!r}"
        )

    kickoff = parse_kickoff(str(event["startDate"]))
    return {
        "id": str(event["eventId"]),
        "group": str(event.get("tournamentName") or ""),
        "round": str(event["round"]),
        "date_token": kickoff.strftime("%d %m"),
        "time_token": kickoff.strftime("%H %M"),
        "home": str(event["homeName"]),
        "away": str(event["awayName"]),
        "sort_key": kickoff.isoformat(),
    }


def render_events(events: list[dict[str, str]]) -> str:
    return "".join(
        " | ".join(
            [
                f"{event['date_token']} {event['time_token']}",
                event["group"],
                event["round"],
                event["home"],
                event["away"],
            ]
        )
        + "\n"
        for event in events
    )


def main() -> int:
    args = parse_args()
    season = current_season(args.tournament_id)
    if season.get("year") != args.expected_season:
        raise RuntimeError(
            f"Official source returned current season {season.get('year')!r}, expected {args.expected_season!r}"
        )
    if season.get("tournamentTemplateId") != args.tournament_id:
        raise RuntimeError("Official source metadata does not match the requested tournament")

    stages = season.get("stages") or []
    stage_ids = [stage.get("id") for stage in stages if stage.get("id")]
    if not stage_ids:
        raise RuntimeError("Official source returned no season stage")

    payload = get_json(
        "/events-v2",
        tournamentId=args.tournament_id,
        seasonId=season["id"],
        limit=args.limit,
        sortDirection="asc",
    )
    raw_events = payload.get("events")
    if not isinstance(raw_events, list) or not raw_events:
        raise RuntimeError("Official source returned no fixtures")

    events = [normalize_event(event, args.tournament_id, args.expected_season) for event in raw_events]
    events.sort(key=lambda event: event["sort_key"])
    event_ids = [event["id"] for event in events]
    if len(event_ids) != len(set(event_ids)):
        raise RuntimeError("Official source returned duplicate fixture ids")

    output_path = Path(args.output).expanduser().resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(render_events(events), encoding="utf-8")
    print(f"Fetched {len(events)} fixtures for {args.expected_season} from tournament {args.tournament_id}")
    print(f"Wrote normalized source to {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
