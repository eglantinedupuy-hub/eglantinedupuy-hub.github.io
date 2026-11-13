/* Charts for projects/causal-failures.html. Data: data/causal-failures/*.json */
(function () {
  "use strict";
  var P = window.Portfolio;
  if (!P || !window.Chart) return;
  var C = P.COLORS;
  var fmt = P.fmt;

  /* ---------- forest plot: estimates + 95% CI ---------- */
  function forest(res) {
    var sets = {
      funding: {
        rows: [{ method: "Naive difference (no adjustment)", ate: res.funding.naiveGap, lo: null, hi: null, naive: true }]
          .concat(res.funding.estimates),
        caption: "High funding = raised more than the $20M median. Dots are point estimates; bars are 95% intervals. The dashed line marks zero effect. Propensity score stratification and the naive gap have no interval."
      },
      giants: {
        rows: [{
          method: "Raw difference (no adjustment)",
          ate: Math.round((res.giants.raw.giants - res.giants.raw.others) * 100) / 100,
          lo: null, hi: null, naive: true
        }].concat(res.giants.estimates),
        caption: "Raw difference = " + fmt(res.giants.raw.giants) + " vs. " + fmt(res.giants.raw.others) + " years (" +
          res.giants.raw.nGiants + " vs. " + res.giants.raw.nOthers + " startups). The interval crosses zero (p = 0.23): no detectable effect."
      }
    };

    var canvas = document.getElementById("chart-forest");
    var chart = P.chart(canvas, {
      type: "bar",
      data: { labels: [], datasets: [] },
      plugins: [P.zeroLine],
      options: {
        indexAxis: "y",
        plugins: {
          legend: { position: "top", align: "start", labels: { usePointStyle: true } },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                if (ctx.dataset.type === "line") return "Estimate: " + fmt(ctx.raw) + " years";
                return "95% CI: " + fmt(ctx.raw[0]) + " to " + fmt(ctx.raw[1]) + " years";
              }
            }
          }
        },
        scales: {
          x: { title: { display: true, text: "Effect on lifespan (years)" }, suggestedMin: -0.5, suggestedMax: 3 },
          y: { grid: { display: false }, ticks: { autoSkip: false, callback: function (v) {
            return P.wrapLabel(this.getLabelForValue(v));
          } } }
        }
      }
    });

    function show(key) {
      var rows = sets[key].rows;
      chart.data.labels = rows.map(function (r) { return r.method; });
      chart.data.datasets = [
        {
          type: "bar",
          label: "95% confidence interval",
          pointStyle: "rect",
          data: rows.map(function (r) { return r.lo == null ? null : [r.lo, r.hi]; }),
          backgroundColor: C.soft,
          borderRadius: 3,
          barPercentage: 0.35,
          order: 2
        },
        {
          type: "line",
          label: "Point estimate",
          data: rows.map(function (r) { return r.ate; }),
          showLine: false,
          pointRadius: 7,
          pointHoverRadius: 9,
          pointStyle: rows.map(function (r) { return r.naive ? "rectRot" : "circle"; }),
          pointBackgroundColor: rows.map(function (r) { return r.naive ? "#fff" : C.accentStrong; }),
          pointBorderColor: C.accentStrong,
          pointBorderWidth: 2,
          backgroundColor: C.accentStrong,
          borderColor: C.accentStrong,
          order: 1
        }
      ];
      P.fitHeight(chart, chart.data.labels);
      chart.update();
      document.getElementById("forest-caption").textContent = sets[key].caption;
      P.table(document.getElementById("table-forest"), "Estimated effects on lifespan",
        [{ label: "Method" }, { label: "Estimate (years)", num: true }, { label: "95% CI" }],
        rows.map(function (r) {
          return [r.method, fmt(r.ate), r.lo == null ? "n/a" : fmt(r.lo) + " to " + fmt(r.hi)];
        }));
    }
    P.segmented(document.getElementById("forest-toggle"), show);
  }

  /* ---------- subgroups ---------- */
  function subgroups(res) {
    var captions = {
      "Business model": "B2B startups show the clearest difference, in both the model estimate and the raw gap.",
      "Hardware": "Inconclusive: the model estimates almost no effect, but the raw gap is 1.87 years. Only 12 hardware startups had low funding.",
      "Founding era": "Largest for 2009–2014. The 2015+ group (38 startups) may reflect truncation: they have had less time to last."
    };
    var chart = P.chart(document.getElementById("chart-subgroups"), {
      type: "bar",
      data: { labels: [], datasets: [
        { label: "Estimated effect (XGBoost T-learner)", data: [], backgroundColor: C.accentStrong, borderRadius: 3 },
        { label: "Raw gap in mean lifespan", data: [], backgroundColor: C.contrast, borderRadius: 3 }
      ] },
      plugins: [P.zeroLine],
      options: {
        indexAxis: "y",
        plugins: {
          legend: { position: "top", align: "start" },
          tooltip: { callbacks: {
            label: function (ctx) { return ctx.dataset.label + ": " + fmt(ctx.raw) + " years"; },
            footer: function (items) { return current[items[0].dataIndex].n + " startups"; }
          } }
        },
        scales: {
          x: { title: { display: true, text: "Years of lifespan" }, suggestedMin: 0 },
          y: { grid: { display: false }, ticks: { callback: function (v) { return P.wrapLabel(this.getLabelForValue(v)); } } }
        }
      }
    });
    var current = [];
    P.segmented(document.getElementById("sub-toggle"), function (dim) {
      current = res.subgroups.filter(function (s) { return s.dimension === dim; });
      chart.data.labels = current.map(function (s) { return s.group + " (n=" + s.n + ")"; });
      chart.data.datasets[0].data = current.map(function (s) { return s.effect; });
      chart.data.datasets[1].data = current.map(function (s) { return s.rawGap; });
      P.fitHeight(chart, chart.data.labels);
      chart.update();
      document.getElementById("sub-caption").textContent = captions[dim] +
        " Exploratory: averages from a single model fit, with no uncertainty estimates; groups overlap.";
    });
    P.table(document.getElementById("table-subgroups"), "Effect of high funding by subgroup",
      [{ label: "Group" }, { label: "Estimated effect", num: true }, { label: "Raw gap", num: true }, { label: "Startups", num: true }],
      res.subgroups.map(function (s) { return [s.dimension + ": " + s.group, fmt(s.effect), fmt(s.rawGap), String(s.n)]; }));
  }

  /* ---------- explorer ---------- */
  function explorer(e) {
    var index = {};
    var key = function (s, er, m, f) { return [s, er, m, f].join("|"); };
    e.cells.forEach(function (c) { index[key(c.Sector, c.era, c.model, c.funding)] = c; });

    function levels(field) {
      var seen = {};
      e.cells.forEach(function (c) { seen[c[field]] = true; });
      return ["All"].concat(Object.keys(seen).filter(function (k) { return k !== "All"; }).sort());
    }
    var selSector = document.getElementById("ex-sector");
    var selEra = document.getElementById("ex-era");
    var selModel = document.getElementById("ex-model");
    P.fillSelect(selSector, levels("Sector"), function (v) { return v === "All" ? "All sectors" : v; });
    var eraOrder = ["All", "Up to 2008", "2009–2014", "2015 or later"];
    P.fillSelect(selEra, eraOrder.filter(function (v) { return levels("era").indexOf(v) !== -1; }), function (v) { return v === "All" ? "All eras" : v; });
    P.fillSelect(selModel, levels("model"), function (v) { return v === "All" ? "All business models" : v; });

    var GROUPS = ["High (> $20M)", "Low (<= $20M)"];
    var LABELS = ["High funding (> $20M)", "Low funding (≤ $20M)"];

    var chart = P.chart(document.getElementById("chart-explorer"), {
      type: "bar",
      data: { labels: LABELS, datasets: [{ label: "Average lifespan (years)", data: [], backgroundColor: [C.accentStrong, C.soft], borderRadius: 3 }] },
      options: {
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: function (ctx) {
            var c = cur[ctx.dataIndex];
            return ["Average lifespan: " + fmt(ctx.raw) + " years", "Median lifespan: " + fmt(c.medianLifespan, 1) + " years",
                    "Median funding: $" + fmt(c.medianFunding, 1) + "M", c.n + " startups"];
          } } }
        },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, suggestedMax: 12, title: { display: true, text: "Average lifespan (years)" } }
        }
      }
    });
    var cur = [];

    function stat(label, v) {
      return '<div class="stat"><span class="value">' + v + '</span><span class="name">' + label + "</span></div>";
    }

    function update() {
      var s = selSector.value, er = selEra.value, m = selModel.value;
      var all = index[key(s, er, m, "All")];
      cur = GROUPS.map(function (g) { return index[key(s, er, m, g)]; });
      var ok = cur.map(function (c) { return c && !c.suppressed; });
      chart.data.datasets[0].data = cur.map(function (c, i) { return ok[i] ? c.meanLifespan : null; });
      chart.update();

      var stats = document.getElementById("ex-stats");
      var n = all ? all.n : 0;
      var gap = ok[0] && ok[1] ? (cur[0].meanLifespan - cur[1].meanLifespan) : null;
      stats.innerHTML = stat("startups match", n) +
        stat("average lifespan", all && !all.suppressed ? fmt(all.meanLifespan, 1) + " yrs" : "–") +
        stat("raw gap, high vs. low", gap == null ? "–" : (gap >= 0 ? "+" : "") + fmt(gap, 1) + " yrs");

      var hidden = GROUPS.filter(function (g, i) { return !ok[i]; }).map(function (g, i) { return g; });
      document.getElementById("ex-note").textContent =
        (n === 0 ? "No startups match these filters. " :
          hidden.length ? "Some groups have fewer than " + e.minCell + " startups and are hidden. " : "") +
        "Raw averages, not causal estimates. Source: Kaggle “Startup Failures” (CC BY-NC 4.0). " + e.note;

      P.table(document.getElementById("table-explorer"), "Lifespan by funding level for the selected filters",
        [{ label: "Funding" }, { label: "Startups", num: true }, { label: "Avg lifespan (yrs)", num: true },
         { label: "Median lifespan (yrs)", num: true }, { label: "Median funding ($M)", num: true }],
        GROUPS.map(function (g, i) {
          var c = cur[i];
          if (!c) return [LABELS[i], "0", "–", "–", "–"];
          if (c.suppressed) return [LABELS[i], "< " + e.minCell, "hidden", "hidden", "hidden"];
          return [LABELS[i], String(c.n), fmt(c.meanLifespan), fmt(c.medianLifespan, 1), fmt(c.medianFunding, 1)];
        }));
    }
    [selSector, selEra, selModel].forEach(function (s) { s.addEventListener("change", update); });
    update();
  }

  Promise.all([P.getJSON("../data/causal-failures/results.json"), P.getJSON("../data/causal-failures/explorer.json")])
    .then(function (res) {
      forest(res[0]);
      subgroups(res[0]);
      explorer(res[1]);
    })
    .catch(P.fail);
})();
