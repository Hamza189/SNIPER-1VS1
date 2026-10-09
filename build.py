#!/usr/bin/env python3
"""Builds the game page.

  core/*.js + client/*.js are inlined into src/page.html, producing:
  - index.html             complete standalone document (for Netlify / GitHub Pages / phones)
  - build/artifact.html    body-only fragment (for the claude.ai published page, which adds its own <head>)
"""
import pathlib
root = pathlib.Path(__file__).parent
CORE = ["config.js", "movement.js", "weapon.js", "melee.js", "trainer.js", "player.js", "protocol.js", "hitbox.js"]
CLIENT = ["settings.js", "layout.js", "touch.js", "quality.js", "netcore.js"]
code = "\n".join((root / "core" / f).read_text() for f in CORE) + "\n" + \
       "\n".join((root / "client" / f).read_text() for f in CLIENT)
page = (root / "src" / "page.html").read_text()
assert "/*@@CORE@@*/" in page
import subprocess
try: rev = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=root, capture_output=True, text=True).stdout.strip() or "dev"
except Exception: rev = "dev"
build_id = rev  # the commit the page was built on (shown in F3)
import hashlib, json
# content hash: changes whenever the game itself changes; the page compares it with version.json
# to tell an open tab that a newer version has been published
build_hash = hashlib.sha1((code + page).encode()).hexdigest()[:10]
fragment = page.replace("/*@@CORE@@*/", code + "\nconst BUILD_ID=" + repr(build_id).replace("'", '"') + ";const BUILD_HASH=" + json.dumps(build_hash) + ";", 1)
(root / "version.json").write_text(json.dumps({"hash": build_hash, "rev": build_id}) + "\n")

# split the fragment: everything up to the end of the first <style> belongs in <head>
cut = fragment.index("</style>") + len("</style>")
head, body = fragment[:cut], fragment[cut:]
standalone = (
    "<!doctype html>\n<html lang=\"es\">\n<head>\n"
    "<meta charset=\"utf-8\">\n"
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover\">\n"
    "<meta name=\"apple-mobile-web-app-capable\" content=\"yes\">\n"
    "<meta name=\"mobile-web-app-capable\" content=\"yes\">\n"
    "<meta name=\"apple-mobile-web-app-status-bar-style\" content=\"black-translucent\">\n"
    "<meta name=\"apple-mobile-web-app-title\" content=\"Sniper Duel\">\n"
    "<link rel=\"manifest\" href=\"manifest.webmanifest\">\n"
    + head + "\n</head>\n<body>\n" + body + "\n</body>\n</html>\n"
)
# The standalone page serves its own copy of Three.js (vendor/three.min.js, official r128 build),
# so the game does not depend on a CDN that a network or ISP may block. If that file ever fails,
# it falls back to two public CDNs before showing the error screen.
CDN = '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>'
assert standalone.count(CDN) == 1
LOCAL = (
    '<script src="vendor/three.min.js"></script>\n'
    '<script data-loader>window.THREE||document.write(\'<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js"><\\/script>\')</script>\n'
    '<script data-loader>window.THREE||document.write(\'<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"><\\/script>\')</script>'
)
standalone = standalone.replace(CDN, LOCAL)
(root / "index.html").write_text(standalone)
(root / "build").mkdir(exist_ok=True)
(root / "build" / "artifact.html").write_text(fragment)
print("built index.html (standalone) and build/artifact.html (fragment)")
