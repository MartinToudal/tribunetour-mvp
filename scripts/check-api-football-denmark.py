#!/usr/bin/env python3
"""Safely inspect API-Football coverage for the Danish 2026 season.

This is deliberately a read-only probe. It does not write fixture data and it
never prints the API key.
"""

from __future__ import annotations

import json
import os
import sys
import unicodedata
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


API_URL = os.environ.get("API_FOOTBALL_BASE_URL", "https://v3.football.api-sports.io").rstrip("/")
SEASON = os.environ.get("API_FOOTBALL_SEASON", "2026")


def normalize(value: str) -> str:
    folded = unicodedata.normalize("NFKD", value)
    ascii_value = "".join(char for char in folded if not unicodedata.combining(char))
    return " ".join(ascii_value.lower().replace("-", " ").split())


def request_json(path: str, **params: str) -> dict:
    api_key = os.environ.get("API_FOOTBALL_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("API_FOOTBALL_API_KEY is not configured")

    query = urlencode(params)
    request = Request(
        f"{API_URL}{path}?{query}",
        headers={"x-apisports-key": api_key, "Accept": "application/json"},
    )
    try:
        with urlopen(request, timeout=30) as response:
            return json.load(response)
    except HTTPError as error:
        raise RuntimeError(f"API request failed with HTTP {error.code}") from error
    except URLError as error:
        raise RuntimeError(f"API request failed: {error.reason}") from error


def main() -> int:
    expected = {
        "superliga": "Superliga",
        "1 division": "1. Division",
        "2 division": "2. Division",
        "3 division": "3. Division",
    }

    try:
        league_payload = request_json("/leagues", country="Denmark", season=SEASON)
        if league_payload.get("errors"):
            raise RuntimeError(f"League lookup returned API errors: {league_payload['errors']}")

        available = league_payload.get("response", [])
        by_name = {normalize(item.get("league", {}).get("name", "")): item for item in available}
        selected: list[tuple[str, int, str]] = []
        missing: list[str] = []
        for key, display_name in expected.items():
            item = by_name.get(key)
            if not item:
                missing.append(display_name)
                continue
            selected.append((display_name, int(item["league"]["id"]), item["league"]["name"]))

        print(f"API-Football Denmark coverage probe for season {SEASON}")
        print(f"Leagues returned by API: {len(available)}")
        if missing:
            print("Missing expected leagues: " + ", ".join(missing))
            return 2

        failures = 0
        for display_name, league_id, api_name in selected:
            fixture_payload = request_json("/fixtures", league=str(league_id), season=SEASON)
            errors = fixture_payload.get("errors") or {}
            if errors:
                print(f"{display_name}: API error ({errors})")
                failures += 1
                continue
            fixtures = fixture_payload.get("response", [])
            print(f"{display_name}: league_id={league_id}, api_name={api_name}, fixtures={len(fixtures)}")

        if failures:
            return 3
        print("Read-only probe completed. No fixture data was changed.")
        return 0
    except (RuntimeError, KeyError, ValueError) as error:
        print(f"Probe failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
