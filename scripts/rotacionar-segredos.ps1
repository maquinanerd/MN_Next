<#
.SYNOPSIS
  Troca os segredos do portal que vazaram na invasão de novembro de 2026. Nenhum valor
  aparece na tela, no histórico do PowerShell ou em arquivo.

.DESCRIPTION
  O que o script faz, em ordem. Até o passo 6, o token e o webhook antigos continuam
  valendo, então o portal nunca fica sem credencial que funcione.

    1. Lê no Coolify, pela API, o que o portal usa hoje: o endereço e o site do Kal El,
       o token vazado (só para descobrir o id dele) e a chave da Cinerie.
    2. Gera aqui três valores novos: o segredo do webhook, o segredo de preview e a chave
       da Cinerie.
    3. Kal El (`pnpm kalel:rotate prepare --apply`): cria um token de entrega novo, com os
       mesmos escopos, e um webhook novo na mesma URL, assinado com o segredo novo.
    4. Cinerie (pule com -SemCinerie): põe a chave nova na área de transferência e espera
       você colá-la no Easypanel, no lugar da chave vazada do portal.
    5. Coolify: grava KAL_EL_SERVICE_TOKEN, SERVICE_BASE64_64_WEBHOOK,
       SERVICE_BASE64_64_PREVIEW e CINERIE_SERVICE_TOKEN, faz o deploy e espera o portal
       responder `/api/health?ready=1` com o Kal El ok.
    6. Kal El (`pnpm kalel:rotate finish --apply`): revoga o token vazado e os outros
       `maquinanerd-portal…`, apaga o webhook antigo e confere que o token vazado não
       autentica mais. O token do MN-Prime (`mn-prime-publicacao`) não é tocado.

  Duas senhas são pedidas sem eco, nunca como argumento, porque argumento aparece na lista
  de processos: um token da API do Coolify que leia valores secretos, escreva e faça
  deploy, e a senha do dono do site no Kal El. As duas somem do ambiente quando o script
  termina. Os ids (que não são segredo) ficam em artifacts/rotacao-segredos.json, ignorado
  pelo git, para o -SoFinalizar.

  Se o deploy falhar, o script para antes do passo 6. Os valores novos já estão no
  Coolify, e os antigos continuam valendo no Kal El. Depois de publicar pelo painel, rode
  de novo com -SoFinalizar.

  Rode na raiz do repositório, depois do `pnpm install`.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\rotacionar-segredos.ps1 -AdminEmail dono@exemplo.com

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\rotacionar-segredos.ps1 -AdminEmail dono@exemplo.com -SoFinalizar
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)] [string] $AdminEmail,
  [string] $CoolifyUrl = 'https://vps.cinerie.com',
  [string] $ApplicationUuid = 'xys58xzntjzf3xd5ar5snoq5',
  [string] $PortalUrl = 'https://www.maquinanerd.com.br',
  [switch] $SemCinerie,
  [switch] $SoFinalizar
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Set-Location (Join-Path $PSScriptRoot '..')

$api = "$($CoolifyUrl.TrimEnd('/'))/api/v1"
$appEnvs = "$api/applications/$ApplicationUuid/envs"
$stateFile = Join-Path (Get-Location) 'artifacts\rotacao-segredos.json'
$secretEnv = 'KALEL_ADMIN_PASSWORD', 'NEW_WEBHOOK_SECRET', 'LEAKED_SERVICE_TOKEN', 'KALEL_ADMIN_EMAIL',
  'KAL_EL_BASE_URL', 'KAL_EL_SITE_ID', 'PORTAL_PUBLIC_URL', 'KEEP_TOKEN_ID', 'KEEP_WEBHOOK_IDS', 'REVOKE_TOKEN_IDS'
$usedClipboard = $false

function Read-Secret([string] $Prompt) {
  $secure = Read-Host $Prompt -AsSecureString
  return [System.Net.NetworkCredential]::new('', $secure).Password
}

# Sem viés de módulo: só os bytes abaixo de 248 (62 x 4) viram caractere.
function New-Alphanumeric([int] $Length) {
  $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  $out = New-Object System.Text.StringBuilder
  $buffer = New-Object byte[] 1
  while ($out.Length -lt $Length) {
    $rng.GetBytes($buffer)
    if ($buffer[0] -lt 248) { [void]$out.Append($alphabet[$buffer[0] % 62]) }
  }
  $rng.Dispose()
  return $out.ToString()
}

# O mesmo formato de docs/operations/editorial-context.md da Cinerie: 32 bytes em base64url.
function New-Base64Url {
  $bytes = New-Object byte[] 32
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  $rng.GetBytes($bytes)
  $rng.Dispose()
  return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function Get-EnvValue($envs, [string] $Key) {
  $item = $envs | Where-Object { $_.key -eq $Key -and -not $_.is_preview } | Select-Object -First 1
  if ($item) { return [string]$item.value }
  return ''
}

function Set-CoolifyEnv([string] $Key, [string] $Value) {
  $body = @{ key = $Key; value = $Value; is_preview = $false } | ConvertTo-Json
  Invoke-RestMethod -Method Patch -Uri $appEnvs -Headers $script:headers -ContentType 'application/json' -Body $body | Out-Null
  Write-Host "    $Key gravada"
}

function Invoke-Rotate([string] $Phase) {
  # Um comando nativo que escreve no stderr não pode virar erro fatal aqui.
  $ErrorActionPreference = 'Continue'
  $lines = & pnpm --silent kalel:rotate $Phase --apply 2>&1 | ForEach-Object { "$_" }
  $code = $LASTEXITCODE
  $ErrorActionPreference = 'Stop'
  $lines | Where-Object { $_ -notmatch '^KAL_EL_SERVICE_TOKEN=' } | ForEach-Object { Write-Host "    $_" }
  if ($code -ne 0) { throw "kalel:rotate $Phase falhou; as linhas acima dizem por quê." }
  return $lines
}

function Get-Line($lines, [string] $Name) {
  $line = $lines | Where-Object { $_ -match "^$Name=" } | Select-Object -First 1
  if (-not $line) { return '' }
  return $line.Substring($Name.Length + 1).Trim()
}

function Invoke-Finish($state) {
  Write-Host '6/6 Kal El: revogando o token vazado e apagando o webhook antigo'
  $env:KEEP_TOKEN_ID = $state.newTokenId
  $env:KEEP_WEBHOOK_IDS = $state.newWebhookIds
  $env:REVOKE_TOKEN_IDS = $state.leakedTokenId
  [void](Invoke-Rotate 'finish')
}

try {
  $coolifyToken = Read-Secret 'Token da API do Coolify (ler segredos, escrever, deploy)'
  $script:headers = @{ Authorization = "Bearer $coolifyToken"; Accept = 'application/json' }
  $envs = Invoke-RestMethod -Method Get -Uri $appEnvs -Headers $script:headers
  $kalelBase = (Get-EnvValue $envs 'KAL_EL_BASE_URL').TrimEnd('/')
  $siteId = Get-EnvValue $envs 'KAL_EL_SITE_ID'
  if (-not $kalelBase -or -not $siteId) {
    throw 'KAL_EL_BASE_URL ou KAL_EL_SITE_ID não veio do Coolify (o token lê valores secretos?).'
  }
  $env:KAL_EL_BASE_URL = $kalelBase
  $env:KAL_EL_SITE_ID = $siteId
  $env:KALEL_ADMIN_EMAIL = $AdminEmail
  $env:KALEL_ADMIN_PASSWORD = Read-Secret 'Senha do dono do site no Kal El'

  if ($SoFinalizar) {
    if (-not (Test-Path $stateFile)) { throw "Não achei $stateFile; rode sem -SoFinalizar." }
    Invoke-Finish (Get-Content $stateFile -Raw | ConvertFrom-Json)
    Write-Host 'Pronto.'
    return
  }

  Write-Host '1/6 Lendo no Coolify o que o portal usa hoje'
  $leaked = Get-EnvValue $envs 'KAL_EL_SERVICE_TOKEN'
  $oldCinerie = Get-EnvValue $envs 'CINERIE_SERVICE_TOKEN'
  if (-not $leaked) { throw 'KAL_EL_SERVICE_TOKEN não veio do Coolify.' }

  Write-Host '2/6 Gerando os valores novos (ficam só na memória deste script)'
  $webhookSecret = New-Alphanumeric 64
  $previewSecret = New-Alphanumeric 64
  $cinerieKey = New-Base64Url

  Write-Host '3/6 Kal El: criando token de entrega e webhook novos (os antigos seguem valendo)'
  $env:NEW_WEBHOOK_SECRET = $webhookSecret
  $env:LEAKED_SERVICE_TOKEN = $leaked
  $env:PORTAL_PUBLIC_URL = $PortalUrl
  $lines = Invoke-Rotate 'prepare'
  $newToken = Get-Line $lines 'KAL_EL_SERVICE_TOKEN'
  $state = [pscustomobject]@{
    at = (Get-Date).ToUniversalTime().ToString('o')
    newTokenId = Get-Line $lines 'NEW_TOKEN_ID'
    newWebhookIds = Get-Line $lines 'NEW_WEBHOOK_IDS'
    leakedTokenId = Get-Line $lines 'LEAKED_TOKEN_ID'
  }
  if (-not $newToken -or -not $state.newTokenId -or -not $state.newWebhookIds) {
    throw 'O Kal El não devolveu o token ou o webhook novo.'
  }
  New-Item -ItemType Directory -Force (Split-Path $stateFile) | Out-Null
  $state | ConvertTo-Json | Set-Content -LiteralPath $stateFile -Encoding utf8

  if (-not $SemCinerie) {
    Write-Host '4/6 Cinerie: trocar a chave do portal no Easypanel'
    Set-Clipboard -Value $cinerieKey
    $usedClipboard = $true
    $prefix = if ($oldCinerie.Length -ge 4) { $oldCinerie.Substring(0, 4) } else { '(sem chave hoje)' }
    Write-Host '    A chave nova está na área de transferência. No Easypanel:'
    Write-Host '      rss_prime > screen-app > Ambiente > CINERIE_EDITORIAL_CONTEXT_API_KEYS'
    Write-Host "      troque a entrada que começa com `"$prefix`" pela área de transferência (Ctrl+V),"
    Write-Host '      mantendo as outras (a do MN-Prime), separadas por vírgula. Salvar > Implantar.'
    Read-Host '    Quando o screen-app voltar, aperte Enter aqui' | Out-Null
    Set-Clipboard -Value ' '
    $usedClipboard = $false
  }

  Write-Host '5/6 Coolify: gravando os valores novos e publicando o portal'
  Set-CoolifyEnv 'KAL_EL_SERVICE_TOKEN' $newToken
  Set-CoolifyEnv 'SERVICE_BASE64_64_WEBHOOK' $webhookSecret
  Set-CoolifyEnv 'SERVICE_BASE64_64_PREVIEW' $previewSecret
  if (-not $SemCinerie) { Set-CoolifyEnv 'CINERIE_SERVICE_TOKEN' $cinerieKey }

  # O método muda entre versões do Coolify: a 4.3.19 responde 405 ao GET.
  $deploy = $null
  foreach ($method in 'Post', 'Get') {
    try {
      $deploy = Invoke-RestMethod -Method $method -Uri "$api/deploy?uuid=$ApplicationUuid&force=false" -Headers $script:headers
      break
    }
    catch {
      if ($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq 405) { continue }
      throw
    }
  }
  $deploymentUuid = @($deploy.deployments)[0].deployment_uuid
  if (-not $deploymentUuid) { throw 'O Coolify não devolveu o id do deploy. Publique pelo painel e rode com -SoFinalizar.' }
  Write-Host "    deploy $deploymentUuid na fila"
  $deadline = (Get-Date).AddMinutes(25)
  do {
    Start-Sleep -Seconds 15
    $status = (Invoke-RestMethod -Method Get -Uri "$api/deployments/$deploymentUuid" -Headers $script:headers).status
    Write-Host "    $status"
  } while ((@('queued', 'in_progress') -contains $status) -and ((Get-Date) -lt $deadline))
  if ($status -ne 'finished') {
    throw "O deploy terminou como '$status'. O token e o webhook antigos seguem valendo; publique pelo painel e rode com -SoFinalizar."
  }

  $ready = $null
  $deadline = (Get-Date).AddMinutes(3)
  do {
    Start-Sleep -Seconds 10
    try {
      $ready = Invoke-RestMethod -Method Get -Uri "$($PortalUrl.TrimEnd('/'))/api/health?ready=1&rotacao=$([DateTime]::UtcNow.Ticks)"
    }
    catch { $ready = $null }
    # 503 (degradado) lança e cai no catch: só um 200 com o Kal El ok passa.
    $ok = $ready -and $ready.status -eq 'ok' -and $ready.checks.kalel -eq 'ok' -and $ready.checks.contract -eq 'ok'
  } while (-not $ok -and (Get-Date) -lt $deadline)
  if (-not $ok) {
    throw 'O portal não respondeu kalel ok / contract ok com o token novo. Nada foi revogado; confira o portal e rode com -SoFinalizar.'
  }
  Write-Host '    portal pronto com o token novo (kalel ok, contract ok)'

  Invoke-Finish $state

  try {
    Invoke-RestMethod -Method Get -Uri "$kalelBase/v1/auth/me" -Headers @{ Authorization = "Bearer $leaked" } | Out-Null
    Write-Host '    ATENÇÃO: o token vazado ainda autentica. Revogue-o no CMS, em Tokens.'
  }
  catch {
    $code = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 }
    if ($code -eq 401 -or $code -eq 403) { Write-Host "    conferido: o token vazado não autentica mais (HTTP $code)" }
    else { Write-Host "    não consegui conferir o token vazado ($($_.Exception.Message)); veja em Tokens no CMS" }
  }
  Write-Host 'Pronto. Falta o que está em docs/migration/RUNBOOK-INCIDENTE-2026-11.md, a partir do passo 5.'
}
finally {
  if ($usedClipboard) { Set-Clipboard -Value ' ' }
  foreach ($name in $secretEnv) { Remove-Item "Env:$name" -ErrorAction SilentlyContinue }
  Remove-Variable coolifyToken, envs, leaked, oldCinerie, webhookSecret, previewSecret, cinerieKey, newToken, lines, ready -ErrorAction SilentlyContinue
  $script:headers = $null
}
