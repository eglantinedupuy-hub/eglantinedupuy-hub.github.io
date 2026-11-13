# eglantinedupuy-hub.github.io

Personal portfolio of Eglantine Dupuy, served by GitHub Pages. Static HTML/CSS/JS:
no framework, no build server. One small Python step regenerates the project cards.

## Structure

```
index.html                  homepage: hero + tabs (About, Experience, Projects, Education & Skills)
projects/<slug>.html        one case-study page per project
projects/_template.html     copy this to start a new project page
data/projects.json          single source of truth for project cards + prev/next links
data/<slug>/*.json          chart data (aggregates only)
assets/css/site.css         all styles; colour tokens at the top
assets/js/site.js           homepage tabs (hash URLs, back button) + tag filter
assets/js/charts.js         shared Chart.js helpers
assets/js/projects/<slug>.js  charts for one project page
assets/vendor/chart.umd.min.js  Chart.js 4.6.1 (MIT), vendored
assets/img/                 images (WebP + PNG/JPG fallback)
assets/Eglantine_Dupuy_CV.pdf   CV (linked from the hero and About)
scripts/render.py           writes cards/filters/pager from data/projects.json
scripts/build_*_data.py     rebuild chart data from the project repos
```

## Preview locally

```
python -m http.server 8000
```

Then open http://localhost:8000. Opening the files directly (`file://`) won't load the charts,
because browsers block `fetch` of local JSON.

## Add a project

1. Add an entry to `data/projects.json` (slug, title, page, hook, keyResult, tags, thumbnail, repo).
2. Copy `projects/_template.html` to `projects/<slug>.html` and write the case study.
3. Optional charts: put aggregate JSON in `data/<slug>/` and a script in `assets/js/projects/<slug>.js`
   (follow `quebec-funding.js`).
4. Add a thumbnail at `assets/img/projects/<slug>-thumb.webp` + `.png`.
5. Run `python scripts/render.py`. It updates the homepage card, the filter tags and every page's prev/next links.

## Data rules

- Raw Dealroom data is proprietary and must never be committed (`*.xlsx` is git-ignored).
  `scripts/build_quebec_data.py` reads the export from your machine, re-runs the notebook pipeline,
  aborts if the test RMSE doesn't reproduce 19.30, and writes aggregates only. Groups with fewer than 5 rounds are suppressed.
- Every number on the site must come from a project repo's outputs.

```
python scripts/build_quebec_data.py "<path>/QuebecInvestmentRounds_fixed.csv"
python scripts/build_causal_data.py "<path>/startups_clean.csv"
```

## Palette (WCAG AA)

| Token | Hex | Contrast |
|---|---|---|
| `--text` | `#1f2620` | 14.8:1 on background |
| `--muted` | `#525e54` | 6.5:1 on background, 5.6:1 on tint |
| `--accent` (buttons) | `#4e7a5c` | white text 4.9:1 |
| `--accent-strong` (links, focus) | `#3a5e46` | 7.0:1 on background |
| chart light sage | `#7a9a84` | 3.1:1 on white (graphics) |
