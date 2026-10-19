param([string]$Stage='generate')
$ErrorActionPreference='Stop'
$deliveryRoot=Split-Path $PSScriptRoot -Parent
$runtimeRoot=Join-Path $deliveryRoot '.work'
foreach($folder in @('tmp','config','cache','appdata','localappdata','resources','cycles')) { New-Item -ItemType Directory -Force -Path (Join-Path $runtimeRoot $folder) | Out-Null }
$env:TEMP=Join-Path $runtimeRoot 'tmp'; $env:TMP=$env:TEMP; $env:TMPDIR=$env:TEMP
$env:APPDATA=Join-Path $runtimeRoot 'appdata'; $env:LOCALAPPDATA=Join-Path $runtimeRoot 'localappdata'
$env:XDG_CACHE_HOME=Join-Path $runtimeRoot 'cache'; $env:BLENDER_USER_CONFIG=Join-Path $runtimeRoot 'config'
$env:BLENDER_USER_RESOURCES=Join-Path $runtimeRoot 'resources'; $env:CYCLES_CACHE_PATH=Join-Path $runtimeRoot 'cycles'
$env:CUDA_CACHE_PATH=Join-Path $runtimeRoot 'cache'; $env:__GL_SHADER_DISK_CACHE_PATH=Join-Path $runtimeRoot 'cache'
$env:PYTHONDONTWRITEBYTECODE='1'
if($Stage -eq 'generate') {
 & C:\Python314\python.exe (Join-Path $PSScriptRoot 'textures.py')
 if($LASTEXITCODE -ne 0){throw 'Textures failed'}
 & D:\Blender\blender.exe --background --factory-startup --python-exit-code 1 --python (Join-Path $PSScriptRoot 'build_character.py')
} elseif($Stage -eq 'preview') { & node (Join-Path $PSScriptRoot 'capture.js') }
else {throw 'Unknown stage'}
if($LASTEXITCODE -ne 0){throw 'Asset stage failed'}
