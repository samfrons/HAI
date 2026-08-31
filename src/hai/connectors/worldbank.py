"""World Bank open data connector for country context indicators."""

from .base import BaseConnector

API_URL = "https://api.worldbank.org/v2/country/{country}/indicator/{indicator}"

# Indicators most relevant to humanitarian context analysis.
CONTEXT_INDICATORS = {
    "SP.POP.TOTL": "Population, total",
    "SP.DYN.LE00.IN": "Life expectancy at birth (years)",
    "SH.STA.MMRT": "Maternal mortality ratio (per 100,000 live births)",
    "SN.ITK.DEFC.ZS": "Prevalence of undernourishment (% of population)",
    "SH.H2O.BASW.ZS": "People using at least basic drinking water services (%)",
    "SM.POP.REFG": "Refugee population by country of asylum",
    "NY.GDP.PCAP.CD": "GDP per capita (current US$)",
    "SI.POV.DDAY": "Poverty headcount at $2.15/day (%)",
}


class WorldBankIndicators(BaseConnector):
    name = "worldbank"
    description = "World Bank development indicators for country context"
    source = "https://data.worldbank.org"

    def indicator(self, country_iso3: str, indicator: str):
        """Most recent non-empty value for one indicator, or None."""
        result = self.client.get(
            API_URL.format(country=country_iso3, indicator=indicator),
            params={"format": "json", "mrnev": 1},
        ).json()
        if not isinstance(result, list) or len(result) < 2 or not result[1]:
            return None
        row = result[1][0]
        return {
            "source": "World Bank",
            "indicator": indicator,
            "name": (row.get("indicator") or {}).get("value"),
            "country": (row.get("country") or {}).get("value"),
            "year": row.get("date"),
            "value": row.get("value"),
        }

    def country_context(self, country_iso3: str):
        """Humanitarian context profile: latest values for key indicators."""
        profile = []
        for code in CONTEXT_INDICATORS:
            try:
                row = self.indicator(country_iso3, code)
            except Exception:
                row = None
            if row and row["value"] is not None:
                profile.append(row)
        return profile
