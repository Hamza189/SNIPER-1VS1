#!/usr/bin/env python3
"""Builds the game page.

  core/*.js + client/*.js are inlined into src/page.html, producing:
  - index.html             complete standalone document (for Netlify / GitHub Pages / phones)
  - build/artifact.html    body-only fragment (for the claude.ai published page, which adds its own <head>)
"""
import pathlib
root = pathlib.Path(__file__).parent
CORE = ["config.js", "movement.js", "weapon.js", "melee.js", "trainer.js"]
CLIENT = ["settings.js", "layout.js", "touch.js"]
code = "\n".join((root / "core" / f).read_text() for f in CORE) + "\n" + \
       "\n".join((root / "client" / f).read_text() for f in CLIENT)
page = (root / "src" / "page.html").read_text()
assert "/*@@CORE@@*/" in page
fragment = page.replace("/*@@CORE@@*/", code, 1)

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
(root / "index.html").write_text(standalone)
(root / "build").mkdir(exist_ok=True)
(root / "build" / "artifact.html").write_text(fragment)
print("built index.html (standalone) and build/artifact.html (fragment)")
