#!/usr/bin/env python3
"""Builds the game page.

  core/*.js + client/*.js are inlined into src/page.html, producing:
  - index.html             complete standalone document (for Netlify / GitHub Pages / phones)
  - build/artifact.html    body-only fragment (for the claude.ai published page, which adds its own <head>)
"""
import pathlib
root = pathlib.Path(__file__).parent
CORE = ["config.js", "movement.js", "weapon.js", "gunstats.js", "melee.js", "trainer.js", "player.js", "protocol.js", "hitbox.js", "items.js"]
CLIENT = ["settings.js", "layout.js", "touch.js", "hudicons.js", "hud2.js", "perfprobe.js", "quality.js", "netcore.js", "vmrig.js", "town.js", "kit3d.js", "town3.js", "rats.js", "flora.js", "casa.js", "casa2.js", "casa2j.js", "barrio.js", "soldier2.js", "profile.js", "camo.js", "miras.js", "menu2.js"]
code = "\n".join((root / "core" / f).read_text(encoding="utf-8") for f in CORE) + "\n" + \
       "\n".join((root / "client" / f).read_text(encoding="utf-8") for f in CLIENT)
page = (root / "src" / "page.html").read_text(encoding="utf-8")
assert "/*@@CORE@@*/" in page
import subprocess
try: rev = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=root, capture_output=True, text=True).stdout.strip() or "dev"
except Exception: rev = "dev"
build_id = rev  # the commit the page was built on (shown in F3)
import hashlib, json
# content hash: changes whenever the game itself changes; the page compares it with version.json
# to tell an open tab that a newer version has been published
glb = root / "assets" / "viewmodels.glb"
tex = b"".join(p.read_bytes() for p in sorted((root / "assets" / "tex").glob("*.jpg")))
tex += b"".join(p.read_bytes() for p in sorted((root / "assets" / "personaje").rglob("*")) if p.is_file())   # personajes opcionales (?pj=2/3)
tex += b"".join(p.read_bytes() for p in sorted((root / "assets" / "armas").rglob("*")) if p.is_file())       # aspectos de arma (?pj=pro)
kit = root / "assets" / "kit.glb"
build_hash = hashlib.sha1((code + page).encode() + (glb.read_bytes() if glb.exists() else b"") + (kit.read_bytes() if kit.exists() else b"") + tex).hexdigest()[:10]
# CARGA (03-11-2026, docs/CARGA.md): every file the game loads gets the hash of its OWN content as its version (ASSET_V,
# used through THREE's URL modifier in page.html), not the build's: a publish only makes the browser download again the
# files that really changed (before, every publish changed every URL and the phone downloaded everything again).
WEB = {".glb", ".gltf", ".bin", ".jpg", ".jpeg", ".png", ".webp", ".ktx2", ".json", ".js", ".wasm", ".mp3", ".ogg", ".wav", ".svg"}
asset_v = {}
used_imports = set(__import__("re").findall(r"assets/3d/imports/([^/'\"]+)/", code + page))   # only the deliveries the code loads
for base in ("assets", "vendor"):
    for f in sorted((root / base).rglob("*")):
        rel = f.relative_to(root).parts
        if len(rel) > 3 and rel[1] == "3d" and rel[2] == "imports" and (rel[3] not in used_imports or "preview" in rel or "src" in rel):
            continue
        if f.is_file() and f.suffix.lower() in WEB:
            asset_v[f.relative_to(root).as_posix()] = hashlib.sha1(f.read_bytes()).hexdigest()[:8]
fragment = page.replace("/*@@CORE@@*/", code + "\nconst BUILD_ID=" + repr(build_id).replace("'", '"') + ";const BUILD_HASH=" + json.dumps(build_hash) + ";const ASSET_V=" + json.dumps(asset_v, separators=(",", ":")) + ";", 1)
(root / "version.json").write_text(json.dumps({"hash": build_hash, "rev": build_id}) + "\n", encoding="utf-8")

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
    "<link rel=\"apple-touch-icon\" href=\"assets/app/icono-180.png\">\n"
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
# the GLTF loader (official r128 example script, vendored) loads the modelled weapons and arms
GLTF_CDN = '<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js"></script>'
assert standalone.count(GLTF_CDN) == 1
standalone = standalone.replace(GLTF_CDN, '<script src="vendor/GLTFLoader.js"></script>')
(root / "index.html").write_text(standalone, encoding="utf-8")
(root / "build").mkdir(exist_ok=True)
(root / "build" / "artifact.html").write_text(fragment, encoding="utf-8")
print("built index.html (standalone) and build/artifact.html (fragment)")
