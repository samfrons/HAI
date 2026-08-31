"""ReliefWeb v2 connector for situation reports and disaster records.

ReliefWeb now requires an approved ``appname`` (request one at
https://apidoc.reliefweb.int/parameters#appname). Set the environment
variable ``RELIEFWEB_APPNAME`` once approved; until then the connector
reports itself unavailable and aggregators skip it gracefully.
"""

import os

from .base import BaseConnector, ConnectorError

API_URL = "https://api.reliefweb.int/v2/{resource}"


class ReliefWeb(BaseConnector):
    name = "reliefweb"
    description = "ReliefWeb reports and disasters (requires approved appname)"
    source = "https://reliefweb.int"

    def __init__(self, client=None, appname: str = None):
        super().__init__(client)
        self.appname = appname or os.environ.get("RELIEFWEB_APPNAME")

    def available(self) -> bool:
        return bool(self.appname)

    def _get(self, resource: str, params: dict):
        if not self.available():
            raise ConnectorError(
                "ReliefWeb needs an approved appname; set RELIEFWEB_APPNAME "
                "(see https://apidoc.reliefweb.int/parameters#appname)")
        params = dict(params, appname=self.appname)
        return self.client.get(API_URL.format(resource=resource), params=params).json()

    def reports(self, query: str = None, country: str = None, limit: int = 10):
        params = {"limit": limit, "sort[]": "date:desc"}
        if query:
            params["query[value]"] = query
        if country:
            params["filter[field]"] = "country"
            params["filter[value]"] = country
        data = self._get("reports", params)
        return [{
            "source": "ReliefWeb",
            "id": item.get("id"),
            "title": item.get("fields", {}).get("title"),
            "url": item.get("fields", {}).get("url"),
        } for item in data.get("data", [])]

    def disasters(self, country: str = None, limit: int = 10):
        params = {"limit": limit, "sort[]": "date:desc"}
        if country:
            params["filter[field]"] = "country"
            params["filter[value]"] = country
        data = self._get("disasters", params)
        return [{
            "source": "ReliefWeb",
            "id": item.get("id"),
            "name": item.get("fields", {}).get("name"),
            "url": item.get("fields", {}).get("url"),
        } for item in data.get("data", [])]
