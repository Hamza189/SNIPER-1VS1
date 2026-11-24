#!/usr/bin/env bash
# Prepara la página pública con solo lo que carga el juego (24-11-2026, propietario: «arregla el error de Cloudflare
# siempre»). Lo usan los dos sitios que publican `main`:
#   - GitHub Pages: .github/workflows/pages.yml («Publicar página»)
#   - Cloudflare Pages, proyecto `sniper-1vs1`: en el panel, comando de compilación `bash tools/pagina-publica.sh` y
#     carpeta de salida `_site`.
# Antes Cloudflare subía el repositorio entero y fallaba con un original de 31 MiB
# (cobblestone_02_nor_gl_4k.exr), porque no acepta archivos de más de 25 MiB.
# Uso: bash tools/pagina-publica.sh [carpeta]   (por defecto _site), desde la raíz del repositorio.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="${1:-_site}"
MAX=$((25 * 1024 * 1024))    # el límite por archivo de Cloudflare Pages (25 MiB)

case "$OUT" in ''|.|./|/|..|../) echo "carpeta de salida no válida: '$OUT'"; exit 1;; esac   # never wipe the repository
rm -rf "$OUT"; mkdir -p "$OUT"
git ls-files -z | tar --null -T - -cf - | tar -xf - -C "$OUT"
cd "$OUT"
# never loaded by the page: documentation, tools, tests, workflow files, sources and previews
rm -rf docs tools test .github build wasm   # wasm/: the C++ sources (the page loads assets/wasm/*.wasm)
find ./assets/3d \( -path '*/preview/*' -o -path '*/src/*' \) -type f -delete   # only the 3D import packs' previews and sources
# (23-11-2026, release) assets/3d/imports holds the original 3D packs; the page only loads from these two. The rest
# (tests, previews, retired versions such as CASA ATLAS XL: ~100 MB) stays in the repository, not on the web
find ./assets/3d/imports -mindepth 1 -maxdepth 1 -type d ! -name '2026-10-12_p0_ground_pack_v2' ! -name '2026-10-18_casa_atlas' -exec rm -rf {} +
find . -type f \( -name '*.blend' -o -name '*.blend1' -o -name '*.exr' -o -name '*.target' -o -name '*.obj' -o -name '*.max' -o -name '*.mb' -o -name '*.py' -o -name '*.md' \) -delete
# server and repository config, not part of the page (wrangler.toml also confuses the Cloudflare Pages build)
rm -f wrangler.toml package.json package-lock.json tsconfig.json AGENTS.md CLAUDE.md .gitignore .gitattributes
touch .nojekyll

# every assets/... path written literally in the page has to be there
missing=0
for f in $(grep -o "assets/[A-Za-z0-9_./-]*\.\(glb\|jpg\|png\|json\|ktx2\|webp\|mp3\|ogg\|wasm\)" index.html | grep -v 'ktx2' | sort -u); do   # the KTX2 files live in Cloudflare R2 (docs/R2.md)
  [ -e "$f" ] || { echo "falta: $f"; missing=1; }
done

# no file above 25 MiB: Cloudflare Pages refuses the whole publication otherwise. If the page needs one, it fails here
# (to move it to R2); if it is an original the page never loads, it is left out with a warning
while IFS= read -r -d '' f; do
  if grep -qF "${f#./}" index.html; then echo "demasiado grande (> 25 MiB) y la página lo carga: $f (pásalo a R2, docs/R2.md)"; missing=1
  else echo "fuera por pesar más de 25 MiB (la página no lo carga): $f"; rm -f "$f"; fi
done < <(find . -type f -size +$((MAX / 1024))k -print0)

du -sh . ; echo "archivos: $(find . -type f | wc -l)"
[ $missing -eq 0 ]
