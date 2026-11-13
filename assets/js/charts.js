/* Shared helpers for project pages: Chart.js defaults, data loading,
   accessible data tables and segmented toggles. Requires Chart.js 4.x
   (assets/vendor/chart.umd.min.js, global `Chart`). */
window.Portfolio = (function () {
  "use strict";

  var css = getComputedStyle(document.documentElement);
  function token(name, fallback) {
    var v = css.getPropertyValue(name).trim();
    return v || fallback;
  }

  var COLORS = {
    accent: token("--accent", "#4e7a5c"),
    accentStrong: token("--accent-strong", "#3a5e46"),
    soft: "#7a9a84",       // light sage for secondary series / CI bars (3.1:1 on white)
    muted: token("--muted", "#525e54"),
    text: token("--text", "#1f2620"),
    grid: "#e3e6df",
    contrast: "#b0802b"    // ochre: second series when two must be told apart
  };

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (window.Chart) {
    var C = window.Chart;
    C.defaults.font.family = token("--font", "Inter, system-ui, sans-serif");
    C.defaults.font.size = 13;
    C.defaults.color = COLORS.muted;
    C.defaults.borderColor = COLORS.grid;
    C.defaults.maintainAspectRatio = false;
    // set fields individually: replacing the object drops the default easing function
    if (reduceMotion) C.defaults.animation = false;
    else C.defaults.animation.duration = 400;
    C.defaults.plugins.legend.labels.boxWidth = 12;
    C.defaults.plugins.legend.labels.boxHeight = 12;
    C.defaults.plugins.tooltip.backgroundColor = COLORS.text;
    C.defaults.plugins.tooltip.padding = 10;
    C.defaults.plugins.tooltip.cornerRadius = 6;
  }

  /* Draws a vertical reference line at x = 0 (horizontal charts). */
  var zeroLine = {
    id: "zeroLine",
    afterDatasetsDraw: function (chart) {
      var x = chart.scales.x;
      if (!x || x.min > 0 || x.max < 0) return;
      var px = x.getPixelForValue(0);
      var ctx = chart.ctx;
      ctx.save();
      ctx.strokeStyle = COLORS.text;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(px, chart.chartArea.top);
      ctx.lineTo(px, chart.chartArea.bottom);
      ctx.stroke();
      ctx.restore();
    }
  };

  function getJSON(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(url + " → HTTP " + r.status);
      return r.json();
    });
  }

  function fmt(n, digits) {
    if (n === null || n === undefined || isNaN(n)) return "–";
    return Number(n).toLocaleString("en-US", {
      minimumFractionDigits: digits == null ? 2 : digits,
      maximumFractionDigits: digits == null ? 2 : digits
    });
  }

  /* Render rows into a <table> inside `container` (replaces its content). */
  function table(container, caption, headers, rows) {
    if (!container) return;
    var t = document.createElement("table");
    var cap = document.createElement("caption");
    cap.className = "visually-hidden";
    cap.textContent = caption;
    t.appendChild(cap);
    var thead = t.createTHead().insertRow();
    headers.forEach(function (h) {
      var th = document.createElement("th");
      th.scope = "col";
      th.textContent = h.label;
      if (h.num) th.className = "num";
      thead.appendChild(th);
    });
    var tb = t.createTBody();
    rows.forEach(function (r) {
      var tr = tb.insertRow();
      r.forEach(function (cell, i) {
        var td = tr.insertCell();
        td.textContent = cell;
        if (headers[i].num) td.className = "num";
      });
    });
    container.innerHTML = "";
    var wrap = document.createElement("div");
    wrap.className = "table-scroll";
    wrap.appendChild(t);
    container.appendChild(wrap);
  }

  /* Segmented toggle: <div class="segmented" data-toggle> with <button data-value>. */
  function segmented(el, onChange) {
    var buttons = Array.prototype.slice.call(el.querySelectorAll("button[data-value]"));
    function set(value) {
      buttons.forEach(function (b) {
        b.setAttribute("aria-pressed", b.getAttribute("data-value") === value ? "true" : "false");
      });
      onChange(value);
    }
    buttons.forEach(function (b) {
      b.type = "button";
      b.addEventListener("click", function () { set(b.getAttribute("data-value")); });
    });
    var initial = buttons.filter(function (b) { return b.getAttribute("aria-pressed") === "true"; })[0] || buttons[0];
    set(initial.getAttribute("data-value"));
  }

  function fillSelect(select, values, labelFn) {
    select.innerHTML = "";
    values.forEach(function (v) {
      var o = document.createElement("option");
      o.value = v;
      o.textContent = labelFn ? labelFn(v) : v;
      select.appendChild(o);
    });
  }

  function fail(err) {
    console.error(err);
    Array.prototype.forEach.call(document.querySelectorAll(".chart-box"), function (box) {
      if (!box.querySelector("canvas[data-ready]")) {
        box.innerHTML = '<p class="note">This chart could not load. The key numbers are in the text above.</p>';
        box.style.height = "auto";
      }
    });
  }

  /* Wrap an axis label into lines of at most `max` characters (narrower on phones),
     capped at `maxLines` lines with an ellipsis. Tooltips still show the full label. */
  function wrapLabel(label, max, maxLines) {
    max = max || (window.innerWidth < 640 ? 18 : 30);
    maxLines = maxLines || 3;
    if (typeof label !== "string" || label.length <= max) return label;
    var lines = [], line = "";
    label.split(" ").forEach(function (word) {
      if (line && (line + " " + word).length > max) { lines.push(line); line = word; }
      else line = line ? line + " " + word : word;
    });
    if (line) lines.push(line);
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      lines[maxLines - 1] = lines[maxLines - 1].replace(/[;,]?$/, "") + "…";
    }
    return lines;
  }

  /* Size a horizontal bar chart's box so the tallest (wrapped) label fits its row;
     Chart.js gives every category row the same height. */
  function fitHeight(chart, labels, max, maxLines) {
    var tallest = 1;
    labels.forEach(function (l) {
      var w = wrapLabel(l, max, maxLines);
      tallest = Math.max(tallest, Array.isArray(w) ? w.length : 1);
    });
    var h = labels.length * (tallest * 17 + 16) + 110;  // + axis, legend, padding
    chart.canvas.parentNode.style.height = Math.max(220, h) + "px";
    chart.resize();
  }

  function chart(canvas, config) {
    canvas.setAttribute("data-ready", "");
    return new window.Chart(canvas, config);
  }

  return {
    COLORS: COLORS,
    zeroLine: zeroLine,
    getJSON: getJSON,
    fmt: fmt,
    table: table,
    segmented: segmented,
    fillSelect: fillSelect,
    fail: fail,
    chart: chart,
    wrapLabel: wrapLabel,
    fitHeight: fitHeight
  };
})();
