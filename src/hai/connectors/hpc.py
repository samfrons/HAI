"""UN OCHA HPC.tools connector: humanitarian response plans and funding."""

from .base import BaseConnector

PLANS_URL = "https://api.hpc.tools/v2/public/plan"
FTS_PLAN_URL = "https://api.hpc.tools/v1/public/fts/flow"


class HPCPlans(BaseConnector):
    name = "hpc"
    description = "UN OCHA humanitarian response plans and funding (HPC/FTS)"
    source = "https://fts.unocha.org"

    def plans(self, year: int):
        """Humanitarian response plans for a year."""
        data = self.client.get(PLANS_URL, params={"year": year}).json()
        plans = []
        for plan in data.get("data", []):
            plans.append({
                "source": "OCHA HPC",
                "id": plan.get("id"),
                "name": plan.get("planVersion", {}).get("name") or plan.get("name"),
                "code": plan.get("planVersion", {}).get("code"),
                "start": plan.get("planVersion", {}).get("startDate"),
                "end": plan.get("planVersion", {}).get("endDate"),
            })
        return plans

    def plan_funding(self, plan_id: int):
        """Funding flows summary for one response plan (FTS)."""
        data = self.client.get(FTS_PLAN_URL, params={"planId": plan_id}).json()
        d = data.get("data", {})
        incoming = d.get("incoming", {})
        return {
            "source": "OCHA FTS",
            "plan_id": plan_id,
            "funding_usd": incoming.get("fundingTotal"),
            "pledges_usd": incoming.get("pledgeTotal"),
            "flow_count": len(d.get("flows", [])),
        }
