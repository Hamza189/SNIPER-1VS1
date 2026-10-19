# Revisión 03 del personaje: regenera todo desde las fuentes (PowerShell, desde la raíz del proyecto).
#   & 'assets/3d/imports/2026-10-19_personaje/revision_03/src/run.ps1'            # modelo + texturas + GLB + copia al juego
#   & 'assets/3d/imports/2026-10-19_personaje/revision_03/src/run.ps1' -Stage glb # solo animaciones/GLB (rápido)
# Requisitos: Blender 5.2 (D:\Blender), Python 3 con numpy y Pillow (C:\Python314). Una vez: python prepare_targets.py
param([string]$Stage = 'all')
$ErrorActionPreference = 'Continue'   # Blender escribe avisos en stderr; se comprueban los códigos de salida
$src = $PSScriptRoot; $rev = Split-Path $src -Parent
$env:PYTHONDONTWRITEBYTECODE = '1'
if ($Stage -eq 'all') {
  & D:\Blender\blender.exe --background --factory-startup --python-exit-code 1 --python (Join-Path $src 'build_model.py') | Select-String '^\['
  if ($LASTEXITCODE -ne 0) { throw 'build_model falló' }
  & C:\Python314\python.exe (Join-Path $src 'textures.py'); if ($LASTEXITCODE -ne 0) { throw 'textures falló' }
}
& C:\Python314\python.exe (Join-Path $src 'build_glb.py') | Select-Object -Last 2; if ($LASTEXITCODE -ne 0) { throw 'build_glb falló' }
# lo que usa el juego (?pj=2)
New-Item -ItemType Directory -Force 'assets/personaje' | Out-Null
Copy-Item (Join-Path $rev 'personaje.glb'), (Join-Path $rev 'personaje_1k.glb') 'assets/personaje/'
foreach ($n in 'color_A', 'color_A_1k', 'color_bots', 'color_bots_1k') { Copy-Item (Join-Path $rev "textures/$n.jpg") 'assets/personaje/' }
