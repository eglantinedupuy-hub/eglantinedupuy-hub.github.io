/* Charts for projects/investech-hackathon.html. Data: data/investech-hackathon/*.json */
(function () {
  "use strict";
  var P = window.Portfolio;
  if (!P || !window.Chart) return;
  var C = P.COLORS;
  var fmt = P.fmt;

  /* ---------- WSP vs peers on the 5 screen measures ---------- */
  function peers(d) {
    var M = {
      revenueCagr: { label: "Revenue growth (% a year)", unit: "%", note: "Higher is better. 3-year compound annual growth." },
      fcfMargin: { label: "Free cash flow margin (%)", unit: "%", note: "Higher is better. 3-year FCF ÷ 3-year revenue." },
      reinvestment: { label: "Reinvestment (% of FCF spent on acquisitions)", unit: "%", note: "Higher = more acquisitive. 3-year acquisition spend ÷ 3-year FCF." },
      roic: { label: "Return on invested capital (%)", unit: "%", note: "Higher is better. Acquisitions add goodwill to invested capital, which weighs on ROIC." },
      netDebtToEbitda: { label: "Net debt ÷ EBITDA (x)", unit: "x", note: "Lower is safer." }
    };
    var cos = d.companies.slice().sort(function (a, b) { return (b.isWsp ? 1 : 0) - (a.isWsp ? 1 : 0); });
    var chart = P.chart(document.getElementById("chart-peers"), {
      type: "bar",
      data: {
        labels: cos.map(function (c) { return c.name; }),
        datasets: [{ label: "", data: [], borderRadius: 4,
          backgroundColor: cos.map(function (c) { return c.isWsp ? C.accentStrong : C.soft; }) }]
      },
      options: {
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: function (ctx) { return ctx.dataset.label + ": " + fmt(ctx.raw, ctx.dataset._unit === "x" ? 2 : 1) + ctx.dataset._unit; } } }
        },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, title: { display: true, text: "" } }
        }
      }
    });
    P.segmented(document.getElementById("peers-toggle"), function (key) {
      var m = M[key];
      chart.data.datasets[0].data = cos.map(function (c) { return c[key]; });
      chart.data.datasets[0].label = m.label;
      chart.data.datasets[0]._unit = m.unit;
      chart.options.scales.y.title.text = m.label;
      chart.update();
      document.getElementById("peers-caption").textContent = m.note + " " + d.window + ", standardized statements, as of " + d.asOf + ".";
    });
    P.table(document.getElementById("table-peers"), "WSP versus peers on five measures",
      [{ label: "Company" }, { label: "Revenue growth", num: true }, { label: "FCF margin", num: true },
       { label: "Reinvestment", num: true }, { label: "ROIC", num: true }, { label: "Net debt ÷ EBITDA", num: true }],
      cos.map(function (c) {
        return [c.name, fmt(c.revenueCagr, 1) + "%", fmt(c.fcfMargin, 1) + "%", fmt(c.reinvestment, 1) + "%",
                fmt(c.roic, 1) + "%", fmt(c.netDebtToEbitda, 2) + "x"];
      }));
  }

  /* ---------- totals vs per share, indexed ---------- */
  function perShare(d) {
    var S = d.series;
    var VIEWS = {
      fcf: [["Free cash flow (total)", S.fcf], ["Free cash flow per share", S.fcfPerShare]],
      revenue: [["Revenue (total)", S.revenue], ["Revenue per share", S.revenuePerShare]],
      earnings: [["Net income (total)", S.netIncome], ["Diluted EPS", S.epsDiluted]]
    };
    var chart = P.chart(document.getElementById("chart-ps"), {
      type: "line",
      data: { labels: d.years.map(String), datasets: [] },
      options: {
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { position: "top", align: "start", labels: { usePointStyle: true } },
          tooltip: { callbacks: { label: function (ctx) { return ctx.dataset.label + ": " + fmt(ctx.raw, 1); } } }
        },
        scales: {
          x: { grid: { display: false } },
          y: { title: { display: true, text: "Index (2021 = 100)" } }
        }
      }
    });
    P.segmented(document.getElementById("ps-toggle"), function (key) {
      var v = VIEWS[key];
      chart.data.datasets = [
        { label: v[0][0], data: v[0][1], borderColor: C.soft, backgroundColor: C.soft, borderWidth: 2.5, pointRadius: 3, tension: 0 },
        { label: v[1][0], data: v[1][1], borderColor: C.accentStrong, backgroundColor: C.accentStrong, borderWidth: 3, pointRadius: 4, tension: 0 },
        { label: "Diluted shares", data: S.sharesDiluted, borderColor: C.contrast, backgroundColor: C.contrast, borderDash: [6, 4], borderWidth: 2, pointRadius: 0, tension: 0 }
      ];
      chart.update();
    });
    P.table(document.getElementById("table-ps"), "WSP totals and per-share values by year",
      [{ label: "Year" }, { label: "Revenue/share (" + d.currency + ")", num: true }, { label: "FCF/share", num: true },
       { label: "Diluted EPS", num: true }, { label: "Diluted shares (M)", num: true }],
      d.years.map(function (y, i) {
        return [String(y), fmt(d.values.revenuePerShare[i]), fmt(d.values.fcfPerShare[i]),
                fmt(d.values.epsDiluted[i]), fmt(d.values.sharesDilutedM[i], 1)];
      }));
  }

  Promise.all([P.getJSON("../data/investech-hackathon/peers.json"), P.getJSON("../data/investech-hackathon/per_share.json")])
    .then(function (r) { peers(r[0]); perShare(r[1]); })
    .catch(P.fail);
})();
