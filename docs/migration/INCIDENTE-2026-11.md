# Incidente de segurança — portal invadido (18 a 26/11/2026)

Relatório do que aconteceu, do que foi corrigido e do que ainda depende do dono. A ordem de
execução fica em [RUNBOOK-INCIDENTE-2026-11.md](RUNBOOK-INCIDENTE-2026-11.md).

## 1. Resumo

|                         |                                                                                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **O que**               | Execução remota de código sem autenticação no container do portal (`maquinanerd.com.br`).                                                 |
| **Quando**              | Container em produção desde 18/11/2026, commit `25306cb`. Invasão encontrada e contida em 26/11/2026.                                     |
| **Porta de entrada**    | next 15.5.4 / react 19.1.1. Três falhas críticas exploráveis dariam esse acesso, e não dá mais para saber qual foi usada (§3).            |
| **O que o invasor fez** | Rodou um minerador (≈3 núcleos, 2,4 GB), o Tor e um watchdog de persistência. Executou comandos repetidas vezes (1.587 processos zumbis). |
| **O que vazou**         | Todas as variáveis de ambiente do portal (§5). Nenhum segredo está no repositório (§6).                                                   |
| **Contenção**           | Container parado em 26/11 às 23:10 (Brasília). O Coolify o removeu junto com o malware.                                                   |
| **Correção no ar**      | Em 26/11 às 23:48: next 15.5.29, react 19.1.10, sharp 0.35.5 e container endurecido (PRs MN_Next #36 e #37).                              |
| **Pendente**            | Trocar os segredos vazados (script pronto), auditar os logs do Kal El e da Cinerie, e as outras aplicações vulneráveis (§8).              |

## 2. Linha do tempo (horário de Brasília)

| Quando                 | O quê                                                                                                                                                             |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 18/11                  | Deploy do commit `25306cb` (PR #34, ficha da Cinerie), com next 15.5.4. O container fica no ar até 26/11.                                                         |
| 18/11 a 26/11          | Comandos executados como `nextjs` dentro do container. O minerador ocupa ~3 núcleos da VPS. A CPU do servidor fica em 75–80% e a carga em 8.                      |
| 26/11, antes das 23:00 | Diagnóstico somente leitura na VPS (outra sessão): indicadores da §4. Nada suspeito fora do container.                                                            |
| 26/11 23:10            | `stop` do portal no Coolify. Container removido (`container_present: false`). A CPU do servidor cai para 22–31%, a memória de 11,2 para 7,1 GB e a carga para ~2. |
| 26/11 23:40            | PR #36 mergeado (dependências e endurecimento).                                                                                                                   |
| 26/11 23:41            | Primeiro deploy falha antes do build: o Compose recusou `pids_limit` ao lado de `deploy.resources.limits`.                                                        |
| 26/11 23:45            | PR #37 mergeado (correção do compose e validação no CI).                                                                                                          |
| 26/11 23:48            | Deploy concluído. Saúde ok, `?ready=1` com Kal El e contrato ok, home, feed, sitemap, `/_next/image` e capas `/media/…` respondendo 200.                          |

O site ficou fora do ar por cerca de 38 minutos, entre o `stop` e o deploy.

## 3. Porta de entrada

A versão em produção tinha, além do React2Shell, dois RCEs críticos sem autenticação no
otimizador de imagens. O portal usa esse otimizador e pede AVIF (`next.config.ts`,
`images.formats`):

| Advisory                                           | Severidade | Afeta                                                          | Corrigido em |
| -------------------------------------------------- | ---------- | -------------------------------------------------------------- | ------------ |
| GHSA-fv66-9v8q-g76r / CVE-2025-55182 (React2Shell) | Crítica    | react-server-dom 19.1.0–19.1.1, embutido no next 15.5.0–15.5.6 | next 15.5.7  |
| GHSA-2xp9-vwfh-vxw4 (otimizador de imagens, AVIF)  | Crítica    | next ≥ 10.0.0 < 15.5.24                                        | 15.5.24      |
| GHSA-2464-fhr4-w9xw (otimizador de imagens, SVG)   | Crítica    | next ≥ 10.0.0 ≤ 15.5.27                                        | 15.5.28      |

O `stop` do Coolify remove o container, e com ele os logs de requisição. Não dá mais para
saber qual das três foi usada. As três estão corrigidas.

## 4. Indicadores de comprometimento (do diagnóstico na VPS)

| Indicador                                                       | O que era                                                     |
| --------------------------------------------------------------- | ------------------------------------------------------------- |
| Processo `redis-server`, binário `memfd:kworkerd` (sem arquivo) | Minerador: ~3 núcleos, 2,4 GB, conectado a `45.86.86.254:443` |
| Processo `kworker -f`, binário `/var/tmp/.kworkerd/.d/tor`      | Tor, conectado a `45.132.127.8:9010`                          |
| Processo `[kworker/u16:2]`, binário `/var/tmp/.guard`           | Watchdog de persistência                                      |
| 1.587 zumbis filhos do `next-server` em 8 dias                  | Comandos executados repetidas vezes                           |

Tudo rodava como `nextjs` (sem root, sem `docker.sock`, sem limite de CPU ou memória).
Nenhum binário suspeito apareceu fora desse container. Os outros apps Next.js da VPS
(OpaPreço 16.4.6, aluguei.app 16.3.6, Kal El 14.2.35) não mostraram sinais.

## 5. Segredos vazados: o que cada um permite e como trocar

Considere vazadas **todas** as variáveis do portal. O mapa abaixo saiu da leitura de
`maquinanerd/kal-el` (origin/main `d5e2e7f`), `maquinanerd/screena` (`606a4d1`) e
`maquinanerd/MN-Prime` (`7db5e99`).

### 5.1 `KAL_EL_SERVICE_TOKEN` — o mais sensível

- **Formato e guarda:** `ke_st.` mais 32 bytes aleatórios. O Kal El guarda só o SHA-256, na
  tabela `service_tokens`. O valor em claro aparece uma vez, na criação.
- **Validação:** a cada requisição, no banco, sem cache. Revogado → 403. Expirado → 401.
  `site_id` diferente → 403. Não expira: nem o script do portal nem o MN-Prime definem
  validade.
- **Permissões** (escopos que `scripts/kalel-provision.ts` pede):

  | Escopo                                               | O que libera                                                                                                                |
  | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
  | `articles.read`                                      | Ler qualquer matéria, inclusive **rascunho, revisão e agendada**; gerar preview `kpv.` de qualquer matéria; `/stats`        |
  | `media.read`                                         | Listar e baixar qualquer arquivo de mídia                                                                                   |
  | `taxonomy.{categories,tags,authors,entities}.manage` | Ler, **criar, editar e apagar** categorias, tags, autores e entidades                                                       |
  | `seo.manage`                                         | Listar, **criar e apagar redirects** (o portal descarta alvos `//`, então o risco é redirect interno abusivo e dano de SEO) |

  O token **não** cria, edita nem publica matéria, não sobe mídia, não mexe em usuários,
  papéis, tokens ou webhooks, e não lê a auditoria. O Kal El ainda não tem escopo só de
  leitura para taxonomia e redirects; por isso o portal pede `*.manage`.

- **Troca:** o Kal El aceita vários tokens ativos, e a revogação vale na hora. Dá para
  trocar sem downtime e sem deploy do Kal El: cria o novo, publica o portal com ele e
  revoga o antigo. `pnpm kalel:rotate` faz isso (§7).

### 5.2 `KAL_EL_WEBHOOK_SECRET` (= `SERVICE_BASE64_64_WEBHOOK` no Coolify)

- **Onde o Kal El guarda:** na coluna `webhooks.secret`, em texto puro, por webhook. Não
  fica no env.
- **Como assina:** HMAC-SHA256 do corpo, no header `x-kal-el-signature`, sem timestamp
  assinado. O portal verifica a assinatura antes do nonce.
- **Impacto do vazamento:** dá para forjar entregas, o que purga o cache e dispara IndexNow
  para slugs à escolha. Não dá acesso a dados.
- **Troca:** o segredo de um webhook não pode ser alterado (o PATCH não aceita `secret`).
  É preciso criar outro webhook com o segredo novo e apagar o antigo. Enquanto os dois
  existem, cada evento vai para os dois; um é recusado com 401, sem lacuna de revalidação.
  O webhook aponta para o host `sslip.io` do portal, não para o `www`, e o script reusa a
  URL do antigo.

### 5.3 `KAL_EL_PREVIEW_SECRET` (= `SERVICE_BASE64_64_PREVIEW`)

Só o portal conhece esse segredo: com ele assina os tokens locais `mnp.` e o cookie de
preview. O Kal El assina os próprios previews (`kpv.`) com o `SESSION_SECRET` dele, que não
estava no portal. **Impacto:** cunhar um grant de preview e abrir no portal qualquer
matéria não publicada. **Troca:** basta um valor novo no Coolify e um deploy.

### 5.4 `CINERIE_SERVICE_TOKEN` (e `CINERIE_INTERNAL_URL`)

- **Validação:** na Cinerie (`maquinanerd/screena`, app `screen-app` no Easypanel, serve
  `https://cinerie.com`). A chave é uma das entradas de `CINERIE_EDITORIAL_CONTEXT_API_KEYS`
  (`apps/web/app/api/internal/editorial-context/route.ts`), comparada em tempo constante
  e lida a cada requisição.
- **Permissões:** só `POST /api/internal/editorial-context`. É leitura do catálogo, com os
  mesmos portões de licença da página pública: até 5 obras por chamada e 300 chamadas por
  minuto por chave e por processo. Não há escrita nem admin.
- **Risco:** raspagem do catálogo e carga no banco. O invasor consome o mesmo balde de rate
  limit do portal, que pode tomar 429.
- **Troca:** trocar a entrada do portal na lista (mantendo a do MN-Prime), clicar em
  **Implantar** no Easypanel e atualizar o Coolify. O script põe a chave nova na área de
  transferência e grava no Coolify (§7).

### 5.5 Sem valor de segredo

- `KAL_EL_SITE_ID` e `KAL_EL_BASE_URL`: identificadores, não há o que trocar. O token já é
  limitado ao site.
- `SERVICE_BASE64_64_*`: os mesmos valores das §5.2 e §5.3, com o nome do Coolify.

### 5.6 MN-Prime

O MN-Prime **não usa nenhum** desses segredos:

- publica no Kal El com token próprio, `mn-prime-publicacao`, com escopos de publicação,
  cifrado no SQLite dele;
- consulta a Cinerie com chave própria (painel `/chaves`, provedor `cinerie`);
- não recebe webhooks nem chama o portal.

A troca não exige nada nele. Os dois cuidados são: revogar no Kal El só os tokens do
portal (o script nunca toca em outro nome) e não apagar a chave do MN-Prime da lista da
Cinerie.

## 6. O repositório (público)

- **Histórico inteiro** (178 commits, todas as refs), varrido em busca de tokens `ke_st.`,
  GitHub, OpenAI/Anthropic, AWS, Google, Slack, chaves privadas, URLs com credencial e
  atribuições `*SECRET*/*TOKEN*/*PASSWORD*`. Houve 22 ocorrências, **todas falsas e de
  teste** (`ke_st.fake0000…`, `ke_st.aaaa…`, `ke_st.testtokenval…`,
  `ci-placeholder-…`, `playwright-…`). Nenhum `.env` jamais foi commitado. (O gitleaks e o
  trufflehog não estavam instalados, então a varredura usou um script equivalente, que
  imprime só o prefixo.)
- **Commits desde 01/11:** só os PRs #28 a #35, do dono e do Claude. O repositório não tem
  deploy key nem webhook, e `maquinanerd` é o único colaborador. Não há sinal de
  adulteração do código.

## 7. O que foi feito

### 7.1 Dependências (PR #36, `ebd0878`)

- next 15.5.4 → **15.5.29**, a última da linha 15.5. Corrige todos os advisories
  publicados para ela até 19/11/2026, incluindo os três da §3, os DoS e o vazamento de
  código do RSC de dez/2025 em diante, SSRF, envenenamento de cache e o bypass de SVG.
- react e react-dom 19.1.1 → **19.1.10**.
- sharp → **0.35.5** em todo o grafo (override em `pnpm-workspace.yaml`), inclusive o
  que o otimizador do Next carrega. Corrige libvips, libheif e librsvg. As capas vêm de
  sites de terceiros, então essa entrada não é confiável.
- **Resíduo conhecido:** o RCE do React de 10/11 (GHSA-xqc2-xf4c-x3h3) foi publicado
  depois do next 15.5.29, e o React que o Next embute é de abril. A falha exige typed
  arrays no payload RSC. O portal não tem Server Actions nem `use cache`, e os typed arrays
  dele ficam só em route handlers de mídia. O Next publicou o equivalente
  (GHSA-673q-mjm6-r5xr) só para a 16.x. Não alcança o portal, mas é um motivo para
  planejar a migração para a 16.x (§8).

### 7.2 Container endurecido (PRs #36 `90c22d2` e #37 `48718cc`)

| Mudança                                                         | Por quê                                                                 | Risco de quebrar                                                                                                                             |
| --------------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `read_only: true`                                               | Nenhum binário gravado junto do código, nenhum `server.js` reescrito    | O servidor escrever fora do volume. Medido: páginas e fetches ficam em memória, e o CI prova que nada é gravado fora de `.next/cache/images` |
| `/tmp` e `/var/tmp` em tmpfs `noexec,nosuid,nodev` (64 e 16 MB) | O Tor e o watchdog rodavam de `/var/tmp`                                | Algo que precise de mais de 64 MB em `/tmp`: o sharp trabalha em memória                                                                     |
| `cap_drop: [ALL]`, `no-new-privileges`                          | Nenhuma capability; setuid não devolve privilégio                       | Nenhum: porta 3000, usuário sem root                                                                                                         |
| `init: true`                                                    | O Node como PID 1 não recolhe órfãos (os 1.587 zumbis)                  | Nenhum                                                                                                                                       |
| Limites `cpus: 1.5`, `memory: 1536M`, `pids: 256`               | Um minerador ou um descontrole fica preso aqui, sem tirar CPU do Kal El | Pico legítimo acima disso: o container é estrangulado (CPU) ou reiniciado (memória). Medido localmente: 105 MB e 12 processos em repouso     |
| `NODE_OPTIONS=--max-old-space-size=768`                         | Heap dentro do teto, com o resto para o libvips                         | Heap acima de 768 MB derruba o processo; o LRU do ISR tem 256 MB                                                                             |
| Código do root, só `.next/cache/images` do `nextjs`             | Mesmo sem `read_only`, a RCE não altera o servidor                      | Nenhum, coberto pelo CI                                                                                                                      |
| Volume novo `portal-image-cache-v2`                             | O antigo ficou gravável pelo invasor por 8 dias                         | Cache de imagens frio depois do deploy (só CPU)                                                                                              |

**Valores propostos** — tetos de 1,5 núcleo e 1,5 GB, cerca de 1,5x o uso normal
estimado (~1 núcleo, ~1 GB). Depois de 24 h no ar, compare com `docker stats` (RUNBOOK §4)
e ajuste em `docker-compose.coolify.yml`.

**Provas no CI** — o job _Container image_ roda o container com as mesmas restrições e
prova cada uma: `server.js` do root e não gravável, raiz somente leitura, binário que não
roda em `/tmp`, `/var/tmp` nem `/dev/shm`, `CapBnd` zerado e `NoNewPrivs` ligado. O job
estático valida o compose com `docker compose config`, e
`tests/security/container-hardening.test.ts` falha se alguém tirar alguma restrição.

### 7.3 Troca dos segredos (este PR)

- `scripts/kalel-rotate.ts` (`pnpm kalel:rotate prepare|finish`): token e webhook novos
  antes, revogação depois. Só mexe em tokens `maquinanerd-portal…` e em webhooks
  `/api/revalidate`, e acha o token vazado pelo `/v1/auth/me`. Testes em
  `tests/unit/kalel-rotate.test.ts`.
- `scripts/rotacionar-segredos.ps1`: o roteiro completo (Kal El, Cinerie, Coolify,
  deploy, verificação, revogação). Lê as senhas sem eco, e nenhum valor passa pela tela.

## 8. Pendências e decisões do dono

| #   | Item                                                                                                                                                                                                                                                                                                                                                                      | Quem                                                                                   | Urgência |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------- |
| 1   | **Rodar `scripts/rotacionar-segredos.ps1`** (RUNBOOK §2). Até lá, os segredos vazados seguem válidos: o token lê rascunhos e altera taxonomia e redirects                                                                                                                                                                                                                 | Dono (precisa do token da API do Coolify com leitura de segredos e da senha do Kal El) | Imediata |
| 2   | **Cinerie exposta:** o `cinerie.com` roda next 15.5.25 com sharp 0.34.5 em glibc (`node:22-bookworm-slim`), vulnerável ao RCE crítico do otimizador com SVG (GHSA-2464). O `cms.cinerie.com` roda next 15.4.11 com Payload 3.86.0 (críticos de RCE no otimizador, SQLi e "RCE through first-register"). Ela fica em outro servidor (Easypanel), que **não foi examinado** | Sessão própria no repositório `screena`                                                | Imediata |
| 3   | **aluguei.app** (mesma VPS) roda next 16.3.6: GHSA-2464 e GHSA-673q (RCEs críticos, corrigidos em 16.4.1)                                                                                                                                                                                                                                                                 | Sessão própria                                                                         | Alta     |
| 4   | Auditar o uso dos segredos desde 18/11 (RUNBOOK §5). **Exporte os logs do container `api` do Kal El antes de qualquer redeploy dele**: as leituras só ficam no stdout                                                                                                                                                                                                     | Dono ou sessão com acesso à VPS                                                        | Alta     |
| 5   | Kal El CMS em next 14.2.35, sem correção na linha 14. Na prática não está exposto (sem sharp, musl, nenhuma imagem de terceiros no otimizador), mas roda como root. Planejar next 15.5.29+ e restringir o CMS por IP ou Cloudflare Access                                                                                                                                 | Decisão do dono                                                                        | Média    |
| 6   | Conferir na VPS que as restrições valem no container novo (RUNBOOK §4). O classificador não deixou o Claude abrir o terminal do servidor                                                                                                                                                                                                                                  | Dono ou sessão com acesso à VPS                                                        | Alta     |
| 7   | Remover o volume antigo `…_portal-image-cache` depois de copiá-lo para perícia, se quiser (RUNBOOK §6)                                                                                                                                                                                                                                                                    | Dono                                                                                   | Baixa    |
| 8   | Bloquear no host as saídas para `45.86.86.254` e `45.132.127.8` (e, idealmente, toda saída do portal que não seja Kal El, Cinerie e os hosts de mídia)                                                                                                                                                                                                                    | Dono                                                                                   | Média    |
| 9   | Zod 3.25.76 (GHSA-mrhx-c7xc-m3w5, sem correção na 3.x) e as dependências de desenvolvimento com advisories (vitest/tinypool, vite, playwright, eslint)                                                                                                                                                                                                                    | Próximo PR de manutenção                                                               | Baixa    |
| 10  | `frontend/` (kit do OpaPreço, fora da imagem) em next 16.4.3 / react 19.3.0, que o Dependabot vai apontar                                                                                                                                                                                                                                                                 | Próximo PR de manutenção                                                               | Baixa    |
| 11  | Migrar o portal para next 16.4.6+, que cobre o RCE do React de 10/11 na origem                                                                                                                                                                                                                                                                                            | Decisão do dono                                                                        | Média    |
| 12  | Não existe `main` no MN_Next: a branch padrão é `chore/maquina-nerd-kalel-migration`, de onde o Coolify publica, então não há nada a levar. Renomeá-la para `main` (o GitHub mantém o redirecionamento) exige trocar a branch no Coolify                                                                                                                                  | Decisão do dono                                                                        | Baixa    |
