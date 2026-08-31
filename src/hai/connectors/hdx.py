"""HDX (Humanitarian Data Exchange) connector via the public CKAN API."""

from .base import BaseConnector

SEARCH_URL = "https://data.humdata.org/api/3/action/package_search"
DATASET_URL = "https://data.humdata.org/dataset/"


class HDXDatasets(BaseConnector):
    name = "hdx"
    description = "OCHA Humanitarian Data Exchange dataset search"
    source = "https://data.humdata.org"

    def search(self, query: str, rows: int = 10, country: str = None):
        """Search HDX datasets; returns normalized dataset summaries."""
        q = query
        if country:
            q = f"{query} {country}"
        data = self.client.get(SEARCH_URL, params={"q": q, "rows": rows}).json()
        if not data.get("success"):
            return []
        results = []
        for pkg in data.get("result", {}).get("results", []):
            results.append({
                "source": "HDX",
                "title": pkg.get("title"),
                "name": pkg.get("name"),
                "organization": (pkg.get("organization") or {}).get("title"),
                "updated": pkg.get("last_modified") or pkg.get("metadata_modified"),
                "total_downloads": pkg.get("total_res_downloads"),
                "tags": [t.get("name") for t in pkg.get("tags", [])][:6],
                "formats": sorted({(r.get("format") or "").upper()
                                   for r in pkg.get("resources", []) if r.get("format")}),
                "url": DATASET_URL + pkg.get("name", ""),
            })
        return results
