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
APP_TURKEY_CSV = APP_DIR / "turkey_top_3.csv"
WEB_TURKEY_DIR = WEBSITE_ROOT / "data" / "league-packs" / "turkey_top_3"
WEB_TURKEY_JSON = WEB_TURKEY_DIR / "stadiums.json"
WEB_TURKEY_README = WEB_TURKEY_DIR / "README.md"
TURKEY_COORDINATE_CACHE = WEB_TURKEY_DIR / "coordinate-cache.json"

USER_AGENT = "Tribunetour/1.0 (martin@toudal.dk)"
SEASON_ID = "2025-26"
LEAGUE_PACK = "turkey_top_3"


SUPER_LIG_FIXTURES = """
RUNDE 33
09.05. 19:00 Alanyaspor Kayserispor
09.05. 19:00 Basaksehir Samsunspor
09.05. 19:00 Besiktas Trabzonspor
09.05. 19:00 Eyupspor Rizespor
09.05. 19:00 Galatasaray Antalyaspor
09.05. 19:00 Genclerbirligi Kasimpasa
09.05. 19:00 Goztepe Gaziantep
09.05. 19:00 Kocaelispor Karagumruk
09.05. 19:00 Konyaspor Fenerbahce
RUNDE 34
17.05. 19:00 Antalyaspor Kocaelispor
17.05. 19:00 Fenerbahce Eyupspor
17.05. 19:00 Gaziantep Basaksehir
17.05. 19:00 Karagumruk Alanyaspor
17.05. 19:00 Kasimpasa Galatasaray
17.05. 19:00 Kayserispor Konyaspor
17.05. 19:00 Rizespor Besiktas
17.05. 19:00 Samsunspor Goztepe
17.05. 19:00 Trabzonspor Genclerbirligi
""".strip()

FIRST_LIG_PLAYOFF_FIXTURES = """
SEMIFINALERNE
11.05. 19:00 Bodrumspor Corum
15.05. 19:00 Corum Bodrumspor
""".strip()


TEAM_ROWS = [
    {"team": "Alanyaspor", "page": "Alanyaspor", "league": "Süper Lig", "league_code": "tr-super-lig", "competition_id": "tr-super-lig", "secondary_competition_ids": "", "short_code": "ALA", "ground_override": "Alanya Oba Stadium", "city_override": "Alanya"},
    {"team": "Antalyaspor", "page": "Antalyaspor", "league": "Süper Lig", "league_code": "tr-super-lig", "competition_id": "tr-super-lig", "secondary_competition_ids": "", "short_code": "ANT", "ground_override": "Corendon Airlines Park", "city_override": "Antalya"},
    {"team": "Başakşehir", "page": "İstanbul_Başakşehir_F.K.", "league": "Süper Lig", "league_code": "tr-super-lig", "competition_id": "tr-super-lig", "secondary_competition_ids": "", "short_code": "IBB", "ground_override": "Fatih Terim Stadium", "city_override": "Başakşehir"},
    {"team": "Beşiktaş", "page": "Beşiktaş_J.K.", "league": "Süper Lig", "league_code": "tr-super-lig", "competition_id": "tr-super-lig", "secondary_competition_ids": "", "short_code": "BES", "ground_override": "Tüpraş Stadium", "city_override": "Beşiktaş"},
    {"team": "Eyüpspor", "page": "Eyüpspor", "league": "Süper Lig", "league_code": "tr-super-lig", "competition_id": "tr-super-lig", "secondary_competition_ids": "", "short_code": "EYP", "ground_override": "Recep Tayyip Erdoğan Stadium", "city_override": "Eyüpsultan"},
    {"team": "Fatih Karagümrük", "page": "Fatih_Karagümrük_S.K.", "league": "Süper Lig", "league_code": "tr-super-lig", "competition_id": "tr-super-lig", "secondary_competition_ids": "", "short_code": "KAR", "ground_override": "Atatürk Olympic Stadium", "city_override": "Fatih"},
    {"team": "Fenerbahçe", "page": "Fenerbahçe_S.K._(football)", "league": "Süper Lig", "league_code": "tr-super-lig", "competition_id": "tr-super-lig", "secondary_competition_ids": "", "short_code": "FEN", "ground_override": "Chobani Stadium", "city_override": "Kadıköy"},
    {"team": "Galatasaray", "page": "Galatasaray_S.K._(football)", "league": "Süper Lig", "league_code": "tr-super-lig", "competition_id": "tr-super-lig", "secondary_competition_ids": "", "short_code": "GAL", "ground_override": "Rams Park", "city_override": "Sarıyer"},
    {"team": "Gaziantep", "page": "Gaziantep_F.K.", "league": "Süper Lig", "league_code": "tr-super-lig", "competition_id": "tr-super-lig", "secondary_competition_ids": "", "short_code": "GAZ", "ground_override": "Gaziantep Stadium", "city_override": "Gaziantep"},
    {"team": "Gençlerbirliği", "page": "Gençlerbirliği_S.K.", "league": "Süper Lig", "league_code": "tr-super-lig", "competition_id": "tr-super-lig", "secondary_competition_ids": "", "short_code": "GEN", "ground_override": "Eryaman Stadium", "city_override": "Yenimahalle"},
    {"team": "Göztepe", "page": "Göztepe_S.K.", "league": "Süper Lig", "league_code": "tr-super-lig", "competition_id": "tr-super-lig", "secondary_competition_ids": "", "short_code": "GOZ", "ground_override": "Gürsel Aksel Stadium", "city_override": "İzmir"},
    {"team": "Kasımpaşa", "page": "Kasımpaşa_S.K.", "league": "Süper Lig", "league_code": "tr-super-lig", "competition_id": "tr-super-lig", "secondary_competition_ids": "", "short_code": "KAS", "ground_override": "Recep Tayyip Erdoğan Stadium", "city_override": "Kasımpaşa"},
    {"team": "Kayserispor", "page": "Kayserispor", "league": "Süper Lig", "league_code": "tr-super-lig", "competition_id": "tr-super-lig", "secondary_competition_ids": "", "short_code": "KAY", "ground_override": "RHG Enertürk Enerji Stadium", "city_override": "Kayseri"},
    {"team": "Kocaelispor", "page": "Kocaelispor", "league": "Süper Lig", "league_code": "tr-super-lig", "competition_id": "tr-super-lig", "secondary_competition_ids": "", "short_code": "KOC", "ground_override": "Kocaeli Stadium", "city_override": "İzmit"},
    {"team": "Konyaspor", "page": "Konyaspor", "league": "Süper Lig", "league_code": "tr-super-lig", "competition_id": "tr-super-lig", "secondary_competition_ids": "", "short_code": "KON", "ground_override": "Konya Metropolitan Municipality Stadium", "city_override": "Konya"},
    {"team": "Rizespor", "page": "Çaykur_Rizespor", "league": "Süper Lig", "league_code": "tr-super-lig", "competition_id": "tr-super-lig", "secondary_competition_ids": "", "short_code": "RIZ", "ground_override": "Rize City Stadium", "city_override": "Rize"},
    {"team": "Samsunspor", "page": "Samsunspor", "league": "Süper Lig", "league_code": "tr-super-lig", "competition_id": "tr-super-lig", "secondary_competition_ids": "", "short_code": "SAM", "ground_override": "Samsun 19 Mayıs Stadium", "city_override": "Samsun"},
    {"team": "Trabzonspor", "page": "Trabzonspor", "league": "Süper Lig", "league_code": "tr-super-lig", "competition_id": "tr-super-lig", "secondary_competition_ids": "", "short_code": "TRA", "ground_override": "Papara Park", "city_override": "Trabzon"},
    {"team": "Adana Demirspor", "page": "Adana_Demirspor", "league": "1. Lig", "league_code": "tr-1-lig", "competition_id": "tr-1-lig", "secondary_competition_ids": "", "short_code": "ADA", "ground_override": "New Adana Stadium", "city_override": "Adana"},
    {"team": "Amedspor", "page": "Amed_S.K.", "league": "1. Lig", "league_code": "tr-1-lig", "competition_id": "tr-1-lig", "secondary_competition_ids": "", "short_code": "AME", "ground_override": "Diyarbakır Stadium", "city_override": "Diyarbakır"},
    {"team": "Bandırmaspor", "page": "Bandırmaspor", "league": "1. Lig", "league_code": "tr-1-lig", "competition_id": "tr-1-lig", "secondary_competition_ids": "", "short_code": "BAN", "ground_override": "17 Eylül Stadium", "city_override": "Bandırma"},
    {"team": "Bodrumspor", "page": "Bodrum_F.K.", "league": "1. Lig", "league_code": "tr-1-lig", "competition_id": "tr-1-lig", "secondary_competition_ids": "tr-1-lig-playoffs", "short_code": "BOD", "ground_override": "Bodrum District Stadium", "city_override": "Bodrum"},
    {"team": "Boluspor", "page": "Boluspor", "league": "1. Lig", "league_code": "tr-1-lig", "competition_id": "tr-1-lig", "secondary_competition_ids": "", "short_code": "BOL", "ground_override": "Bolu Atatürk Stadium", "city_override": "Bolu"},
    {"team": "Çorum", "page": "Çorum_FK", "league": "1. Lig", "league_code": "tr-1-lig", "competition_id": "tr-1-lig", "secondary_competition_ids": "tr-1-lig-playoffs", "short_code": "COR", "ground_override": "Çorum City Stadium", "city_override": "Çorum"},
    {"team": "Erzurumspor", "page": "Erzurumspor_FK", "league": "1. Lig", "league_code": "tr-1-lig", "competition_id": "tr-1-lig", "secondary_competition_ids": "", "short_code": "ERZ", "ground_override": "Kazım Karabekir Stadium", "city_override": "Erzurum"},
    {"team": "Esenler Erokspor", "page": "Esenler_Erokspor", "league": "1. Lig", "league_code": "tr-1-lig", "competition_id": "tr-1-lig", "secondary_competition_ids": "", "short_code": "ERO", "ground_override": "Esenler Stadium", "city_override": "Esenler"},
    {"team": "Hatayspor", "page": "Hatayspor", "league": "1. Lig", "league_code": "tr-1-lig", "competition_id": "tr-1-lig", "secondary_competition_ids": "", "short_code": "HAT", "ground_override": "Fuat Tosyalı Stadium", "city_override": "Antakya"},
    {"team": "Iğdır", "page": "Iğdır_FK", "league": "1. Lig", "league_code": "tr-1-lig", "competition_id": "tr-1-lig", "secondary_competition_ids": "", "short_code": "IGD", "ground_override": "Iğdır City Stadium", "city_override": "Iğdır"},
    {"team": "İstanbulspor", "page": "İstanbulspor", "league": "1. Lig", "league_code": "tr-1-lig", "competition_id": "tr-1-lig", "secondary_competition_ids": "", "short_code": "IST", "ground_override": "Esenyurt Necmi Kadıoğlu Stadium", "city_override": "Büyükçekmece"},
    {"team": "Keçiörengücü", "page": "Keçiörengücü", "league": "1. Lig", "league_code": "tr-1-lig", "competition_id": "tr-1-lig", "secondary_competition_ids": "", "short_code": "KEC", "ground_override": "Ankara Aktepe Stadium", "city_override": "Keçiören"},
    {"team": "Manisa", "page": "Manisa_FK", "league": "1. Lig", "league_code": "tr-1-lig", "competition_id": "tr-1-lig", "secondary_competition_ids": "", "short_code": "MAN", "ground_override": "Manisa 19 Mayıs Stadium", "city_override": "Manisa"},
    {"team": "Pendikspor", "page": "Pendikspor", "league": "1. Lig", "league_code": "tr-1-lig", "competition_id": "tr-1-lig", "secondary_competition_ids": "", "short_code": "PEN", "ground_override": "Pendik Stadium", "city_override": "Pendik"},
    {"team": "Sakaryaspor", "page": "Sakaryaspor", "league": "1. Lig", "league_code": "tr-1-lig", "competition_id": "tr-1-lig", "secondary_competition_ids": "", "short_code": "SAK", "ground_override": "New Sakarya Stadium", "city_override": "Adapazarı", "coordinate_override": (40.7805, 30.4324)},
    {"team": "Sarıyer", "page": "Sarıyer_S.K.", "league": "1. Lig", "league_code": "tr-1-lig", "competition_id": "tr-1-lig", "secondary_competition_ids": "", "short_code": "SAR", "ground_override": "Yusuf Ziya Öniş Stadium", "city_override": "Sarıyer", "coordinate_override": (41.1725, 29.0503)},
    {"team": "Serikspor", "page": "Serik_Belediyespor", "league": "1. Lig", "league_code": "tr-1-lig", "competition_id": "tr-1-lig", "secondary_competition_ids": "", "short_code": "SER", "ground_override": "Serik İsmail Oğan Stadium", "city_override": "Serik", "coordinate_override": (36.9165, 31.1028)},
    {"team": "Sivasspor", "page": "Sivasspor", "league": "1. Lig", "league_code": "tr-1-lig", "competition_id": "tr-1-lig", "secondary_competition_ids": "", "short_code": "SIV", "ground_override": "New Sivas 4 Eylül Stadium", "city_override": "Sivas"},
    {"team": "Ümraniyespor", "page": "Ümraniyespor", "league": "1. Lig", "league_code": "tr-1-lig", "competition_id": "tr-1-lig", "secondary_competition_ids": "", "short_code": "UMR", "ground_override": "Ümraniye Municipality City Stadium", "city_override": "Ümraniye"},
    {"team": "Vanspor", "page": "Vanspor_FK", "league": "1. Lig", "league_code": "tr-1-lig", "competition_id": "tr-1-lig", "secondary_competition_ids": "", "short_code": "VAN", "ground_override": "Van Atatürk Stadium", "city_override": "Van", "coordinate_override": (38.4960867, 43.3730708)},
    {"team": "24 Erzincanspor", "page": "24_Erzincanspor", "league": "2. Lig Beyaz Grup", "league_code": "tr-2-lig-beyaz-grup", "competition_id": "tr-2-lig-beyaz-grup", "secondary_competition_ids": "", "short_code": "24E"},
    {"team": "Adana 01", "page": "Adana_01_FK", "league": "2. Lig Beyaz Grup", "league_code": "tr-2-lig-beyaz-grup", "competition_id": "tr-2-lig-beyaz-grup", "secondary_competition_ids": "", "short_code": "A01", "ground_override": "Ali Hoşfikirer Stadium", "city_override": "Adana"},
    {"team": "Altınordu", "page": "Altınordu_F.K.", "league": "2. Lig Beyaz Grup", "league_code": "tr-2-lig-beyaz-grup", "competition_id": "tr-2-lig-beyaz-grup", "secondary_competition_ids": "", "short_code": "ALT", "ground_override": "Bornova Aziz Kocaoğlu Stadium", "city_override": "Bornova", "coordinate_override": (38.45454695, 27.22938607)},
    {"team": "Ankaraspor", "page": "Ankaraspor", "league": "2. Lig Beyaz Grup", "league_code": "tr-2-lig-beyaz-grup", "competition_id": "tr-2-lig-beyaz-grup", "secondary_competition_ids": "", "short_code": "ANK"},
    {"team": "Batman Petrolspor", "page": "Batman_Petrolspor", "league": "2. Lig Beyaz Grup", "league_code": "tr-2-lig-beyaz-grup", "competition_id": "tr-2-lig-beyaz-grup", "secondary_competition_ids": "", "short_code": "BAT"},
    {"team": "Beykoz Anadoluspor", "page": "Beykoz_Anadoluspor", "league": "2. Lig Beyaz Grup", "league_code": "tr-2-lig-beyaz-grup", "competition_id": "tr-2-lig-beyaz-grup", "secondary_competition_ids": "", "short_code": "BEY", "ground_override": "Sancaktepe Stadium", "city_override": "Sancaktepe", "coordinate_override": (41.0024389, 29.2260889)},
    {"team": "Beyoğlu Yeni Çarşı", "page": "Beyoğlu_Yeni_Çarşı_S.K.", "league": "2. Lig Beyaz Grup", "league_code": "tr-2-lig-beyaz-grup", "competition_id": "tr-2-lig-beyaz-grup", "secondary_competition_ids": "", "short_code": "BYC"},
    {"team": "Bucaspor 1928", "page": "Bucaspor_1928", "league": "2. Lig Beyaz Grup", "league_code": "tr-2-lig-beyaz-grup", "competition_id": "tr-2-lig-beyaz-grup", "secondary_competition_ids": "", "short_code": "BUC"},
    {"team": "Elazığspor", "page": "Elazığspor", "league": "2. Lig Beyaz Grup", "league_code": "tr-2-lig-beyaz-grup", "competition_id": "tr-2-lig-beyaz-grup", "secondary_competition_ids": "", "short_code": "ELA"},
    {"team": "Erbaaspor", "page": "Erbaaspor", "league": "2. Lig Beyaz Grup", "league_code": "tr-2-lig-beyaz-grup", "competition_id": "tr-2-lig-beyaz-grup", "secondary_competition_ids": "", "short_code": "ERB", "ground_override": "Erbaa İlçe Stadium", "city_override": "Erbaa", "coordinate_override": (40.6667, 36.5667)},
    {"team": "İnegölspor", "page": "İnegölspor", "league": "2. Lig Beyaz Grup", "league_code": "tr-2-lig-beyaz-grup", "competition_id": "tr-2-lig-beyaz-grup", "secondary_competition_ids": "", "short_code": "INE"},
    {"team": "İskenderunspor", "page": "İskenderunspor_(1978)", "league": "2. Lig Beyaz Grup", "league_code": "tr-2-lig-beyaz-grup", "competition_id": "tr-2-lig-beyaz-grup", "secondary_competition_ids": "", "short_code": "ISK", "ground_override": "İskenderun 5 Temmuz Stadium", "city_override": "İskenderun", "coordinate_override": (36.58510, 36.15530)},
    {"team": "Karacabey Belediyespor", "page": "Karacabey_Belediyespor", "league": "2. Lig Beyaz Grup", "league_code": "tr-2-lig-beyaz-grup", "competition_id": "tr-2-lig-beyaz-grup", "secondary_competition_ids": "", "short_code": "KBC", "ground_override": "Mustafa Fehmi Gerçeker Stadyumu", "city_override": "Karacabey", "coordinate_override": (40.2133, 28.3614)},
    {"team": "Karaman", "page": "Karaman_FK", "league": "2. Lig Beyaz Grup", "league_code": "tr-2-lig-beyaz-grup", "competition_id": "tr-2-lig-beyaz-grup", "secondary_competition_ids": "", "short_code": "KRM", "ground_override": "Yeni Karaman Stadyumu", "city_override": "Karaman"},
    {"team": "Kastamonuspor", "page": "Kastamonuspor_1966", "league": "2. Lig Beyaz Grup", "league_code": "tr-2-lig-beyaz-grup", "competition_id": "tr-2-lig-beyaz-grup", "secondary_competition_ids": "", "short_code": "KAS2"},
    {"team": "Kepezspor", "page": "Kepezspor_FK", "league": "2. Lig Beyaz Grup", "league_code": "tr-2-lig-beyaz-grup", "competition_id": "tr-2-lig-beyaz-grup", "secondary_competition_ids": "", "short_code": "KEP", "ground_override": "Kepez Hasan Doğan Stadium", "city_override": "Antalya"},
    {"team": "MKE Ankaragücü", "page": "MKE_Ankaragücü", "league": "2. Lig Beyaz Grup", "league_code": "tr-2-lig-beyaz-grup", "competition_id": "tr-2-lig-beyaz-grup", "secondary_competition_ids": "", "short_code": "MKA", "ground_override": "Eryaman Stadium", "city_override": "Ankara"},
    {"team": "Muğlaspor", "page": "Muğlaspor", "league": "2. Lig Beyaz Grup", "league_code": "tr-2-lig-beyaz-grup", "competition_id": "tr-2-lig-beyaz-grup", "secondary_competition_ids": "", "short_code": "MUG"},
    {"team": "Şanlıurfaspor", "page": "Şanlıurfaspor", "league": "2. Lig Beyaz Grup", "league_code": "tr-2-lig-beyaz-grup", "competition_id": "tr-2-lig-beyaz-grup", "secondary_competition_ids": "", "short_code": "SAN"},
    {"team": "1461 Trabzon", "page": "1461_Trabzon_FK", "league": "2. Lig Kırmızı Grup", "league_code": "tr-2-lig-kirmizi-grup", "competition_id": "tr-2-lig-kirmizi-grup", "secondary_competition_ids": "", "short_code": "146"},
    {"team": "68 Aksaray Belediyespor", "page": "68_Aksaray_Belediyespor", "league": "2. Lig Kırmızı Grup", "league_code": "tr-2-lig-kirmizi-grup", "competition_id": "tr-2-lig-kirmizi-grup", "secondary_competition_ids": "", "short_code": "AKS"},
    {"team": "Adanaspor", "page": "Adanaspor", "league": "2. Lig Kırmızı Grup", "league_code": "tr-2-lig-kirmizi-grup", "competition_id": "tr-2-lig-kirmizi-grup", "secondary_competition_ids": "", "short_code": "ADS"},
    {"team": "Aliağa", "page": "Aliağa_FK", "league": "2. Lig Kırmızı Grup", "league_code": "tr-2-lig-kirmizi-grup", "competition_id": "tr-2-lig-kirmizi-grup", "secondary_competition_ids": "", "short_code": "ALI", "ground_override": "Aliağa Atatürk Stadı", "city_override": "Aliağa", "coordinate_override": (38.8000, 26.9722)},
    {"team": "Ankara Demirspor", "page": "Ankara_Demirspor", "league": "2. Lig Kırmızı Grup", "league_code": "tr-2-lig-kirmizi-grup", "competition_id": "tr-2-lig-kirmizi-grup", "secondary_competition_ids": "", "short_code": "DEM"},
    {"team": "Arnavutköy Belediyespor", "page": "Arnavutköy_Belediyespor", "league": "2. Lig Kırmızı Grup", "league_code": "tr-2-lig-kirmizi-grup", "competition_id": "tr-2-lig-kirmizi-grup", "secondary_competition_ids": "", "short_code": "ARN", "ground_override": "Bolluca Stadium", "city_override": "Arnavutköy", "coordinate_override": (41.199406, 28.753056)},
    {"team": "Bursaspor", "page": "Bursaspor", "league": "2. Lig Kırmızı Grup", "league_code": "tr-2-lig-kirmizi-grup", "competition_id": "tr-2-lig-kirmizi-grup", "secondary_competition_ids": "", "short_code": "BUR"},
    {"team": "Fethiyespor", "page": "Fethiyespor", "league": "2. Lig Kırmızı Grup", "league_code": "tr-2-lig-kirmizi-grup", "competition_id": "tr-2-lig-kirmizi-grup", "secondary_competition_ids": "", "short_code": "FET"},
    {"team": "Güzide Gebzespor", "page": "Gebzespor", "league": "2. Lig Kırmızı Grup", "league_code": "tr-2-lig-kirmizi-grup", "competition_id": "tr-2-lig-kirmizi-grup", "secondary_competition_ids": "", "short_code": "GEB"},
    {"team": "Isparta 32", "page": "Isparta_32_Spor", "league": "2. Lig Kırmızı Grup", "league_code": "tr-2-lig-kirmizi-grup", "competition_id": "tr-2-lig-kirmizi-grup", "secondary_competition_ids": "", "short_code": "ISP", "ground_override": "Isparta Atatürk Stadyum", "city_override": "Isparta", "coordinate_override": (37.7648, 30.5566)},
    {"team": "Kahramanmaraş İstiklalspor", "page": "Kahramanmaraş_İstiklalspor", "league": "2. Lig Kırmızı Grup", "league_code": "tr-2-lig-kirmizi-grup", "competition_id": "tr-2-lig-kirmizi-grup", "secondary_competition_ids": "", "short_code": "KMI", "ground_override": "Batıpark Adem Şahan Sentetik Çim Sahası", "city_override": "Kahramanmaraş", "coordinate_override": (37.5858, 36.9371)},
    {"team": "Kırklarelispor", "page": "Kırklarelispor", "league": "2. Lig Kırmızı Grup", "league_code": "tr-2-lig-kirmizi-grup", "competition_id": "tr-2-lig-kirmizi-grup", "secondary_competition_ids": "", "short_code": "KIR"},
    {"team": "Mardin 1969", "page": "Mardin_1969_Spor", "league": "2. Lig Kırmızı Grup", "league_code": "tr-2-lig-kirmizi-grup", "competition_id": "tr-2-lig-kirmizi-grup", "secondary_competition_ids": "", "short_code": "MAR", "ground_override": "21 Kasım Şehir Stadı", "city_override": "Mardin"},
    {"team": "Menemen", "page": "Menemen_F.K.", "league": "2. Lig Kırmızı Grup", "league_code": "tr-2-lig-kirmizi-grup", "competition_id": "tr-2-lig-kirmizi-grup", "secondary_competition_ids": "", "short_code": "MEN"},
    {"team": "Muşspor", "page": "Muşspor", "league": "2. Lig Kırmızı Grup", "league_code": "tr-2-lig-kirmizi-grup", "competition_id": "tr-2-lig-kirmizi-grup", "secondary_competition_ids": "", "short_code": "MUS", "ground_override": "Muş Şehir Stadı", "city_override": "Muş"},
    {"team": "Somaspor", "page": "Somaspor", "league": "2. Lig Kırmızı Grup", "league_code": "tr-2-lig-kirmizi-grup", "competition_id": "tr-2-lig-kirmizi-grup", "secondary_competition_ids": "", "short_code": "SOM"},
    {"team": "Yeni Malatyaspor", "page": "Yeni_Malatyaspor", "league": "2. Lig Kırmızı Grup", "league_code": "tr-2-lig-kirmizi-grup", "competition_id": "tr-2-lig-kirmizi-grup", "secondary_competition_ids": "", "short_code": "YEN"},
    {"team": "Yeni Mersin İdmanyurdu", "page": "Mersin_İdmanyurdu", "league": "2. Lig Kırmızı Grup", "league_code": "tr-2-lig-kirmizi-grup", "competition_id": "tr-2-lig-kirmizi-grup", "secondary_competition_ids": "", "short_code": "YMI"},
]


FIXTURE_COMPETITIONS = [
    {
        "source": SUPER_LIG_FIXTURES,
        "fixture_prefix": "tr1",
        "round_prefix": "Süper Lig - Runde",
        "competition_id": "tr-super-lig",
        "timezone_offset": "+03:00",
    },
    {
        "source": FIRST_LIG_PLAYOFF_FIXTURES,
        "fixture_prefix": "tr1p",
        "round_prefix": "1. Lig - Slutspil - Semifinale",
        "competition_id": "tr-1-lig-playoffs",
        "timezone_offset": "+03:00",
    },
]


FIXTURE_TEAM_ALIASES = {
    "Basaksehir": "Başakşehir",
    "Besiktas": "Beşiktaş",
    "Eyupspor": "Eyüpspor",
    "Fenerbahce": "Fenerbahçe",
    "Genclerbirligi": "Gençlerbirliği",
    "Goztepe": "Göztepe",
    "Kasimpasa": "Kasımpaşa",
    "Karagumruk": "Fatih Karagümrük",
    "Corum": "Çorum",
    "Bodrum": "Bodrumspor",
}


def canonicalize_fixture_team_text(value: str) -> str:
    canonical = value
    for alias, replacement in sorted(FIXTURE_TEAM_ALIASES.items(), key=lambda item: len(item[0]), reverse=True):
        canonical = re.sub(rf"\b{re.escape(alias)}\b", replacement, canonical)
    return canonical


def slugify_team(team: str) -> str:
    normalized = (
        team.lower()
        .replace("ç", "c")
        .replace("ğ", "g")
        .replace("ı", "i")
        .replace("İ", "i")
        .replace("ö", "o")
        .replace("ş", "s")
        .replace("ü", "u")
        .replace("&", "and")
        .replace("'", "")
        .replace(".", "")
        .replace(" ", "-")
    )
    normalized = re.sub(r"[^a-z0-9-]+", "-", normalized)
    normalized = re.sub(r"-+", "-", normalized).strip("-")
    return normalized


def normalize_lookup_text(value: str) -> str:
    value = urllib.parse.unquote(value or "")
    value = value.replace("_", " ").lower()
    replacements = {
        "ç": "c",
        "ğ": "g",
        "ı": "i",
        "İ": "i",
        "ö": "o",
        "ş": "s",
        "ü": "u",
    }
    for source, target in replacements.items():
        value = value.replace(source, target)
    value = re.sub(r"[^a-z0-9 ]+", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def fetch_wikipedia_payload(params: dict) -> dict:
    request = urllib.request.Request(
        f"https://en.wikipedia.org/w/api.php?{urllib.parse.urlencode(params)}",
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def resolve_page_title(page_title: str | None, search_term: str) -> str:
    normalized = None
    if page_title:
        normalized = urllib.parse.unquote(page_title)
        payload = fetch_wikipedia_payload(
            {
                "action": "query",
                "titles": normalized,
                "redirects": 1,
                "format": "json",
                "formatversion": 2,
            }
        )
        pages = payload.get("query", {}).get("pages", [])
        if pages and not pages[0].get("missing"):
            return pages[0]["title"]

    search_terms = []
    if normalized:
        search_terms.append(normalized.replace("_", " "))
    search_terms.append(search_term)

    for candidate in search_terms:
        search_payload = fetch_wikipedia_payload(
            {
                "action": "query",
                "list": "search",
                "srsearch": candidate,
                "srlimit": 10,
                "format": "json",
                "formatversion": 2,
            }
        )
        search_results = search_payload.get("query", {}).get("search", [])
        if search_results:
            candidate_normalized = normalize_lookup_text(candidate)

            def result_score(result: dict) -> tuple[int, int, int, int]:
                title = result.get("title", "")
                normalized_title = normalize_lookup_text(title)
                snippet = normalize_lookup_text(result.get("snippet", ""))

                exact = int(normalized_title == candidate_normalized)
                starts_with = int(normalized_title.startswith(candidate_normalized))
                contains = int(candidate_normalized in normalized_title or candidate_normalized in snippet)
                football_bias = int(
                    any(keyword in normalized_title for keyword in [" fk", " sk", "spor", "football", "futbol", "kulubu"])
                    or any(keyword in snippet for keyword in ["football", "futbol", "kulubu", "sports club"])
                )
                bad_match_penalty = int(
                    any(keyword in normalized_title for keyword in ["footballer", "born ", "album", "film", "song"])
                    or any(keyword in snippet for keyword in ["footballer", "born "])
                )
                length_penalty = -abs(len(normalized_title) - len(candidate_normalized))
                return (
                    exact,
                    starts_with + contains,
                    football_bias - bad_match_penalty,
                    length_penalty,
                )

            best_result = max(search_results, key=result_score)
            return best_result["title"]

    raise RuntimeError(f"Missing Wikipedia page for {search_term}")


def fetch_wikitext(page_title: str) -> str:
    payload = fetch_wikipedia_payload(
        {
            "action": "query",
            "prop": "revisions",
            "titles": page_title,
            "rvslots": "main",
            "rvprop": "content",
            "redirects": 1,
            "format": "json",
            "formatversion": 2,
        }
    )
    pages = payload.get("query", {}).get("pages", [])
    if not pages:
        raise RuntimeError(f"Missing page payload for {page_title}")
    revisions = pages[0].get("revisions") or []
    if not revisions:
        raise RuntimeError(f"Missing revisions for {page_title}")
    return revisions[0]["slots"]["main"]["content"]


def fetch_wikipedia_coordinates(page_title: str) -> tuple[float, float] | None:
    payload = fetch_wikipedia_payload(
        {
            "action": "query",
            "prop": "coordinates",
            "titles": page_title,
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
    if not coordinates:
        return None
    return float(coordinates[0]["lat"]), float(coordinates[0]["lon"])


def clean_wiki(value: str) -> str:
    value = re.sub(r"<ref[^>]*>.*?</ref>", "", value)
    value = re.sub(r"<ref[^/]*/>", "", value)
    value = re.sub(r"\{\{flagicon\|[^{}]+\}\}", "", value)
    value = re.sub(r"\{\{convert\|([^|}]+)\|[^}]+\}\}", r"\1", value)
    value = re.sub(r"\{\{nowrap\|([^{}]+)\}\}", r"\1", value)
    value = re.sub(r"\{\{small\|([^{}]+)\}\}", r"\1", value)
    value = re.sub(r"\{\{lang\|[^|]+\|([^{}]+)\}\}", r"\1", value)
    value = re.sub(r"\{\{sortname\|([^|{}]+)\|([^{}]+)\}\}", r"\1 \2", value)
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


def normalize_city_label(value: str) -> str:
    value = value.strip()
    value = re.split(r"\s*[,/;]\s*", value)[0].strip()
    value = re.sub(r"\s*\([^)]*\)\s*", "", value).strip()
    return value


def derive_city_from_team_name(team_name: str) -> str:
    normalized = normalize_city_label(team_name)
    replacements = [
        (r"\s+belediyespor$", ""),
        (r"\s+anadoluspor$", ""),
        (r"\s+demirspor$", ""),
        (r"\s+petrolspor$", ""),
        (r"\s+idmanyurdu$", ""),
        (r"\s+belediye$", ""),
        (r"\s+fk$", ""),
        (r"\s+sk$", ""),
        (r"\s+u23$", ""),
        (r"\s+2$", ""),
        (r"spor$", ""),
        (r"gucu$", "gu"),
        (r"gücü$", "gü"),
    ]
    derived = normalized
    for pattern, replacement in replacements:
        derived = re.sub(pattern, replacement, derived, flags=re.IGNORECASE).strip()
    derived = re.sub(r"\s+", " ", derived).strip(" -")
    return derived or normalized


def parse_coord_template(wikitext: str) -> tuple[float, float] | None:
    match = re.search(r"\{\{coord\|([^{}]+)\}\}", wikitext, re.IGNORECASE)
    if not match:
        return None
    parts = [part.strip() for part in match.group(1).split("|") if part.strip()]
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
    except ValueError:
        return None
    return None


def derive_team_metadata(team_row: dict) -> tuple[str, str, tuple[float, float] | None]:
    if team_row.get("ground_override") and team_row.get("city_override"):
        return (
            team_row["ground_override"],
            team_row["city_override"],
            team_row.get("coordinate_override"),
        )

    page_title = resolve_page_title(team_row.get("page"), team_row["team"])
    wikitext = fetch_wikitext(page_title)
    ground = extract_infobox_value(wikitext, ["ground", "stadium"])
    city = extract_infobox_value(wikitext, ["city", "location"])
    coordinates = parse_coord_template(wikitext) or fetch_wikipedia_coordinates(page_title)

    if not ground:
        raise RuntimeError(f"Missing ground for {team_row['team']} ({page_title})")

    if city:
        city = normalize_city_label(city)
    else:
        city = derive_city_from_team_name(team_row["team"])

    if coordinates is None:
        try:
            city_page = resolve_page_title(None, city)
            coordinates = fetch_wikipedia_coordinates(city_page)
        except RuntimeError:
            coordinates = None

    return (
        team_row.get("ground_override") or ground,
        team_row.get("city_override") or city,
        team_row.get("coordinate_override") or coordinates,
    )


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

    payload = run_query(f"{stadium}, {city}, Turkey")
    if not payload:
        payload = run_query(f"{stadium}, Turkey")
    if not payload:
        payload = run_query(f"{city}, Turkey")
    if not payload:
        derived_city = derive_city_from_team_name(city)
        if derived_city != city:
            payload = run_query(f"{derived_city}, Turkey")
    if not payload:
        normalized_city = normalize_city_label(city)
        try:
            city_page = resolve_page_title(None, normalized_city)
            city_coordinates = fetch_wikipedia_coordinates(city_page)
            if city_coordinates is not None:
                return city_coordinates
        except RuntimeError:
            pass
    if not payload:
        raise RuntimeError(f"Missing coordinates for {stadium} ({city})")
    return float(payload[0]["lat"]), float(payload[0]["lon"])


def load_coordinate_cache() -> dict[str, tuple[float, float]]:
    cache: dict[str, tuple[float, float]] = {}
    if TURKEY_COORDINATE_CACHE.exists():
        existing_cache = json.loads(TURKEY_COORDINATE_CACHE.read_text(encoding="utf-8"))
        cache.update(
            {
                team_id: (float(value["lat"]), float(value["lon"]))
                for team_id, value in existing_cache.items()
                if isinstance(value, dict) and "lat" in value and "lon" in value
            }
        )
    if WEB_TURKEY_JSON.exists():
        existing = json.loads(WEB_TURKEY_JSON.read_text(encoding="utf-8"))
        cache.update(
            {
                row["id"]: (float(row["lat"]), float(row["lon"]))
                for row in existing
                if "id" in row and "lat" in row and "lon" in row
            }
        )
    return cache


def persist_coordinate_cache(coordinate_cache: dict[str, tuple[float, float]]):
    WEB_TURKEY_DIR.mkdir(parents=True, exist_ok=True)
    TURKEY_COORDINATE_CACHE.write_text(
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
        team_id = f"tr-{slugify_team(team_row['team'])}"
        lat_lon = team_row.get("coordinate_override") or coordinate_cache.get(team_id) or wiki_coordinates
        if lat_lon is None:
            print(f"OSM fallback for {team_row['team']} ({ground}, {city})")
            lat_lon = fetch_coordinates(ground, city)
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
                "country_code": "tr",
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
            alias_line = canonicalize_fixture_team_text(teams)
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
                    "id": f"{spec['fixture_prefix']}-{index:02d}-{home['id'].split('tr-')[1]}-{away['id'].split('tr-')[1]}",
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
    with APP_TURKEY_CSV.open("w", encoding="utf-8", newline="") as handle:
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

    WEB_TURKEY_DIR.mkdir(parents=True, exist_ok=True)
    WEB_TURKEY_JSON.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    WEB_TURKEY_README.write_text(
        "# Turkey Top 3\n\n"
        "Generated by `scripts/generate-turkey-league-pack.py`.\n"
        "Includes Süper Lig, 1. Lig, 2. Lig Beyaz Grup and 2. Lig Kırmızı Grup, plus current 1. Lig playoff fixtures.\n",
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
                if row["id"].startswith(("tr1-", "tr1p-")):
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
    print(f"Wrote {len(rows)} clubs to {APP_TURKEY_CSV.name}")
    print(f"Wrote {len(fixture_rows)} fixtures into {APP_FIXTURES_CSV.name}")


if __name__ == "__main__":
    main()
