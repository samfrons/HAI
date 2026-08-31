"""Minimal country name <-> ISO3 resolution for connector queries."""

# Countries with recurring humanitarian operations, plus common large states.
COUNTRIES = {
    "AFG": "Afghanistan", "BGD": "Bangladesh", "BFA": "Burkina Faso",
    "CAF": "Central African Republic", "TCD": "Chad", "COL": "Colombia",
    "COD": "Democratic Republic of the Congo", "ETH": "Ethiopia",
    "HTI": "Haiti", "IND": "India", "IDN": "Indonesia", "IRQ": "Iraq",
    "KEN": "Kenya", "LBN": "Lebanon", "LBY": "Libya", "MDG": "Madagascar",
    "MLI": "Mali", "MOZ": "Mozambique", "MMR": "Myanmar", "NER": "Niger",
    "NGA": "Nigeria", "PAK": "Pakistan", "PSE": "occupied Palestinian territory",
    "PHL": "Philippines", "SOM": "Somalia", "SSD": "South Sudan",
    "SDN": "Sudan", "SYR": "Syrian Arab Republic", "TUR": "Türkiye",
    "UGA": "Uganda", "UKR": "Ukraine", "VEN": "Venezuela", "YEM": "Yemen",
    "ZWE": "Zimbabwe", "USA": "United States", "CHN": "China", "JPN": "Japan",
    "MEX": "Mexico", "BRA": "Brazil", "NPL": "Nepal", "LKA": "Sri Lanka",
    "VUT": "Vanuatu", "FJI": "Fiji", "MWI": "Malawi", "ZMB": "Zambia",
    "TZA": "United Republic of Tanzania", "RWA": "Rwanda", "BDI": "Burundi",
    "ERI": "Eritrea", "DJI": "Djibouti", "IRN": "Iran", "JOR": "Jordan",
    "EGY": "Egypt", "MAR": "Morocco", "DZA": "Algeria", "SEN": "Senegal",
    "CMR": "Cameroon", "GTM": "Guatemala", "HND": "Honduras", "SLV": "El Salvador",
    "PER": "Peru", "ECU": "Ecuador", "BOL": "Bolivia", "PNG": "Papua New Guinea",
}

_ALIASES = {
    "drc": "COD", "congo": "COD", "dr congo": "COD", "palestine": "PSE",
    "gaza": "PSE", "west bank": "PSE", "syria": "SYR", "turkey": "TUR",
    "tanzania": "TZA", "burma": "MMR", "ivory coast": "CIV",
    "united states of america": "USA", "us": "USA", "usa": "USA",
}


def resolve(name_or_iso3: str):
    """Return (iso3, display_name) or (None, original input) if unknown."""
    s = name_or_iso3.strip()
    if s.upper() in COUNTRIES:
        return s.upper(), COUNTRIES[s.upper()]
    key = s.lower()
    if key in _ALIASES:
        iso = _ALIASES[key]
        return iso, COUNTRIES.get(iso, s)
    for iso, name in COUNTRIES.items():
        if key == name.lower() or key in name.lower():
            return iso, name
    return None, s
