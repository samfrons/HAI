"""Situation report aggregator: combines live connectors + knowledge base.

Produces structured country briefs and global overviews. Every section
degrades gracefully - a source that is down or unconfigured is reported
in ``errors`` instead of failing the whole report.
"""

import datetime

from . import countries
from .connectors import build_all
from .knowledge import KnowledgeBase


class SituationReporter:
    def __init__(self, connectors=None, kb: KnowledgeBase = None):
        self.connectors = connectors or build_all()
        self.kb = kb

    def _kb(self):
        if self.kb is None:
            self.kb = KnowledgeBase()
        return self.kb

    def _try(self, report, source, fn):
        try:
            return fn()
        except Exception as err:
            report["errors"].append(f"{source}: {err}")
            return None

    def global_overview(self):
        """Global hazard snapshot: GDACS alerts + significant earthquakes + plans."""
        report = {
            "type": "global_overview",
            "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "errors": [],
        }
        report["gdacs_alerts"] = self._try(
            report, "gdacs",
            lambda: self.connectors["gdacs"].alerts(min_level="orange")) or []
        report["earthquakes"] = self._try(
            report, "usgs",
            lambda: self.connectors["usgs"].earthquakes("significant_week")) or []
        year = datetime.date.today().year
        report["response_plans"] = self._try(
            report, "hpc", lambda: self.connectors["hpc"].plans(year)) or []
        return report

    def country_brief(self, country: str):
        """Country situation brief: hazards, context indicators, data, knowledge."""
        iso3, display = countries.resolve(country)
        report = {
            "type": "country_brief",
            "country": display,
            "iso3": iso3,
            "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "errors": [],
        }
        report["active_alerts"] = self._try(
            report, "gdacs",
            lambda: self.connectors["gdacs"].alerts(country=display)) or []
        if iso3:
            report["context_indicators"] = self._try(
                report, "worldbank",
                lambda: self.connectors["worldbank"].country_context(iso3)) or []
        else:
            report["context_indicators"] = []
            report["errors"].append(f"countries: could not resolve ISO3 for {country!r}")
        report["datasets"] = self._try(
            report, "hdx",
            lambda: self.connectors["hdx"].search(display, rows=5)) or []

        rw = self.connectors.get("reliefweb")
        if rw is not None and rw.available():
            report["recent_reports"] = self._try(
                report, "reliefweb", lambda: rw.reports(country=display, limit=5)) or []

        report["knowledge"] = self._try(
            report, "knowledge",
            lambda: self._kb().search(display + " crisis response", limit=3)) or []
        return report


def format_report(report: dict) -> str:
    """Render a report dict as readable terminal text."""
    lines = []
    if report["type"] == "global_overview":
        lines.append("GLOBAL HUMANITARIAN HAZARD OVERVIEW")
        lines.append(f"Generated: {report['generated_at']}")
        lines.append("")
        lines.append(f"GDACS alerts (orange/red): {len(report['gdacs_alerts'])}")
        for a in report["gdacs_alerts"][:10]:
            lines.append(f"  [{a['alert_level'].upper():6}] {a['event_type']}: "
                         f"{a['title']}")
        lines.append("")
        lines.append(f"Significant earthquakes (7 days): {len(report['earthquakes'])}")
        for e in report["earthquakes"][:10]:
            pager = f", PAGER {e['alert']}" if e.get("alert") else ""
            lines.append(f"  M{e['magnitude']:.1f} {e['place']}{pager}")
        lines.append("")
        lines.append(f"Active response plans this year: {len(report['response_plans'])}")
        for p in report["response_plans"][:10]:
            lines.append(f"  {p['name']}")
    elif report["type"] == "country_brief":
        lines.append(f"COUNTRY SITUATION BRIEF: {report['country']}"
                     + (f" ({report['iso3']})" if report["iso3"] else ""))
        lines.append(f"Generated: {report['generated_at']}")
        lines.append("")
        lines.append(f"Active GDACS alerts: {len(report['active_alerts'])}")
        for a in report["active_alerts"][:5]:
            lines.append(f"  [{a['alert_level'].upper():6}] {a['event_type']}: {a['title']}")
        if report["context_indicators"]:
            lines.append("")
            lines.append("Country context (World Bank, latest available):")
            for ind in report["context_indicators"]:
                val = ind["value"]
                val = f"{val:,.1f}" if isinstance(val, float) else f"{val:,}"
                lines.append(f"  {ind['name']}: {val} ({ind['year']})")
        if report["datasets"]:
            lines.append("")
            lines.append("Relevant HDX datasets:")
            for d in report["datasets"]:
                lines.append(f"  {d['title']} [{d['organization']}]")
                lines.append(f"    {d['url']}")
        if report.get("recent_reports"):
            lines.append("")
            lines.append("Recent ReliefWeb reports:")
            for r in report["recent_reports"]:
                lines.append(f"  {r['title']}")
        if report["knowledge"]:
            lines.append("")
            lines.append("Knowledge base guidance:")
            for k in report["knowledge"]:
                lines.append(f"  [{k['category']}] {k['title']}: {k['text'][:160]}")
    if report["errors"]:
        lines.append("")
        lines.append("Source issues (degraded sections):")
        for err in report["errors"]:
            lines.append(f"  ! {err}")
    return "\n".join(lines)
