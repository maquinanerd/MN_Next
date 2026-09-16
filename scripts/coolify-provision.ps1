<#
.SYNOPSIS
  Provisions the Kal El site for a portal deployed on Coolify and hands the delivery token
  straight to Coolify: the token is never printed, copied to the clipboard or written to disk.

.DESCRIPTION
  1. Reads, through the Coolify API, the webhook secret Coolify generated for the portal
     (SERVICE_BASE64_64_WEBHOOK).
  2. Runs `pnpm kalel:provision --apply --new-token` with it: editorias, reserved tags, the
     revalidation webhook and a delivery token.
  3. Stores that token in the portal's KAL_EL_SERVICE_TOKEN through the Coolify API.
  4. Queues a deployment of the portal.

  Two secrets are asked for interactively, never as arguments (an argument is visible in the
  process list): a Coolify API token that can read secret values, write and deploy, and the
  password of the Kal El site owner. Both leave the environment when the script ends.

  Run it from the repository root, where `pnpm install` has already run. Running it again is
  safe, but each run mints a new delivery token: revoke the older one in the CMS.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\coolify-provision.ps1 `
    -CoolifyUrl https://coolify.example.com -ApplicationUuid abc123 `
    -KalElBaseUrl https://api.cms.example.com -SiteId 00000000-0000-4000-8000-000000000000 `
    -PortalUrl https://portal.example.com -AdminEmail owner@example.com
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)] [string] $CoolifyUrl,
  [Parameter(Mandatory = $true)] [string] $ApplicationUuid,
  [Parameter(Mandatory = $true)] [string] $KalElBaseUrl,
  [Parameter(Mandatory = $true)] [string] $SiteId,
  [Parameter(Mandatory = $true)] [string] $PortalUrl,
  [Parameter(Mandatory = $true)] [string] $AdminEmail
)

$ErrorActionPreference = 'Stop'
# Windows PowerShell 5.1 still offers TLS 1.0 first.
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Read-Secret([string] $Prompt) {
  $secure = Read-Host $Prompt -AsSecureString
  return [System.Net.NetworkCredential]::new('', $secure).Password
}

$api = "$($CoolifyUrl.TrimEnd('/'))/api/v1"
$appEnvs = "$api/applications/$ApplicationUuid/envs"

try {
  $coolifyToken = Read-Secret 'Coolify API token (read secrets, write, deploy)'
  $headers = @{ Authorization = "Bearer $coolifyToken"; Accept = 'application/json' }

  Write-Host '1/4 Reading the webhook secret Coolify generated for the portal'
  $envs = Invoke-RestMethod -Method Get -Uri $appEnvs -Headers $headers
  $webhook = $envs | Where-Object { $_.key -eq 'SERVICE_BASE64_64_WEBHOOK' -and -not $_.is_preview } | Select-Object -First 1
  if (-not $webhook -or -not $webhook.value) {
    throw 'SERVICE_BASE64_64_WEBHOOK not found, or this API token cannot read secret values.'
  }

  Write-Host '2/4 Provisioning Kal El: editorias, reserved tags, webhook, delivery token'
  $env:KAL_EL_BASE_URL = $KalElBaseUrl
  $env:KAL_EL_SITE_ID = $SiteId
  $env:PORTAL_PUBLIC_URL = $PortalUrl
  $env:KALEL_ADMIN_EMAIL = $AdminEmail
  $env:KAL_EL_WEBHOOK_SECRET = $webhook.value
  $env:KALEL_ADMIN_PASSWORD = Read-Secret 'Kal El password'

  # A native command writing to stderr must not become a terminating error here.
  $ErrorActionPreference = 'Continue'
  $output = & pnpm kalel:provision --apply --new-token 2>&1 | ForEach-Object { "$_" }
  $provisionExit = $LASTEXITCODE
  $ErrorActionPreference = 'Stop'

  $tokenLine = $output | Where-Object { $_ -match '^KAL_EL_SERVICE_TOKEN=' } | Select-Object -First 1
  $output | Where-Object { $_ -notmatch '^KAL_EL_SERVICE_TOKEN=' } | ForEach-Object { Write-Host "    $_" }
  if ($provisionExit -ne 0 -or -not $tokenLine) {
    throw 'Provisioning did not produce a delivery token; the lines above say why.'
  }
  $deliveryToken = $tokenLine.Substring('KAL_EL_SERVICE_TOKEN='.Length).Trim()

  Write-Host '3/4 Storing KAL_EL_SERVICE_TOKEN in Coolify'
  $body = @{ key = 'KAL_EL_SERVICE_TOKEN'; value = $deliveryToken; is_preview = $false } | ConvertTo-Json
  Invoke-RestMethod -Method Patch -Uri $appEnvs -Headers $headers -ContentType 'application/json' -Body $body | Out-Null

  Write-Host '4/4 Queueing a deployment of the portal'
  # The method differs between Coolify releases: 4.3.19 answers GET with 405.
  $deploy = $null
  foreach ($method in 'Post', 'Get') {
    try {
      $deploy = Invoke-RestMethod -Method $method -Uri "$api/deploy?uuid=$ApplicationUuid&force=false" -Headers $headers
      break
    }
    catch {
      if ($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq 405) { continue }
      throw
    }
  }
  if ($deploy) {
    foreach ($d in @($deploy.deployments)) { Write-Host "    $($d.message)" }
  }
  else {
    Write-Host '    Coolify refused both methods. The token is stored: deploy the portal from the panel.'
  }
  Write-Host 'Done. If a delivery token had been minted before, revoke the older one in the CMS.'
}
finally {
  foreach ($name in 'KALEL_ADMIN_PASSWORD', 'KAL_EL_WEBHOOK_SECRET', 'KALEL_ADMIN_EMAIL') {
    Remove-Item "Env:$name" -ErrorAction SilentlyContinue
  }
  Remove-Variable coolifyToken, headers, envs, webhook, output, tokenLine, deliveryToken, body -ErrorAction SilentlyContinue
}
