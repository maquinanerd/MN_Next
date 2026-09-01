[CmdletBinding()]
param(
  [switch]$ExtractReferences
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$required = @('Máquina Nerd template completo.zip', 'doc tecnico.zip')
$records = @()

foreach ($name in $required) {
  $path = Join-Path $repoRoot $name
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    throw "Arquivo de referência ausente: $path"
  }
  $item = Get-Item -LiteralPath $path
  $records += [pscustomobject]@{
    Name = $item.Name
    Bytes = $item.Length
    SHA256 = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
    LastWriteTimeUtc = $item.LastWriteTimeUtc.ToString('o')
  }
}

$reportDirectory = Join-Path $repoRoot 'docs\migration'
New-Item -ItemType Directory -Force -Path $reportDirectory | Out-Null
$inventoryPath = Join-Path $reportDirectory 'INPUT-INVENTORY.md'
$lines = @('# Inventário de entradas', '', "Gerado: $(Get-Date -Format o)", '', '| Arquivo | Bytes | SHA-256 | Modificado (UTC) |', '|---|---:|---|---|')
$lines += $records | ForEach-Object { "| {0} | {1} | {2}{3}{2} | {4} |" -f $_.Name, $_.Bytes, [char]96, $_.SHA256, $_.LastWriteTimeUtc }
Set-Content -LiteralPath $inventoryPath -Value $lines -Encoding utf8

if ($ExtractReferences) {
  $referenceRoot = Join-Path $repoRoot '.migration-reference'
  New-Item -ItemType Directory -Force -Path $referenceRoot | Out-Null
  foreach ($record in $records) {
    $source = Join-Path $repoRoot $record.Name
    $safeName = if ($record.Name -like 'doc tecnico*') { 'technical' } else { 'claude-design' }
    $destination = Join-Path $referenceRoot $safeName
    if (-not (Test-Path -LiteralPath $destination)) {
      Expand-Archive -LiteralPath $source -DestinationPath $destination
    }
  }
  $gitignore = Join-Path $repoRoot '.gitignore'
  if (-not (Test-Path -LiteralPath $gitignore)) { New-Item -ItemType File -Path $gitignore | Out-Null }
  if (-not (Select-String -LiteralPath $gitignore -SimpleMatch '.migration-reference/' -Quiet -ErrorAction SilentlyContinue)) {
    Add-Content -LiteralPath $gitignore -Value "`n.migration-reference/"
  }
}

Write-Output "Entrada validada. Relatório: $inventoryPath"
$records | Format-Table -AutoSize
