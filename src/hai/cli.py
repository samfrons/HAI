"""HAI platform CLI.

Usage (from repo root):
    python -m hai overview                 Global hazard + response overview
    python -m hai country <name|ISO3>      Country situation brief
    python -m hai alerts [--level red]     GDACS disaster alerts
    python -m hai quakes [--min-mag 5]     USGS significant earthquakes
    python -m hai datasets <query>         Search HDX humanitarian datasets
    python -m hai plans [--year 2026]      OCHA humanitarian response plans
    python -m hai search <query>           Search the local knowledge base
    python -m hai define <term>            Define a humanitarian term
    python -m hai sources                  List data connectors and status

Add --json to any command for machine-readable output.
"""

import argparse
import datetime
import json
import sys

from .connectors import build_all
from .knowledge import KnowledgeBase
from .situation import SituationReporter, format_report


def _emit(args, data, text_fn):
    if args.json:
        print(json.dumps(data, indent=2, default=str))
    else:
        print(text_fn(data))


def main(argv=None):
    parser = argparse.ArgumentParser(prog="hai",
                                     description="HAI humanitarian data platform")
    parser.add_argument("--json", action="store_true",
                        help="output JSON instead of text")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("overview", help="global hazard and response overview")

    p = sub.add_parser("country", help="country situation brief")
    p.add_argument("name", nargs="+", help="country name or ISO3 code")

    p = sub.add_parser("alerts", help="GDACS disaster alerts")
    p.add_argument("--level", default="green", choices=["green", "orange", "red"])
    p.add_argument("--country")

    p = sub.add_parser("quakes", help="USGS earthquakes")
    p.add_argument("--feed", default="significant_week")
    p.add_argument("--min-mag", type=float, default=0.0)

    p = sub.add_parser("datasets", help="search HDX datasets")
    p.add_argument("query", nargs="+")
    p.add_argument("--rows", type=int, default=10)

    p = sub.add_parser("plans", help="OCHA response plans")
    p.add_argument("--year", type=int, default=datetime.date.today().year)

    p = sub.add_parser("search", help="search local knowledge base")
    p.add_argument("query", nargs="+")
    p.add_argument("--category")
    p.add_argument("--limit", type=int, default=5)

    p = sub.add_parser("define", help="define a humanitarian term")
    p.add_argument("term", nargs="+")

    sub.add_parser("sources", help="list connectors and availability")

    args = parser.parse_args(argv)
    connectors = build_all()

    try:
        if args.command == "overview":
            report = SituationReporter(connectors).global_overview()
            _emit(args, report, format_report)

        elif args.command == "country":
            report = SituationReporter(connectors).country_brief(" ".join(args.name))
            _emit(args, report, format_report)

        elif args.command == "alerts":
            alerts = connectors["gdacs"].alerts(min_level=args.level,
                                                country=args.country)
            _emit(args, alerts, lambda a: "\n".join(
                f"[{x['alert_level'].upper():6}] {x['event_type']}: {x['title']}"
                for x in a) or "No matching alerts.")

        elif args.command == "quakes":
            quakes = connectors["usgs"].earthquakes(args.feed,
                                                    min_magnitude=args.min_mag)
            _emit(args, quakes, lambda qs: "\n".join(
                f"M{q['magnitude']:.1f} {q['place']}"
                + (f" [PAGER {q['alert']}]" if q.get("alert") else "")
                for q in qs) or "No matching earthquakes.")

        elif args.command == "datasets":
            results = connectors["hdx"].search(" ".join(args.query), rows=args.rows)
            _emit(args, results, lambda rs: "\n".join(
                f"{r['title']} [{r['organization']}]\n  {r['url']}"
                for r in rs) or "No datasets found.")

        elif args.command == "plans":
            plans = connectors["hpc"].plans(args.year)
            _emit(args, plans, lambda ps: "\n".join(
                f"{p['name']} ({p['start']} to {p['end']})" for p in ps)
                or f"No plans found for {args.year}.")

        elif args.command == "search":
            kb = KnowledgeBase()
            hits = kb.search(" ".join(args.query), limit=args.limit,
                             category=args.category)
            _emit(args, hits, lambda hs: "\n".join(
                f"[{h['category']}] {h['title']} (score {h['score']})\n"
                f"  {h['text'][:240]}" for h in hs) or "No knowledge base matches.")

        elif args.command == "define":
            kb = KnowledgeBase()
            hit = kb.define(" ".join(args.term))
            _emit(args, hit, lambda h:
                  f"{h['title']}\n  {h['text'][:500]}" if h
                  else "No definition found.")

        elif args.command == "sources":
            rows = [{"name": c.name, "description": c.description,
                     "source": c.source, "available": c.available()}
                    for c in connectors.values()]
            _emit(args, rows, lambda rs: "\n".join(
                f"{'[ok]  ' if r['available'] else '[off] '}{r['name']:10} "
                f"{r['description']} ({r['source']})" for r in rs))
    except Exception as err:
        print(f"error: {err}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
