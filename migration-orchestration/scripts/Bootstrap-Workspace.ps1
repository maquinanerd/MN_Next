[CmdletBinding()]
param([switch]$Install)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location $repoRoot

if (-not (Test-Path -LiteralPath (Join-Path $repoRoot '.git'))) {
  git init | Out-Host
}

$branch = 'chore/maquina-nerd-kalel-migration'
$existingBranch = git branch --list $branch
if (-not $existingBranch) { git switch -c $branch | Out-Host } else { git switch $branch | Out-Host }

if (-not (Test-Path -LiteralPath '.env.example')) {
  Copy-Item -LiteralPath 'migration-orchestration\.env.example' -Destination '.env.example'
}

& (Join-Path $PSScriptRoot 'Inspect-Inputs.ps1') -ExtractReferences

if (-not (Test-Path -LiteralPath 'package.json')) {
  Write-Warning 'Ainda não existe package.json. O Claude Code deve criar o app Next conforme CLAUDE.md antes da instalação.'
  exit 0
}

$manager = if (Test-Path 'pnpm-lock.yaml') { 'pnpm' } elseif (Test-Path 'yarn.lock') { 'yarn' } elseif (Test-Path 'package-lock.json') { 'npm' } else { 'pnpm' }
Write-Output "Gerenciador selecionado: $manager"
if ($Install) {
  switch ($manager) {
    'pnpm' { pnpm install --frozen-lockfile }
    'yarn' { yarn install --immutable }
    'npm' { npm ci }
  }
}
