# Runbook — incidente de novembro de 2026

Ordem de execução depois da invasão do portal. O contexto e o mapa dos segredos estão em
[INCIDENTE-2026-11.md](INCIDENTE-2026-11.md). Nenhum valor de segredo aparece aqui: só
nomes de variáveis.

| Passo                                             | Situação                                    |
| ------------------------------------------------- | ------------------------------------------- |
| 1. Parar o container comprometido                 | **Feito** em 26/11 às 23:10                 |
| 2. Publicar a versão corrigida num container novo | **Feito** em 26/11 às 23:48 (PRs #36 e #37) |
| 3. Trocar os segredos                             | **Falta.** Um comando (§3)                  |
| 4. Conferir o container novo na VPS               | **Falta** (§4)                              |
| 5. Auditar o uso dos segredos desde 18/11         | **Falta** (§5)                              |
| 6. Limpeza                                        | **Falta** (§6)                              |

## 1. Contenção (feito)

- `stop` do aplicativo `xys58xzntjzf3xd5ar5snoq5` no Coolify. O container foi removido, e
  com ele o minerador, o Tor e o watchdog, que viviam na camada gravável e na memória do
  container.
- **Não use o Rollback do Coolify** para nenhuma imagem anterior a 26/11. Todas têm o next
  15.5.4, vulnerável, e o token vazado nos metadados de build. A §6 as remove.

## 2. Deploy corrigido (feito)

- Branch `chore/maquina-nerd-kalel-migration` em `032e470`: next 15.5.29, react 19.1.10,
  sharp 0.35.5, container endurecido e volume novo `portal-image-cache-v2`.
- Verificado de fora em 26/11 às 23:50:
  - `/api/health?ready=1` respondeu `{"status":"ok","checks":{"env":"ok","kalel":"ok","contract":"ok"}}`;
  - home 200 com `x-nextjs-cache: HIT`;
  - `/feed.xml` e `/news-sitemap.xml` 200;
  - `/_next/image` 200;
  - capa `/media/<id>/16x9-v1.jpg` 200, servida pelo sharp novo;
  - matéria com a ficha da Cinerie.
- CPU do servidor: 75–80% antes do `stop`, 22–31% depois. Confirme o valor estável na §4.

## 3. Troca dos segredos (falta, um comando)

### 3.1 Antes de rodar

1. **Token da API do Coolify** com leitura de valores secretos, escrita e deploy. Crie em
   Coolify › Keys & Tokens › API tokens e apague depois.
2. **Senha do dono do site** no Kal El.
3. **Acesso ao Easypanel** da Cinerie (projeto `rss_prime`, app `screen-app`). Sem ele,
   use `-SemCinerie` e faça a parte da Cinerie depois (§3.4).
4. **Dependências instaladas:** `pnpm install` na raiz do repositório, na branch de
   deploy atualizada.

### 3.2 O comando

```powershell
powershell -ExecutionPolicy Bypass -File scripts\rotacionar-segredos.ps1 -AdminEmail <e-mail do dono no Kal El>
```

As duas senhas são pedidas sem eco. Em ordem, o script:

1. lê no Coolify o endereço e o site do Kal El, o token vazado (só para achar o id dele) e a
   chave atual da Cinerie;
2. gera o segredo de webhook (64 caracteres), o de preview (64) e a chave da Cinerie
   (base64url de 32 bytes);
3. `pnpm kalel:rotate prepare --apply`: cria no Kal El o token
   `maquinanerd-portal-entrega-<data>`, com os mesmos 7 escopos, e um webhook novo na mesma
   URL do antigo, assinado com o segredo novo. **O token e o webhook antigos continuam
   valendo** até o passo 6;
4. Cinerie: põe a chave nova na área de transferência e mostra os 4 primeiros caracteres da
   chave vazada. No Easypanel, em `rss_prime › screen-app › Ambiente ›
CINERIE_EDITORIAL_CONTEXT_API_KEYS`, troque a entrada que começa com eles pelo
   conteúdo colado, **mantendo a do MN-Prime**, e clique em Salvar › Implantar. Depois volte
   e aperte Enter. Entre a implantação e o deploy do portal, matérias que saírem do cache
   ficam sem a ficha; a página continua 200;
5. grava no Coolify `KAL_EL_SERVICE_TOKEN`, `SERVICE_BASE64_64_WEBHOOK`,
   `SERVICE_BASE64_64_PREVIEW` e `CINERIE_SERVICE_TOKEN`, faz o deploy (que reconstrói,
   porque as variáveis também são argumentos de build) e espera `/api/health?ready=1`
   responder 200 com o Kal El ok;
6. `pnpm kalel:rotate finish --apply`: revoga o token vazado e os outros
   `maquinanerd-portal…` (como o de importação), apaga o webhook antigo e confere que o
   token vazado recebe 401 ou 403. **O `mn-prime-publicacao` não é tocado.**

Os ids (que não são segredo) ficam em `artifacts/rotacao-segredos.json`.

### 3.3 Se algo falhar no meio

| Onde parou                    | Estado                                                                                    | O que fazer                                                                                   |
| ----------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Antes do passo 5              | Nada mudou no Coolify. O Kal El tem um token e um webhook novos sobrando                  | Rode o script de novo. O `finish` da próxima rodada revoga e apaga as sobras                  |
| Deploy ou `ready=1` (passo 5) | Valores novos no Coolify; os antigos ainda valem no Kal El, então o portal continua no ar | Veja o log do deploy no painel, corrija, publique pelo painel e rode com `-SoFinalizar`       |
| Passo 6                       | O portal já usa o token novo                                                              | Rode com `-SoFinalizar`, ou revogue à mão no CMS, em Tokens (o nome e o id aparecem na saída) |

```powershell
powershell -ExecutionPolicy Bypass -File scripts\rotacionar-segredos.ps1 -AdminEmail <e-mail> -SoFinalizar
```

### 3.4 Sem o script (manual, pelo CMS e pelos painéis)

1. **CMS do Kal El › Tokens.** Crie um token com os escopos `articles.read`,
   `media.read`, `taxonomy.categories.manage`, `taxonomy.tags.manage`,
   `taxonomy.authors.manage`, `taxonomy.entities.manage` e `seo.manage`. Ele aparece uma
   vez: cole em `KAL_EL_SERVICE_TOKEN` no Coolify.
2. **CMS › Webhooks.** Crie um webhook com a mesma URL do atual (o host `sslip.io` do
   portal, caminho `/api/revalidate`) e os eventos `article.published` e
   `article.updated`. O CMS gera o segredo e mostra uma vez: cole em
   `SERVICE_BASE64_64_WEBHOOK` no Coolify.
3. **Coolify.** Em `SERVICE_BASE64_64_PREVIEW`, um valor novo de 32 a 128 caracteres
   alfanuméricos.
4. **Easypanel e Coolify.** Gere a chave da Cinerie e troque-a como no passo 4 da §3.2;
   depois atualize `CINERIE_SERVICE_TOKEN` no Coolify.
5. **Coolify.** Faça o Redeploy (com build) e confira `/api/health?ready=1`.
6. **CMS.** Revogue o token antigo do portal, apague o webhook antigo e **não toque no
   `mn-prime-publicacao`**.

O preenchimento automático do Chrome preenche campos de senha do Coolify. Releia todos os
campos antes de salvar.

## 4. Conferir o container novo na VPS (falta)

No terminal da VPS, como root. Só leitura:

```bash
C=$(docker ps --filter name=portal-xys58xzntjzf3xd5ar5snoq5 --format '{{.Names}}' | head -1); echo "$C"

# As restrições do compose valem? Esperado: ro=true init=true capdrop=[ALL]
# secopt=[no-new-privileges:true] cpus=1500000000 mem=1610612736 pids=256 e os dois tmpfs noexec
docker inspect -f 'ro={{.HostConfig.ReadonlyRootfs}} init={{.HostConfig.Init}} capdrop={{.HostConfig.CapDrop}} secopt={{.HostConfig.SecurityOpt}} cpus={{.HostConfig.NanoCpus}} mem={{.HostConfig.Memory}} pids={{.HostConfig.PidsLimit}} tmpfs={{json .HostConfig.Tmpfs}}' "$C"

# Só o volume novo montado
docker inspect -f '{{range .Mounts}}{{.Name}} -> {{.Destination}}{{"\n"}}{{end}}' "$C"

# Dentro do portal, só o docker-init e o node server.js
docker top "$C" -eo pid,user,etime,args

# No host inteiro: nada rodando de /tmp, /var/tmp, /dev/shm, memfd ou binário apagado
for p in /proc/[0-9]*; do e=$(readlink "$p/exe" 2>/dev/null) || continue
  case "$e" in /tmp/*|/var/tmp/*|/dev/shm/*|*memfd:*|*'(deleted)'*)
    echo "${p#/proc/} $e :: $(tr '\0' ' ' < "$p/cmdline" | head -c 160)";; esac; done

# Nenhuma conexão para os endereços do invasor
ss -tnp | grep -E '45\.86\.86\.254|45\.132\.127\.8' || echo 'nenhuma conexão'

# Zumbis no host (esperado: 0 ou perto disso)
ps -eo stat= | grep -c '^Z'

# CPU e memória do portal: em repouso, poucos % de CPU e algumas centenas de MB
docker stats --no-stream --format '{{.Name}} cpu={{.CPUPerc}} mem={{.MemUsage}} pids={{.PIDs}}' "$C"
```

Como ler o resultado:

- **`(deleted)`** pode aparecer em processo legítimo cujo binário foi atualizado pelo `apt`
  depois de iniciado. Investigue o que não for de pacote do sistema.
- **Alguma restrição ausente no `inspect`**: o Coolify ignorou a chave do compose. Avise
  antes de mexer.
- **Depois de 24 h:** se o pico do `docker stats` ficar perto de 1,5 CPU ou 1,5 GB, ajuste
  os tetos em `docker-compose.coolify.yml`.

## 5. Auditoria (falta)

O id do token vazado está em `artifacts/rotacao-segredos.json` (`leakedTokenId`), depois
da §3.

### 5.1 Kal El: exportar os logs **antes de qualquer redeploy do Kal El**

As leituras feitas com o token (rascunhos, mídia, listas) não vão para o banco. Ficam só no
stdout do container `api`, e um redeploy as apaga.

```bash
API=$(docker ps --filter name=api-7t8t4kox5xazfgmsepc9ouqv --format '{{.Names}}' | head -1)
docker logs "$API" --since 2026-11-18T00:00:00Z > /root/kalel-api-desde-1811.jsonl 2>&1
T=<leakedTokenId>
# o que o token vazado leu ou escreveu
jq -r --arg t "$T" 'select(.actorId==$t)|[.time,.method,.path,.statusCode]|@tsv' /root/kalel-api-desde-1811.jsonl | sort | uniq -c | sort -rn | head -50
# de que IP e com que user-agent (a linha "incoming request" tem o mesmo reqId)
jq -r --arg t "$T" 'select(.actorId==$t)|.reqId' /root/kalel-api-desde-1811.jsonl | sort -u > /root/reqs.txt
jq -r 'select(.msg=="incoming request")|[.reqId,.req.remoteAddress,.req.userAgent]|@tsv' /root/kalel-api-desde-1811.jsonl \
  | grep -F -f /root/reqs.txt | cut -f2,3 | sort | uniq -c | sort -rn
```

**Sinais de abuso:**

- leitura de `status=draft`, `/revisions`, `POST …/preview`, `POST /redirects` ou
  `/media/*/file` em massa;
- qualquer IP que não seja o do próprio servidor do portal.

### 5.2 Kal El: consultas no banco

Rode no Postgres do Kal El (`docker ps | grep -i postgres` mostra o container). Troque
`<SITE_ID>`.

```sql
-- tokens do site
SELECT id,name,scopes,created_at,expires_at,last_used_at,revoked_at
FROM service_tokens WHERE site_id='<SITE_ID>' ORDER BY created_at;

-- toda escrita feita por token de serviço desde 18/11 (as do portal deveriam ser 0:
-- o runtime do portal só faz GET)
SELECT created_at,action,object_type,object_id,actor_label,ip,request_id
FROM audit_log WHERE actor_type='service' AND created_at>=timestamptz '2026-11-18 00:00:00+00'
ORDER BY created_at;

-- persistência ou ganho de privilégio
SELECT created_at,action,actor_type,actor_label,ip,object_id FROM audit_log
WHERE created_at>=timestamptz '2026-11-18 00:00:00+00' AND action IN
('tokens.create','tokens.revoke','webhooks.create','webhooks.update','webhooks.delete','users.create',
 'roles.create','roles.assign','sites.create','sites.update','bootstrap.init','articles.recover')
ORDER BY created_at;

-- pelas próprias tabelas (independe da auditoria); nunca selecione webhooks.secret
SELECT id,name,scopes,created_at FROM service_tokens WHERE created_at>=timestamptz '2026-11-18 00:00:00+00';
SELECT id,url,events,enabled,created_at,updated_at FROM webhooks
 WHERE greatest(created_at,updated_at)>=timestamptz '2026-11-18 00:00:00+00';
SELECT id,email,status,created_at,updated_at FROM users
 WHERE greatest(created_at,updated_at)>=timestamptz '2026-11-18 00:00:00+00';

-- logins (sessões que ainda existem)
SELECT u.email,s.ip,s.user_agent,s.created_at,s.last_seen_at
FROM sessions s JOIN users u ON u.id=s.user_id
WHERE s.created_at>=timestamptz '2026-11-18 00:00:00+00' OR s.last_seen_at>=timestamptz '2026-11-18 00:00:00+00';

-- redirects e taxonomia (redirect NÃO é auditado; o token vazado podia criar e apagar)
SELECT id,source_path,target_path,kind,created_at,updated_at FROM redirects
WHERE site_id='<SITE_ID>' AND greatest(created_at,updated_at)>=timestamptz '2026-11-18 00:00:00+00';
SELECT 'categories' t,id,created_at,updated_at FROM categories WHERE site_id='<SITE_ID>' AND greatest(created_at,updated_at)>=timestamptz '2026-11-18 00:00:00+00'
UNION ALL SELECT 'tags',id,created_at,updated_at FROM tags WHERE site_id='<SITE_ID>' AND greatest(created_at,updated_at)>=timestamptz '2026-11-18 00:00:00+00'
UNION ALL SELECT 'authors',id,created_at,updated_at FROM authors WHERE site_id='<SITE_ID>' AND greatest(created_at,updated_at)>=timestamptz '2026-11-18 00:00:00+00'
UNION ALL SELECT 'entities',id,created_at,updated_at FROM entities WHERE site_id='<SITE_ID>' AND greatest(created_at,updated_at)>=timestamptz '2026-11-18 00:00:00+00';

-- para onde foram os payloads de webhook
SELECT w.url,o.event_type,d.status,d.response_status,d.created_at
FROM webhook_deliveries d JOIN webhooks w ON w.id=d.webhook_id JOIN outbox_events o ON o.id=d.outbox_event_id
WHERE d.created_at>=timestamptz '2026-11-18 00:00:00+00' ORDER BY d.created_at;
```

**O que o Kal El não registra:**

- leituras (só nos logs da §5.1);
- geração e resgate de preview;
- exclusão de redirect;
- login sem sucesso;
- IP por token;
- user-agent no `audit_log`.

O IP do `audit_log` pode ser forjado por quem alcança a API sem passar pelo Traefik
(fastify 5.12.0 com `TRUST_PROXY=1`, GHSA-3m5p-2c4r-xxw2).

### 5.3 Cinerie (outro servidor, Easypanel)

A Cinerie registra só no stdout, em JSON:

- `editorial_context_served` traz o `credentialId`, que são os 8 primeiros caracteres da
  chave, mais a contagem de itens;
- **não registra** IP, títulos consultados, 401 nem 429;
- o JSON não traz hora, então use o `--timestamps` do Docker.

```bash
SVC=rss_prime_screen-app   # nome deduzido do padrão <projeto>_<serviço> do Swarm
docker service logs --raw --timestamps --since 2026-11-18T00:00:00Z "$SVC" 2>&1 \
  | grep '"event":"editorial_context_' > /root/ctx-desde-1811.log; wc -l /root/ctx-desde-1811.log
# por hora, credencial e evento (o prefixo do portal = 8 primeiros caracteres da chave vazada)
sed -nE 's/^([0-9-]{10}T[0-9]{2}).*"event":"([a-z_]+)".*"credentialId":"([^"]*)".*/\1h \3 \2/p' /root/ctx-desde-1811.log | sort | uniq -c
# picos por minuto (perto de 300/min = varredura)
sed -nE 's/^([0-9-]{10}T[0-9]{2}:[0-9]{2}).*"credentialId":"([^"]*)".*/\1 \2/p' /root/ctx-desde-1811.log | sort | uniq -c | sort -rn | head -20
```

Os IPs só aparecem na Cloudflare. Na zona `cinerie.com`, em Security/Analytics, filtre
Path `/api/internal/editorial-context` e agrupe por IP, ASN e user-agent. O único IP
legítimo para a chave do portal é o da VPS do Coolify.

### 5.4 Portal

Os logs do container invadido se perderam com a remoção. O que resta é a Cloudflare, na
zona `maquinanerd.com.br`, entre 18/11 e 26/11:

- requisições com header `Next-Action`;
- `POST` em páginas;
- `/_next/image` com `url=` de host externo ou de SVG/AVIF incomum.

Os IPs que aparecerem aí podem ser cruzados com os da §5.1.

## 6. Limpeza (falta)

1. **Volume antigo do cache de imagens.** Ficou gravável pelo invasor. Copie para perícia
   se quiser e remova:
   ```bash
   mkdir -p /root/pericia && docker run --rm -v xys58xzntjzf3xd5ar5snoq5_portal-image-cache:/v:ro -v /root/pericia:/out alpine \
     tar czf /out/portal-image-cache-2026-11.tgz -C /v .
   docker volume rm xys58xzntjzf3xd5ar5snoq5_portal-image-cache
   ```
   Depois apague o registro dele no Coolify (aplicação › Persistent Storage), onde ele
   aparece ao lado do `-v2`.
2. **Imagens antigas do portal.** Têm o next vulnerável e o token vazado nos argumentos de
   build (`docker history`):
   ```bash
   docker image ls --format '{{.Repository}}:{{.Tag}} {{.CreatedAt}}' | grep xys58xzntjzf3xd5ar5snoq5
   ```
   Remova as anteriores a 26/11 com `docker image rm <imagem>`, sem tocar na que está em uso
   (a do container da §4).
3. **Endereços do invasor**, bloqueados na saída de todos os containers:
   ```bash
   iptables -I DOCKER-USER -d 45.86.86.254 -j DROP
   iptables -I DOCKER-USER -d 45.132.127.8 -j DROP
   ```
   Isso não persiste num reboot sem `netfilter-persistent` ou equivalente. Os nós do Tor
   mudam; a proteção de verdade é uma lista de saídas permitidas para o portal (Kal El,
   Cinerie e os hosts de mídia).
4. **O token da API do Coolify** criado para a §3: apague-o.

## 7. Se o portal novo der problema

- **Não volte** para uma imagem anterior a 26/11 (§1).
- **Se o log mostrar `EROFS`, `EACCES` ou `read-only file system`**, alguma escrita em disco
  ficou de fora do volume. Para liberar só isso, tire `read_only: true` de
  `docker-compose.coolify.yml` num PR e publique. As outras restrições e o código do root
  continuam protegendo.
- **Se o container reiniciar por falta de memória** (OOMKilled no `docker inspect`), suba
  `memory` e `--max-old-space-size` juntos, mantendo o heap em no máximo metade do teto. O
  teste `tests/security/container-hardening.test.ts` confere essa proporção.
