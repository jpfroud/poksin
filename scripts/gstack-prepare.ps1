$ErrorActionPreference = 'Stop'

if ($env:GSTACK_GIT_BASH) {
    $gitBash = $env:GSTACK_GIT_BASH
} else {
    $gitExecPath = & git --exec-path
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    $gitBash = [IO.Path]::GetFullPath((Join-Path $gitExecPath '../../../bin/bash.exe'))
}
if (-not (Test-Path -LiteralPath $gitBash -PathType Leaf)) {
    throw 'Git Bash introuvable. Installez Git pour Windows ou définissez GSTACK_GIT_BASH.'
}

Push-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
try {
    & $gitBash scripts/gstack-prepare.sh @args
    $result = $LASTEXITCODE
} finally {
    Pop-Location
}
exit $result
