"""USGS earthquake feed connector (GeoJSON, no API key required)."""

from .base import BaseConnector

FEED_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/{feed}.geojson"

FEEDS = {
    "significant_week": "Significant earthquakes, past 7 days",
    "significant_month": "Significant earthquakes, past 30 days",
    "4.5_day": "M4.5+ earthquakes, past 24 hours",
    "4.5_week": "M4.5+ earthquakes, past 7 days",
}


class USGSEarthquakes(BaseConnector):
    name = "usgs"
    description = "USGS real-time earthquake feeds"
    source = "https://earthquake.usgs.gov"

    def earthquakes(self, feed: str = "significant_week", min_magnitude: float = 0.0):
        """Return a list of normalized earthquake events."""
        if feed not in FEEDS:
            raise ValueError(f"unknown feed {feed!r}; choose from {sorted(FEEDS)}")
        data = self.client.get(FEED_URL.format(feed=feed)).json()
        events = []
        for feat in data.get("features", []):
            props = feat.get("properties", {})
            geom = feat.get("geometry") or {}
            coords = geom.get("coordinates") or [None, None, None]
            mag = props.get("mag")
            if mag is None or mag < min_magnitude:
                continue
            events.append({
                "source": "USGS",
                "id": feat.get("id"),
                "magnitude": mag,
                "place": props.get("place"),
                "time_ms": props.get("time"),
                "tsunami": bool(props.get("tsunami")),
                "alert": props.get("alert"),  # PAGER level: green/yellow/orange/red
                "felt_reports": props.get("felt"),
                "longitude": coords[0],
                "latitude": coords[1],
                "depth_km": coords[2],
                "url": props.get("url"),
            })
        events.sort(key=lambda e: e["magnitude"] or 0, reverse=True)
        return events
