"""Offline unit tests for the HAI platform layer (connectors mocked)."""

import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from hai import countries  # noqa: E402
from hai.connectors.base import FetchResult  # noqa: E402
from hai.connectors.gdacs import GDACSAlerts  # noqa: E402
from hai.connectors.hdx import HDXDatasets  # noqa: E402
from hai.connectors.usgs import USGSEarthquakes  # noqa: E402
from hai.connectors.worldbank import WorldBankIndicators  # noqa: E402
from hai.knowledge import KnowledgeBase  # noqa: E402
from hai.situation import SituationReporter, format_report  # noqa: E402


class FakeClient:
    """HttpClient stand-in returning canned payloads."""

    def __init__(self, body):
        self.body = body if isinstance(body, bytes) else json.dumps(body).encode()

    def get(self, url, params=None):
        return FetchResult(body=self.body, url=url)


USGS_PAYLOAD = {"features": [
    {"id": "q1", "properties": {"mag": 6.1, "place": "Testland", "time": 1,
                                "tsunami": 0, "alert": "orange", "felt": 12,
                                "url": "http://x"},
     "geometry": {"coordinates": [10.0, 20.0, 30.0]}},
    {"id": "q2", "properties": {"mag": 4.0, "place": "Smallville", "time": 2},
     "geometry": {"coordinates": [1, 2, 3]}},
]}

GDACS_XML = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:gdacs="http://www.gdacs.org">
<channel>
<item>
  <title>Red flood alert in Testland</title>
  <link>http://gdacs/1</link>
  <gdacs:eventtype>FL</gdacs:eventtype>
  <gdacs:alertlevel>Red</gdacs:alertlevel>
  <gdacs:country>Testland</gdacs:country>
  <gdacs:eventid>1001</gdacs:eventid>
</item>
<item>
  <title>Green earthquake in Otherland</title>
  <link>http://gdacs/2</link>
  <gdacs:eventtype>EQ</gdacs:eventtype>
  <gdacs:alertlevel>Green</gdacs:alertlevel>
  <gdacs:country>Otherland</gdacs:country>
  <gdacs:eventid>1002</gdacs:eventid>
</item>
</channel>
</rss>"""

WB_PAYLOAD = [{"page": 1}, [{"indicator": {"id": "SP.POP.TOTL", "value": "Population, total"},
                            "country": {"value": "Kenya"}, "date": "2025",
                            "value": 57000000}]]

HDX_PAYLOAD = {"success": True, "result": {"results": [{
    "title": "Test Dataset", "name": "test-ds",
    "organization": {"title": "OCHA"}, "last_modified": "2026-01-01",
    "tags": [{"name": "flood"}], "resources": [{"format": "CSV"}],
}]}}


class TestUSGS(unittest.TestCase):
    def test_parse_and_filter(self):
        conn = USGSEarthquakes(FakeClient(USGS_PAYLOAD))
        events = conn.earthquakes(min_magnitude=5.0)
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["place"], "Testland")
        self.assertEqual(events[0]["alert"], "orange")
        self.assertEqual(events[0]["depth_km"], 30.0)

    def test_unknown_feed_rejected(self):
        conn = USGSEarthquakes(FakeClient(USGS_PAYLOAD))
        with self.assertRaises(ValueError):
            conn.earthquakes("bogus_feed")


class TestGDACS(unittest.TestCase):
    def test_parse_and_level_filter(self):
        conn = GDACSAlerts(FakeClient(GDACS_XML.encode()))
        all_alerts = conn.alerts()
        self.assertEqual(len(all_alerts), 2)
        self.assertEqual(all_alerts[0]["alert_level"], "red")
        self.assertEqual(all_alerts[0]["event_type"], "Flood")
        red_only = conn.alerts(min_level="red")
        self.assertEqual(len(red_only), 1)

    def test_country_filter(self):
        conn = GDACSAlerts(FakeClient(GDACS_XML.encode()))
        hits = conn.alerts(country="testland")
        self.assertEqual(len(hits), 1)
        self.assertEqual(hits[0]["country"], "Testland")


class TestWorldBank(unittest.TestCase):
    def test_indicator_parse(self):
        conn = WorldBankIndicators(FakeClient(WB_PAYLOAD))
        row = conn.indicator("KEN", "SP.POP.TOTL")
        self.assertEqual(row["country"], "Kenya")
        self.assertEqual(row["value"], 57000000)

    def test_empty_result(self):
        conn = WorldBankIndicators(FakeClient([{"page": 1}, None]))
        self.assertIsNone(conn.indicator("KEN", "SP.POP.TOTL"))


class TestHDX(unittest.TestCase):
    def test_search_parse(self):
        conn = HDXDatasets(FakeClient(HDX_PAYLOAD))
        results = conn.search("flood")
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["organization"], "OCHA")
        self.assertIn("CSV", results[0]["formats"])
        self.assertTrue(results[0]["url"].endswith("test-ds"))


class TestCountries(unittest.TestCase):
    def test_resolution(self):
        self.assertEqual(countries.resolve("KEN"), ("KEN", "Kenya"))
        self.assertEqual(countries.resolve("kenya")[0], "KEN")
        self.assertEqual(countries.resolve("DRC")[0], "COD")
        self.assertEqual(countries.resolve("syria")[0], "SYR")
        self.assertIsNone(countries.resolve("atlantis")[0])


class TestKnowledgeBase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.kb = KnowledgeBase()

    def test_corpus_loaded(self):
        stats = self.kb.stats()
        self.assertGreater(stats.get("terminology", 0), 100)
        self.assertGreater(stats.get("crisis_type", 0), 50)

    def test_search_ranked(self):
        hits = self.kb.search("flood assessment", limit=5)
        self.assertTrue(hits)
        scores = [h["score"] for h in hits]
        self.assertEqual(scores, sorted(scores, reverse=True))

    def test_category_filter(self):
        hits = self.kb.search("data", limit=3, category="terminology")
        self.assertTrue(all(h["category"] == "terminology" for h in hits))

    def test_empty_query(self):
        self.assertEqual(self.kb.search("the and of"), [])


class FailingConnector:
    def alerts(self, **kw):
        raise RuntimeError("network down")


class TestSituationReporter(unittest.TestCase):
    def test_country_brief_degrades_gracefully(self):
        connectors = {
            "gdacs": FailingConnector(),
            "worldbank": WorldBankIndicators(FakeClient(WB_PAYLOAD)),
            "hdx": HDXDatasets(FakeClient(HDX_PAYLOAD)),
        }
        reporter = SituationReporter(connectors, kb=KnowledgeBase())
        report = reporter.country_brief("kenya")
        self.assertEqual(report["iso3"], "KEN")
        self.assertEqual(report["active_alerts"], [])
        self.assertTrue(any("gdacs" in e for e in report["errors"]))
        self.assertTrue(report["context_indicators"])
        self.assertTrue(report["datasets"])
        text = format_report(report)
        self.assertIn("COUNTRY SITUATION BRIEF: Kenya", text)
        self.assertIn("Source issues", text)


if __name__ == "__main__":
    unittest.main()
