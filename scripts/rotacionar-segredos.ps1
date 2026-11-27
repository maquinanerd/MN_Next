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
       novo. Um token a revogar que não se chame maquinanerd-portal… exige o nome digitado.
    4. Cinerie (pule com -SemCinerie): você ACRESCENTA a chave nova à lista no Easypanel. O
       script confere que a Cinerie a aceita.
    5. Coolify: grava KAL_EL_SERVICE_TOKEN, SERVICE_BASE64_64_WEBHOOK,
       SERVICE_BASE64_64_PREVIEW e CINERIE_SERVICE_TOKEN, relê e confere.
    6. Publica o portal e espera o deploy terminar e o portal responder com o Kal El ok.
    7. Kal El (`pnpm kalel:rotate finish`): com nenhum deploy do portal em andamento, só
       revoga se o Coolify tiver o token novo E o portal no ar o tiver usado. Mostra o plano,
       pede que você digite REVOGAR, revoga o token vazado e apaga o webhook antigo.
    8. Cinerie: você tira da lista a chave vazada. O script confere que ela não abre mais.

  Duas senhas são pedidas sem eco, nunca como argumento, porque argumento aparece na lista
  de processos: um token da API do Coolify que leia valores secretos, escreva e faça
  deploy, e a senha do dono do site no Kal El. As duas somem do ambiente quando o script
  termina. Os ids e prefixos de 4 caracteres (que não são segredo) ficam em
  artifacts/rotacao-segredos.json, ignorado pelo git.

  Se algo falhar, a mensagem diz o que fazer: -SoFinalizar retoma do passo 7; -Recomecar
  começa de novo e leva para a revogação o que a rodada abandonada criou.

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
  # Só quando o Coolify não informa os domínios do portal: www, apex e a origem sslip.io.
  [string[]] $PortalHosts = @(),
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
  'KEEP_TOKEN_ID', 'KEEP_WEBHOOK_IDS', 'REVOKE_TOKEN_IDS', 'ALLOW_FOREIGN_REVOKE_IDS'
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

function Get-StatusCode($err) {
  if ($err.Exception.Response) { return [int]$err.Exception.Response.StatusCode }
  return 0
}

# O corpo de uma resposta de erro. O Windows PowerShell 5.1 só o põe em ErrorDetails quando a
# resposta traz Content-Length; as rotas do Next respondem em chunks, então lê-se o stream.
function Get-ErrorBody($err) {
  if ($err.ErrorDetails -and $err.ErrorDetails.Message) { return [string]$err.ErrorDetails.Message }
  $response = $err.Exception.Response
  if (-not $response) { return '' }
  try {
    $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
    $text = $reader.ReadToEnd()
    $reader.Dispose()
    return $text
  }
  catch { return '' }
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

# Durante um build, o builder lê o Kal El com o token novo do Coolify enquanto o container
# antigo ainda serve com o vazado: a conferência do finish não provaria nada.
function Assert-NoDeployInProgress {
  try { $running = Invoke-RestMethod -Method Get -Uri "$api/deployments" -Headers $script:headers }
  catch { throw "Não consegui conferir no Coolify se há deploy do portal em andamento ($($_.Exception.Message)). Nada foi revogado." }
  $items = @()
  if ($null -ne $running) {
    if ($running -isnot [array] -and $running.PSObject.Properties.Name -contains 'deployments') { $items = @($running.deployments) }
    else { $items = @($running) }
  }
  $mine = @($items | Where-Object {
      $_ -and (@('queued', 'in_progress') -contains [string]$_.status) -and
      (([string]$_.deployment_url) -like "*/application/$ApplicationUuid/*" -or [string]$_.application_name -eq $script:appName)
    })
  if ($mine.Count -gt 0) {
    throw "Há um deploy do portal em andamento ($($mine[0].deployment_uuid)). Espere terminar e rode com -SoFinalizar. Nada foi revogado."
  }
}

function Invoke-Rotate([string] $Phase, [switch] $Apply) {
  $previousEncoding = [Console]::OutputEncoding
  [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
  # Um comando nativo que escreve no stderr não pode virar erro fatal aqui.
  $ErrorActionPreference = 'Continue'
  $arguments = @('--silent', 'kalel:rotate', $Phase)
  if ($Apply) { $arguments += '--apply' }
  $lines = @(& pnpm @arguments 2>&1 | ForEach-Object { "$_" })
  $code = $LASTEXITCODE
  $ErrorActionPreference = 'Stop'
  [Console]::OutputEncoding = $previousEncoding
  $lines | Where-Object { $_ -notmatch '^KAL_EL_SERVICE_TOKEN=' } | ForEach-Object { Write-Host "    $_" }
  # As linhas voltam mesmo na falha: o prepare pode ter criado um token antes de falhar.
  return [pscustomobject]@{ lines = $lines; code = $code }
}

function Get-Line($lines, [string] $Name) {
  $line = $lines | Where-Object { $_ -match "^$Name=" } | Select-Object -First 1
  if (-not $line) { return '' }
  return $line.Substring($Name.Length + 1).Trim()
}

function Split-Ids([string] $Value) {
  return @(($Value -split ',') | ForEach-Object { $_.Trim() } | Where-Object { $_ })
}

function Save-State($state) {
  New-Item -ItemType Directory -Force (Split-Path $stateFile) | Out-Null
  $state | ConvertTo-Json | Set-Content -LiteralPath $stateFile -Encoding utf8
}

# 'aceita' (a autenticação passou: 200, 400/413/422 para o corpo vazio, 429), 'recusada' (401,
# ou 503 context_disabled: nenhuma chave válida) ou 'indefinida' (WAF, rota, reinício do app).
function Test-CinerieKey([string] $Base, [string] $Key) {
  try {
    Invoke-RestMethod -Method Post -Uri "$Base/api/internal/editorial-context" -Headers @{ Authorization = "Bearer $Key" } `
      -ContentType 'application/json' -Body '{}' | Out-Null
    return 'aceita'
  }
  catch {
    $code = Get-StatusCode $_
    if (@(400, 413, 422, 429) -contains $code) { return 'aceita' }
    if ($code -eq 401) { return 'recusada' }
    if ($code -eq 503 -and (Get-ErrorBody $_) -match 'context_disabled') { return 'recusada' }
    return "indefinida (HTTP $code)"
  }
}

# Repete a conferência até a Cinerie responder o esperado, ou até você digitar PULAR.
function Wait-CinerieKey([string] $Base, [string] $Key, [string] $Expected, [string] $WrongMessage) {
  while ($true) {
    $answer = Read-Host '    Quando o screen-app voltar, aperte Enter aqui'
    if ($answer -ceq 'PULAR') { Write-Host '    pulado: confira depois, à mão.'; return $false }
    $result = Test-CinerieKey $Base $Key
    if ($result -eq $Expected) { return $true }
    if ($result -like 'indefinida*') { Write-Host "    Não consegui conferir: $result. Enter tenta de novo; PULAR segue sem conferir." }
    else { Write-Host "    $WrongMessage Enter tenta de novo; PULAR segue sem conferir." }
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
      $body = Get-ErrorBody $_
      if ($body) { try { $kalel = ($body | ConvertFrom-Json).checks.kalel } catch { $kalel = '' } }
    }
  } while ($kalel -ne 'ok' -and (Get-Date) -lt $deadline)
  return $kalel -eq 'ok'
}

function Invoke-Finish($state, [string] $ReadyUrl, [string] $Hosts) {
  Write-Host '7/8 Kal El: conferindo que o portal no ar usa o token novo'
  $env:KEEP_TOKEN_ID = $state.newTokenId
  $env:KEEP_WEBHOOK_IDS = $state.newWebhookIds
  $env:REVOKE_TOKEN_IDS = (@($state.revokeTokenIds) | Where-Object { $_ }) -join ','
  $env:ALLOW_FOREIGN_REVOKE_IDS = (@($state.allowForeignIds) | Where-Object { $_ }) -join ','
  $env:PORTAL_HOSTS = $Hosts
  $env:PORTAL_READY_URL = $ReadyUrl
  # Primeiro só confere e mostra o plano; só revoga depois da confirmação digitada. A trava do
  # deploy em andamento vale antes de cada uma das duas passadas.
  Assert-NoDeployInProgress
  $env:CURRENT_SERVICE_TOKEN = Get-EnvValue (Get-CoolifyEnvs) 'KAL_EL_SERVICE_TOKEN'
  $plan = Invoke-Rotate 'finish'
  if ($plan.code -ne 0) { throw 'O finish recusou (as linhas acima dizem por quê). Nada foi revogado.' }
  $answer = Read-Host '    Digite REVOGAR para aplicar o plano acima (qualquer outra coisa cancela)'
  if ($answer -cne 'REVOGAR') { throw 'Cancelado. Nada foi revogado; rode com -SoFinalizar quando quiser.' }
  Assert-NoDeployInProgress
  $env:CURRENT_SERVICE_TOKEN = Get-EnvValue (Get-CoolifyEnvs) 'KAL_EL_SERVICE_TOKEN'
  $done = Invoke-Rotate 'finish' -Apply
  if ($done.code -ne 0) { throw 'O finish falhou no meio (as linhas acima dizem onde). Rode com -SoFinalizar.' }
  $stillActive = Split-Ids (Get-Line $done.lines 'STILL_ACTIVE_IDS')
  if ($stillActive.Count -gt 0) {
    Write-Host "    ATENÇÃO: seguem ativos, sem confirmação para revogar: $($stillActive -join ', '). Revogue no CMS, em Tokens,"
    Write-Host '    depois de dar ao dono desse token (MN-Prime?) um token novo.'
  }
  else { Write-Host '    conferido no Kal El: todos os tokens a revogar estão revogados' }
}

function Show-CinerieRemoval($state, [string] $CurrentNewPrefix) {
  $prefixes = @(@($state.cinerieLeakedPrefix) + @($state.cinerieAddedPrefixes) |
    Where-Object { $_ -and $_ -ne $CurrentNewPrefix } | Select-Object -Unique)
  if ($prefixes.Count -eq 0) { return $false }
  Write-Host '8/8 Cinerie: tirar da lista a chave vazada (e as de rodadas abandonadas)'
  Write-Host '    No Easypanel, em rss_prime > screen-app > Ambiente > CINERIE_EDITORIAL_CONTEXT_API_KEYS,'
  Write-Host "    apague as entradas que começam com: $($prefixes -join ', ')"
  Write-Host '    (e a vírgula de cada uma), mantendo a nova e a do MN-Prime. Salvar > Implantar.'
  return $true
}

try {
  $coolifyToken = Read-Secret 'Token da API do Coolify (ler segredos, escrever, deploy)'
  $script:headers = @{ Authorization = "Bearer $coolifyToken"; Accept = 'application/json' }

  Write-Host '1/8 Lendo no Coolify o que o portal usa hoje'
  $envs = Get-CoolifyEnvs
  $app = Invoke-RestMethod -Method Get -Uri "$api/applications/$ApplicationUuid" -Headers $script:headers
  $script:appName = [string]$app.name
  $domains = @($PortalHosts | Where-Object { $_ })
  if ($domains.Count -eq 0 -and $app.docker_compose_domains) {
    foreach ($service in ($app.docker_compose_domains | ConvertFrom-Json).PSObject.Properties) {
      $domains += ([string]$service.Value.domain).Split(',') | Where-Object { $_ } | ForEach-Object { ([Uri]$_.Trim()).Host }
    }
  }
  if ($domains.Count -eq 0) {
    throw "O Coolify não informou os domínios do portal. Rode de novo com -PortalHosts 'www.maquinanerd.com.br','maquinanerd.com.br','<origem>.sslip.io'."
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
    if (-not $previous.newWebhookIds) { throw 'A rodada anterior não terminou de criar o token e o webhook; rode com -Recomecar.' }
    if (-not (Wait-PortalReady $readyUrl)) { throw 'O portal não respondeu com o Kal El ok. Confira o deploy antes de finalizar.' }
    Invoke-Finish $previous $readyUrl $hosts
    $previous.finished = $true
    Save-State $previous
    if (-not $previous.semCinerie) { [void](Show-CinerieRemoval $previous $previous.cinerieNewPrefix) }
    Write-Host 'Pronto. Falta o que está em docs/migration/RUNBOOK-INCIDENTE-2026-11.md, a partir do passo 4.'
    return
  }
  if ($previous -and -not $previous.finished -and -not $Recomecar) {
    throw "Há uma troca em andamento ($stateFile). Rode com -SoFinalizar se o deploy com os valores novos foi ao ar, ou com -Recomecar para começar de novo."
  }
  if (-not ($previous -and -not $previous.finished)) { $previous = $null }

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
  $prepared = Invoke-Rotate 'prepare' -Apply
  $newTokenId = Get-Line $prepared.lines 'NEW_TOKEN_ID'
  if (-not $newTokenId) { throw 'O prepare falhou antes de criar o token (as linhas acima dizem por quê). Nada mudou.' }

  # O token vazado de verdade e o que a rodada abandonada criou ou gravou no Coolify: tudo isso
  # é revogado no fim. Um nome que não seja maquinanerd-portal… exige confirmação por id.
  $currentId = Get-Line $prepared.lines 'LEAKED_TOKEN_ID'
  $currentName = Get-Line $prepared.lines 'LEAKED_TOKEN_NAME'
  $toRevoke = @()
  if ($currentId) { $toRevoke += [pscustomobject]@{ id = $currentId; name = $currentName } }
  if ($previous) {
    if ($previous.leakedTokenId) { $toRevoke += [pscustomobject]@{ id = $previous.leakedTokenId; name = $previous.leakedTokenName } }
    if ($previous.newTokenId) { $toRevoke += [pscustomobject]@{ id = $previous.newTokenId; name = "$tokenPrefix (rodada anterior)" } }
    foreach ($id in @($previous.revokeTokenIds)) { if ($id) { $toRevoke += [pscustomobject]@{ id = $id; name = "$tokenPrefix (rodada anterior)" } } }
  }
  # Sem repetir id, ficando com a primeira ocorrência: o nome real (lido do Kal El) vem antes do
  # rótulo genérico das rodadas anteriores. O nome que vale para revogar é o do Kal El, no finish.
  $seen = @{}
  $toRevoke = @(foreach ($candidate in $toRevoke) {
      if ($candidate.id -and $candidate.id -ne $newTokenId -and -not $seen.ContainsKey($candidate.id)) {
        $seen[$candidate.id] = $true
        $candidate
      }
    })
  $originalLeaked = if ($previous -and $previous.leakedTokenId) { $previous } else { [pscustomobject]@{ leakedTokenId = $currentId; leakedTokenName = $currentName } }
  $state = [pscustomobject]@{
    at = (Get-Date).ToUniversalTime().ToString('o')
    newTokenId = $newTokenId
    newWebhookIds = Get-Line $prepared.lines 'NEW_WEBHOOK_IDS'
    leakedTokenId = $originalLeaked.leakedTokenId
    leakedTokenName = $originalLeaked.leakedTokenName
    revokeTokenIds = @($toRevoke | ForEach-Object { $_.id })
    allowForeignIds = @(if ($previous) { @($previous.allowForeignIds) | Where-Object { $_ } })
    semCinerie = [bool]$SemCinerie
    cinerieLeakedPrefix = if ($previous -and $previous.cinerieLeakedPrefix) { $previous.cinerieLeakedPrefix } elseif ($oldCinerie.Length -ge 4) { $oldCinerie.Substring(0, 4) } else { '' }
    cinerieAddedPrefixes = @(if ($previous) { @($previous.cinerieAddedPrefixes) | Where-Object { $_ } })
    cinerieNewPrefix = ''
    finished = $false
  }
  # Gravado já: se algo abaixo falhar (ou você interromper), o -Recomecar sabe o que revogar.
  Save-State $state
  $newToken = Get-Line $prepared.lines 'KAL_EL_SERVICE_TOKEN'
  if ($prepared.code -ne 0 -or -not $newToken -or -not $state.newWebhookIds) {
    throw "O prepare falhou depois de criar o token $newTokenId. Rode com -Recomecar: ele entra na revogação."
  }

  foreach ($candidate in $toRevoke) {
    $name = [string]$candidate.name
    if ($name.StartsWith($tokenPrefix) -or @($state.allowForeignIds) -contains $candidate.id) { continue }
    Write-Host "    O token a revogar $($candidate.id) se chama `"$name`". Se o MN-Prime (ou outro) publica com ele, dê"
    Write-Host '    antes um token novo a esse consumidor (no MN-Prime: painel /sites > trocar token), senão ele para.'
    $confirm = Read-Host '    Digite o nome do token para revogá-lo mesmo assim (ou Enter para não revogar)'
    if ($confirm -ceq $name) { $state.allowForeignIds = @(@($state.allowForeignIds) + $candidate.id) }
  }
  Save-State $state

  if (-not $SemCinerie) {
    Write-Host '4/8 Cinerie: acrescentar a chave nova no Easypanel (a vazada sai no passo 8)'
    $state.cinerieNewPrefix = $cinerieKey.Substring(0, 4)
    $state.cinerieAddedPrefixes = @(@($state.cinerieAddedPrefixes) + $state.cinerieNewPrefix)
    Save-State $state
    Set-PrivateClipboard $cinerieKey
    $usedClipboard = $true
    Write-Host '    A chave nova está na área de transferência (fora do histórico do Windows). No Easypanel:'
    Write-Host '      rss_prime > screen-app > Ambiente > CINERIE_EDITORIAL_CONTEXT_API_KEYS'
    Write-Host '      ACRESCENTE no fim da lista uma vírgula e a chave (Ctrl+V), sem apagar nada. Salvar > Implantar.'
    if (Wait-CinerieKey $cinerieBase $cinerieKey 'aceita' 'A Cinerie ainda recusa a chave nova. Confira o Ambiente e o Implantar.') {
      Write-Host '    conferido: a Cinerie aceita a chave nova'
    }
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
    Write-Host "    conferido: o Coolify guardou os $($written.Count) valores"
  }
  catch {
    throw "Falha ao gravar no Coolify ($($_.Exception.Message)). O portal no ar segue com os valores antigos, que ainda valem. Corrija (o token do Coolify escreve?) e rode com -Recomecar."
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
      if ((Get-StatusCode $_) -eq 405) { continue }
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
    throw "O deploy terminou como '$status'. O portal segue com o container anterior, e os valores antigos ainda valem. Veja o log no painel, publique de novo, espere terminar e rode com -SoFinalizar."
  }
  if (-not (Wait-PortalReady $readyUrl)) {
    throw 'O portal não respondeu com o Kal El ok depois do deploy. Nada foi revogado; confira o portal e rode com -SoFinalizar.'
  }
  Write-Host '    portal no ar, com o Kal El respondendo'

  Invoke-Finish $state $readyUrl $hosts
  try {
    Invoke-RestMethod -Method Get -Uri "$kalelBase/v1/auth/me" -Headers @{ Authorization = "Bearer $leaked" } | Out-Null
    Write-Host '    ATENÇÃO: o token que estava no Coolify ainda autentica. Revogue-o no CMS, em Tokens.'
  }
  catch {
    $code = Get-StatusCode $_
    if ($code -eq 401 -or $code -eq 403) { Write-Host "    conferido: o token que estava no Coolify não autentica mais (HTTP $code)" }
    else { Write-Host "    não consegui conferir o token que estava no Coolify ($($_.Exception.Message)); veja em Tokens no CMS" }
  }
  $state.finished = $true
  Save-State $state

  if (-not $SemCinerie -and (Show-CinerieRemoval $state $state.cinerieNewPrefix) -and $oldCinerie) {
    # A chave que estava no Coolify (a vazada, ou a de uma rodada abandonada) sai junto.
    if (Wait-CinerieKey $cinerieBase $oldCinerie 'recusada' 'A chave antiga ainda abre a rota. Confira a lista e o Implantar.') {
      Write-Host '    conferido: a chave antiga não abre mais a rota da Cinerie'
    }
  }
  Write-Host 'Pronto. Falta o que está em docs/migration/RUNBOOK-INCIDENTE-2026-11.md, a partir do passo 4.'
}
finally {
  if ($usedClipboard) { Clear-PrivateClipboard }
  foreach ($name in $childEnv) { Remove-Item "Env:$name" -ErrorAction SilentlyContinue }
  Remove-Variable coolifyToken, envs, reread, leaked, oldCinerie, webhookSecret, previewSecret, cinerieKey, newToken, prepared, written -ErrorAction SilentlyContinue
  $script:headers = $null
}
