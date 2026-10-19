param([string]$Stage = 'generate', [string]$Blender = 'D:\Blender\blender.exe')
$ErrorActionPreference = 'Stop'
$deliveryRoot = Split-Path $PSScriptRoot -Parent
$projectRoot = (Resolve-Path (Join-Path $deliveryRoot '../../../..')).Path
$runtimeRoot = Join-Path $deliveryRoot '.work'
foreach ($folder in @('tmp','config','cache','appdata','localappdata','resources','cycles')) {
    New-Item -ItemType Directory -Force -Path (Join-Path $runtimeRoot $folder) | Out-Null
}
$env:TEMP = Join-Path $runtimeRoot 'tmp'
$env:TMP = $env:TEMP
$env:TMPDIR = $env:TEMP
$env:APPDATA = Join-Path $runtimeRoot 'appdata'
$env:LOCALAPPDATA = Join-Path $runtimeRoot 'localappdata'
$env:XDG_CACHE_HOME = Join-Path $runtimeRoot 'cache'
$env:BLENDER_USER_RESOURCES = Join-Path $runtimeRoot 'resources'
$env:BLENDER_USER_CONFIG = Join-Path $runtimeRoot 'config'
$env:CYCLES_CACHE_PATH = Join-Path $runtimeRoot 'cycles'
$env:CUDA_CACHE_PATH = Join-Path $runtimeRoot 'cache'
$env:__GL_SHADER_DISK_CACHE_PATH = Join-Path $runtimeRoot 'cache'
$env:PYTHONDONTWRITEBYTECODE = '1'
if ($Stage -eq 'generate') {
    & python (Join-Path $PSScriptRoot 'prepare_textures.py')
    if ($LASTEXITCODE -ne 0) { throw 'Texture preparation failed' }
    & $Blender --background --factory-startup --python-exit-code 1 --python (Join-Path $PSScriptRoot 'generate_casa_atlas_xl_v2.py')
} elseif ($Stage -eq 'preview') {
    & node (Join-Path $PSScriptRoot 'capture_and_test.js')
} else { throw "Unknown stage: $Stage" }
if ($LASTEXITCODE -ne 0) { throw "Blender $Stage failed" }
