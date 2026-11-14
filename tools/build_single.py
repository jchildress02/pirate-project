"""Bundle the game into one self-contained HTML file.

    python3 tools/build_single.py

Writes dist/pirate-chronicle.html: every stylesheet and script from
index.html inlined, so the game runs from a single file with no folder
around it (to keep offline, email, or open on another machine).
No packages needed.
"""
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
src = (ROOT / "index.html").read_text(encoding="utf-8")


def inline_css(m):
    css = (ROOT / m.group(1)).read_text(encoding="utf-8")
    return "<style>\n" + css + "</style>"


def inline_js(m):
    js = (ROOT / m.group(1)).read_text(encoding="utf-8")
    return "<script>\n" + js.replace("</script", "<\\/script") + "</script>"


out = re.sub(r'<link rel="stylesheet" href="([^"]+)">', inline_css, src)
out = re.sub(r'<script src="([^"]+)"></script>', inline_js, out)

dist = ROOT / "dist"
dist.mkdir(exist_ok=True)
(dist / "pirate-chronicle.html").write_text(out, encoding="utf-8")
print("wrote", dist / "pirate-chronicle.html", f"({len(out):,} bytes)")
