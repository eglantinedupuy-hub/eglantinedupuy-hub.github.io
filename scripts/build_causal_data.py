"""Build chart data for the startup-failures causal inference project page.

Writes:
  data/causal-failures/results.json   effect estimates, CIs, subgroups, refutations
                                      (copied from the printed outputs of
                                      EglantineDupuy_EDS_Assignment2.ipynb, cell refs noted)
  data/causal-failures/explorer.json  aggregates of startups_clean.csv
                                      (public Kaggle data, CC BY-NC 4.0) by
                                      sector x era x business model; cells with n < MIN_CELL dropped

Usage:
    python scripts/build_causal_data.py "<path to startups_clean.csv>"
"""

import json
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _cube import cube  # noqa: E402

MIN_CELL = 5
OUT = Path(__file__).resolve().parent.parent / "data" / "causal-failures"

# Every number below is copied from a printed notebook output (cell index in brackets).
RESULTS = {
    "source": "EglantineDupuy_EDS_Assignment2.ipynb (printed outputs)",
    "n": 356,
    "treated": {"high_funding": 176, "control": 180},
    "funding": {
        "naiveGap": 2.45,  # [19] markdown table, README
        "estimates": [
            # [16] LRSRegressor.estimate_ate
            {"method": "Linear S-learner (CausalML)", "ate": 2.21, "lo": 1.58, "hi": 2.84},
            # [18] XGBTRegressor.estimate_ate
            {"method": "XGBoost T-learner (CausalML)", "ate": 2.02, "lo": 1.57, "hi": 2.48},
            # [54] statsmodels OLS on the DoWhy adjustment set (= DoWhy linear regression, [39])
            {"method": "Linear regression (DoWhy)", "ate": 2.21, "lo": 1.59, "hi": 2.82},
            # [37] propensity score stratification; README reports 2.47, no CI printed
            {"method": "Propensity score stratification (DoWhy)", "ate": 2.47, "lo": None, "hi": None},
        ],
        "refutations": [  # [41]-[44]
            {"test": "Random common cause", "original": 2.21, "new": 2.21, "p": 0.98},
            {"test": "Placebo treatment", "original": 2.21, "new": 0.04, "p": 0.84},
            {"test": "90% data subset", "original": 2.21, "new": 2.21, "p": 0.88},
            {"test": "Unobserved common cause (range)", "original": 2.21, "newLo": -0.97, "newHi": 2.66},
        ],
    },
    "giants": {
        "raw": {"giants": 7.88, "nGiants": 274, "others": 7.20, "nOthers": 82},  # [47]
        "estimates": [
            # [51] OLS coefficient and 95% CI, p = 0.226
            {"method": "Linear regression (DoWhy)", "ate": 0.44, "lo": -0.27, "hi": 1.15, "p": 0.226},
            # [50]
            {"method": "Propensity score stratification (DoWhy)", "ate": 0.52, "lo": None, "hi": None},
        ],
        "refutations": [  # [52]-[53]
            {"test": "Random common cause", "original": 0.44, "new": 0.44, "p": 0.86},
            {"test": "Placebo treatment", "original": 0.44, "new": 0.02, "p": 0.86},
            {"test": "90% data subset", "original": 0.44, "new": 0.43, "p": 0.92},
            {"test": "Unobserved common cause (range)", "original": 0.44, "newLo": -0.59, "newHi": 0.62},
        ],
    },
    # [28] markdown table built from the [24]-[27] outputs (XGBTRegressor CATE means)
    "subgroups": [
        {"dimension": "Business model", "group": "B2B", "effect": 4.01, "rawGap": 4.65, "n": 60},
        {"dimension": "Business model", "group": "Not B2B", "effect": 1.62, "rawGap": 1.83, "n": 296},
        {"dimension": "Hardware", "group": "Hardware", "effect": -0.02, "rawGap": 1.87, "n": 49},
        {"dimension": "Hardware", "group": "Not hardware", "effect": 2.35, "rawGap": 2.76, "n": 307},
        {"dimension": "Founding era", "group": "Up to 2008", "effect": 1.47, "rawGap": 1.24, "n": 84},
        {"dimension": "Founding era", "group": "2009–2014", "effect": 2.36, "rawGap": 2.47, "n": 234},
        {"dimension": "Founding era", "group": "2015 or later", "effect": 1.13, "rawGap": 0.32, "n": 38},
    ],
}

ERA = {"up_to_2008": "Up to 2008", "2009_2014": "2009–2014", "2015_plus": "2015 or later"}


def explorer(df):
    df = df.copy()
    df["era"] = df["era"].map(ERA)
    df["model"] = "Other"
    df.loc[df["consumer_digital"] == 1, "model"] = "Consumer digital"
    df.loc[df["physical_ops"] == 1, "model"] = "Physical operations"
    df.loc[df["b2b"] == 1, "model"] = "B2B"
    df.loc[df["hardware"] == 1, "model"] = "Hardware"
    df["funding"] = df["high_funding"].map({1: "High (> $20M)", 0: "Low (<= $20M)"})

    def stats(g):
        return {
            "meanLifespan": round(float(g["lifespan"].mean()), 2),
            "medianLifespan": round(float(g["lifespan"].median()), 1),
            "medianFunding": round(float(g["funding_musd"].median()), 1),
        }

    return {
        "minCell": MIN_CELL, "total": int(len(df)),
        "dims": ["Sector", "era", "model", "funding"],
        "note": "Business model is assigned in priority order Hardware > B2B > Physical operations > Consumer digital > Other, so each startup is counted once.",
        "cells": cube(df, ["Sector", "era", "model", "funding"], stats, MIN_CELL),
    }


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    df = pd.read_csv(sys.argv[1])
    assert len(df) == RESULTS["n"], len(df)
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "results.json").write_text(json.dumps(RESULTS, indent=1, ensure_ascii=False), encoding="utf-8")
    e = explorer(df)
    (OUT / "explorer.json").write_text(json.dumps(e, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"OK: {len(e['cells'])} explorer cells ({sum(1 for c in e['cells'] if c.get('suppressed'))} suppressed)")


if __name__ == "__main__":
    main()
