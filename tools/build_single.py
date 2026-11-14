"""Bundle the game into one self-contained HTML file.

    python3 tools/build_single.py

Writes dist/pirate-chronicle.html: every stylesheet and script from
index.html inlined, and every image under assets/ embedded, so the game
runs from a single file with no folder around it (to keep offline, email,
or open on another machine). No packages needed.
"""
import base64
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
src = (ROOT / "index.html").read_text(encoding="utf-8")

MIME = {".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg"}


def inline_css(m):
    css = (ROOT / m.group(1)).read_text(encoding="utf-8")
    return "<style>\n" + css + "</style>"


def inline_js(m):
    js = (ROOT / m.group(1)).read_text(encoding="utf-8")
    return "<script>\n" + js.replace("</script", "<\\/script") + "</script>"


# Images: PC.assets maps each path (as the game asks for it) to a data URL.
assets = {}
for f in sorted((ROOT / "assets").rglob("*")):
    if f.suffix.lower() in MIME:
        rel = f.relative_to(ROOT).as_posix()
        assets[rel] = "data:" + MIME[f.suffix.lower()] + ";base64," + base64.b64encode(f.read_bytes()).decode("ascii")
assets_js = "<script>\nglobalThis.PC = globalThis.PC || {};\nPC.assets = " + json.dumps(assets) + ";\n</script>\n"

out = re.sub(r'<link rel="stylesheet" href="([^"]+)">', inline_css, src)
out = re.sub(r'<script src="([^"]+)"></script>', inline_js, out)
out = out.replace("  <!-- Engine", assets_js + "  <!-- Engine", 1)

dist = ROOT / "dist"
dist.mkdir(exist_ok=True)
(dist / "pirate-chronicle.html").write_text(out, encoding="utf-8")
print("wrote", dist / "pirate-chronicle.html", f"({len(out):,} bytes, {len(assets)} images)")
