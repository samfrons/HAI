"""GDACS (Global Disaster Alert and Coordination System) connector.

Parses the public GDACS RSS feed, which covers earthquakes, tropical
cyclones, floods, volcanoes, droughts, and wildfires with red/orange/green
severity levels used by humanitarian responders.
"""

import xml.etree.ElementTree as ET

from .base import BaseConnector

RSS_URL = "https://www.gdacs.org/xml/rss.xml"
GDACS_NS = "http://www.gdacs.org"

EVENT_TYPES = {
    "EQ": "Earthquake",
    "TC": "Tropical Cyclone",
    "FL": "Flood",
    "VO": "Volcano",
    "DR": "Drought",
    "WF": "Wildfire",
    "TS": "Tsunami",
}


class GDACSAlerts(BaseConnector):
    name = "gdacs"
    description = "GDACS multi-hazard disaster alerts (EC/UN)"
    source = "https://www.gdacs.org"

    def alerts(self, min_level: str = "green", country: str = None):
        """Return normalized alerts. min_level: green < orange < red."""
        order = {"green": 0, "orange": 1, "red": 2}
        if min_level.lower() not in order:
            raise ValueError("min_level must be green, orange, or red")
        threshold = order[min_level.lower()]

        xml_text = self.client.get(RSS_URL).text()
        root = ET.fromstring(xml_text)
        alerts = []
        for item in root.iter("item"):
            def g(tag, ns=None):
                el = item.find(f"{{{ns}}}{tag}" if ns else tag)
                return el.text.strip() if el is not None and el.text else None

            level = (g("alertlevel", GDACS_NS) or "green").lower()
            if order.get(level, 0) < threshold:
                continue
            alert_country = g("country", GDACS_NS) or ""
            if country and country.lower() not in alert_country.lower():
                continue
            etype = g("eventtype", GDACS_NS) or ""
            alerts.append({
                "source": "GDACS",
                "event_id": g("eventid", GDACS_NS),
                "event_type": EVENT_TYPES.get(etype, etype),
                "alert_level": level,
                "title": g("title"),
                "country": alert_country,
                "from_date": g("fromdate", GDACS_NS),
                "to_date": g("todate", GDACS_NS),
                "severity": g("severity", GDACS_NS),
                "population": g("population", GDACS_NS),
                "link": g("link"),
            })
        alerts.sort(key=lambda a: order.get(a["alert_level"], 0), reverse=True)
        return alerts
