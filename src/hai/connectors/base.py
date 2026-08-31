"""Shared connector infrastructure: HTTP fetching with retries and on-disk caching.

All connectors use only the Python standard library so the platform layer
works without installing the heavy training dependencies.
"""

import hashlib
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

DEFAULT_CACHE_DIR = Path(__file__).resolve().parents[3] / "data" / "cache"
USER_AGENT = "HAI-platform/0.2 (humanitarian AI proof of concept)"


class ConnectorError(Exception):
    """Raised when a data source cannot be reached or returns bad data."""


@dataclass
class FetchResult:
    """Raw payload plus provenance metadata."""

    body: bytes
    url: str
    from_cache: bool = False
    fetched_at: float = field(default_factory=time.time)

    def json(self):
        return json.loads(self.body.decode("utf-8"))

    def text(self) -> str:
        return self.body.decode("utf-8", errors="replace")


class HttpClient:
    """Small HTTP client with retries and a TTL file cache.

    Caching keeps the CLI fast, avoids hammering free humanitarian APIs,
    and gives partial offline capability in the field.
    """

    def __init__(self, cache_dir: Optional[Path] = None, cache_ttl: int = 900,
                 timeout: int = 20, retries: int = 2):
        self.cache_dir = Path(cache_dir) if cache_dir else DEFAULT_CACHE_DIR
        self.cache_ttl = cache_ttl
        self.timeout = timeout
        self.retries = retries

    def _cache_path(self, url: str) -> Path:
        digest = hashlib.sha256(url.encode()).hexdigest()[:32]
        return self.cache_dir / f"{digest}.cache"

    def _read_cache(self, url: str, max_age: Optional[int] = None) -> Optional[FetchResult]:
        path = self._cache_path(url)
        if not path.exists():
            return None
        age = time.time() - path.stat().st_mtime
        if max_age is not None and age > max_age:
            return None
        return FetchResult(body=path.read_bytes(), url=url, from_cache=True,
                           fetched_at=path.stat().st_mtime)

    def get(self, url: str, params: Optional[dict] = None) -> FetchResult:
        if params:
            sep = "&" if "?" in url else "?"
            url = url + sep + urllib.parse.urlencode(params)

        cached = self._read_cache(url, max_age=self.cache_ttl)
        if cached:
            return cached

        last_err = None
        for attempt in range(self.retries + 1):
            try:
                req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT,
                                                           "Accept": "*/*"})
                with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                    body = resp.read()
                self.cache_dir.mkdir(parents=True, exist_ok=True)
                self._cache_path(url).write_bytes(body)
                return FetchResult(body=body, url=url)
            except (urllib.error.URLError, TimeoutError, OSError) as err:
                last_err = err
                if attempt < self.retries:
                    time.sleep(2 ** attempt)

        # Network down: fall back to a stale cache entry rather than failing.
        stale = self._read_cache(url, max_age=None)
        if stale:
            return stale
        raise ConnectorError(f"failed to fetch {url}: {last_err}")


class BaseConnector:
    """Base class giving every connector a name, source URL, and HTTP client."""

    name = "base"
    description = ""
    source = ""

    def __init__(self, client: Optional[HttpClient] = None):
        self.client = client or HttpClient()

    def available(self) -> bool:
        """Whether the connector is configured/usable (not a liveness probe)."""
        return True
