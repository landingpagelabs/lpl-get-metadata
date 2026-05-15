"""Static blog generator shared across LPL tool sites.

Each tool site (svgscraper.com, inspectbrand.com, downloadhtml.com, makeutms.com)
keeps its blog posts as markdown in `blog-posts/`. This module reads those, renders
HTML with the site's nav/footer/colors, and writes:

  blog/index.html         (post list)
  blog/<slug>/index.html  (post page)
  sitemap.xml             (regenerated to include posts)

Usage from a routine or CLI:

    from blog_build import build_site
    build_site('/Users/.../tools/svg-grabber', site_config)

The site_config dict drives everything brand-specific. See
`tools/<site>/blog-config.yaml` for the canonical per-site config.
"""

from __future__ import annotations

import html
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    import yaml  # type: ignore
except ImportError:  # pragma: no cover
    raise SystemExit("Install pyyaml: pip install pyyaml")


# ---------- Markdown -> HTML (minimal, dependency-free) ----------


def md_to_html(md: str) -> str:
    out: list[str] = []
    lines = md.split("\n")
    in_code = False
    code_buf: list[str] = []
    in_list = False
    list_buf: list[str] = []
    para_buf: list[str] = []

    def flush_para() -> None:
        if para_buf:
            text = " ".join(para_buf).strip()
            if text:
                out.append(f"<p>{_inline(text)}</p>")
            para_buf.clear()

    def flush_list() -> None:
        nonlocal in_list
        if in_list:
            out.append("<ul>" + "".join(f"<li>{_inline(item)}</li>" for item in list_buf) + "</ul>")
            list_buf.clear()
            in_list = False

    for raw in lines:
        line = raw.rstrip()
        if line.startswith("```"):
            flush_para()
            flush_list()
            if in_code:
                out.append("<pre><code>" + html.escape("\n".join(code_buf)) + "</code></pre>")
                code_buf.clear()
                in_code = False
            else:
                in_code = True
            continue
        if in_code:
            code_buf.append(line)
            continue

        m = re.match(r"^(#{1,4})\s+(.+)$", line)
        if m:
            flush_para()
            flush_list()
            level = len(m.group(1))
            out.append(f"<h{level}>{_inline(m.group(2).strip())}</h{level}>")
            continue

        m = re.match(r"^[-*]\s+(.+)$", line)
        if m:
            flush_para()
            in_list = True
            list_buf.append(m.group(1))
            continue

        if not line.strip():
            flush_para()
            flush_list()
            continue

        flush_list()
        para_buf.append(line)

    flush_para()
    flush_list()
    return "\n".join(out)


def _inline(text: str) -> str:
    text = html.escape(text)
    text = re.sub(r"`([^`]+)`", r"<code>\1</code>", text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"(?<![*\w])\*([^*\s][^*]*)\*(?!\w)", r"<em>\1</em>", text)

    def _img(m: re.Match[str]) -> str:
        return f'<img src="{html.escape(m.group(2))}" alt="{m.group(1)}" loading="lazy" />'

    text = re.sub(r"!\[([^\]]*)\]\(([^)\s]+)\)", _img, text)

    def _link(m: re.Match[str]) -> str:
        return f'<a href="{html.escape(m.group(2))}">{m.group(1)}</a>'

    text = re.sub(r"\[([^\]]+)\]\(([^)\s]+)\)", _link, text)
    return text


# ---------- Frontmatter parsing ----------


def parse_frontmatter(text: str) -> tuple[dict[str, Any], str]:
    if not text.startswith("---\n"):
        raise ValueError("post is missing YAML frontmatter (--- ... ---)")
    end = text.find("\n---\n", 4)
    if end < 0:
        raise ValueError("frontmatter is not closed")
    fm = yaml.safe_load(text[4:end])
    body = text[end + 5 :].lstrip("\n")
    return fm, body


# ---------- Post discovery ----------


def discover_posts(blog_posts_dir: Path) -> list[dict[str, Any]]:
    posts: list[dict[str, Any]] = []
    for md_path in sorted(blog_posts_dir.glob("*.md")):
        raw = md_path.read_text(encoding="utf-8")
        try:
            fm, body = parse_frontmatter(raw)
        except ValueError as e:
            raise SystemExit(f"{md_path.name}: {e}")
        slug = fm.get("slug") or md_path.stem
        if not re.match(r"^[a-z0-9][a-z0-9\-]{0,80}$", slug):
            raise SystemExit(f"{md_path.name}: invalid slug {slug!r}")
        for required in ("title", "description", "published"):
            if required not in fm:
                raise SystemExit(f"{md_path.name}: missing required frontmatter '{required}'")

        body_html = md_to_html(body)
        wc = len(re.findall(r"\b\w+\b", body))

        posts.append(
            {
                "slug": slug,
                "title": fm["title"],
                "description": fm["description"],
                "published": str(fm["published"]),
                "category": fm.get("category", "guide"),
                "cover_image": fm.get("cover_image"),
                "cover_alt": fm.get("cover_alt", ""),
                "tags": fm.get("tags", []),
                "body_html": body_html,
                "word_count": wc,
                "reading_minutes": max(1, wc // 220),
            }
        )

    posts.sort(key=lambda p: p["published"], reverse=True)
    return posts


# ---------- HTML rendering ----------


# Master list of LPL free tools. Each blog page renders the OTHERS as sister tools.
LPL_TOOLS = [
    {
        "domain": "svgscraper.com",
        "name": "SVG Scraper",
        "desc": "Extract every SVG from a site",
        "logo_svg": '<rect width="24" height="24" rx="5" fill="#2563eb"/><path d="M7 17 L12 7 L17 17 Z" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="12" cy="12" r="1.4" fill="#fff"/><circle cx="7" cy="17" r="0.9" fill="#fff"/><circle cx="17" cy="17" r="0.9" fill="#fff"/><circle cx="12" cy="7" r="0.9" fill="#fff"/>',
    },
    {
        "domain": "inspectbrand.com",
        "name": "Inspect Brand",
        "desc": "Favicons, colors, fonts",
        "logo_svg": '<rect width="24" height="24" rx="5" fill="#111"/><circle cx="11" cy="9" r="3.5" fill="none" stroke="#fff" stroke-width="2"/><line x1="13.6" y1="11.6" x2="16.5" y2="14.5" stroke="#fff" stroke-width="2" stroke-linecap="round"/><circle cx="6.5" cy="18" r="2.2" fill="#FF6B6B"/><circle cx="12" cy="18" r="2.2" fill="#4ECDC4"/><circle cx="17.5" cy="18" r="2.2" fill="#FFD43B"/>',
    },
    {
        "domain": "downloadhtml.com",
        "name": "Download HTML",
        "desc": "View and download source",
        "logo_svg": '<rect width="24" height="24" rx="5" fill="#0a0a0a"/><path d="M9 8 L5 12 L9 16" fill="none" stroke="#3b82f6" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 8 L19 12 L15 16" fill="none" stroke="#3b82f6" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 6.5 L10 17.5" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>',
    },
    {
        "domain": "makeutms.com",
        "name": "Make UTMs",
        "desc": "UTM campaign URL builder",
        "logo_svg": '<rect width="24" height="24" rx="5" fill="#0a0a0b"/><line x1="3.5" y1="12" x2="9" y2="12" stroke="#f59e0b" stroke-width="2.2" stroke-linecap="round"/><rect x="9.5" y="9.5" width="4" height="5" rx="1.2" fill="#f59e0b"/><rect x="14.5" y="9.5" width="3" height="5" rx="1.2" fill="#f59e0b" opacity="0.65"/><rect x="18.5" y="9.5" width="2" height="5" rx="1" fill="#f59e0b" opacity="0.4"/>',
    },
    {
        "domain": "fontcompressor.com",
        "name": "Font Compressor",
        "desc": "Compress fonts to WOFF2",
        "logo_svg": '<rect width="24" height="24" rx="5" fill="#2563eb"/><text x="12" y="17" font-family="ui-sans-serif,system-ui,sans-serif" font-size="15" font-weight="700" fill="#fff" text-anchor="middle">F</text>',
    },
]


def _sister_tools_html(current_domain: str) -> str:
    """Emit the sister-tools section listing every LPL tool except the current one."""
    items = []
    for tool in LPL_TOOLS:
        if tool["domain"] == current_domain:
            continue
        href = (
            f"https://{tool['domain']}/"
            f"?utm_source={current_domain}&amp;utm_medium=referral"
            f"&amp;utm_campaign=lpl-tools&amp;utm_content=sister-tools-card"
        )
        items.append(
            f'<li><a href="{href}" target="_blank" rel="noopener">'
            f'<svg class="sister-logo" viewBox="0 0 24 24" aria-hidden="true">{tool["logo_svg"]}</svg>'
            f'<div class="sister-meta">'
            f'<span class="sister-name">{html.escape(tool["name"])}</span>'
            f'<span class="sister-desc">{html.escape(tool["desc"])}</span>'
            f'</div></a></li>'
        )
    return (
        '<section class="sister-tools" aria-labelledby="sister-heading">'
        '<h2 id="sister-heading">More free tools from Landing Page Labs</h2>'
        '<ul class="sister-list">' + "".join(items) + "</ul>"
        "</section>"
    )


def _lpl_footer_html(current_domain: str, dark: bool = False) -> str:
    """Render the LPL 'built by' footer link.

    Routes through the per-tool pxl.to short link so clicks are tracked and the
    destination URL can be remapped without redeploying. The pill class is
    swapped on dark themes so the Bunny lockup sits on a white pill backdrop
    (preserves the official brand asset; CSS inverts/filters break its
    gradient + pattern internals).
    """
    domain_to_slug = {
        "svgscraper.com": "svgscraper",
        "inspectbrand.com": "inspectbrand",
        "downloadhtml.com": "downloadhtml",
        "makeutms.com": "makeutms",
        "fontcompressor.com": "fontcompressor",
    }
    slug = domain_to_slug.get(current_domain)
    if slug:
        href = f"https://links.landingpagelabs.co/{slug}"
    else:
        href = (
            f"https://www.landingpagelabs.co/"
            f"?utm_source={current_domain}&amp;utm_medium=referral"
            f"&amp;utm_campaign=lpl-tools&amp;utm_content=footer-logo"
        )
    cls = "footer-lpl footer-lpl-pill" if dark else "footer-lpl"
    return (
        f'<a class="{cls}" href="{href}" target="_blank" rel="noopener">'
        f'<span>Built by</span>'
        f'<img src="https://landing-page-labs.b-cdn.net/LPLabsLogo-NavBar.svg" '
        f'alt="Landing Page Labs" height="22" width="100" loading="lazy" decoding="async">'
        f'</a>'
    )


def render_layout(
    *,
    config: dict[str, Any],
    title: str,
    description: str,
    canonical: str,
    og_image: str,
    og_image_alt: str,
    extra_head: str,
    body_html: str,
    og_type: str = "article",
    breadcrumb_jsonld: dict | None = None,
    article_jsonld: dict | None = None,
) -> str:
    site_name = config["site_name"]
    domain = config["domain"]
    brand_mark_svg = config["brand_mark_svg"].strip()
    brand_text_light = config["brand_text_light"]
    brand_text_strong = config["brand_text_strong"]
    primary = config["primary_color"]
    body_bg = config.get("body_bg", "#fafafa")
    body_color = config.get("body_color", "#1a1a1a")
    text_muted = config.get("text_muted", "#595959")
    border = config.get("border", "#e5e5e5")
    surface = config.get("surface", "#ffffff")
    font_family = config.get("font_family", "'Inter',-apple-system,BlinkMacSystemFont,system-ui,sans-serif")
    font_url = config.get("font_url")  # absolute or root-relative woff2 path
    tool_label = config.get("tool_label", "Tool")

    jsonld_blocks: list[str] = []
    if breadcrumb_jsonld:
        jsonld_blocks.append(
            '<script type="application/ld+json">' + json.dumps(breadcrumb_jsonld) + "</script>"
        )
    if article_jsonld:
        jsonld_blocks.append(
            '<script type="application/ld+json">' + json.dumps(article_jsonld) + "</script>"
        )
    jsonld_html = "\n".join(jsonld_blocks)

    font_face = ""
    font_preload = ""
    if font_url:
        font_face = f"""@font-face {{
  font-family: 'Inter'; font-style: normal; font-weight: 400 700; font-display: swap;
  src: url('{font_url}') format('woff2');
}}"""
        font_preload = f'<link rel="preload" as="font" type="font/woff2" href="{font_url}" crossorigin>'

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{html.escape(title)}</title>
  <meta name="description" content="{html.escape(description)}">
  <meta name="robots" content="index, follow">
  <meta name="theme-color" content="{primary}">
  <link rel="canonical" href="{html.escape(canonical)}">

  <meta property="og:type" content="{og_type}">
  <meta property="og:title" content="{html.escape(title)}">
  <meta property="og:description" content="{html.escape(description)}">
  <meta property="og:url" content="{html.escape(canonical)}">
  <meta property="og:image" content="{html.escape(og_image)}">
  <meta property="og:image:alt" content="{html.escape(og_image_alt)}">
  <meta property="og:site_name" content="{html.escape(site_name)}">
  <meta property="og:locale" content="en_US">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{html.escape(title)}">
  <meta name="twitter:description" content="{html.escape(description)}">
  <meta name="twitter:image" content="{html.escape(og_image)}">
  <meta name="twitter:image:alt" content="{html.escape(og_image_alt)}">

  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  {font_preload}

  {jsonld_html}

  <style>
    {font_face}
    *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: {font_family};
      background: {body_bg};
      color: {body_color};
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
    }}
    a {{ color: {primary}; text-decoration: underline; text-underline-offset: 2px; }}
    a:hover {{ color: {body_color}; }}
    .site-nav {{
      width: 100%;
      border-bottom: 1px solid {border};
    }}
    .site-nav-inner {{
      max-width: 880px; margin: 0 auto; padding: 16px 24px;
      display: flex; align-items: center; justify-content: space-between;
      gap: 24px;
    }}
    .site-nav-brand {{
      display: inline-flex; align-items: center; gap: 8px;
      color: {body_color}; text-decoration: none; font-weight: 600;
    }}
    .brand-mark {{ display: block; flex: 0 0 22px; }}
    .brand-text {{ font-size: 15px; letter-spacing: -0.2px; }}
    .brand-text-light {{ color: {text_muted}; font-weight: 500; }}
    .brand-text-strong {{ color: {body_color}; font-weight: 700; }}
    .site-nav-links {{ display: flex; gap: 20px; }}
    .site-nav-link {{
      font-size: 14px; color: {text_muted}; text-decoration: none; font-weight: 500;
    }}
    .site-nav-link:hover {{ color: {body_color}; }}
    main {{ max-width: 720px; margin: 0 auto; padding: 48px 24px 32px; }}
    .post-list-header h1 {{
      font-size: 38px; font-weight: 700; letter-spacing: -0.6px; margin-bottom: 8px;
    }}
    .post-list-header p {{ color: {text_muted}; font-size: 16px; margin-bottom: 32px; }}
    .post-card {{
      display: block; padding: 24px 0; border-bottom: 1px solid {border};
      color: {body_color}; text-decoration: none;
    }}
    .post-card:last-child {{ border-bottom: 0; }}
    .post-card-meta {{
      font-size: 12px; color: {text_muted}; text-transform: uppercase;
      letter-spacing: 0.05em; margin-bottom: 6px;
    }}
    .post-card h2 {{
      font-size: 22px; font-weight: 700; letter-spacing: -0.3px; margin-bottom: 6px;
    }}
    .post-card p {{ color: {text_muted}; font-size: 15px; }}
    .post-card:hover h2 {{ color: {primary}; }}
    article.post {{
      max-width: 680px; margin: 0 auto; padding: 32px 0 64px;
    }}
    article.post .post-meta {{
      font-size: 13px; color: {text_muted}; margin-bottom: 12px;
      text-transform: uppercase; letter-spacing: 0.05em;
    }}
    article.post h1 {{
      font-size: 38px; font-weight: 700; letter-spacing: -0.6px; line-height: 1.15;
      margin-bottom: 16px;
    }}
    article.post .post-cover {{
      margin: 24px -24px 32px;
      max-width: calc(100% + 48px);
    }}
    article.post .post-cover img {{
      width: 100%; height: auto; border-radius: 8px;
    }}
    article.post h2 {{
      font-size: 26px; font-weight: 700; letter-spacing: -0.4px; margin: 36px 0 12px;
    }}
    article.post h3 {{
      font-size: 19px; font-weight: 700; margin: 28px 0 10px;
    }}
    article.post p {{ font-size: 16.5px; line-height: 1.7; margin-bottom: 16px; color: {body_color}; }}
    article.post ul {{ margin: 0 0 18px 24px; }}
    article.post li {{ font-size: 16.5px; line-height: 1.7; margin-bottom: 8px; }}
    article.post pre {{
      background: {surface}; border: 1px solid {border}; border-radius: 8px;
      padding: 16px; overflow-x: auto; margin: 18px 0;
      font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 13.5px;
      line-height: 1.6;
    }}
    article.post code {{
      font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 14px;
      background: {surface}; padding: 1px 5px; border-radius: 4px;
    }}
    article.post pre code {{ background: transparent; padding: 0; }}
    article.post img {{
      width: 100%; height: auto; border-radius: 8px; margin: 16px 0;
    }}
    article.post a {{ color: {primary}; }}
    .post-back {{
      display: inline-block; font-size: 14px; color: {text_muted};
      text-decoration: none; margin-bottom: 12px;
    }}
    .post-back:hover {{ color: {body_color}; }}
    .related {{
      margin-top: 48px; padding-top: 32px; border-top: 1px solid {border};
    }}
    .related h2 {{
      font-size: 16px; font-weight: 600; color: {text_muted};
      text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px;
    }}
    .related ul {{ list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }}
    .related li {{ margin: 0; font-size: 15px; }}
    .related a {{ color: {body_color}; }}
    .related a:hover {{ color: {primary}; }}
    .site-footer {{
      max-width: 880px; margin: 0 auto; padding: 32px 24px;
      border-top: 1px solid {border}; font-size: 13px; color: {text_muted};
      display: flex; align-items: center; justify-content: space-between; gap: 16px;
      flex-wrap: wrap;
    }}
    .site-footer a {{ color: {text_muted}; }}
    .site-footer a:hover {{ color: {body_color}; }}
    .footer-lpl {{
      display: inline-flex; align-items: center; gap: 8px;
      color: {text_muted}; text-decoration: none;
    }}
    .footer-lpl img {{ height: 22px; width: auto; display: block; }}
    .footer-lpl-pill img {{
      background: #fff; padding: 5px 10px; border-radius: 999px;
      box-sizing: content-box; box-shadow: 0 1px 2px rgba(0,0,0,0.2);
    }}
    .footer-lpl:hover {{ color: {body_color}; }}
    .sister-tools {{
      max-width: 880px; margin: 32px auto 0; padding: 32px 24px 0;
      border-top: 1px solid {border};
    }}
    .sister-tools h2 {{
      font-size: 13px; font-weight: 600; color: {text_muted};
      text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 18px;
    }}
    .sister-list {{
      list-style: none; padding: 0; margin: 0;
      display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px;
      align-items: stretch;
    }}
    .sister-list li {{ display: flex; }}
    .sister-list a {{
      display: flex; align-items: flex-start; gap: 12px;
      padding: 16px; background: {surface};
      border: 1px solid {border}; border-radius: 8px;
      text-decoration: none; transition: border-color 0.15s, box-shadow 0.15s;
      width: 100%; min-height: 80px;
    }}
    .sister-list a:hover {{ border-color: {primary}; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }}
    .sister-logo {{ flex: 0 0 28px; width: 28px; height: 28px; display: block; }}
    .sister-meta {{ display: flex; flex-direction: column; gap: 3px; min-width: 0; }}
    .sister-name {{ font-size: 14px; font-weight: 600; color: {body_color}; }}
    .sister-desc {{ font-size: 12.5px; color: {text_muted}; line-height: 1.45; }}
    @media (max-width: 768px) {{
      .sister-list {{ grid-template-columns: 1fr 1fr; }}
    }}
    @media (max-width: 480px) {{
      .sister-list {{ grid-template-columns: 1fr; }}
      main {{ padding: 32px 20px 24px; }}
      article.post .post-cover {{ margin: 20px -20px 24px; }}
      article.post h1 {{ font-size: 30px; }}
      article.post h2 {{ font-size: 22px; }}
      .post-list-header h1 {{ font-size: 30px; }}
    }}
    @media (max-width: 640px) {{
      main {{ padding: 32px 20px 24px; }}
      article.post .post-cover {{ margin: 20px -20px 24px; }}
      article.post h1 {{ font-size: 30px; }}
      article.post h2 {{ font-size: 22px; }}
      .post-list-header h1 {{ font-size: 30px; }}
    }}
    {extra_head}
  </style>
</head>
<body>
  <nav class="site-nav" aria-label="Primary">
    <div class="site-nav-inner">
      <a class="site-nav-brand" href="/" aria-label="{html.escape(site_name)} home">
        {brand_mark_svg}
        <span class="brand-text"><span class="brand-text-light">{html.escape(brand_text_light)}</span> <span class="brand-text-strong">{html.escape(brand_text_strong)}</span></span>
      </a>
      <div class="site-nav-links">
        <a href="/blog" class="site-nav-link">Blog</a>
      </div>
    </div>
  </nav>
  {body_html}
  {_sister_tools_html(domain)}
  <footer class="site-footer">
    <p><a href="/">Back to {html.escape(site_name)}</a></p>
    {_lpl_footer_html(domain, dark=bool(config.get("dark_footer_logo")))}
  </footer>
</body>
</html>
"""


def render_post(config: dict[str, Any], post: dict[str, Any], related: list[dict[str, Any]]) -> str:
    domain = config["domain"]
    site_name = config["site_name"]
    canonical = f"https://{domain}/blog/{post['slug']}/"
    cover = post.get("cover_image")
    if cover and cover.startswith("/"):
        og_image = f"https://{domain}{cover}"
    elif cover:
        og_image = cover
    else:
        og_image = f"https://{domain}/og-image.jpg"
    og_alt = post.get("cover_alt") or post["title"]

    cover_html = ""
    if cover:
        cover_html = (
            '<div class="post-cover">'
            f'<img src="{html.escape(cover)}" alt="{html.escape(og_alt)}" '
            f'width="1200" height="630" loading="eager" />'
            "</div>"
        )

    related_html = ""
    if related:
        items = "".join(
            f'<li><a href="/blog/{html.escape(r["slug"])}/">{html.escape(r["title"])}</a></li>'
            for r in related
        )
        related_html = f'<aside class="related"><h2>Related posts</h2><ul>{items}</ul></aside>'

    breadcrumb = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": site_name, "item": f"https://{domain}/"},
            {"@type": "ListItem", "position": 2, "name": "Blog", "item": f"https://{domain}/blog"},
            {"@type": "ListItem", "position": 3, "name": post["title"], "item": canonical},
        ],
    }
    article = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": post["title"],
        "description": post["description"],
        "image": og_image,
        "datePublished": post["published"],
        "dateModified": post["published"],
        "author": {"@type": "Organization", "name": "Landing Page Labs", "url": "https://www.landingpagelabs.co"},
        "publisher": {"@type": "Organization", "name": "Landing Page Labs", "url": "https://www.landingpagelabs.co"},
        "mainEntityOfPage": canonical,
        "wordCount": post["word_count"],
    }

    body_html = (
        '<main>'
        '<a href="/blog" class="post-back">← Back to blog</a>'
        '<article class="post">'
        f'<div class="post-meta">{html.escape(post["published"][:10])} · {post["reading_minutes"]} min read</div>'
        f'<h1>{html.escape(post["title"])}</h1>'
        f'{cover_html}'
        f'{post["body_html"]}'
        f'{related_html}'
        '</article>'
        '</main>'
    )
    return render_layout(
        config=config,
        title=f"{post['title']} | {site_name}",
        description=post["description"],
        canonical=canonical,
        og_image=og_image,
        og_image_alt=og_alt,
        extra_head="",
        body_html=body_html,
        breadcrumb_jsonld=breadcrumb,
        article_jsonld=article,
    )


def render_index(config: dict[str, Any], posts: list[dict[str, Any]]) -> str:
    site_name = config["site_name"]
    domain = config["domain"]
    canonical = f"https://{domain}/blog"
    og_image = f"https://{domain}/og-image.jpg"

    if not posts:
        cards = '<p style="color:#666">No posts yet. Come back soon.</p>'
    else:
        cards = "".join(
            f'<a class="post-card" href="/blog/{html.escape(p["slug"])}/">'
            f'<div class="post-card-meta">{html.escape(p["published"][:10])} · {p["reading_minutes"]} min read</div>'
            f'<h2>{html.escape(p["title"])}</h2>'
            f'<p>{html.escape(p["description"])}</p>'
            "</a>"
            for p in posts
        )

    body_html = (
        '<main>'
        '<header class="post-list-header">'
        f'<h1>{html.escape(site_name)} blog</h1>'
        f'<p>{html.escape(config.get("blog_tagline", "Notes, guides, and roundups."))}</p>'
        '</header>'
        f'{cards}'
        '</main>'
    )
    return render_layout(
        config=config,
        title=f"Blog | {site_name}",
        description=config.get("blog_description", f"Notes, guides, and roundups from the {site_name} team."),
        canonical=canonical,
        og_image=og_image,
        og_image_alt=f"{site_name} blog",
        extra_head="",
        body_html=body_html,
        og_type="website",
    )


def render_sitemap(config: dict[str, Any], posts: list[dict[str, Any]]) -> str:
    domain = config["domain"]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    urls = [
        (f"https://{domain}/", today, "weekly", "1.0"),
        (f"https://{domain}/blog", today, "weekly", "0.8"),
    ]
    for p in posts:
        urls.append((f"https://{domain}/blog/{p['slug']}/", p["published"][:10], "monthly", "0.7"))
    body = "\n".join(
        f'  <url>\n    <loc>{loc}</loc>\n    <lastmod>{lm}</lastmod>\n    <changefreq>{cf}</changefreq>\n    <priority>{pr}</priority>\n  </url>'
        for loc, lm, cf, pr in urls
    )
    return f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{body}\n</urlset>\n'


# ---------- Main entry ----------


def build_site(site_root: str | Path, config: dict[str, Any] | None = None) -> dict[str, Any]:
    site_root = Path(site_root)
    if config is None:
        cfg_path = site_root / "blog-config.yaml"
        if not cfg_path.exists():
            raise SystemExit(f"missing {cfg_path}")
        config = yaml.safe_load(cfg_path.read_text())

    posts_dir = site_root / "blog-posts"
    posts_dir.mkdir(exist_ok=True)
    posts = discover_posts(posts_dir)

    blog_dir = site_root / "blog"
    blog_dir.mkdir(exist_ok=True)
    (blog_dir / "index.html").write_text(render_index(config, posts), encoding="utf-8")

    for i, post in enumerate(posts):
        related = [p for j, p in enumerate(posts) if j != i][:3]
        post_dir = blog_dir / post["slug"]
        post_dir.mkdir(exist_ok=True)
        (post_dir / "index.html").write_text(render_post(config, post, related), encoding="utf-8")

    sitemap_path = site_root / "sitemap.xml"
    sitemap_path.write_text(render_sitemap(config, posts), encoding="utf-8")

    return {
        "site": config["site_name"],
        "posts_built": len(posts),
        "blog_dir": str(blog_dir),
        "sitemap": str(sitemap_path),
    }


if __name__ == "__main__":
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--site", required=True, help="Path to a tool site directory containing blog-config.yaml")
    args = ap.parse_args()
    result = build_site(args.site)
    print(json.dumps(result, indent=2))
