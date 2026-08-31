"""Connector registry for live humanitarian data sources."""

from .base import BaseConnector, ConnectorError, HttpClient
from .gdacs import GDACSAlerts
from .hdx import HDXDatasets
from .hpc import HPCPlans
from .reliefweb import ReliefWeb
from .usgs import USGSEarthquakes
from .worldbank import WorldBankIndicators

ALL_CONNECTORS = [GDACSAlerts, USGSEarthquakes, WorldBankIndicators,
                  HDXDatasets, HPCPlans, ReliefWeb]


def build_all(client: HttpClient = None):
    """Instantiate every connector, sharing one HTTP client/cache."""
    client = client or HttpClient()
    return {cls.name: cls(client) for cls in ALL_CONNECTORS}


__all__ = ["BaseConnector", "ConnectorError", "HttpClient", "GDACSAlerts",
           "HDXDatasets", "HPCPlans", "ReliefWeb", "USGSEarthquakes",
           "WorldBankIndicators", "ALL_CONNECTORS", "build_all"]
