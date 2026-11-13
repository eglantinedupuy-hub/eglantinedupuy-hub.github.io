/* Homepage: hash-based section tabs + project tag filter.
   Progressive enhancement: without JS every section is shown stacked and
   the nav links are plain in-page anchors. */
(function () {
  "use strict";

  /* ---------------- section tabs ---------------- */
  var nav = document.querySelector(".section-nav");
  var links = Array.prototype.slice.call(document.querySelectorAll(".section-nav a[href^='#']"));
  var panels = links
    .map(function (a) { return document.getElementById(a.getAttribute("href").slice(1)); })
    .filter(Boolean);
  var ids = panels.map(function (p) { return p.id; });
  var DEFAULT = ids[0];
  var current = null;

  // Which panel should a hash open? A panel id, or any element inside a panel.
  function panelFor(hash) {
    var id = (hash || "").replace(/^#/, "");
    if (!id) return null;
    if (ids.indexOf(id) !== -1) return id;
    var el = document.getElementById(id);
    if (!el) return null;
    for (var i = 0; i < panels.length; i++) if (panels[i].contains(el)) return panels[i].id;
    return null;
  }

  function show(id, opts) {
    opts = opts || {};
    if (!id) id = current || DEFAULT;
    panels.forEach(function (p) { p.hidden = p.id !== id; });
    links.forEach(function (a) {
      if (a.getAttribute("href") === "#" + id) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    });
    var changed = current !== id;
    current = id;

    if (opts.scroll) {
      // Keep the sticky nav at the top only if the user has scrolled past the hero.
      var navTop = nav.getBoundingClientRect().top + window.pageYOffset;
      if (window.pageYOffset > navTop) window.scrollTo(0, navTop);
    }
    if (opts.focus && changed) {
      var heading = document.getElementById(id).querySelector("h2");
      if (heading) {
        heading.setAttribute("tabindex", "-1");
        heading.focus({ preventScroll: true });
      }
    }
  }

  if (nav && panels.length) {
    links.forEach(function (a) {
      a.addEventListener("click", function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        var id = a.getAttribute("href").slice(1);
        if (id !== current) history.pushState(null, "", "#" + id);
        show(id, { scroll: true, focus: true });
      });
    });

    // Back / forward buttons, and hash links elsewhere on the page.
    window.addEventListener("popstate", function () {
      show(panelFor(location.hash) || DEFAULT, { scroll: true });
    });
    window.addEventListener("hashchange", function () {
      var id = panelFor(location.hash);
      if (id) show(id, { scroll: ids.indexOf(location.hash.slice(1)) !== -1 });
    });

    var initial = panelFor(location.hash);
    show(initial || DEFAULT);
    if (initial && ids.indexOf(location.hash.slice(1)) !== -1) {
      // Direct link like /#projects: land with the nav at the top.
      requestAnimationFrame(function () { show(initial, { scroll: true }); });
    }
  }

  /* ---------------- project tag filter ---------------- */
  var filterBar = document.querySelector(".filters");
  var cards = Array.prototype.slice.call(document.querySelectorAll(".cards > .card"));
  var status = document.querySelector(".filter-status");

  if (filterBar && cards.length) {
    filterBar.hidden = false;
    var buttons = Array.prototype.slice.call(filterBar.querySelectorAll(".filter-btn"));

    function apply(tag) {
      var shown = 0;
      buttons.forEach(function (b) {
        b.setAttribute("aria-pressed", b.getAttribute("data-filter") === tag ? "true" : "false");
      });
      cards.forEach(function (c) {
        var match = tag === "all" || (" " + c.getAttribute("data-tags") + " ").indexOf(" " + tag + " ") !== -1;
        c.hidden = !match;
        if (match) shown++;
      });
      if (status) {
        status.textContent = tag === "all"
          ? "Showing all " + cards.length + " projects"
          : "Showing " + shown + " of " + cards.length + " projects";
      }
    }

    buttons.forEach(function (b) {
      b.addEventListener("click", function () { apply(b.getAttribute("data-filter")); });
    });
    apply("all");
  }
})();

/* Dealroom slide carousel: native scroll-snap (works without JS), enhanced with
   prev/next buttons, a counter, a report picker and arrow keys. */
(function () {
  "use strict";
  var root = document.querySelector(".carousel");
  if (!root) return;
  var track = root.querySelector(".carousel-track");
  var slides = Array.prototype.slice.call(track.children);
  var bar = root.querySelector(".carousel-bar");
  var count = root.querySelector(".carousel-count");
  var select = root.querySelector(".carousel-select");
  var prev = root.querySelector('[data-dir="-1"]');
  var next = root.querySelector('[data-dir="1"]');
  var starts = Array.prototype.map.call(select.options, function (o) { return Number(o.value); });
  bar.hidden = false;

  function current() {
    if (!track.clientWidth) return 0;  // panel hidden
    return Math.max(0, Math.min(slides.length - 1, Math.round(track.scrollLeft / track.clientWidth)));
  }
  function go(i) {
    i = Math.max(0, Math.min(slides.length - 1, i));
    track.scrollTo({ left: slides[i].offsetLeft - track.offsetLeft, behavior: "smooth" });
  }
  function sync() {
    var i = current();
    count.textContent = i + 1 + " / " + slides.length;
    prev.disabled = i === 0;
    next.disabled = i === slides.length - 1;
    var r = 0;
    for (var k = 0; k < starts.length; k++) if (starts[k] <= i) r = k;
    if (select.selectedIndex !== r) select.selectedIndex = r;
  }
  var t;
  track.addEventListener("scroll", function () { clearTimeout(t); t = setTimeout(sync, 60); }, { passive: true });
  prev.addEventListener("click", function () { go(current() - 1); });
  next.addEventListener("click", function () { go(current() + 1); });
  select.addEventListener("change", function () { go(Number(select.value)); });
  track.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight") { e.preventDefault(); go(current() + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(current() - 1); }
    else if (e.key === "Home") { e.preventDefault(); go(0); }
    else if (e.key === "End") { e.preventDefault(); go(slides.length - 1); }
  });
  window.addEventListener("resize", sync);
  sync();
})();
