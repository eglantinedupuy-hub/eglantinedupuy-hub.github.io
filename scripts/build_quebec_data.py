"""Build the aggregate-only chart data for the Quebec funding project page.

The raw Dealroom export is proprietary and is NEVER committed to this repo.
This script reads it from your local machine and writes only aggregates:

  data/quebec-funding/model.json     model comparison, feature importance,
                                     predicted vs. actual by amount bucket
  data/quebec-funding/explorer.json  counts / disclosure rate / median amount
                                     by round type x year x public backing,
                                     with small cells (n < MIN_CELL) suppressed

It re-runs the notebook's pipeline (same seeds) and aborts if the test RMSE
does not reproduce the published 19.30, so the site never shows numbers
that differ from the notebook.

Usage:
    python scripts/build_quebec_data.py "<path to QuebecInvestmentRounds_fixed.csv>"
"""

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import randint
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, root_mean_squared_error
from sklearn.model_selection import RandomizedSearchCV, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.tree import DecisionTreeRegressor

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _cube import cube  # noqa: E402

MIN_CELL = 5  # suppress any aggregate built from fewer rounds than this
EXPECTED_TEST_RMSE = 19.30
OUT = Path(__file__).resolve().parent.parent / "data" / "quebec-funding"


def load(path):
    df = pd.read_csv(path, header=3)
    cols = [
        "Name", "ID", "Growth stage", "HQ city", "Industries", "Launch year",
        "Total amount raised (USD)", "Round", "Amount (USD M)", "Round valuation (USD)",
        "Average Valuation (USD)", "Year", "Month",
        "Government Backed", "Semi-Public", "Number of investors", "Total rounds number",
    ]
    df = df[cols].rename(columns={"Year": "Round Year", "Month": "Round Month"}).copy()
    df["Publicly Backed"] = ((df["Government Backed"] == 1) | (df["Semi-Public"] == 1)).astype(int)
    return df


def explorer(df):
    """Aggregates over ALL 1,141 rounds (disclosed or not); medians use disclosed only."""
    df = df.copy()
    df["round"] = df["Round"].fillna("Not specified").str.title().str.replace(" Vc", " VC").str.replace("Not Specified", "Not specified")
    df["year"] = df["Round Year"].astype(int)
    df["public"] = df["Publicly Backed"].map({1: "Publicly backed", 0: "No public investor"})

    def stats(g):
        amt = g["Amount (USD M)"].dropna()
        return {
            "disclosed": int(len(amt)),
            # a median is only shown if at least MIN_CELL disclosed amounts back it
            "median": round(float(amt.median()), 2) if len(amt) >= MIN_CELL else None,
        }

    return {"minCell": MIN_CELL, "dims": ["round", "year", "public"],
            "cells": cube(df, ["round", "year", "public"], stats, MIN_CELL)}


def model(df):
    df = df.dropna(subset=["Amount (USD M)"]).copy()
    bins = [0, 4, 15, 40, 100, np.inf]
    labels = ["Seed", "Series A", "Series B", "Series C", "Late Stage"]
    df["amount_cat"] = pd.cut(df["Amount (USD M)"], bins=bins, labels=labels, include_lowest=True)
    train, test = train_test_split(df, test_size=0.2, stratify=df["amount_cat"], random_state=42)
    train, test = train.drop(columns="amount_cat"), test.drop(columns="amount_cat")

    drop = ["Name", "ID", "Total amount raised (USD)", "Round valuation (USD)",
            "Average Valuation (USD)", "Government Backed", "Semi-Public"]
    X_train, y_train = train.drop(columns=["Amount (USD M)"] + drop), train["Amount (USD M)"]
    X_test, y_test = test.drop(columns=["Amount (USD M)"] + drop), test["Amount (USD M)"]

    num = ["Launch year", "Round Year", "Round Month", "Number of investors",
           "Total rounds number", "Publicly Backed"]
    cat = ["Growth stage", "HQ city", "Industries", "Round"]
    prep = ColumnTransformer([
        ("num", Pipeline([("impute", SimpleImputer(strategy="median")),
                          ("scale", StandardScaler())]), num),
        ("cat", Pipeline([("impute", SimpleImputer(strategy="most_frequent")),
                          ("encode", OneHotEncoder(handle_unknown="ignore"))]), cat),
    ])

    def pipe(m):
        return Pipeline([("preprocessing", prep), ("model", m)])

    cv = {}
    for name, m in [("Linear Regression", LinearRegression()),
                    ("Decision Tree", DecisionTreeRegressor(random_state=42)),
                    ("Random Forest", RandomForestRegressor(random_state=42))]:
        s = -cross_val_score(pipe(m), X_train, y_train,
                             scoring="neg_root_mean_squared_error", cv=5)
        cv[name] = {"mean": round(float(s.mean()), 2), "folds": [round(float(x), 2) for x in s]}

    search = RandomizedSearchCV(
        pipe(RandomForestRegressor(random_state=42)),
        param_distributions={
            "model__n_estimators": randint(low=50, high=300),
            "model__max_features": randint(low=2, high=20),
            "model__max_depth": randint(low=3, high=20),
        },
        n_iter=10, cv=5, scoring="neg_root_mean_squared_error", random_state=42,
    )
    search.fit(X_train, y_train)
    final = search.best_estimator_
    pred = final.predict(X_test)
    rmse = root_mean_squared_error(y_test, pred)
    mae = mean_absolute_error(y_test, pred)
    if round(rmse, 2) != EXPECTED_TEST_RMSE:
        sys.exit(f"Test RMSE {rmse:.2f} != notebook {EXPECTED_TEST_RMSE}; not writing model.json")

    imp = pd.Series(final.named_steps["model"].feature_importances_,
                    index=final.named_steps["preprocessing"].get_feature_names_out())
    imp = imp.sort_values(ascending=False).head(15)

    # Predicted vs actual, aggregated by actual-amount bucket (no per-round values)
    t = pd.DataFrame({"actual": y_test.values, "pred": pred})
    t["bucket"] = pd.cut(t["actual"], bins=bins, labels=["< $4M", "$4–15M", "$15–40M",
                                                         "$40–100M", "> $100M"],
                         include_lowest=True)
    buckets = []
    for b, g in t.groupby("bucket", observed=False):
        if len(g) < MIN_CELL:
            buckets.append({"bucket": str(b), "n": int(len(g)), "suppressed": True})
            continue
        buckets.append({
            "bucket": str(b), "n": int(len(g)),
            "medianActual": round(float(g["actual"].median()), 2),
            "medianPredicted": round(float(g["pred"].median()), 2),
            "mae": round(float((g["actual"] - g["pred"]).abs().mean()), 2),
        })

    return {
        "nDisclosed": int(len(df)), "nTrain": int(len(train)), "nTest": int(len(test)),
        "cvRmse": cv,
        "tunedCvRmse": round(float(-search.best_score_), 2),
        "bestParams": {k.replace("model__", ""): int(v) for k, v in search.best_params_.items()},
        "testRmse": round(float(rmse), 2), "testMae": round(float(mae), 2),
        "featureImportance": [{"feature": k, "importance": round(float(v), 4)}
                              for k, v in imp.items()],
        "predVsActual": buckets,
    }


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    df = load(sys.argv[1])
    OUT.mkdir(parents=True, exist_ok=True)
    m = model(df)
    (OUT / "model.json").write_text(json.dumps(m, indent=1), encoding="utf-8")
    (OUT / "explorer.json").write_text(json.dumps(explorer(df), indent=1), encoding="utf-8")
    print(f"OK: test RMSE {m['testRmse']}, MAE {m['testMae']}; wrote {OUT}")


if __name__ == "__main__":
    main()
