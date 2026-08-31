# HAI

Humanitarian AI bot — a proof of concept combining a fine-tuned humanitarian
model (see `hai-cd/`), Petri safety auditing, ACE context optimization, and a
**live humanitarian data platform** (`src/hai/`).

## Platform: live data connectors + knowledge base

The `hai` package connects the platform to real operational data sources and
makes the extracted CLEAR knowledge corpus searchable. It is standard-library
only — no dependencies beyond Python 3.9+.

### Data connectors (`src/hai/connectors/`)

| Connector | Source | What it provides |
|-----------|--------|------------------|
| `gdacs` | GDACS (EC/UN) | Multi-hazard disaster alerts (red/orange/green) |
| `usgs` | USGS | Real-time earthquake feeds with PAGER impact levels |
| `worldbank` | World Bank | Country context indicators (population, undernourishment, refugees, poverty…) |
| `hdx` | OCHA HDX | Humanitarian dataset search (admin boundaries, food prices, facilities…) |
| `hpc` | OCHA HPC/FTS | Humanitarian response plans and funding flows |
| `reliefweb` | ReliefWeb v2 | Situation reports & disasters (needs an approved `RELIEFWEB_APPNAME`) |

All connectors share an HTTP client with retries, a 15-minute on-disk cache
(`data/cache/`), and stale-cache fallback when offline — sources that are down
degrade gracefully instead of failing a whole report.

### CLI

```bash
cd HAI
PYTHONPATH=src python3 -m hai overview              # global hazard + response overview
PYTHONPATH=src python3 -m hai country kenya         # country situation brief
PYTHONPATH=src python3 -m hai alerts --level red    # GDACS alerts
PYTHONPATH=src python3 -m hai quakes --min-mag 5    # significant earthquakes
PYTHONPATH=src python3 -m hai datasets "food security somalia"
PYTHONPATH=src python3 -m hai plans --year 2026     # OCHA response plans
PYTHONPATH=src python3 -m hai search "flood needs assessment"
PYTHONPATH=src python3 -m hai define "protection"   # knowledge-base lookup
PYTHONPATH=src python3 -m hai sources               # connector status
```

Add `--json` before the subcommand for machine-readable output — the same
structures can feed model prompts (RAG-style grounding) or dashboards.

### Country situation briefs

`python -m hai country <name|ISO3>` combines, in one report:
active GDACS alerts, World Bank humanitarian-context indicators, relevant HDX
datasets, ReliefWeb reports (when configured), and matching guidance from the
local knowledge base. Failed sources are listed under "Source issues".

### Knowledge base (`src/hai/knowledge.py`)

Indexes `data/processed/humanitarian_knowledge.json` (118 crisis types,
333 terminology entries, verified statistics, workflows, 317 platform
references) with a scored keyword search — usable standalone or as grounding
context for the trained model.

### Python API

```python
from hai.connectors import build_all
from hai.knowledge import KnowledgeBase
from hai.situation import SituationReporter

reporter = SituationReporter()
report = reporter.country_brief("somalia")   # dict, ready for JSON/prompting

kb = KnowledgeBase()
kb.search("cash and voucher assistance", limit=5)
```

### Tests

```bash
python3 -m unittest discover -s tests
```

Connector parsers are tested offline with canned payloads; no network needed.

## Repository layout

- `src/hai/` — platform package: connectors, knowledge base, situation reports, CLI
- `src/ace/`, `src/petri/` — ACE context optimizer and Petri humanitarian auditor
- `hai-cd/` — model training pipeline (LoRA fine-tune of Llama 3.2 3B) and demo apps
- `data/processed/` — extracted CLEAR humanitarian knowledge corpus
- `petri/` — Petri safety test scenarios
- `docs/`, `SUMMARY.md`, `INTEGRATION_GUIDE.md` — project documentation
