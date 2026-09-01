[CmdletBinding()]
param([switch]$SkipVisual, [switch]$SkipPerformance)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location $repoRoot
if (-not (Test-Path -LiteralPath 'package.json')) { throw 'package.json ausente. Implemente o workspace antes de rodar gates.' }

$manager = if (Test-Path 'pnpm-lock.yaml') { 'pnpm' } elseif (Test-Path 'yarn.lock') { 'yarn' } else { 'npm' }
$package = Get-Content -LiteralPath 'package.json' -Raw | ConvertFrom-Json
$scripts = $package.scripts.psobject.Properties.Name
$gates = @('format:check','lint','typecheck','test:unit','test:integration','test:contract','build','test:a11y','test:e2e','test:security')
if (-not $SkipVisual) { $gates += 'test:visual' }
if (-not $SkipPerformance) { $gates += 'test:performance' }
$missing = $gates | Where-Object { $_ -notin $scripts }
if ($missing) { throw "Scripts de qualidade ausentes: $($missing -join ', ')" }

foreach ($gate in $gates) {
  Write-Host "`n==> $gate" -ForegroundColor Cyan
  if ($manager -eq 'pnpm') { & pnpm $gate } elseif ($manager -eq 'yarn') { & yarn $gate } else { & npm run $gate }
  if ($LASTEXITCODE -ne 0) { throw "Gate falhou: $gate" }
}
Write-Host 'Todos os gates concluídos com sucesso.' -ForegroundColor Green
