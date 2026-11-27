<#
.SYNOPSIS
  Troca os segredos do portal que vazaram na invasão de novembro de 2026. Nenhum valor
  aparece na tela, no histórico do PowerShell, no histórico da área de transferência ou em
  arquivo.

.DESCRIPTION
  O que o script faz, em ordem. Até o passo 7 o token, o webhook e a chave da Cinerie
  antigos continuam valendo, então o portal nunca fica sem credencial que funcione.

    1. Lê no Coolify, pela API, o que o portal usa hoje e os domínios dele.
    2. Gera aqui três valores novos: o segredo do webhook, o segredo de preview e a chave
       da Cinerie.
    3. Kal El (`pnpm kalel:rotate prepare --apply`): cria um token de entrega novo, com os
       mesmos escopos, e um webhook novo na mesma URL do antigo, assinado com o segredo
       novo. Se o token vazado não se chamar maquinanerd-portal…, para e pede confirmação.
    4. Cinerie (pule com -SemCinerie): você ACRESCENTA a chave nova à lista no Easypanel. O
       script confere que a Cinerie a aceita.
    5. Coolify: grava KAL_EL_SERVICE_TOKEN, SERVICE_BASE64_64_WEBHOOK,
       SERVICE_BASE64_64_PREVIEW e CINERIE_SERVICE_TOKEN, relê e confere os quatro.
    6. Publica o portal e espera o deploy terminar e o portal responder com o Kal El ok.
    7. Kal El (`pnpm kalel:rotate finish`): só revoga se o Coolify tiver o token novo E o
       portal no ar o tiver usado. Mostra o plano, pede que você digite REVOGAR, revoga o
       token vazado e apaga o webhook antigo. O token do MN-Prime não é tocado.
    8. Cinerie: você tira a chave vazada da lista. O script confere que ela não abre mais.

  Duas senhas são pedidas sem eco, nunca como argumento, porque argumento aparece na lista
  de processos: um token da API do Coolify que leia valores secretos, escreva e faça
  deploy, e a senha do dono do site no Kal El. As duas somem do ambiente quando o script
  termina. Os ids (que não são segredo) ficam em artifacts/rotacao-segredos.json, ignorado
  pelo git.

  Se algo falhar, a mensagem diz o que fazer. -SoFinalizar retoma do passo 6; -Recomecar
  começa de novo e leva para a próxima revogação os tokens criados na rodada abandonada.

  Rode na raiz do repositório, depois do `pnpm install`.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\rotacionar-segredos.ps1 -AdminEmail dono@exemplo.com
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)] [string] $AdminEmail,
  [string] $CoolifyUrl = 'https://vps.cinerie.com',
  [string] $ApplicationUuid = 'xys58xzntjzf3xd5ar5snoq5',
  [string] $PortalUrl = 'https://www.maquinanerd.com.br',
  [switch] $SemCinerie,
  [switch] $SoFinalizar,
  [switch] $Recomecar
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Set-Location (Join-Path $PSScriptRoot '..')
Add-Type -AssemblyName System.Windows.Forms

$api = "$($CoolifyUrl.TrimEnd('/'))/api/v1"
$appEnvs = "$api/applications/$ApplicationUuid/envs"
$stateFile = Join-Path (Get-Location) 'artifacts\rotacao-segredos.json'
$tokenPrefix = 'maquinanerd-portal'
$childEnv = 'KALEL_ADMIN_PASSWORD', 'NEW_WEBHOOK_SECRET', 'LEAKED_SERVICE_TOKEN', 'CURRENT_SERVICE_TOKEN',
  'KALEL_ADMIN_EMAIL', 'KAL_EL_BASE_URL', 'KAL_EL_SITE_ID', 'PORTAL_PUBLIC_URL', 'PORTAL_HOSTS', 'PORTAL_READY_URL',
  'KEEP_TOKEN_ID', 'KEEP_WEBHOOK_IDS', 'REVOKE_TOKEN_IDS', 'ALLOW_FOREIGN_REVOKE'
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

# Na área de transferência, mas fora do histórico do Windows (Win+V) e da sincronização na
# nuvem: os formatos abaixo pedem isso ao sistema e aos gerenciadores de área de transferência.
function Set-PrivateClipboard([string] $Value) {
  if ([Threading.Thread]::CurrentThread.GetApartmentState() -ne 'STA') {
    # Só o console em STA (o padrão do Windows PowerShell 5.1) fala com a área de transferência
    # do Windows Forms.
    Write-Host '    aviso: PowerShell fora de STA; a chave entra no histórico da área de transferência (Win+V).'
    Write-Host '    Depois de colar, apague-a do histórico.'
    Set-Clipboard -Value $Value
    return
  }
  $data = New-Object System.Windows.Forms.DataObject
  $data.SetData([System.Windows.Forms.DataFormats]::UnicodeText, $Value)
  foreach ($format in 'CanIncludeInClipboardHistory', 'CanUploadToCloudClipboard') {
    $data.SetData($format, (New-Object System.IO.MemoryStream (, [byte[]](0, 0, 0, 0))))
  }
  $data.SetData('ExcludeClipboardContentFromMonitorProcessing', (New-Object System.IO.MemoryStream (, [byte[]](0))))
  [System.Windows.Forms.Clipboard]::SetDataObject($data, $true)
}

function Clear-PrivateClipboard {
  if ([Threading.Thread]::CurrentThread.GetApartmentState() -eq 'STA') { [System.Windows.Forms.Clipboard]::Clear() }
  else { Set-Clipboard -Value ' ' }
}

function Get-EnvItem($envs, [string] $Key) {
  return $envs | Where-Object { $_.key -eq $Key -and -not $_.is_preview } | Select-Object -First 1
}

function Get-EnvValue($envs, [string] $Key) {
  $item = Get-EnvItem $envs $Key
  if ($item) { return [string]$item.value }
  return ''
}

# Reenvia as marcações que a variável já tem: um PATCH sem elas as zera no Coolify.
function Set-CoolifyEnv($envs, [string] $Key, [string] $Value) {
  $body = @{ key = $Key; value = $Value; is_preview = $false }
  $item = Get-EnvItem $envs $Key
  if ($item) {
    foreach ($flag in 'is_literal', 'is_multiline', 'is_shown_once', 'is_build_time') {
      if ($item.PSObject.Properties.Name -contains $flag -and $null -ne $item.$flag) { $body[$flag] = [bool]$item.$flag }
    }
  }
  Invoke-RestMethod -Method Patch -Uri $appEnvs -Headers $script:headers -ContentType 'application/json' -Body ($body | ConvertTo-Json) | Out-Null
  Write-Host "    $Key gravada"
}

function Get-CoolifyEnvs {
  # Atribuído antes de usar: o PowerShell 5.1 entrega o array da resposta como um objeto só.
  $envs = Invoke-RestMethod -Method Get -Uri $appEnvs -Headers $script:headers
  return , $envs
}

function Invoke-Rotate([string] $Phase, [switch] $Apply) {
  $previousEncoding = [Console]::OutputEncoding
  [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
  # Um comando nativo que escreve no stderr não pode virar erro fatal aqui.
  $ErrorActionPreference = 'Continue'
  $arguments = @('--silent', 'kalel:rotate', $Phase)
  if ($Apply) { $arguments += '--apply' }
  $lines = & pnpm @arguments 2>&1 | ForEach-Object { "$_" }
  $code = $LASTEXITCODE
  $ErrorActionPreference = 'Stop'
  [Console]::OutputEncoding = $previousEncoding
  $lines | Where-Object { $_ -notmatch '^KAL_EL_SERVICE_TOKEN=' } | ForEach-Object { Write-Host "    $_" }
  if ($code -ne 0) { throw "kalel:rotate $Phase falhou; as linhas acima dizem por quê." }
  return $lines
}

function Get-Line($lines, [string] $Name) {
  $line = $lines | Where-Object { $_ -match "^$Name=" } | Select-Object -First 1
  if (-not $line) { return '' }
  return $line.Substring($Name.Length + 1).Trim()
}

function Save-State($state) {
  New-Item -ItemType Directory -Force (Split-Path $stateFile) | Out-Null
  $state | ConvertTo-Json | Set-Content -LiteralPath $stateFile -Encoding utf8
}

# 401 = a Cinerie recusou a chave; 503 = nenhuma chave válida na lista. Qualquer outra resposta
# (400/422 para o corpo vazio) quer dizer que a autenticação passou.
function Test-CinerieKey([string] $Base, [string] $Key) {
  try {
    Invoke-RestMethod -Method Post -Uri "$Base/api/internal/editorial-context" -Headers @{ Authorization = "Bearer $Key" } `
      -ContentType 'application/json' -Body '{}' | Out-Null
    return $true
  }
  catch {
    $code = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 }
    if ($code -eq 0) { throw "Não consegui falar com a Cinerie: $($_.Exception.Message)" }
    return -not ($code -eq 401 -or $code -eq 503)
  }
}

# O portal pronto, lendo o corpo do 503 também: o que decide é o Kal El responder.
function Wait-PortalReady([string] $ReadyUrl) {
  $deadline = (Get-Date).AddMinutes(4)
  do {
    Start-Sleep -Seconds 10
    $kalel = ''
    try {
      $ready = Invoke-RestMethod -Method Get -Uri "$ReadyUrl&rotacao=$([DateTime]::UtcNow.Ticks)"
      $kalel = $ready.checks.kalel
    }
    catch {
      try { $kalel = ($_.ErrorDetails.Message | ConvertFrom-Json).checks.kalel } catch { $kalel = '' }
    }
  } while ($kalel -ne 'ok' -and (Get-Date) -lt $deadline)
  return $kalel -eq 'ok'
}

function Invoke-Finish($state, [string] $ReadyUrl, [string] $Hosts) {
  Write-Host '7/8 Kal El: conferindo que o portal no ar usa o token novo'
  $env:KEEP_TOKEN_ID = $state.newTokenId
  $env:KEEP_WEBHOOK_IDS = $state.newWebhookIds
  $env:REVOKE_TOKEN_IDS = (@($state.leakedTokenId) + @($state.staleTokenIds) | Where-Object { $_ }) -join ','
  $env:ALLOW_FOREIGN_REVOKE = if ($state.allowForeign) { '1' } else { '' }
  $env:CURRENT_SERVICE_TOKEN = Get-EnvValue (Get-CoolifyEnvs) 'KAL_EL_SERVICE_TOKEN'
  $env:PORTAL_HOSTS = $Hosts
  $env:PORTAL_READY_URL = $ReadyUrl
  # Primeiro só confere e mostra o plano; só revoga depois da confirmação digitada.
  [void](Invoke-Rotate 'finish')
  $answer = Read-Host '    Digite REVOGAR para aplicar o plano acima (qualquer outra coisa cancela)'
  if ($answer -cne 'REVOGAR') { throw 'Cancelado. Nada foi revogado; rode com -SoFinalizar quando quiser.' }
  [void](Invoke-Rotate 'finish' -Apply)
}

try {
  $coolifyToken = Read-Secret 'Token da API do Coolify (ler segredos, escrever, deploy)'
  $script:headers = @{ Authorization = "Bearer $coolifyToken"; Accept = 'application/json' }

  Write-Host '1/8 Lendo no Coolify o que o portal usa hoje'
  $envs = Get-CoolifyEnvs
  $app = Invoke-RestMethod -Method Get -Uri "$api/applications/$ApplicationUuid" -Headers $script:headers
  $domains = @()
  foreach ($service in ($app.docker_compose_domains | ConvertFrom-Json).PSObject.Properties) {
    $domains += ([string]$service.Value.domain).Split(',') | Where-Object { $_ } | ForEach-Object { ([Uri]$_.Trim()).Host }
  }
  $domains = @($domains + ([Uri]$PortalUrl).Host | Select-Object -Unique)
  $origin = $domains | Where-Object { $_ -like '*.sslip.io' } | Select-Object -First 1
  # Pela origem quando há: o Cloudflare não entra no caminho da conferência.
  $readyBase = if ($origin) { "https://$origin" } else { $PortalUrl.TrimEnd('/') }
  $readyUrl = "$readyBase/api/health?ready=1"
  $hosts = $domains -join ','
  Write-Host "    domínios do portal: $hosts"

  $kalelBase = (Get-EnvValue $envs 'KAL_EL_BASE_URL').TrimEnd('/')
  $siteId = Get-EnvValue $envs 'KAL_EL_SITE_ID'
  if (-not $kalelBase -or -not $siteId) {
    throw 'KAL_EL_BASE_URL ou KAL_EL_SITE_ID não veio do Coolify (o token lê valores secretos?).'
  }
  $cinerieBase = (Get-EnvValue $envs 'CINERIE_INTERNAL_URL').TrimEnd('/')
  if (-not $cinerieBase) { $cinerieBase = 'https://cinerie.com' }
  $env:KAL_EL_BASE_URL = $kalelBase
  $env:KAL_EL_SITE_ID = $siteId
  $env:KALEL_ADMIN_EMAIL = $AdminEmail
  $env:KALEL_ADMIN_PASSWORD = Read-Secret 'Senha do dono do site no Kal El'

  $previous = $null
  if (Test-Path $stateFile) { $previous = Get-Content $stateFile -Raw | ConvertFrom-Json }

  if ($SoFinalizar) {
    if (-not $previous -or $previous.finished) { throw "Não há troca em andamento em $stateFile." }
    if (-not (Wait-PortalReady $readyUrl)) { throw 'O portal não respondeu com o Kal El ok. Confira o deploy antes de finalizar.' }
    Invoke-Finish $previous $readyUrl $hosts
    $previous.finished = $true
    Save-State $previous
    Write-Host '8/8 Cinerie: se a chave antiga do portal ainda está na lista do Easypanel, tire-a agora.'
    Write-Host "    (é a que começa com `"$($previous.cinerieOldPrefix)`"), mantendo a do MN-Prime; Salvar > Implantar."
    Write-Host 'Pronto. Falta o que está em docs/migration/RUNBOOK-INCIDENTE-2026-11.md, a partir do passo 4.'
    return
  }
  if ($previous -and -not $previous.finished -and -not $Recomecar) {
    throw "Há uma troca em andamento ($stateFile). Rode com -SoFinalizar se o deploy com os valores novos foi ao ar, ou com -Recomecar para começar de novo."
  }

  $leaked = Get-EnvValue $envs 'KAL_EL_SERVICE_TOKEN'
  $oldCinerie = Get-EnvValue $envs 'CINERIE_SERVICE_TOKEN'
  if (-not $leaked) { throw 'KAL_EL_SERVICE_TOKEN não veio do Coolify.' }

  Write-Host '2/8 Gerando os valores novos (ficam só na memória deste script)'
  $webhookSecret = New-Alphanumeric 64
  $previewSecret = New-Alphanumeric 64
  $cinerieKey = New-Base64Url

  Write-Host '3/8 Kal El: criando token de entrega e webhook novos (os antigos seguem valendo)'
  $env:NEW_WEBHOOK_SECRET = $webhookSecret
  $env:LEAKED_SERVICE_TOKEN = $leaked
  $env:PORTAL_PUBLIC_URL = $PortalUrl
  $env:PORTAL_HOSTS = $hosts
  $lines = Invoke-Rotate 'prepare' -Apply
  $newToken = Get-Line $lines 'KAL_EL_SERVICE_TOKEN'
  $leakedId = Get-Line $lines 'LEAKED_TOKEN_ID'
  $leakedName = Get-Line $lines 'LEAKED_TOKEN_NAME'
  $state = [pscustomobject]@{
    at = (Get-Date).ToUniversalTime().ToString('o')
    newTokenId = Get-Line $lines 'NEW_TOKEN_ID'
    newWebhookIds = Get-Line $lines 'NEW_WEBHOOK_IDS'
    leakedTokenId = $leakedId
    leakedTokenName = $leakedName
    allowForeign = $false
    staleTokenIds = @()
    cinerieOldPrefix = if ($oldCinerie.Length -ge 4) { $oldCinerie.Substring(0, 4) } else { '' }
    finished = $false
  }
  if ($previous -and $Recomecar) {
    # A rodada abandonada: o token vazado de verdade é o que ela anotou; o que ela criou (e
    # o que hoje está no Coolify, se ela chegou a gravar) entra na próxima revogação.
    if ($previous.leakedTokenId) {
      $state.leakedTokenId = $previous.leakedTokenId
      $state.leakedTokenName = $previous.leakedTokenName
      $state.allowForeign = [bool]$previous.allowForeign
    }
    $state.staleTokenIds = @(@($previous.staleTokenIds) + @($previous.newTokenId, $leakedId) |
      Where-Object { $_ -and $_ -ne $state.leakedTokenId -and $_ -ne $state.newTokenId } | Select-Object -Unique)
    if ($previous.cinerieOldPrefix) { $state.cinerieOldPrefix = $previous.cinerieOldPrefix }
  }
  if (-not $newToken -or -not $state.newTokenId -or -not $state.newWebhookIds) {
    throw 'O Kal El não devolveu o token ou o webhook novo.'
  }
  if ($state.leakedTokenName -and -not $state.leakedTokenName.StartsWith($tokenPrefix)) {
    Write-Host "    O token vazado se chama `"$($state.leakedTokenName)`". Se o MN-Prime publica com ele, crie antes um"
    Write-Host '    token novo para o MN-Prime (painel /sites > trocar token), senão ele para de publicar na revogação.'
    $confirm = Read-Host "    Digite o nome do token para revogá-lo mesmo assim (ou Enter para não revogar)"
    $state.allowForeign = ($confirm -ceq $state.leakedTokenName)
  }
  Save-State $state

  if (-not $SemCinerie) {
    Write-Host '4/8 Cinerie: acrescentar a chave nova no Easypanel (a antiga sai no passo 8)'
    Set-PrivateClipboard $cinerieKey
    $usedClipboard = $true
    Write-Host '    A chave nova está na área de transferência (fora do histórico do Windows). No Easypanel:'
    Write-Host '      rss_prime > screen-app > Ambiente > CINERIE_EDITORIAL_CONTEXT_API_KEYS'
    Write-Host '      ACRESCENTE no fim da lista uma vírgula e a chave (Ctrl+V), sem apagar nada. Salvar > Implantar.'
    do {
      Read-Host '    Quando o screen-app voltar, aperte Enter aqui' | Out-Null
      $accepted = Test-CinerieKey $cinerieBase $cinerieKey
      if (-not $accepted) { Write-Host '    A Cinerie ainda recusa a chave nova. Confira o Ambiente e o Implantar.' }
    } until ($accepted)
    Write-Host '    conferido: a Cinerie aceita a chave nova'
    Clear-PrivateClipboard
    $usedClipboard = $false
  }

  Write-Host '5/8 Coolify: gravando os valores novos'
  $written = @{
    KAL_EL_SERVICE_TOKEN = $newToken
    SERVICE_BASE64_64_WEBHOOK = $webhookSecret
    SERVICE_BASE64_64_PREVIEW = $previewSecret
  }
  if (-not $SemCinerie) { $written.CINERIE_SERVICE_TOKEN = $cinerieKey }
  try {
    foreach ($key in $written.Keys) { Set-CoolifyEnv $envs $key $written[$key] }
    $reread = Get-CoolifyEnvs
    foreach ($key in $written.Keys) {
      if ((Get-EnvValue $reread $key) -cne $written[$key]) { throw "o Coolify não guardou $key" }
    }
    Write-Host '    conferido: o Coolify guardou os quatro valores'
  }
  catch {
    throw "Falha ao gravar no Coolify ($($_.Exception.Message)). O portal no ar segue com os valores antigos, que ainda valem; NÃO rode -SoFinalizar. Corrija (o token do Coolify escreve?) e rode com -Recomecar."
  }

  Write-Host '6/8 Publicando o portal'
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
    throw "O deploy terminou como '$status'. O portal segue com o container anterior e os valores antigos ainda valem. Veja o log no painel, publique de novo e rode com -SoFinalizar."
  }
  if (-not (Wait-PortalReady $readyUrl)) {
    throw 'O portal não respondeu com o Kal El ok depois do deploy. Nada foi revogado; confira o portal e rode com -SoFinalizar.'
  }
  Write-Host '    portal no ar, com o Kal El respondendo'

  Invoke-Finish $state $readyUrl $hosts
  try {
    Invoke-RestMethod -Method Get -Uri "$kalelBase/v1/auth/me" -Headers @{ Authorization = "Bearer $leaked" } | Out-Null
    Write-Host '    ATENÇÃO: o token vazado ainda autentica. Revogue-o no CMS, em Tokens.'
  }
  catch {
    $code = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 }
    if ($code -eq 401 -or $code -eq 403) { Write-Host "    conferido: o token vazado não autentica mais (HTTP $code)" }
    else { Write-Host "    não consegui conferir o token vazado ($($_.Exception.Message)); veja em Tokens no CMS" }
  }
  $state.finished = $true
  Save-State $state

  if (-not $SemCinerie -and $oldCinerie) {
    Write-Host '8/8 Cinerie: tirar a chave vazada do portal'
    Write-Host "    No mesmo Ambiente do Easypanel, apague da lista a entrada que começa com `"$($state.cinerieOldPrefix)`""
    Write-Host '    (e a vírgula), mantendo a nova e a do MN-Prime. Salvar > Implantar.'
    do {
      Read-Host '    Quando o screen-app voltar, aperte Enter aqui' | Out-Null
      $stillOpen = Test-CinerieKey $cinerieBase $oldCinerie
      if ($stillOpen) { Write-Host '    A chave vazada ainda abre a rota. Confira a lista e o Implantar.' }
    } while ($stillOpen)
    Write-Host '    conferido: a chave vazada não abre mais a rota da Cinerie'
  }
  Write-Host 'Pronto. Falta o que está em docs/migration/RUNBOOK-INCIDENTE-2026-11.md, a partir do passo 4.'
}
finally {
  if ($usedClipboard) { Clear-PrivateClipboard }
  foreach ($name in $childEnv) { Remove-Item "Env:$name" -ErrorAction SilentlyContinue }
  Remove-Variable coolifyToken, envs, reread, leaked, oldCinerie, webhookSecret, previewSecret, cinerieKey, newToken, lines, written -ErrorAction SilentlyContinue
  $script:headers = $null
}
