"""Shared helper: aggregate every combination of filter values, including "All"."""
from itertools import product

ALL = "All"


def cube(df, dims, stats, min_cell):
    """Yield one record per combination of dim values (each dim can also be ALL).

    stats(g) -> dict of aggregates for sub-frame g. Combinations with fewer than
    min_cell rows are emitted as {"n": n, "suppressed": True} without statistics.
    """
    levels = [[ALL] + sorted(df[d].dropna().unique().tolist()) for d in dims]
    out = []
    for combo in product(*levels):
        g = df
        for d, v in zip(dims, combo):
            if v != ALL:
                g = g[g[d] == v]
        if len(g) == 0:
            continue
        rec = {d: (v.item() if hasattr(v, "item") else v) for d, v in zip(dims, combo)}
        rec["n"] = int(len(g))
        if len(g) < min_cell:
            rec["suppressed"] = True
        else:
            rec.update(stats(g))
        out.append(rec)
    return out
