#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import random
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo


WEBSITE_ROOT = Path(__file__).resolve().parent.parent
STADIUMS_PATH = WEBSITE_ROOT / "data" / "stadiums.json"
FIXTURES_PATH = WEBSITE_ROOT / "data" / "fixtures.json"
REPORT_DIR = WEBSITE_ROOT / "data" / "manual-club-checks" / "reports"
REPORT_JSON_PATH = REPORT_DIR / "latest.json"
REPORT_MD_PATH = REPORT_DIR / "latest.md"

TZ = ZoneInfo("Europe/Copenhagen")
DEFAULT_BASE_URL = "https://www.tribunetour.dk"


@dataclass
class ClubSpotcheck:
    stadiumId: str
    team: str
    stadiumName: str
    city: str
    league: str
    competitionId: str
    seasonId: str
    lat: float
    lon: float
    stadiumUrl: str
    mapUrl: str
    upcomingMatchCount: int
    upcomingHomeMatchCount: int
    nextMatchKickoff: str | None
    nextHomeMatchKickoff: str | None
    firstHomeMatchKickoff: str | None
    lastHomeMatchKickoff: str | None
    lastCompetitionMatchKickoff: str | None
    sampleHomeMatches: list[dict[str, str]]


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def parse_kickoff(value: str) -> datetime:
    return datetime.fromisoformat(value)


def iso_or_none(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def format_match(match: dict[str, Any]) -> dict[str, str]:
    return {
        "kickoff": match["kickoff"],
        "round": match.get("round") or "",
        "homeTeamId": match["homeTeamId"],
        "awayTeamId": match["awayTeamId"],
    }


def dedupe_fixtures(fixtures: list[dict[str, Any]]) -> list[dict[str, Any]]:
    unique: dict[tuple[str, str, str, str, str], dict[str, Any]] = {}
    for fixture in fixtures:
        key = (
            fixture.get("kickoff") or "",
            fixture.get("homeTeamId") or "",
            fixture.get("awayTeamId") or "",
            fixture.get("venueClubId") or "",
            fixture.get("round") or "",
        )
        existing = unique.get(key)
        if existing is None or len((fixture.get("id") or "")) < len((existing.get("id") or "")):
            unique[key] = fixture
    return sorted(unique.values(), key=lambda item: item["kickoff"])


def build_spotcheck(
    stadium: dict[str, Any],
    fixtures: list[dict[str, Any]],
    base_url: str,
    now: datetime,
) -> ClubSpotcheck | None:
    stadium_id = stadium.get("id")
    competition_id = stadium.get("competitionId")
    if not stadium_id or not competition_id:
        return None

    upcoming_fixtures = []
    home_fixtures = []
    competition_fixtures = []

    for fixture in fixtures:
        if fixture.get("status") != "scheduled":
            continue
        kickoff_raw = fixture.get("kickoff")
        if not kickoff_raw:
            continue
        kickoff = parse_kickoff(kickoff_raw)
        if kickoff < now:
            continue

        if fixture.get("competitionId") == competition_id:
            competition_fixtures.append(fixture)

        if stadium_id in {fixture.get("homeTeamId"), fixture.get("awayTeamId")}:
            upcoming_fixtures.append(fixture)

        if fixture.get("venueClubId") == stadium_id:
            home_fixtures.append(fixture)

    if len(home_fixtures) < 2:
        return None

    upcoming_fixtures = dedupe_fixtures(upcoming_fixtures)
    home_fixtures = dedupe_fixtures(home_fixtures)
    competition_fixtures = dedupe_fixtures(competition_fixtures)

    clean_base_url = base_url.rstrip("/")

    return ClubSpotcheck(
        stadiumId=stadium_id,
        team=stadium.get("team") or stadium_id,
        stadiumName=stadium.get("name") or stadium_id,
        city=stadium.get("city") or "",
        league=stadium.get("league") or "",
        competitionId=competition_id,
        seasonId=stadium.get("seasonId") or "",
        lat=float(stadium["lat"]),
        lon=float(stadium["lon"]),
        stadiumUrl=f"{clean_base_url}/stadiums/{stadium_id}",
        mapUrl=f"https://www.google.com/maps?q={stadium['lat']},{stadium['lon']}",
        upcomingMatchCount=len(upcoming_fixtures),
        upcomingHomeMatchCount=len(home_fixtures),
        nextMatchKickoff=upcoming_fixtures[0]["kickoff"] if upcoming_fixtures else None,
        nextHomeMatchKickoff=home_fixtures[0]["kickoff"] if home_fixtures else None,
        firstHomeMatchKickoff=home_fixtures[0]["kickoff"] if home_fixtures else None,
        lastHomeMatchKickoff=home_fixtures[-1]["kickoff"] if home_fixtures else None,
        lastCompetitionMatchKickoff=competition_fixtures[-1]["kickoff"] if competition_fixtures else None,
        sampleHomeMatches=[format_match(match) for match in home_fixtures[:4]],
    )


def render_markdown(payload: dict[str, Any]) -> str:
    lines = [
        "# Dagligt manuelt klubtjek",
        "",
        f"- Genereret: `{payload['generatedAt']}`",
        f"- Seed: `{payload['seed']}`",
        f"- Antal klubber: `{len(payload['clubs'])}`",
        "",
        "## Tjek på hver klub",
        "",
        "1. Ligger stadion korrekt på kortet?",
        "2. Ser det kommende kampprogram komplet ud for klubben?",
        "3. Ser årstal, række eller modstandere forkerte ud?",
        "",
    ]

    for club in payload["clubs"]:
        lines.extend(
            [
                f"## {club['team']}",
                "",
                f"- Stadion: {club['stadiumName']} ({club['city']})",
                f"- Række: {club['league']}",
                f"- Web: {club['stadiumUrl']}",
                f"- Kort: {club['mapUrl']}",
                f"- Koordinater: `{club['lat']}, {club['lon']}`",
                f"- Kommende kampe i data: `{club['upcomingMatchCount']}`",
                f"- Kommende hjemmekampe i data: `{club['upcomingHomeMatchCount']}`",
                f"- Første hjemmekamp i data: `{club['firstHomeMatchKickoff'] or '-'}`",
                f"- Sidste hjemmekamp i data: `{club['lastHomeMatchKickoff'] or '-'}`",
                f"- Sidste kamp i rækken lige nu: `{club['lastCompetitionMatchKickoff'] or '-'}`",
                "",
            ]
        )
        if club["sampleHomeMatches"]:
            lines.append("Eksempel på hjemmekampe:")
            lines.append("")
            for match in club["sampleHomeMatches"]:
                lines.append(
                    f"- `{match['kickoff']}` · {match['round'] or 'Kamp'} · {match['homeTeamId']} vs {match['awayTeamId']}"
                )
            lines.append("")

    return "\n".join(lines).strip() + "\n"


def main() -> int:
    stadiums = load_json(STADIUMS_PATH)
    fixtures = load_json(FIXTURES_PATH)

    now = datetime.now(TZ)
    seed = (os.environ.get("MANUAL_CLUB_SPOTCHECK_SEED") or now.date().isoformat()).strip()
    base_url = (os.environ.get("TRIBUNETOUR_BASE_URL") or DEFAULT_BASE_URL).strip() or DEFAULT_BASE_URL
    requested_count = int((os.environ.get("MANUAL_CLUB_SPOTCHECK_COUNT") or "3").strip())

    candidates: list[ClubSpotcheck] = []
    for stadium in stadiums:
        if stadium.get("membershipStatus") != "active":
            continue
        spotcheck = build_spotcheck(stadium, fixtures, base_url, now)
        if spotcheck is not None:
            candidates.append(spotcheck)

    if len(candidates) < requested_count:
        raise SystemExit(f"Not enough eligible clubs for manual spotcheck: {len(candidates)} available")

    rng = random.Random(seed)
    selected = rng.sample(candidates, requested_count)
    selected.sort(key=lambda club: (club.league, club.team))

    payload = {
        "generatedAt": now.isoformat(),
        "seed": seed,
        "count": requested_count,
        "clubs": [asdict(club) for club in selected],
    }

    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_JSON_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    REPORT_MD_PATH.write_text(render_markdown(payload), encoding="utf-8")

    print(f"Generated manual club spotcheck with {len(selected)} clubs")
    for club in selected:
        print(f"- {club.team} ({club.league})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
