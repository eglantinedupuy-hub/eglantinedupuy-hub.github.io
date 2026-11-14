"""Build chart data for the InvestTech Hackathon project page.

Reads the team's computed snapshot (trimestre-toolkit/dashboard_data/, already
public in the hackathon repo) and writes:

  data/investech-hackathon/peers.json      WSP vs index engineering peers on the 5 screen measures
  data/investech-hackathon/per_share.json  WSP totals vs per-share growth, indexed 2021 = 100

Usage:
    python scripts/build_investech_data.py "<path to trimestre-toolkit/dashboard_data>"
"""

import json
import sys
from pathlib import Path

import pandas as pd

OUT = Path(__file__).resolve().parent.parent / "data" / "investech-hackathon"


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    src = Path(sys.argv[1])
    OUT.mkdir(parents=True, exist_ok=True)

    sc = pd.read_csv(src / "peer_scorecard.csv")
    peers = {
        "asOf": "November 12, 2026",
        "window": f"{int(sc['years_window'].iloc[0])} fiscal years to {int(sc['last_fiscal_year'].max())}",
        "companies": [
            {"ticker": r.ticker, "name": r.company, "isWsp": r.group == "WSP",
             "revenueCagr": round(r.revenue_cagr * 100, 1),
             "fcfMargin": round(r.fcf_margin * 100, 1),
             "reinvestment": round(r.reinvestment * 100, 1),
             "roic": round(r.roic * 100, 1),
             "netDebtToEbitda": round(r.net_debt_to_ebitda, 2)}
            for r in sc.itertuples()
        ],
    }
    (OUT / "peers.json").write_text(json.dumps(peers, indent=1), encoding="utf-8")

    ps = pd.read_csv(src / "wsp_per_share.csv").sort_values("fiscal_year")
    cols = {
        "revenue": "revenue_index_first_year_100",
        "revenuePerShare": "revenue_per_share_index_first_year_100",
        "fcf": "free_cash_flow_index_first_year_100",
        "fcfPerShare": "free_cash_flow_per_share_index_first_year_100",
        "netIncome": "net_income_index_first_year_100",
        "epsDiluted": "eps_diluted_index_first_year_100",
        "sharesDiluted": "shares_diluted_index_first_year_100",
    }
    per_share = {
        "currency": ps["currency"].iloc[0],
        "years": [int(y) for y in ps["fiscal_year"]],
        "series": {k: [round(float(v), 1) for v in ps[c]] for k, c in cols.items()},
        "values": {
            "revenuePerShare": [round(float(v), 2) for v in ps["revenue_per_share"]],
            "fcfPerShare": [round(float(v), 2) for v in ps["free_cash_flow_per_share"]],
            "epsDiluted": [round(float(v), 2) for v in ps["eps_diluted"]],
            "sharesDilutedM": [round(float(v) / 1e6, 1) for v in ps["shares_diluted"]],
        },
    }
    (OUT / "per_share.json").write_text(json.dumps(per_share, indent=1), encoding="utf-8")
    print("OK:", [c["ticker"] for c in peers["companies"]], per_share["years"])


if __name__ == "__main__":
    main()
