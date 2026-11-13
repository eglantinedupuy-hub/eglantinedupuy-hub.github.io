/* Charts for projects/quebec-funding.html. Data: data/quebec-funding/*.json (aggregates only). */
(function () {
  "use strict";
  var P = window.Portfolio;
  if (!P || !window.Chart) return;
  var C = P.COLORS;
  var fmt = P.fmt;

  function prettyFeature(name) {
    var s = name.replace(/^(num|cat)__/, "");
    var cats = ["Growth stage", "Industries", "Round", "HQ city"];
    for (var i = 0; i < cats.length; i++) {
      if (s.indexOf(cats[i] + "_") === 0) {
        return cats[i] + ": " + s.slice(cats[i].length + 1).replace(/;/g, "; ");
      }
    }
    return s;
  }

  /* ---------- model comparison ---------- */
  function modelChart(m) {
    var names = ["Linear Regression", "Decision Tree", "Random Forest"];
    var labels = names.concat(["Random Forest (tuned)"]);
    var means = names.map(function (n) { return m.cvRmse[n].mean; }).concat([m.tunedCvRmse]);
    var folds = names.map(function (n) { return m.cvRmse[n].folds; }).concat([m.tunedFolds]);
    var ranges = folds.map(function (f) { return [Math.min.apply(null, f), Math.max.apply(null, f)]; });

    var chart = P.chart(document.getElementById("chart-models"), {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Average RMSE (USD M)",
            data: means,
            backgroundColor: labels.map(function (_, i) { return i === 3 ? C.accentStrong : C.soft; }),
            borderRadius: 4
          },
          {
            label: "Range across folds (min–max)",
            data: ranges,
            backgroundColor: "rgba(176, 128, 43, 0.25)",
            borderColor: C.contrast,
            borderWidth: 1.5,
            borderSkipped: false,
            barPercentage: 0.25,
            hidden: true
          }
        ]
      },
      options: {
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                if (ctx.datasetIndex === 1) {
                  return "Folds: $" + fmt(ctx.raw[0]) + "M – $" + fmt(ctx.raw[1]) + "M";
                }
                return "Average CV RMSE: $" + fmt(ctx.raw) + "M";
              },
              afterLabel: function (ctx) {
                if (ctx.datasetIndex === 0) return "Folds: " + folds[ctx.dataIndex].map(function (v) { return fmt(v); }).join(", ");
              }
            }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { autoSkip: false, maxRotation: 0, callback: function (v) { return P.wrapLabel(this.getLabelForValue(v), window.innerWidth < 640 ? 12 : 30); } } },
          y: { beginAtZero: true, title: { display: true, text: "RMSE (USD M)" } }
        }
      }
    });

    P.segmented(document.getElementById("models-toggle"), function (v) {
      chart.setDatasetVisibility(1, v === "range");
      chart.options.plugins.legend.display = v === "range";
      chart.update();
    });

    P.table(document.getElementById("table-models"), "Cross-validated RMSE by model",
      [{ label: "Model" }, { label: "Average RMSE ($M)", num: true }, { label: "Fold RMSEs ($M)" }],
      labels.map(function (l, i) { return [l, fmt(means[i]), folds[i].map(function (v) { return fmt(v); }).join(", ")]; }));
  }

  /* ---------- feature importance ---------- */
  function importanceChart(m) {
    var all = m.featureImportance.map(function (f) { return { name: prettyFeature(f.feature), v: f.importance }; });
    var chart = P.chart(document.getElementById("chart-importance"), {
      type: "bar",
      data: { labels: [], datasets: [{ label: "Importance", data: [], backgroundColor: C.accent, borderRadius: 3 }] },
      options: {
        indexAxis: "y",
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: function (ctx) { return "Importance: " + fmt(ctx.parsed.x, 3); } } }
        },
        scales: {
          x: { beginAtZero: true, title: { display: true, text: "Share of total importance" } },
          y: { grid: { display: false }, ticks: { autoSkip: false, callback: function (v) {
            return P.wrapLabel(this.getLabelForValue(v), window.innerWidth < 640 ? 18 : 40, 2);
          } } }
        }
      }
    });
    P.segmented(document.getElementById("imp-toggle"), function (v) {
      var top = all.slice(0, Number(v));
      chart.data.labels = top.map(function (f) { return f.name; });
      chart.data.datasets[0].data = top.map(function (f) { return f.v; });
      P.fitHeight(chart, chart.data.labels, window.innerWidth < 640 ? 18 : 40, 2);
      chart.update();
    });
    P.table(document.getElementById("table-importance"), "Top 15 features by importance",
      [{ label: "Feature" }, { label: "Importance", num: true }],
      all.map(function (f) { return [f.name, fmt(f.v, 4)]; }));
  }

  /* ---------- predicted vs actual (bucketed) ---------- */
  function pvaChart(m) {
    var shown = m.predVsActual.filter(function (b) { return !b.suppressed; });
    P.chart(document.getElementById("chart-pva"), {
      type: "bar",
      data: {
        labels: shown.map(function (b) { return b.bucket; }),
        datasets: [
          { label: "Median actual", data: shown.map(function (b) { return b.medianActual; }), backgroundColor: C.accentStrong, borderRadius: 3 },
          { label: "Median predicted", data: shown.map(function (b) { return b.medianPredicted; }), backgroundColor: C.contrast, borderRadius: 3 }
        ]
      },
      options: {
        plugins: {
          legend: { position: "top", align: "start" },
          tooltip: {
            callbacks: {
              title: function (items) { return "Actual round size " + items[0].label; },
              label: function (ctx) { return ctx.dataset.label + ": $" + fmt(ctx.raw) + "M"; },
              footer: function (items) {
                var b = shown[items[0].dataIndex];
                return b.n + " test rounds · mean absolute error $" + fmt(b.mae) + "M";
              }
            }
          }
        },
        scales: {
          x: { grid: { display: false }, title: { display: true, text: "Actual round size" } },
          y: { beginAtZero: true, title: { display: true, text: "USD M" } }
        }
      }
    });
    P.table(document.getElementById("table-pva"), "Predicted versus actual by bucket",
      [{ label: "Actual size" }, { label: "Test rounds", num: true }, { label: "Median actual ($M)", num: true },
       { label: "Median predicted ($M)", num: true }, { label: "MAE ($M)", num: true }],
      m.predVsActual.map(function (b) {
        return b.suppressed
          ? [b.bucket, String(b.n), "hidden", "hidden", "hidden"]
          : [b.bucket, String(b.n), fmt(b.medianActual), fmt(b.medianPredicted), fmt(b.mae)];
      }));
  }

  /* ---------- explorer ---------- */
  function explorer(e) {
    var cells = e.cells;
    var key = function (r, y, p) { return r + "|" + y + "|" + p; };
    var index = {};
    cells.forEach(function (c) { index[key(c.round, c.year, c.public)] = c; });

    var rounds = ["All"].concat(uniq(cells.map(function (c) { return c.round; })).filter(function (r) { return r !== "All"; }).sort());
    var years = uniq(cells.map(function (c) { return c.year; })).filter(function (y) { return y !== "All"; }).sort();
    var selRound = document.getElementById("ex-round");
    var selPublic = document.getElementById("ex-public");
    P.fillSelect(selRound, rounds, function (v) { return v === "All" ? "All round types" : v; });
    P.fillSelect(selPublic, ["All", "Publicly backed", "No public investor"], function (v) { return v === "All" ? "All rounds" : v; });

    var metric = "n";
    var METRICS = {
      n: { label: "Number of rounds", get: function (c) { return c.n; }, fmt: function (v) { return String(v); } },
      rate: { label: "Disclosure rate (%)", get: function (c) { return 100 * c.disclosed / c.n; }, fmt: function (v) { return fmt(v, 0) + "%"; } },
      median: { label: "Median disclosed amount (USD M)", get: function (c) { return c.median; }, fmt: function (v) { return "$" + fmt(v, 1) + "M"; } }
    };

    var chart = P.chart(document.getElementById("chart-explorer"), {
      type: "bar",
      data: { labels: years.map(String), datasets: [{ label: "", data: [], backgroundColor: C.accent, borderRadius: 3 }] },
      options: {
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: function (ctx) {
            var c = index[key(selRound.value, years[ctx.dataIndex], selPublic.value)];
            return [METRICS[metric].label + ": " + METRICS[metric].fmt(ctx.raw), c.n + " rounds, " + c.disclosed + " disclosed"];
          } } }
        },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, title: { display: true, text: "" } }
        }
      }
    });

    function value(c) {
      if (!c || c.suppressed) return null;
      var v = METRICS[metric].get(c);
      return v === null || v === undefined ? null : Math.round(v * 100) / 100;
    }

    function stat(label, v) {
      return '<div class="stat"><span class="value">' + v + '</span><span class="name">' + label + "</span></div>";
    }

    function update() {
      var r = selRound.value, p = selPublic.value;
      var data = years.map(function (y) { return value(index[key(r, y, p)]); });
      chart.data.datasets[0].data = data;
      chart.data.datasets[0].label = METRICS[metric].label;
      chart.options.scales.y.title.text = METRICS[metric].label;
      chart.options.scales.y.max = metric === "rate" ? 100 : undefined;
      chart.update();

      var total = index[key(r, "All", p)];
      var stats = document.getElementById("ex-stats");
      if (!total || total.suppressed) {
        stats.innerHTML = stat("rounds", total ? "< " + e.minCell : "0");
      } else {
        stats.innerHTML =
          stat("rounds, 2021–2026", total.n) +
          stat("with a disclosed amount", fmt(100 * total.disclosed / total.n, 0) + "%") +
          stat("median disclosed amount", total.median == null ? "too few" : "$" + fmt(total.median, 1) + "M");
      }

      var hidden = years.filter(function (y, i) { return data[i] === null; });
      document.getElementById("ex-note").textContent = "Source: Dealroom.co, aggregated. " +
        (hidden.length ? "No bar for " + hidden.join(", ") + ": too few rounds" + (metric === "median" ? " or disclosed amounts" : "") + " to show. " : "") +
        "2026 is partial.";

      P.table(document.getElementById("table-explorer"), "Rounds by year for the selected filters",
        [{ label: "Year" }, { label: "Rounds", num: true }, { label: "Disclosed", num: true }, { label: "Median amount ($M)", num: true }],
        years.map(function (y) {
          var c = index[key(r, y, p)];
          if (!c) return [String(y), "0", "–", "–"];
          if (c.suppressed) return [String(y), "< " + e.minCell, "hidden", "hidden"];
          return [String(y), String(c.n), String(c.disclosed), c.median == null ? "too few" : fmt(c.median, 1)];
        }));
    }

    selRound.addEventListener("change", update);
    selPublic.addEventListener("change", update);
    P.segmented(document.getElementById("ex-metric"), function (v) { metric = v; update(); });
  }

  function uniq(a) { return a.filter(function (v, i) { return a.indexOf(v) === i; }); }

  Promise.all([P.getJSON("../data/quebec-funding/model.json"), P.getJSON("../data/quebec-funding/explorer.json")])
    .then(function (res) {
      modelChart(res[0]);
      pvaChart(res[0]);
      importanceChart(res[0]);
      explorer(res[1]);
    })
    .catch(P.fail);
})();
