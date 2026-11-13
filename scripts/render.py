"""Render project cards and prev/next links from data/projects.json.

Standard library only. Writes static HTML between marker comments so the
site works without JavaScript and GitHub Pages needs no build step:

  index.html            <!-- render:filters -->  ... <!-- /render:filters -->
                        <!-- render:cards -->    ... <!-- /render:cards -->
  projects/<slug>.html  <!-- render:pager -->    ... <!-- /render:pager -->

Usage:  python scripts/render.py
"""

import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def esc(s):
    return html.escape(str(s), quote=True)


def slugify(tag):
    return re.sub(r"[^a-z0-9]+", "-", tag.lower()).strip("-")


def replace_block(text, name, content, indent):
    pattern = re.compile(
        rf"([ \t]*)<!-- render:{name} -->.*?<!-- /render:{name} -->", re.S
    )
    if not pattern.search(text):
        raise SystemExit(f"marker render:{name} not found")
    body = "\n".join(indent + line if line else line for line in content.strip("\n").split("\n"))
    return pattern.sub(
        lambda m: f"{m.group(1)}<!-- render:{name} -->\n{body}\n{m.group(1)}<!-- /render:{name} -->",
        text,
    )


def picture(thumb, prefix=""):
    base = prefix + thumb["base"]
    return (
        f'<picture>\n'
        f'  <source srcset="{esc(base)}.webp" type="image/webp" />\n'
        f'  <img src="{esc(base)}.png" alt="{esc(thumb["alt"])}" width="{thumb["width"]}" '
        f'height="{thumb["height"]}" loading="lazy" decoding="async" />\n'
        f'</picture>'
    )


def card(p):
    tags = " ".join(slugify(t) for t in p["tags"])
    tag_items = "\n".join(f'      <li class="tag">{esc(t)}</li>' for t in p["tags"])
    title_id = f'card-{p["slug"]}'
    return f"""<li class="card" data-tags="{tags}">
  <div class="card-media">
{indent_lines(picture(p["thumbnail"]), "    ")}
  </div>
  <div class="card-body">
    <h3 class="card-title" id="{title_id}"><a class="card-link" href="{esc(p["page"])}">{esc(p["title"])}</a></h3>
    <p class="card-hook">{esc(p["hook"])}</p>
    <p class="card-result"><span class="visually-hidden">Key result: </span>{esc(p["keyResult"])}</p>
    <ul class="tag-list" aria-label="Tools and methods">
{tag_items}
    </ul>
  </div>
</li>"""


def indent_lines(text, pad):
    return "\n".join(pad + line for line in text.split("\n"))


def render_index(projects):
    path = ROOT / "index.html"
    text = path.read_text(encoding="utf-8")
    tags = []
    for p in projects:
        for t in p["tags"]:
            if t not in tags:
                tags.append(t)
    buttons = ['<button type="button" class="filter-btn" data-filter="all" aria-pressed="true">All</button>']
    buttons += [
        f'<button type="button" class="filter-btn" data-filter="{slugify(t)}" aria-pressed="false">{esc(t)}</button>'
        for t in tags
    ]
    text = replace_block(text, "filters", "\n".join(buttons), "            ")
    cards = "\n".join(card(p) for p in projects)
    text = replace_block(text, "cards", cards, "            ")
    path.write_text(text, encoding="utf-8", newline="\n")
    print(f"index.html: {len(projects)} cards, {len(tags)} filter tags")


def render_pages(projects):
    n = len(projects)
    for i, p in enumerate(projects):
        path = ROOT / p["page"]
        if not path.exists():
            print(f"skip {p['page']} (page not created yet)")
            continue
        prev_p = projects[i - 1] if i > 0 else None
        next_p = projects[i + 1] if i < n - 1 else None
        links = ['<a class="pager-link" href="../index.html#projects">&larr; All projects</a>']
        if prev_p:
            links.append(
                f'<a class="pager-link" href="../{esc(prev_p["page"])}" rel="prev">'
                f'<span class="pager-label">Previous</span> {esc(prev_p["title"])}</a>'
            )
        if next_p:
            links.append(
                f'<a class="pager-link" href="../{esc(next_p["page"])}" rel="next">'
                f'<span class="pager-label">Next</span> {esc(next_p["title"])}</a>'
            )
        text = path.read_text(encoding="utf-8")
        text = replace_block(text, "pager", "\n".join(links), "        ")
        path.write_text(text, encoding="utf-8", newline="\n")
        print(f"{p['page']}: pager updated")


def render_dealroom():
    """Slide carousel + featured links under the Dealroom role (index.html)."""
    path = ROOT / "data" / "dealroom.json"
    if not path.exists():
        return
    d = json.loads(path.read_text(encoding="utf-8"))
    slides = [(r, s) for r in d["reports"] for s in r["slides"]]
    total = len(slides)

    options = []
    i = 0
    for r in d["reports"]:
        options.append(f'<option value="{i}">{esc(r["title"])} ({esc(r["date"])})</option>')
        i += len(r["slides"])

    items = []
    for k, (r, s) in enumerate(slides, 1):
        base = f'assets/img/dealroom/slides/slide-{s["n"]:02d}'
        loading = 'fetchpriority="low"' if k == 1 else 'loading="lazy"'
        items.append(f"""<li class="carousel-slide" id="dr-slide-{k}" aria-roledescription="slide" aria-label="{k} of {total}: {esc(r["title"])}">
  <picture>
    <source srcset="{base}.webp" type="image/webp" />
    <img src="{base}.jpg" alt="{esc(s["alt"])}" width="1200" height="675" {loading} decoding="async" />
  </picture>
  <p class="carousel-caption"><strong>{esc(r["title"])}</strong> · with {esc(r["partners"])} · {esc(r["date"])}</p>
</li>""")

    html_out = f"""<div class="showcase">
  <h4 class="showcase-title">Selected research <span class="showcase-sub">{len(d["reports"])} reports · {total} slides</span></h4>
  {f'<p class="showcase-intro">{esc(d["intro"])}</p>' if d.get("intro") else ""}
  <div class="carousel" role="region" aria-roledescription="carousel" aria-label="Dealroom report slides">
    <div class="carousel-bar" hidden>
      <label class="visually-hidden" for="dr-report">Jump to report</label>
      <select id="dr-report" class="carousel-select">
{indent_lines(chr(10).join(options), "        ")}
      </select>
      <span class="carousel-count" aria-live="polite">1 / {total}</span>
      <button type="button" class="carousel-btn" data-dir="-1" aria-label="Previous slide">&#8249;</button>
      <button type="button" class="carousel-btn" data-dir="1" aria-label="Next slide">&#8250;</button>
    </div>
    <ul class="carousel-track" tabindex="0" aria-label="Report slides, scroll horizontally">
{indent_lines(chr(10).join(items), "      ")}
    </ul>
  </div>"""

    links = d.get("links") or []
    if links:
        cards = []
        for l in links:
            thumb = ""
            if l.get("thumbnail"):
                t = esc(l["thumbnail"])  # base path; .webp + .jpg fallback
                thumb = (f'<picture class="link-thumb"><source srcset="{t}.webp" type="image/webp" />'
                         f'<img src="{t}.jpg" alt="" width="640" height="360" loading="lazy" decoding="async" /></picture>')
            cards.append(f"""<li class="link-card">
  {thumb}
  <div class="link-body">
    <span class="link-type">{esc(l["type"])}</span>
    <h5 class="link-title"><a class="link-anchor" href="{esc(l["url"])}" rel="noopener">{esc(l["title"])}</a></h5>
    <p class="link-desc">{esc(l.get("description", ""))}</p>
  </div>
</li>""")
        html_out += f"""
  <h4 class="showcase-title">Podcasts &amp; articles</h4>
  <ul class="link-cards">
{indent_lines(chr(10).join(cards), "    ")}
  </ul>"""
    html_out += "\n</div>"

    idx = ROOT / "index.html"
    text = idx.read_text(encoding="utf-8")
    text = replace_block(text, "dealroom-showcase", html_out, "            ")
    idx.write_text(text, encoding="utf-8", newline="\n")
    print(f"index.html: Dealroom showcase with {total} slides, {len(links)} links")


def main():
    projects = json.loads((ROOT / "data" / "projects.json").read_text(encoding="utf-8"))["projects"]
    render_index(projects)
    render_pages(projects)
    render_dealroom()


if __name__ == "__main__":
    main()
