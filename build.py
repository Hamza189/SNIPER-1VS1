#!/usr/bin/env python3
"""Builds the single-file game page: inlines core/*.js into src/page.html -> index.html."""
import pathlib
root = pathlib.Path(__file__).parent
core = "\n".join((root / "core" / f).read_text() for f in ("config.js", "movement.js", "weapon.js"))
page = (root / "src" / "page.html").read_text()
assert "/*@@CORE@@*/" in page
(root / "index.html").write_text(page.replace("/*@@CORE@@*/", core, 1))
print("built index.html")
