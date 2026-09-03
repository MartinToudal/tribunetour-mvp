#!/usr/bin/env python3
"""Fetch one Danish league's complete fixture page into the audit format."""

from __future__ import annotations

import argparse
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen


MONTHS = {
    "januar": 1, "februar": 2, "marts": 3, "april": 4, "maj": 5, "juni": 6,
    "juli": 7, "august": 8, "september": 9, "oktober": 10, "november": 11, "december": 12,
}


class MatchLinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.current_href: str | None = None
        self.current_text: list[str] = []
        self.links: list[tuple[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag != "a" or self.current_href is not None:
            return
        href = dict(attrs).get("href") or ""
        if "/matches/" in href:
            self.current_href = href
            self.current_text = []

    def handle_data(self, data: str) -> None:
        if self.current_href is not None:
            self.current_text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "a" and self.current_href is not None:
            text = " ".join("".join(self.current_text).split())
            self.links.append((self.current_href, text))
            self.current_href = None
            self.current_text = []


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fetch a complete official Danish fixture page.")
    parser.add_argument("--url", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--group", required=True, help="Stable source group name")
    parser.add_argument("--round-prefix", required=True, help="Fixture round prefix")
    parser.add_argument("--season", default="2026-27")
    return parser.parse_args()


def fetch_html(url: str) -> str:
    request = Request(url, headers={"User-Agent": "Tribunetour/1.0 (fixture sync)"})
    with urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8", "ignore")


def season_year(month: int, season: str) -> int:
    start_year, end_token = season.split("-", 1)
    end_year = int(end_token) if len(end_token) == 4 else (int(start_year[:2]) * 100) + int(end_token)
    return int(start_year) if month >= 7 else end_year


def parse_link(text: str, season: str, group: str, round_prefix: str) -> str | None:
    round_match = re.search(r"(\d+)\.\s*Spillerunde", text, re.IGNORECASE)
    date_match = re.search(
        r"(\d{1,2})\.\s*([A-Za-zæøåÆØÅ]+)\s+kl\.\s*(\d{1,2}):(\d{2})",
        text,
        re.IGNORECASE,
    )
    if not round_match or not date_match:
        return None
    month = MONTHS.get(date_match.group(2).lower())
    if not month:
        return None

    before_round = text[: round_match.start()].strip()
    teams = re.split(r"\s+(?:\d+\s*-\s*\d+|vs\.?)\s+", before_round, maxsplit=1, flags=re.IGNORECASE)
    if len(teams) != 2 or not all(teams):
        return None
    day, hour, minute = (int(date_match.group(1)), int(date_match.group(3)), int(date_match.group(4)))
    round_label = f"{round_prefix}{round_match.group(1)}. Spillerunde"
    return " | ".join(
        [f"{day:02d} {month:02d} {hour:02d} {minute:02d}", group, round_label, teams[0].strip(), teams[1].strip()]
    )


def main() -> int:
    args = parse_args()
    parser = MatchLinkParser()
    parser.feed(fetch_html(args.url))
    rows = [row for _, text in parser.links if (row := parse_link(text, args.season, args.group, args.round_prefix))]
    if len(rows) < 100:
        raise SystemExit(f"Refusing incomplete source: extracted {len(rows)} fixtures from {args.url}")
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text("\n".join(dict.fromkeys(rows)) + "\n", encoding="utf-8")
    print(f"Fetched {len(rows)} fixtures from {args.url}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
