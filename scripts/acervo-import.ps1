<#
.SYNOPSIS
  Imports the WordPress archive into the production Kal El, in one supervised session.

.DESCRIPTION
  Runs `pnpm wp:import-session` (scripts/wp/import-session.ts), which pauses the site's
  webhooks, mints a 48-hour import token, runs the import twice (the second run must create
  nothing) and always resumes the webhooks and revokes the token at the end.

  The only secret, the Kal El owner's password, is asked for without echo and lives in this
  process's environment only while the session runs. The import token is never shown.

  Leave the window open until it finishes: it takes hours. If it is closed halfway, run the
  same command again with -Recover before anything else.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\acervo-import.ps1 `
    -KalElBaseUrl https://api.cms.example.com -SiteId 00000000-0000-4000-8000-000000000000 `
    -AdminEmail owner@example.com -Dump C:\backup\127_0_0_1.sql -Uploads C:\mn-import\uploads
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)] [string] $KalElBaseUrl,
  [Parameter(Mandatory = $true)] [string] $SiteId,
  [Parameter(Mandatory = $true)] [string] $AdminEmail,
  [string] $Dump,
  [string] $Uploads,
  [string] $Out = 'artifacts/migration/producao',
  [int] $Concurrency = 4,
  [switch] $Recover
)

$ErrorActionPreference = 'Stop'

function Read-Secret([string] $Prompt) {
  $secure = Read-Host $Prompt -AsSecureString
  return [System.Net.NetworkCredential]::new('', $secure).Password
}

try {
  $env:KAL_EL_BASE_URL = $KalElBaseUrl.TrimEnd('/')
  $env:KAL_EL_SITE_ID = $SiteId
  $env:KALEL_ADMIN_EMAIL = $AdminEmail
  $env:KALEL_ADMIN_PASSWORD = Read-Secret "Senha do owner do Kal El ($AdminEmail)"

  if ($Recover) {
    pnpm wp:import-session --recover
    if ($LASTEXITCODE -ne 0) { throw "wp:import-session --recover terminou com código $LASTEXITCODE" }
    return
  }

  if (-not $Dump -or -not (Test-Path -LiteralPath $Dump)) { throw "Dump não encontrado: $Dump" }
  if (-not $Uploads -or -not (Test-Path -LiteralPath $Uploads)) { throw "Pasta de uploads não encontrada: $Uploads" }
  $env:WP_ARCHIVE_DUMP = (Resolve-Path -LiteralPath $Dump).Path

  pnpm wp:import-session -- `
    --uploads (Resolve-Path -LiteralPath $Uploads).Path `
    --external-images --auto-desk `
    --concurrency $Concurrency `
    --out $Out `
    --state "$Out/state.json"
  if ($LASTEXITCODE -ne 0) { throw "wp:import-session terminou com código $LASTEXITCODE — veja o relatório em $Out" }
  Write-Host "Importação concluída. Relatório: $Out/import-report.json"
}
finally {
  Remove-Item Env:KALEL_ADMIN_PASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:WP_ARCHIVE_DUMP -ErrorAction SilentlyContinue
}
