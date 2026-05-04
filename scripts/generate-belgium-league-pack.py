from __future__ import annotations

import csv
import json
import re
import time
import urllib.parse
import urllib.request
from urllib.error import HTTPError
from pathlib import Path


WEBSITE_ROOT = Path(__file__).resolve().parent.parent
WORKSPACE_ROOT = WEBSITE_ROOT.parent
APP_DIR = WORKSPACE_ROOT / "Tribunetour"
APP_FIXTURES_CSV = APP_DIR / "fixtures.csv"
APP_BELGIUM_CSV = APP_DIR / "belgium_top_3.csv"
WEB_BELGIUM_DIR = WEBSITE_ROOT / "data" / "league-packs" / "belgium_top_3"
WEB_BELGIUM_JSON = WEB_BELGIUM_DIR / "stadiums.json"
WEB_BELGIUM_README = WEB_BELGIUM_DIR / "README.md"
BELGIUM_COORDINATE_CACHE = WEB_BELGIUM_DIR / "coordinate-cache.json"

USER_AGENT = "Tribunetour/1.0 (martin@toudal.dk)"
SEASON_ID = "2025-26"
LEAGUE_PACK = "belgium_top_3"


PRO_LEAGUE_RELEGATION_FIXTURES = """
RUNDE 37
08.05. 20:45 St. Liege Leuven
RUNDE 36
09.05. 16:00 RAAL La Louviere Cercle Brugge
09.05. 16:00 Waregem Dender
RUNDE 38
15.05. 20:45 Leuven Antwerp
16.05. 16:00 Charleroi Westerlo
16.05. 18:15 St. Liege Genk
RUNDE 39
19.05. 20:30 Charleroi Leuven
19.05. 20:30 Genk Antwerp
19.05. 20:30 Westerlo St. Liege
RUNDE 40
23.05. 20:45 Antwerp Westerlo
23.05. 20:45 Leuven Genk
23.05. 20:45 St. Liege Charleroi
""".strip()

PRO_LEAGUE_CHAMPIONS_FIXTURES = """
RUNDE 37
09.05. 20:45 Club Brügge St. Truiden
10.05. 13:30 Gent Anderlecht
10.05. 18:30 Royale Union SG KV Mechelen
RUNDE 38
16.05. 20:45 St. Truiden Gent
17.05. 13:30 Anderlecht KV Mechelen
17.05. 18:30 Club Brügge Royale Union SG
RUNDE 39
21.05. 20:30 Anderlecht St. Truiden
21.05. 20:30 Gent Royale Union SG
21.05. 20:30 KV Mechelen Club Brügge
RUNDE 40
24.05. 18:30 Club Brügge Gent
24.05. 18:30 Royale Union SG Anderlecht
24.05. 18:30 St. Truiden KV Mechelen
""".strip()

PRO_LEAGUE_EUROPE_FIXTURES = """
RUNDE 37
10.05. 16:00 Antwerp Charleroi
10.05. 19:15 Genk Westerlo
RUNDE 38
15.05. 20:45 Leuven Antwerp
16.05. 16:00 Charleroi Westerlo
16.05. 18:15 St. Liege Genk
RUNDE 39
19.05. 20:30 Charleroi Leuven
19.05. 20:30 Genk Antwerp
19.05. 20:30 Westerlo St. Liege
RUNDE 40
23.05. 20:45 Antwerp Westerlo
23.05. 20:45 Leuven Genk
23.05. 20:45 St. Liege Charleroi
""".strip()

PROMOTION_RELEGATION_PLAYOFF_FIXTURES = """
SEMIFINALERNE
09.05. 18:15 Beerschot VA Lommel SK
""".strip()

ACFF_FIXTURES = """
RUNDE 10
10.05. 15:00 Namur Charleroi B
10.05. 15:00 Royal Union SG 2 Stockay-Warfusee
10.05. 15:00 St. Liege U23 Schaerbeek-Evere
""".strip()

ACFF_PROMOTION_FIXTURES = """
RUNDE 10
10.05. 15:00 Renaissance Mons Meux
10.05. 15:00 Tubize-Braine Union Rochefortoise
10.05. 15:00 Virton Habay La Neuve
""".strip()


TEAM_ROWS = [
    {"team": "Anderlecht", "page": "R.S.C._Anderlecht", "league": "Jupiler Pro League", "league_code": "be-jupiler-pro-league", "competition_id": "be-jupiler-pro-league", "secondary_competition_ids": "be-pro-league-champions-playoffs", "short_code": "AND"},
    {"team": "Antwerp", "page": "Royal_Antwerp_F.C.", "league": "Jupiler Pro League", "league_code": "be-jupiler-pro-league", "competition_id": "be-jupiler-pro-league", "secondary_competition_ids": "be-pro-league-europe-playoffs", "short_code": "ANT"},
    {"team": "Cercle Brugge", "page": "Cercle_Brugge_K.S.V.", "league": "Jupiler Pro League", "league_code": "be-jupiler-pro-league", "competition_id": "be-jupiler-pro-league", "secondary_competition_ids": "be-pro-league-relegation-playoffs", "short_code": "CER", "city_override": "Bruges"},
    {"team": "Charleroi", "page": "Royal_Charleroi_S.C.", "league": "Jupiler Pro League", "league_code": "be-jupiler-pro-league", "competition_id": "be-jupiler-pro-league", "secondary_competition_ids": "be-pro-league-europe-playoffs", "short_code": "CHA"},
    {"team": "Club Brugge", "page": "Club_Brugge_KV", "league": "Jupiler Pro League", "league_code": "be-jupiler-pro-league", "competition_id": "be-jupiler-pro-league", "secondary_competition_ids": "be-pro-league-champions-playoffs", "short_code": "CBR", "city_override": "Bruges"},
    {"team": "Dender", "page": "F.C.V._Dender_E.H.", "league": "Jupiler Pro League", "league_code": "be-jupiler-pro-league", "competition_id": "be-jupiler-pro-league", "secondary_competition_ids": "be-pro-league-relegation-playoffs", "short_code": "DEN", "city_override": "Denderleeuw"},
    {"team": "Genk", "page": "K.R.C._Genk", "league": "Jupiler Pro League", "league_code": "be-jupiler-pro-league", "competition_id": "be-jupiler-pro-league", "secondary_competition_ids": "be-pro-league-europe-playoffs", "short_code": "GNK"},
    {"team": "Gent", "page": "K.A.A._Gent", "league": "Jupiler Pro League", "league_code": "be-jupiler-pro-league", "competition_id": "be-jupiler-pro-league", "secondary_competition_ids": "be-pro-league-champions-playoffs", "short_code": "GEN"},
    {"team": "KV Mechelen", "page": "K.V._Mechelen", "league": "Jupiler Pro League", "league_code": "be-jupiler-pro-league", "competition_id": "be-jupiler-pro-league", "secondary_competition_ids": "be-pro-league-champions-playoffs", "short_code": "MEC", "city_override": "Mechelen"},
    {"team": "Leuven", "page": "Oud-Heverlee_Leuven", "league": "Jupiler Pro League", "league_code": "be-jupiler-pro-league", "competition_id": "be-jupiler-pro-league", "secondary_competition_ids": "be-pro-league-relegation-playoffs|be-pro-league-europe-playoffs", "short_code": "LEU", "city_override": "Leuven"},
    {"team": "RAAL La Louviere", "page": "R.A.A._La_Louvi%C3%A8re", "league": "Jupiler Pro League", "league_code": "be-jupiler-pro-league", "competition_id": "be-jupiler-pro-league", "secondary_competition_ids": "be-pro-league-relegation-playoffs", "short_code": "LOU", "ground_override": "Stade du Tivoli", "city_override": "La Louviere"},
    {"team": "Royale Union SG", "page": "Royale_Union_Saint-Gilloise", "league": "Jupiler Pro League", "league_code": "be-jupiler-pro-league", "competition_id": "be-jupiler-pro-league", "secondary_competition_ids": "be-pro-league-champions-playoffs", "short_code": "USG", "city_override": "Forest"},
    {"team": "St. Liege", "page": "Standard_Li%C3%A8ge", "league": "Jupiler Pro League", "league_code": "be-jupiler-pro-league", "competition_id": "be-jupiler-pro-league", "secondary_competition_ids": "be-pro-league-relegation-playoffs|be-pro-league-europe-playoffs", "short_code": "STL", "city_override": "Liege"},
    {"team": "St. Truiden", "page": "Sint-Truidense_V.V.", "league": "Jupiler Pro League", "league_code": "be-jupiler-pro-league", "competition_id": "be-jupiler-pro-league", "secondary_competition_ids": "be-pro-league-champions-playoffs", "short_code": "STR", "city_override": "Sint-Truiden"},
    {"team": "Waregem", "page": "S.V._Zulte_Waregem", "league": "Jupiler Pro League", "league_code": "be-jupiler-pro-league", "competition_id": "be-jupiler-pro-league", "secondary_competition_ids": "be-pro-league-relegation-playoffs", "short_code": "WAR"},
    {"team": "Westerlo", "page": "K.V.C._Westerlo", "league": "Jupiler Pro League", "league_code": "be-jupiler-pro-league", "competition_id": "be-jupiler-pro-league", "secondary_competition_ids": "be-pro-league-europe-playoffs", "short_code": "WES"},
    {"team": "Beerschot VA", "page": "K._Beerschot_VA", "league": "Challenger Pro League", "league_code": "be-challenger-pro-league", "competition_id": "be-challenger-pro-league", "secondary_competition_ids": "be-promotion-relegation-playoffs", "short_code": "BEE", "city_override": "Antwerp", "coordinate_override": (51.1816, 4.3817)},
    {"team": "Beveren", "page": "S.K._Beveren", "league": "Challenger Pro League", "league_code": "be-challenger-pro-league", "competition_id": "be-challenger-pro-league", "secondary_competition_ids": "", "short_code": "BEV"},
    {"team": "Club NXT", "page": "Club_NXT", "league": "Challenger Pro League", "league_code": "be-challenger-pro-league", "competition_id": "be-challenger-pro-league", "secondary_competition_ids": "", "short_code": "NXT", "ground_override": "Schiervelde Stadion", "city_override": "Roeselare"},
    {"team": "Eupen", "page": "K.A.S._Eupen", "league": "Challenger Pro League", "league_code": "be-challenger-pro-league", "competition_id": "be-challenger-pro-league", "secondary_competition_ids": "", "short_code": "EUP"},
    {"team": "Francs Borains", "page": "R.F.C._Seraing_(1922)", "league": "Challenger Pro League", "league_code": "be-challenger-pro-league", "competition_id": "be-challenger-pro-league", "secondary_competition_ids": "", "short_code": "FRB", "ground_override": "Stade Robert Urbain", "city_override": "Boussu", "coordinate_override": (50.4326, 3.7938)},
    {"team": "Jong Genk", "page": "Jong_Genk", "league": "Challenger Pro League", "league_code": "be-challenger-pro-league", "competition_id": "be-challenger-pro-league", "secondary_competition_ids": "", "short_code": "JGN", "ground_override": "Cegeka Arena", "city_override": "Genk"},
    {"team": "Jong KAA Gent", "page": "Jong_KAA_Gent", "league": "Challenger Pro League", "league_code": "be-challenger-pro-league", "competition_id": "be-challenger-pro-league", "secondary_competition_ids": "", "short_code": "JGT", "city_override": "Gent"},
    {"team": "Kortrijk", "page": "K.V._Kortrijk", "league": "Challenger Pro League", "league_code": "be-challenger-pro-league", "competition_id": "be-challenger-pro-league", "secondary_competition_ids": "", "short_code": "KOR", "city_override": "Kortrijk"},
    {"team": "Lierse", "page": "Lierse_K.", "league": "Challenger Pro League", "league_code": "be-challenger-pro-league", "competition_id": "be-challenger-pro-league", "secondary_competition_ids": "", "short_code": "LIE"},
    {"team": "Lokeren", "page": "K.S.C._Lokeren-Temse", "league": "Challenger Pro League", "league_code": "be-challenger-pro-league", "competition_id": "be-challenger-pro-league", "secondary_competition_ids": "", "short_code": "LOK"},
    {"team": "Lommel SK", "page": "Lommel_S.K.", "league": "Challenger Pro League", "league_code": "be-challenger-pro-league", "competition_id": "be-challenger-pro-league", "secondary_competition_ids": "be-promotion-relegation-playoffs", "short_code": "LOM", "ground_override": "Soevereinstadion", "city_override": "Lommel", "coordinate_override": (51.2317, 5.3151)},
    {"team": "Olympic Charleroi", "page": "R.A.A._Louvi%C3%A8re", "league": "Challenger Pro League", "league_code": "be-challenger-pro-league", "competition_id": "be-challenger-pro-league", "secondary_competition_ids": "", "short_code": "OLY", "ground_override": "Stade de la Neuville", "city_override": "Charleroi", "coordinate_override": (50.4108, 4.4446)},
    {"team": "Patro Eisden", "page": "K._Patro_Eisden_Maasmechelen", "league": "Challenger Pro League", "league_code": "be-challenger-pro-league", "competition_id": "be-challenger-pro-league", "secondary_competition_ids": "", "short_code": "PAT", "ground_override": "Gemeentelijk Sportparkstadion", "city_override": "Maasmechelen", "coordinate_override": (50.9660, 5.6944)},
    {"team": "RFC Liege", "page": "R.F.C._Li%C3%A8ge", "league": "Challenger Pro League", "league_code": "be-challenger-pro-league", "competition_id": "be-challenger-pro-league", "secondary_competition_ids": "", "short_code": "RFL", "ground_override": "Stade de Rocourt", "city_override": "Liege", "coordinate_override": (50.6672, 5.5488)},
    {"team": "RSCA Futures", "page": "RSCA_Futures", "league": "Challenger Pro League", "league_code": "be-challenger-pro-league", "competition_id": "be-challenger-pro-league", "secondary_competition_ids": "", "short_code": "RSF", "ground_override": "Lotto Park", "city_override": "Anderlecht"},
    {"team": "RWDM Brussels", "page": "R.W.D._Molenbeek", "league": "Challenger Pro League", "league_code": "be-challenger-pro-league", "competition_id": "be-challenger-pro-league", "secondary_competition_ids": "", "short_code": "RWD", "ground_override": "Edmond Machtens Stadium", "city_override": "Brussels", "coordinate_override": (50.8609, 4.3125)},
    {"team": "Seraing", "page": "R.F.C._Seraing", "league": "Challenger Pro League", "league_code": "be-challenger-pro-league", "competition_id": "be-challenger-pro-league", "secondary_competition_ids": "", "short_code": "SER", "ground_override": "Stade du Pairay", "city_override": "Seraing", "coordinate_override": (50.5993, 5.5141)},
    {"team": "Crossing Schaerbeek", "page": "Crossing_Schaerbeek", "league": "National Division 1 ACFF", "league_code": "be-national-division-1-acff", "competition_id": "be-national-division-1-acff", "secondary_competition_ids": "", "short_code": "CSC", "coordinate_override": (50.8670, 4.3785)},
    {"team": "Habay La Neuve", "page": "R.Entente_Sportive_Habay-la-Neuve", "league": "National Division 1 ACFF", "league_code": "be-national-division-1-acff", "competition_id": "be-national-division-1-acff", "secondary_competition_ids": "be-national-division-1-acff-promotion-group", "short_code": "HAB", "ground_override": "Stade communal de Habay-la-Neuve", "city_override": "Habay-la-Neuve", "coordinate_override": (49.7234, 5.6460)},
    {"team": "Meux", "page": "R._A.S._Meux", "league": "National Division 1 ACFF", "league_code": "be-national-division-1-acff", "competition_id": "be-national-division-1-acff", "secondary_competition_ids": "be-national-division-1-acff-promotion-group", "short_code": "MEU", "ground_override": "Stade des Verts Pres", "city_override": "Meux", "coordinate_override": (50.5517, 4.8011)},
    {"team": "Renaissance Mons", "page": "Renaissance_Mons_44", "league": "National Division 1 ACFF", "league_code": "be-national-division-1-acff", "competition_id": "be-national-division-1-acff", "secondary_competition_ids": "be-national-division-1-acff-promotion-group", "short_code": "MON", "city_override": "Mons"},
    {"team": "SL16 FC", "page": "SL16_FC", "league": "National Division 1 ACFF", "league_code": "be-national-division-1-acff", "competition_id": "be-national-division-1-acff", "secondary_competition_ids": "", "short_code": "SL1", "ground_override": "Stade Maurice Dufrasne", "city_override": "Liege"},
    {"team": "Stockay-Warfusee", "page": "R._R.C._Stockay-Warfus%C3%A9e", "league": "National Division 1 ACFF", "league_code": "be-national-division-1-acff", "competition_id": "be-national-division-1-acff", "secondary_competition_ids": "", "short_code": "STO", "coordinate_override": (50.5820, 5.3370)},
    {"team": "Tubize-Braine", "page": "R.U.S._Tubize-Braine", "league": "National Division 1 ACFF", "league_code": "be-national-division-1-acff", "competition_id": "be-national-division-1-acff", "secondary_competition_ids": "be-national-division-1-acff-promotion-group", "short_code": "TUB", "ground_override": "Stade Leburton", "city_override": "Tubize", "coordinate_override": (50.6918, 4.2016)},
    {"team": "Union Namur", "page": "Union_Namur", "league": "National Division 1 ACFF", "league_code": "be-national-division-1-acff", "competition_id": "be-national-division-1-acff", "secondary_competition_ids": "", "short_code": "NAM", "ground_override": "Stade ADEPS de Jambes", "city_override": "Namur", "coordinate_override": (50.4674, 4.8718)},
    {"team": "Union Rochefortoise", "page": "R._Union_Rochefortoise", "league": "National Division 1 ACFF", "league_code": "be-national-division-1-acff", "competition_id": "be-national-division-1-acff", "secondary_competition_ids": "be-national-division-1-acff-promotion-group", "short_code": "ROC", "ground_override": "Stade de Rochefort", "city_override": "Rochefort", "coordinate_override": (50.1633, 5.2214)},
    {"team": "Union SG B", "page": "Royale_Union_Saint-Gilloise_B", "league": "National Division 1 ACFF", "league_code": "be-national-division-1-acff", "competition_id": "be-national-division-1-acff", "secondary_competition_ids": "", "short_code": "USB", "ground_override": "Stade Marien annexe", "city_override": "Forest"},
    {"team": "Virton", "page": "R.E._Virton", "league": "National Division 1 ACFF", "league_code": "be-national-division-1-acff", "competition_id": "be-national-division-1-acff", "secondary_competition_ids": "be-national-division-1-acff-promotion-group", "short_code": "VIR", "city_override": "Virton"},
    {"team": "Zébra Élites", "page": "Z%C3%A9bra_%C3%89lites", "league": "National Division 1 ACFF", "league_code": "be-national-division-1-acff", "competition_id": "be-national-division-1-acff", "secondary_competition_ids": "", "short_code": "ZEB", "ground_override": "Stade du Pays de Charleroi", "city_override": "Charleroi"},
    {"team": "Belisia Bilzen", "page": "K._Belisia_Bilzen", "league": "National Division 1 VV", "league_code": "be-national-division-1-vv", "competition_id": "be-national-division-1-vv", "secondary_competition_ids": "", "short_code": "BEL", "ground_override": "Sportcomplex De Katteberg", "city_override": "Bilzen", "coordinate_override": (50.8733, 5.5184)},
    {"team": "Dessel Sport", "page": "K.F.C._Dessel_Sport", "league": "National Division 1 VV", "league_code": "be-national-division-1-vv", "competition_id": "be-national-division-1-vv", "secondary_competition_ids": "", "short_code": "DES", "ground_override": "Armand Melis Stadion", "city_override": "Dessel", "coordinate_override": (51.2399, 5.1145)},
    {"team": "Diegem", "page": "K._Diegem_Sport", "league": "National Division 1 VV", "league_code": "be-national-division-1-vv", "competition_id": "be-national-division-1-vv", "secondary_competition_ids": "", "short_code": "DIE"},
    {"team": "Hasselt", "page": "Sporting_Hasselt", "league": "National Division 1 VV", "league_code": "be-national-division-1-vv", "competition_id": "be-national-division-1-vv", "secondary_competition_ids": "", "short_code": "HAS", "city_override": "Hasselt"},
    {"team": "Hoogstraten", "page": "Hoogstraten_VV", "league": "National Division 1 VV", "league_code": "be-national-division-1-vv", "competition_id": "be-national-division-1-vv", "secondary_competition_ids": "", "short_code": "HOO", "ground_override": "Sportcomplex Seminarie", "city_override": "Hoogstraten", "coordinate_override": (51.4003, 4.7606)},
    {"team": "Houtvenne", "page": "KFC_Houtvenne", "league": "National Division 1 VV", "league_code": "be-national-division-1-vv", "competition_id": "be-national-division-1-vv", "secondary_competition_ids": "", "short_code": "HOU", "city_override": "Houtvenne"},
    {"team": "Jong Cercle", "page": "Jong_Cercle", "league": "National Division 1 VV", "league_code": "be-national-division-1-vv", "competition_id": "be-national-division-1-vv", "secondary_competition_ids": "", "short_code": "JCE", "city_override": "Bruges"},
    {"team": "Knokke", "page": "Royal_Knokke_FC", "league": "National Division 1 VV", "league_code": "be-national-division-1-vv", "competition_id": "be-national-division-1-vv", "secondary_competition_ids": "", "short_code": "KNO", "city_override": "Knokke"},
    {"team": "Lyra-Lierse Berlaar", "page": "K._Lyra-Lierse", "league": "National Division 1 VV", "league_code": "be-national-division-1-vv", "competition_id": "be-national-division-1-vv", "secondary_competition_ids": "", "short_code": "LYR", "ground_override": "Lyrastadion", "city_override": "Lier", "coordinate_override": (51.1313, 4.5706)},
    {"team": "Merelbeke", "page": "K.F.C._Merelbeke", "league": "National Division 1 VV", "league_code": "be-national-division-1-vv", "competition_id": "be-national-division-1-vv", "secondary_competition_ids": "", "short_code": "MER"},
    {"team": "Ninove", "page": "K.V.K._Ninove", "league": "National Division 1 VV", "league_code": "be-national-division-1-vv", "competition_id": "be-national-division-1-vv", "secondary_competition_ids": "", "short_code": "NIN"},
    {"team": "OH Leuven U-23", "page": "Oud-Heverlee_Leuven_U23", "league": "National Division 1 VV", "league_code": "be-national-division-1-vv", "competition_id": "be-national-division-1-vv", "secondary_competition_ids": "", "short_code": "OH3", "city_override": "Leuven"},
    {"team": "Roeselare", "page": "K.S.V._Roeselare", "league": "National Division 1 VV", "league_code": "be-national-division-1-vv", "competition_id": "be-national-division-1-vv", "secondary_competition_ids": "", "short_code": "ROE"},
    {"team": "Thes Sport", "page": "K._Thes_Sport_Tessenderlo", "league": "National Division 1 VV", "league_code": "be-national-division-1-vv", "competition_id": "be-national-division-1-vv", "secondary_competition_ids": "", "short_code": "THE", "city_override": "Tessenderlo"},
    {"team": "Tienen", "page": "K.V.K._Tienen-Hageland", "league": "National Division 1 VV", "league_code": "be-national-division-1-vv", "competition_id": "be-national-division-1-vv", "secondary_competition_ids": "", "short_code": "TIE", "ground_override": "Bergéstadion", "city_override": "Tienen", "coordinate_override": (50.8079, 4.9385)},
    {"team": "Zelzate", "page": "K._V.V._Zelzate", "league": "National Division 1 VV", "league_code": "be-national-division-1-vv", "competition_id": "be-national-division-1-vv", "secondary_competition_ids": "", "short_code": "ZEL"},
]


FIXTURE_COMPETITIONS = [
    {
        "source": PRO_LEAGUE_RELEGATION_FIXTURES,
        "fixture_prefix": "be1r",
        "round_prefix": "Jupiler Pro League - Nedrykningsgruppe - Runde",
        "competition_id": "be-pro-league-relegation-playoffs",
        "timezone_offset": "+02:00",
    },
    {
        "source": PRO_LEAGUE_CHAMPIONS_FIXTURES,
        "fixture_prefix": "be1c",
        "round_prefix": "Jupiler Pro League - Mesterskabsspil - Runde",
        "competition_id": "be-pro-league-champions-playoffs",
        "timezone_offset": "+02:00",
    },
    {
        "source": PRO_LEAGUE_EUROPE_FIXTURES,
        "fixture_prefix": "be1e",
        "round_prefix": "Jupiler Pro League - Conference League Gruppe - Runde",
        "competition_id": "be-pro-league-europe-playoffs",
        "timezone_offset": "+02:00",
    },
    {
        "source": PROMOTION_RELEGATION_PLAYOFF_FIXTURES,
        "fixture_prefix": "be1p",
        "round_prefix": "Belgisk promotion/relegation playoff - Semifinale",
        "competition_id": "be-promotion-relegation-playoffs",
        "timezone_offset": "+02:00",
    },
    {
        "source": ACFF_FIXTURES,
        "fixture_prefix": "be3a",
        "round_prefix": "National Division 1 ACFF - Runde",
        "competition_id": "be-national-division-1-acff",
        "timezone_offset": "+02:00",
    },
    {
        "source": ACFF_PROMOTION_FIXTURES,
        "fixture_prefix": "be3ap",
        "round_prefix": "National Division 1 ACFF - Oprykningsgruppe - Runde",
        "competition_id": "be-national-division-1-acff-promotion-group",
        "timezone_offset": "+02:00",
    },
]


FIXTURE_TEAM_ALIASES = {
    "Club Brügge": "Club Brugge",
    "Royale Union SG": "Royale Union SG",
    "St. Truiden": "St. Truiden",
    "St. Liege": "St. Liege",
    "RAAL La Louviere": "RAAL La Louviere",
    "Waregem": "Waregem",
    "Dender": "Dender",
    "Leuven": "Leuven",
    "Beerschot VA": "Beerschot VA",
    "Lommel SK": "Lommel SK",
    "Namur": "Union Namur",
    "Royal Union SG 2": "Union SG B",
    "Charleroi B": "Zébra Élites",
    "St. Liege U23": "SL16 FC",
    "Schaerbeek-Evere": "Crossing Schaerbeek",
    "Renaissance Mons": "Renaissance Mons",
    "Union Rochefortoise": "Union Rochefortoise",
    "Habay La Neuve": "Habay La Neuve",
}


def slugify_team(team: str) -> str:
    normalized = (
        team.lower()
        .replace("é", "e")
        .replace("è", "e")
        .replace("ê", "e")
        .replace("ë", "e")
        .replace("à", "a")
        .replace("â", "a")
        .replace("ï", "i")
        .replace("î", "i")
        .replace("ô", "o")
        .replace("ö", "o")
        .replace("ü", "u")
        .replace("û", "u")
        .replace("ç", "c")
        .replace("'", "")
        .replace(".", "")
        .replace("&", "and")
        .replace(" ", "-")
    )
    normalized = re.sub(r"[^a-z0-9-]+", "-", normalized)
    normalized = re.sub(r"-+", "-", normalized).strip("-")
    return normalized


def fetch_wikipedia_payload(params: dict) -> dict:
    request = urllib.request.Request(
        f"https://en.wikipedia.org/w/api.php?{urllib.parse.urlencode(params)}",
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def fetch_wikitext(page_title: str) -> str:
    normalized_page_title = urllib.parse.unquote(page_title)
    params = urllib.parse.urlencode(
        {
            "action": "query",
            "prop": "revisions",
            "titles": normalized_page_title,
            "rvslots": "main",
            "rvprop": "content",
            "redirects": 1,
            "format": "json",
            "formatversion": 2,
        }
    )
    payload = fetch_wikipedia_payload(
        {
            "action": "query",
            "prop": "revisions",
            "titles": normalized_page_title,
            "rvslots": "main",
            "rvprop": "content",
            "redirects": 1,
            "format": "json",
            "formatversion": 2,
        }
    )
    pages = payload.get("query", {}).get("pages", [])
    if not pages:
        raise RuntimeError(f"Missing page payload for {normalized_page_title}")

    page = pages[0]
    revisions = page.get("revisions") or []
    if not revisions:
        search_term = normalized_page_title.replace("_", " ").replace(".", " ")
        search_payload = fetch_wikipedia_payload(
            {
                "action": "query",
                "list": "search",
                "srsearch": search_term,
                "srlimit": 1,
                "format": "json",
                "formatversion": 2,
            }
        )
        search_results = search_payload.get("query", {}).get("search", [])
        if not search_results:
            raise RuntimeError(f"Missing revisions for {normalized_page_title}")
        return fetch_wikitext(search_results[0]["title"])

    return revisions[0]["slots"]["main"]["content"]


def fetch_wikipedia_coordinates(page_title: str) -> tuple[float, float] | None:
    normalized_page_title = urllib.parse.unquote(page_title)
    payload = fetch_wikipedia_payload(
        {
            "action": "query",
            "prop": "coordinates",
            "titles": normalized_page_title,
            "redirects": 1,
            "format": "json",
            "formatversion": 2,
            "colimit": 1,
        }
    )
    pages = payload.get("query", {}).get("pages", [])
    if not pages:
        return None

    coordinates = pages[0].get("coordinates") or []
    if coordinates:
        return float(coordinates[0]["lat"]), float(coordinates[0]["lon"])

    search_term = normalized_page_title.replace("_", " ").replace(".", " ")
    search_payload = fetch_wikipedia_payload(
        {
            "action": "query",
            "list": "search",
            "srsearch": search_term,
            "srlimit": 1,
            "format": "json",
            "formatversion": 2,
        }
    )
    search_results = search_payload.get("query", {}).get("search", [])
    if not search_results:
        return None
    best_title = search_results[0]["title"]
    if best_title == normalized_page_title:
        return None
    return fetch_wikipedia_coordinates(best_title)


def clean_wiki(value: str) -> str:
    value = re.sub(r"<ref[^>]*>.*?</ref>", "", value)
    value = re.sub(r"<ref[^/]*/>", "", value)
    value = re.sub(r"\{\{flagicon\|[^{}]+\}\}", "", value)
    value = re.sub(r"\{\{convert\|([^|}]+)\|[^}]+\}\}", r"\1", value)
    value = re.sub(r"\{\{nowrap\|([^{}]+)\}\}", r"\1", value)
    value = re.sub(r"\{\{small\|([^{}]+)\}\}", r"\1", value)
    value = re.sub(r"\{\{lang\|[^|]+\|([^{}]+)\}\}", r"\1", value)
    value = re.sub(r"\{\{plainlist\|\s*", "", value)
    value = value.replace("}}", "")
    value = re.sub(r"\[\[([^|\]]+)\|([^\]]+)\]\]", r"\2", value)
    value = re.sub(r"\[\[([^\]]+)\]\]", r"\1", value)
    value = value.replace("&nbsp;", " ")
    value = value.replace("<br />", ", ").replace("<br/>", ", ").replace("<br>", ", ")
    value = re.sub(r"\{\{[^{}]+\}\}", "", value)
    value = re.sub(r"\s+", " ", value).strip(" ,")
    return value


def extract_infobox_value(wikitext: str, field_names: list[str]) -> str | None:
    for field in field_names:
        pattern = re.compile(rf"^\|\s*{re.escape(field)}\s*=\s*(.+)$", re.IGNORECASE | re.MULTILINE)
        match = pattern.search(wikitext)
        if match:
            return clean_wiki(match.group(1))
    return None


def parse_coord_template(wikitext: str) -> tuple[float, float] | None:
    match = re.search(r"\{\{coord\|([^{}]+)\}\}", wikitext, re.IGNORECASE)
    if not match:
        return None

    parts = [part.strip() for part in match.group(1).split("|") if part.strip()]
    if len(parts) < 2:
        return None

    try:
        if len(parts) >= 4 and parts[1].upper() in {"N", "S"} and parts[3].upper() in {"E", "W"}:
            lat = float(parts[0]) * (-1 if parts[1].upper() == "S" else 1)
            lon = float(parts[2]) * (-1 if parts[3].upper() == "W" else 1)
            return lat, lon

        if len(parts) >= 6 and parts[2].upper() in {"N", "S"} and parts[5].upper() in {"E", "W"}:
            lat = float(parts[0]) + float(parts[1]) / 60
            lon = float(parts[3]) + float(parts[4]) / 60
            lat *= -1 if parts[2].upper() == "S" else 1
            lon *= -1 if parts[5].upper() == "W" else 1
            return lat, lon

        if len(parts) >= 8 and parts[3].upper() in {"N", "S"} and parts[7].upper() in {"E", "W"}:
            lat = float(parts[0]) + float(parts[1]) / 60 + float(parts[2]) / 3600
            lon = float(parts[4]) + float(parts[5]) / 60 + float(parts[6]) / 3600
            lat *= -1 if parts[3].upper() == "S" else 1
            lon *= -1 if parts[7].upper() == "W" else 1
            return lat, lon

        lat = float(parts[0])
        lon = float(parts[1])
        return lat, lon
    except ValueError:
        return None


def derive_team_metadata(team_row: dict) -> tuple[str, str, tuple[float, float] | None]:
    if team_row.get("ground_override") and team_row.get("city_override"):
        return (
            team_row["ground_override"],
            team_row["city_override"],
            team_row.get("coordinate_override"),
        )

    wikitext = fetch_wikitext(team_row["page"])
    ground = extract_infobox_value(wikitext, ["ground", "stadium"])
    city = extract_infobox_value(wikitext, ["city", "location"])
    coordinates = parse_coord_template(wikitext)

    if not ground:
        raise RuntimeError(f"Missing ground for {team_row['team']} ({team_row['page']})")

    if city:
        city = city.split(",")[0].strip()
    elif "," in ground:
        ground, city = [part.strip() for part in ground.split(",", 1)]
    else:
        city = team_row["team"]

    if team_row.get("ground_override"):
        ground = team_row["ground_override"]
    if team_row.get("city_override"):
        city = team_row["city_override"]

    return ground, city, team_row.get("coordinate_override") or coordinates


def fetch_coordinates(stadium: str, city: str) -> tuple[float, float]:
    def run_query(query: str) -> list[dict]:
        params = urllib.parse.urlencode({"q": query, "format": "jsonv2", "limit": 1})
        request = urllib.request.Request(
            f"https://nominatim.openstreetmap.org/search?{params}",
            headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
        )
        for attempt in range(3):
            try:
                with urllib.request.urlopen(request, timeout=30) as response:
                    return json.loads(response.read().decode("utf-8"))
            except HTTPError as error:
                if error.code != 429 or attempt == 2:
                    raise
                retry_after = error.headers.get("Retry-After")
                delay = int(retry_after) if retry_after and retry_after.isdigit() else 10 * (attempt + 1)
                time.sleep(delay)
        return []

    payload = run_query(f"{stadium}, {city}, Belgium")

    if not payload:
        payload = run_query(f"{stadium}, Belgium")

    if not payload:
        payload = run_query(f"{city}, Belgium")

    if not payload:
        raise RuntimeError(f"Missing coordinates for {stadium} ({city})")

    return float(payload[0]["lat"]), float(payload[0]["lon"])


def load_coordinate_cache() -> dict[str, tuple[float, float]]:
    cache = {}
    if BELGIUM_COORDINATE_CACHE.exists():
        existing_cache = json.loads(BELGIUM_COORDINATE_CACHE.read_text(encoding="utf-8"))
        cache.update(
            {
                team_id: (float(value["lat"]), float(value["lon"]))
                for team_id, value in existing_cache.items()
                if isinstance(value, dict) and "lat" in value and "lon" in value
            }
        )
    if WEB_BELGIUM_JSON.exists():
        existing = json.loads(WEB_BELGIUM_JSON.read_text(encoding="utf-8"))
        cache.update(
            {
                row["id"]: (float(row["lat"]), float(row["lon"]))
                for row in existing
                if "id" in row and "lat" in row and "lon" in row
            }
        )
    return cache


def persist_coordinate_cache(coordinate_cache: dict[str, tuple[float, float]]):
    WEB_BELGIUM_DIR.mkdir(parents=True, exist_ok=True)
    BELGIUM_COORDINATE_CACHE.write_text(
        json.dumps(
            {
                team_id: {"lat": lat_lon[0], "lon": lat_lon[1]}
                for team_id, lat_lon in coordinate_cache.items()
            },
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )


def build_team_rows() -> list[dict]:
    coordinate_cache = load_coordinate_cache()
    rows = []
    for team_row in TEAM_ROWS:
        ground, city, wiki_coordinates = derive_team_metadata(team_row)
        team_id = f"be-{slugify_team(team_row['team'])}"
        lat_lon = team_row.get("coordinate_override") or coordinate_cache.get(team_id) or wiki_coordinates
        if lat_lon is None:
            try:
                lat_lon = fetch_wikipedia_coordinates(ground)
                if lat_lon is None:
                    lat_lon = fetch_wikipedia_coordinates(team_row["team"])
                if lat_lon is None:
                    lat_lon = fetch_wikipedia_coordinates(city)
                if lat_lon is None:
                    lat_lon = fetch_coordinates(ground, city)
            except Exception as error:
                raise RuntimeError(
                    f"Coordinate lookup failed for {team_row['team']} at {ground} ({city})"
                ) from error
            coordinate_cache[team_id] = lat_lon
            persist_coordinate_cache(coordinate_cache)
            time.sleep(1)

        rows.append(
            {
                "id": team_id,
                "name": ground,
                "team": team_row["team"],
                "league": team_row["league"],
                "city": city,
                "lat": lat_lon[0],
                "lon": lat_lon[1],
                "country_code": "be",
                "league_code": team_row["league_code"],
                "league_pack": LEAGUE_PACK,
                "short_code": team_row["short_code"],
                "competition_id": team_row["competition_id"],
                "season_id": SEASON_ID,
                "membership_status": "active",
                "secondary_competition_ids": team_row["secondary_competition_ids"],
            }
        )
    return rows


def parse_fixture_source(source: str, round_prefix: str):
    fixtures = []
    current_round = None

    for raw_line in source.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line.startswith("RUNDE "):
            current_round = line.split()[-1]
            continue
        if line == "SEMIFINALERNE":
            current_round = "Semifinale"
            continue

        parts = line.split()
        date_part, time_part = parts[0], parts[1]
        teams = " ".join(parts[2:])

        matched = None
        for home in sorted(TEAM_BY_NAME.keys(), key=len, reverse=True):
            prefix = f"{home} "
            if teams.startswith(prefix):
                away = teams[len(prefix):]
                if away in TEAM_BY_NAME:
                    matched = (home, away)
                    break

        if matched is None:
            alias_line = teams
            for alias, canonical in FIXTURE_TEAM_ALIASES.items():
                alias_line = alias_line.replace(alias, canonical)
            for home in sorted(TEAM_BY_NAME.keys(), key=len, reverse=True):
                prefix = f"{home} "
                if alias_line.startswith(prefix):
                    away = alias_line[len(prefix):]
                    if away in TEAM_BY_NAME:
                        matched = (home, away)
                        break

        if matched is None:
            raise RuntimeError(f"Unable to parse fixture line: {line}")

        day, month = date_part.split(".")[:2]
        round_value = round_prefix if current_round == "Semifinale" else f"{round_prefix} {current_round}"
        fixtures.append(
            {
                "kickoff": f"2026-{month}-{day}T{time_part}:00",
                "round": round_value,
                "home": matched[0],
                "away": matched[1],
            }
        )

    return fixtures


def build_fixture_rows():
    rows = []
    for spec in FIXTURE_COMPETITIONS:
        parsed = parse_fixture_source(spec["source"], spec["round_prefix"])
        for index, fixture in enumerate(parsed, start=1):
            home = TEAM_BY_NAME[fixture["home"]]
            away = TEAM_BY_NAME[fixture["away"]]
            rows.append(
                {
                    "id": f"{spec['fixture_prefix']}-{index:02d}-{home['id'].split('be-')[1]}-{away['id'].split('be-')[1]}",
                    "kickoff": f"{fixture['kickoff']}{spec['timezone_offset']}",
                    "round": fixture["round"],
                    "homeTeamId": home["id"],
                    "awayTeamId": away["id"],
                    "venueClubId": home["id"],
                    "status": "scheduled",
                    "homeScore": "",
                    "awayScore": "",
                    "competitionId": spec["competition_id"],
                    "seasonId": SEASON_ID,
                }
            )
    return rows


def write_app_csv(rows: list[dict]):
    header = [
        "id",
        "name",
        "team",
        "league",
        "city",
        "lat",
        "lon",
        "country_code",
        "league_code",
        "league_pack",
        "short_code",
        "competition_id",
        "season_id",
        "membership_status",
        "secondary_competition_ids",
    ]
    with APP_BELGIUM_CSV.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=header)
        writer.writeheader()
        writer.writerows(rows)


def write_web_json(rows: list[dict]):
    payload = []
    for row in rows:
        payload.append(
            {
                "id": row["id"],
                "name": row["name"],
                "team": row["team"],
                "league": row["league"],
                "city": row["city"],
                "lat": row["lat"],
                "lon": row["lon"],
                "countryCode": row["country_code"],
                "leagueCode": row["league_code"],
                "leaguePack": row["league_pack"],
                "shortCode": row["short_code"],
                "primaryCompetitionId": row["competition_id"],
                "primarySeasonId": row["season_id"],
                "membershipStatus": row["membership_status"],
                "secondaryCompetitionIds": [
                    value for value in row["secondary_competition_ids"].split("|") if value
                ],
            }
        )

    WEB_BELGIUM_DIR.mkdir(parents=True, exist_ok=True)
    WEB_BELGIUM_JSON.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    WEB_BELGIUM_README.write_text(
        "# Belgium Top 3\n\n"
        "Generated by `scripts/generate-belgium-league-pack.py`.\n"
        "Includes Jupiler Pro League, Challenger Pro League, National Division 1 ACFF/VV and current playoff fixtures.\n",
        encoding="utf-8",
    )


def update_fixtures_csv(new_rows: list[dict]):
    header = [
        "id",
        "kickoff",
        "round",
        "homeTeamId",
        "awayTeamId",
        "venueClubId",
        "status",
        "homeScore",
        "awayScore",
        "competitionId",
        "seasonId",
    ]
    existing_rows = []
    if APP_FIXTURES_CSV.exists():
        with APP_FIXTURES_CSV.open("r", encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                if row["id"].startswith(("be1r-", "be1c-", "be1e-", "be1p-", "be3a-", "be3ap-")):
                    continue
                existing_rows.append({key: row.get(key, "") for key in header})
    existing_rows.extend(new_rows)
    with APP_FIXTURES_CSV.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=header)
        writer.writeheader()
        writer.writerows(existing_rows)


TEAM_BY_NAME = {}


def main():
    rows = build_team_rows()
    TEAM_BY_NAME.update({row["team"]: row for row in rows})
    write_app_csv(rows)
    write_web_json(rows)
    fixture_rows = build_fixture_rows()
    update_fixtures_csv(fixture_rows)
    print(f"Wrote {len(rows)} clubs to {APP_BELGIUM_CSV.name}")
    print(f"Wrote {len(fixture_rows)} fixtures into {APP_FIXTURES_CSV.name}")


if __name__ == "__main__":
    main()
