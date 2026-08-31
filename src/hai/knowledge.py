"""Searchable knowledge base over the extracted CLEAR humanitarian corpus.

Wraps ``data/processed/humanitarian_knowledge.json`` (118 crisis types,
333 terminology entries, verified statistics, workflows, 317 platform
references) with cleanup and a lightweight scored keyword search, so the
platform can answer grounded questions without any model loaded.
"""

import json
import re
from collections import Counter
from pathlib import Path
from typing import Optional

DEFAULT_KB_PATH = (Path(__file__).resolve().parents[2]
                   / "data" / "processed" / "humanitarian_knowledge.json")

_WORD_RE = re.compile(r"[a-z0-9]{2,}")
_STOPWORDS = frozenset("""
a an and are as at be by for from has have in is it its of on or that the
this to was were will with what which how when
""".split())


def _tokens(text: str):
    return [t for t in _WORD_RE.findall(text.lower()) if t not in _STOPWORDS]


class KnowledgeBase:
    """In-memory index over the processed humanitarian knowledge corpus."""

    def __init__(self, path: Optional[Path] = None):
        self.path = Path(path) if path else DEFAULT_KB_PATH
        with open(self.path) as fh:
            raw = json.load(fh)
        self.entries = self._build_entries(raw)
        # Inverted index: token -> set of entry indices
        self._index = {}
        for i, entry in enumerate(self.entries):
            for tok in set(_tokens(entry["title"] + " " + entry["text"])):
                self._index.setdefault(tok, set()).add(i)

    @staticmethod
    def _build_entries(raw: dict):
        """Normalize every corpus section into {category, title, text} records."""
        entries = []

        def add(category, title, text):
            title = (title or "").strip()
            text = re.sub(r"\s+", " ", (text or "")).strip()
            if title and text and len(text) > 10:
                entries.append({"category": category, "title": title, "text": text})

        for item in raw.get("crisis_types", []):
            add("crisis_type", item.get("type"), item.get("context"))
        for item in raw.get("statistics", []):
            add("statistic", item.get("subject") or item.get("raw"), item.get("raw"))
        for i, item in enumerate(raw.get("workflows", []), 1):
            steps = item.get("steps") or []
            add("workflow", item.get("name") or f"Workflow {i}", " -> ".join(steps))
        for item in raw.get("platforms", []):
            add("platform", item.get("name"), item.get("description"))
        for term, definition in raw.get("terminology", {}).items():
            add("terminology", term, definition)
        for item in raw.get("case_studies", []):
            add("case_study", item.get("name"), item.get("description"))
        return entries

    def stats(self):
        return Counter(e["category"] for e in self.entries)

    def search(self, query: str, limit: int = 5, category: Optional[str] = None):
        """Scored keyword search. Title hits count double; results are ranked."""
        q_tokens = _tokens(query)
        if not q_tokens:
            return []
        scores = Counter()
        for tok in q_tokens:
            for i in self._index.get(tok, ()):
                entry = self.entries[i]
                weight = 2 if tok in _tokens(entry["title"]) else 1
                scores[i] += weight
        ranked = []
        for i, score in scores.most_common():
            entry = self.entries[i]
            if category and entry["category"] != category:
                continue
            ranked.append({**entry, "score": score})
            if len(ranked) >= limit:
                break
        return ranked

    def define(self, term: str):
        """Best terminology match for a term, or None."""
        hits = self.search(term, limit=1, category="terminology")
        return hits[0] if hits else None
