#!/usr/bin/env python3
"""Generate year-colored share cards and static OG metadata for quiz pages."""

from __future__ import annotations

import html
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import urlparse

SITE_ROOT = Path(__file__).resolve().parents[1]
SITE_URL = "https://hena-choco.github.io"
START = "<!-- social-metadata:start -->"
END = "<!-- social-metadata:end -->"


def quiz_pages() -> list[Path]:
    return sorted(
        p for p in SITE_ROOT.glob("*.html")
        if re.match(r"^20\d{2}-.+\.html$", p.name)
    )


def content_for(page: Path, pattern: str, label: str) -> str:
    match = re.search(pattern, page.read_text(encoding="utf-8"), re.I | re.S)
    if not match:
        raise ValueError(f"{page.name}: {label} を取得できません")
    return html.unescape(match.group(1).strip())


def update_page(page: Path) -> tuple[int, str]:
    year = int(page.name[:4])
    source = page.read_text(encoding="utf-8")
    title = content_for(page, r"<title[^>]*>(.*?)</title>", "title")
    description = content_for(page, r'<meta\s+name=["\']description["\']\s+content=["\'](.*?)["\']\s*/?>', "description")
    escaped_title = html.escape(title, quote=True)
    escaped_description = html.escape(description, quote=True)
    page_url = f"{SITE_URL}/{page.name}"
    image_url = f"{SITE_URL}/share-images/doraemon-kentei-{year}.png"

    block = f'''{START}
<link rel="canonical" href="{page_url}">
<meta property="og:type" content="website">
<meta property="og:locale" content="ja_JP">
<meta property="og:site_name" content="ドラえもん検定 過去問題集">
<meta property="og:title" content="{escaped_title}">
<meta property="og:description" content="{escaped_description}">
<meta property="og:url" content="{page_url}">
<meta property="og:image" content="{image_url}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:type" content="image/png">
<meta property="og:image:alt" content="{year}年 ドラえもん検定 過去問題">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{escaped_title}">
<meta name="twitter:description" content="{escaped_description}">
<meta name="twitter:image" content="{image_url}">
{END}'''

    marker_pattern = re.compile(re.escape(START) + r".*?" + re.escape(END), re.S)
    if marker_pattern.search(source):
        updated = marker_pattern.sub(lambda _: block, source, count=1)
    else:
        desc_tag = re.search(r'<meta\s+name=["\']description["\']\s+content=["\'].*?["\']\s*/?>', source, re.I | re.S)
        if not desc_tag:
            raise ValueError(f"{page.name}: description meta tag がありません")
        updated = source[:desc_tag.end()] + "\n" + block + source[desc_tag.end():]

    page.write_text(updated, encoding="utf-8")
    return year, image_url


def update_sitemap(page_images: dict[str, str]) -> None:
    sitemap_path = SITE_ROOT / "sitemap.xml"
    ET.register_namespace("", "http://www.sitemaps.org/schemas/sitemap/0.9")
    ET.register_namespace("image", "http://www.google.com/schemas/sitemap-image/1.1")
    tree = ET.parse(sitemap_path)
    root = tree.getroot()
    ns = "{http://www.sitemaps.org/schemas/sitemap/0.9}"
    image_ns = "{http://www.google.com/schemas/sitemap-image/1.1}"
    found: set[str] = set()

    for url_element in root.findall(f"{ns}url"):
        loc = url_element.findtext(f"{ns}loc", default="")
        filename = Path(urlparse(loc).path).name
        if filename not in page_images:
            for image_element in list(url_element.findall(f"{image_ns}image")):
                url_element.remove(image_element)
            continue
        found.add(filename)
        for image_element in list(url_element.findall(f"{image_ns}image")):
            url_element.remove(image_element)
        image = ET.SubElement(url_element, f"{image_ns}image")
        ET.SubElement(image, f"{image_ns}loc").text = page_images[filename]
        ET.SubElement(image, f"{image_ns}title").text = f"{filename[:4]}年 ドラえもん検定 過去問題"

    missing = sorted(set(page_images) - found)
    if missing:
        print("注意: sitemap.xml に未掲載の検定ページ: " + ", ".join(missing), file=sys.stderr)
    tree.write(sitemap_path, encoding="utf-8", xml_declaration=True)


def main() -> None:
    subprocess.run(
        ["swift", str(SITE_ROOT / "tools/generate-share-images.swift"), str(SITE_ROOT)],
        check=True,
    )
    pages = quiz_pages()
    page_images: dict[str, str] = {}
    for page in pages:
        year, image_url = update_page(page)
        page_images[page.name] = image_url
    update_sitemap(page_images)
    print(f"{len(pages)}ページにOG/Twitter画像を設定し、{len(set(int(p[:4]) for p in page_images))}年分のPNGと画像サイトマップを更新しました。")


if __name__ == "__main__":
    main()
