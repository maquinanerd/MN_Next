# Runbook — operação, virada e rollback

Escrito para quem estiver de plantão às três da manhã. Cada procedimento diz o que
observar, o que fazer, e como saber que funcionou.

---

## 1. Provisionamento

### 1.0 O atalho: `pnpm kalel:provision`

Faz de uma vez, de forma idempotente, o que as seções 1.1 e 1.2 descrevem à mão: cria as
sete editorias como categorias (slugs e nomes do kit), as tags reservadas de layout
(`capa-em-tela-cheia`, `oferta`), o webhook de revalidação e, se pedido, o token de entrega.
Item que já existe é deixado como está.

```bash
export KAL_EL_BASE_URL='https://<api do kal el>'
export KAL_EL_SITE_ID='<uuid do site>'
export KALEL_ADMIN_EMAIL='<owner do site>'
export KALEL_ADMIN_PASSWORD='<senha>'           # só no ambiente, nunca em flag
export PORTAL_PUBLIC_URL='https://www.maquinanerd.com.br'
export KAL_EL_WEBHOOK_SECRET='<32+ caracteres>' # o mesmo valor que o portal recebe
pnpm kalel:provision                            # ensaio: diz o que faria
pnpm kalel:provision --apply                    # aplica
pnpm kalel:provision --apply --new-token        # idem, e imprime KAL_EL_SERVICE_TOKEN uma vez
```

O token impresso vai direto para o cofre de segredos do portal. Não cole em ticket, chat
ou log. Rodar `--new-token` duas vezes cria dois tokens: revogue o que sobrar no CMS.

### 1.1 Token de serviço do Kal El

No CMS: **Admin → Site → Service tokens**, ou
`POST /v1/admin/sites/:siteId/service-tokens` com escopo `tokens.manage`.

| Finalidade              | Escopos                                                                                                                                                  |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entrega (runtime)       | `articles.read`, `media.read`, `taxonomy.categories.manage`, `taxonomy.tags.manage`, `taxonomy.authors.manage`, `taxonomy.entities.manage`, `seo.manage` |
| Importação (temporário) | os acima + `articles.create`, `articles.update`, `articles.publish`, `articles.schedule`, `media.manage`                                                 |

> Ler taxonomia exige escopo de **escrita** hoje — o Kal El não tem `taxonomy.read`. O
> token de entrega fica sobre-privilegiado, o que está registrado como lacuna em
> [KAL-EL-DISCOVERY.md](./KAL-EL-DISCOVERY.md) com a mudança proposta. Até lá, trate o
> token de entrega como credencial sensível e rotacione-o no mesmo ciclo de um token de
> escrita.

O token de importação é temporário: **revogue-o assim que a migração terminar.**

### 1.2 Webhook de publicação

No Kal El: `POST /v1/admin/sites/:siteId/webhooks`

```json
{
  "url": "https://www.maquinanerd.com.br/api/revalidate",
  "events": ["article.published", "article.updated"],
  "description": "Revalidação do portal Next",
  "secret": "<KAL_EL_WEBHOOK_SECRET>"
}
```

O segredo é mostrado **uma vez**, na criação. Guarde-o em `KAL_EL_WEBHOOK_SECRET`.
Rotacionar exige recriar o webhook — o Kal El recusa atualizar o segredo de propósito,
porque o assinante não teria como saber com qual chave uma entrega foi assinada.

Hoje só `article.published` é efetivamente emitido. Listagens de taxonomia e redirects
dependem do TTL de ISR até que os demais eventos existam.

### 1.3 Variáveis obrigatórias

Ver [`.env.example`](../../.env.example). Em produção o boot falha, de forma legível, se
faltar qualquer uma — inclusive `TRUST_PROXY`, que precisa ser respondida explicitamente.

---

## 2. Observação

| Sinal                       | Onde        | O que significa                                                |
| --------------------------- | ----------- | -------------------------------------------------------------- |
| `GET /api/health`           | balanceador | processo vivo. Não depende do CMS de propósito                 |
| `GET /api/health?ready=1`   | operador    | ambiente válido, token aceito e contrato do Kal El (abaixo)    |
| `content.optional-degraded` | log         | um módulo opcional caiu; a página continuou                    |
| `kalel.contract.violation`  | log         | o CMS mudou de formato. **Alerta**                             |
| `kalel.read.error`          | log         | indisponibilidade do CMS                                       |
| `kalel.read.rate-limited`   | log         | o Kal El recusou o token por excesso de chamadas. **Alerta**   |
| `revalidate.rejected`       | log         | webhook com assinatura ou evento inválido. Investigar          |
| `revalidate.duplicate`      | log         | reentrega normal. Não é erro                                   |
| `preview.rejected`          | log         | token de preview inválido ou expirado                          |
| `rum.metric`                | log         | Core Web Vitals por template e editoria                        |
| `discovery.degraded`        | log         | feed ou sitemap renderizado vazio por falha do CMS. **Alerta** |

Toda linha é JSON com `event`, `time` e um `correlationId` quando existe um. Segredos são
removidos na saída; nenhum log carrega token.

**`?ready=1`** faz a leitura sem a qual nada funciona: artigos publicados, `order=published`,
`offset=0`, `limit=1`, autenticada e sem cache, uma tentativa em 2 s. Fora de `ok` responde
503, e `checks` diz o motivo:

| `checks`              | Significa                                                                    |
| --------------------- | ---------------------------------------------------------------------------- |
| `env: fail`           | ambiente inválido — o boot lista cada variável                               |
| `kalel: unauthorized` | token revogado, de outro site ou sem `articles.read`                         |
| `kalel: unreachable`  | o CMS não respondeu no prazo                                                 |
| `kalel: fail`         | o CMS respondeu com outra recusa (5xx, 429, site inexistente)                |
| `contract: fail`      | a lista não bate com o schema — ver `kalel.contract.violation`               |
| `contract: degraded`  | a lista veio sem `total`: o Kal El não tem a ordem por publicação (kal-el#7) |

O healthcheck do container usa só `/api/health`: uma queda do CMS não pode derrubar e
reiniciar o portal dentro da mesma queda.

### Alertas que valem acordar alguém

- `kalel.contract.violation` — qualquer ocorrência. Significa que uma resposta do CMS
  deixou de satisfazer o schema; artigos podem estar sumindo.
- `readiness` falhando por mais de 2 minutos.
- `revalidate.rejected` acima de 5 por minuto — ou o segredo está errado, ou alguém está
  testando o endpoint.
- Taxa de 5xx acima de 1% em 5 minutos.

---

## 3. Cache e revalidação

| Superfície        | ISR   | Tag                                   |
| ----------------- | ----- | ------------------------------------- |
| Home              | 60 s  | `home`                                |
| Artigo            | 300 s | `article:{id}`, `article-slug:{slug}` |
| Editoria          | 120 s | `category:{slug}`                     |
| Autor / tag       | 300 s | `author:{slug}`, `tag:{slug}`         |
| Taxonomia e mídia | 1 h   | `taxonomy`, `media`                   |
| Sitemap           | 1 h   | `sitemap`                             |
| Busca             | —     | `no-store`, sempre dinâmica           |

Publicar dispara a purga por tag. **Se um artigo não aparecer:**

1. `revalidate.ok` no log? Se não, a entrega não chegou — confira o webhook no CMS.
2. Chegou mas foi rejeitada? `revalidate.rejected` diz o motivo.
3. Nenhum dos dois? A janela de ISR resolve sozinha em até 5 minutos. É o _backstop_, não
   o caminho normal.

### Múltiplas instâncias

O store de nonce do webhook é em processo. Com N instâncias, uma entrega pode ser
processada até N vezes — o efeito é uma purga redundante, nunca um efeito colateral
duplicado, porque revalidar é idempotente.

Para eliminar mesmo isso, implemente `NonceStore` sobre Redis:

```ts
async claim(key: string, ttlMs: number) {
  return (await redis.set(key, '1', 'PX', ttlMs, 'NX')) === 'OK';
}
```

É a única troca necessária — a interface tem um método por esse motivo.

---

## 4. Migração

### 4.0 De onde o importador lê

Duas origens, a mesma interface (`WpReadSource`), e nenhum consumidor sabe qual recebeu.

#### `--source archive` — um dump SQL, direto (recomendado)

Lê o `.sql` ou `.sql.gz` sem restaurar banco nenhum. **Não abre nenhuma conexão de rede**:
as linhas vêm do dump e os bytes das mídias de um diretório de uploads extraído.

```bash
export WP_ARCHIVE_DUMP='/caminho/para/127_0_0_1.sql'   # .sql ou .sql.gz
pnpm wp:import --source archive                        # ensaio: só escreve relatórios
pnpm wp:import --source archive --uploads /caminho/wp-content/uploads --apply
```

| Flag             | Para quê                                                                  |
| ---------------- | ------------------------------------------------------------------------- |
| `--dump`         | caminho do dump, se preferir a `WP_ARCHIVE_DUMP`                          |
| `--uploads`      | `wp-content/uploads` extraído; sem ele nenhum byte de mídia é transferido |
| `--table-prefix` | prefixo das tabelas, quando não for `wp_`                                 |
| `--category-map` | JSON `"categoria-wp": "editoria"`, para os posts sem editoria             |

O leitor descobre e imprime o que achou antes de qualquer coisa — contagens, `siteurl`,
`permalink_structure` — e falha nomeando `--table-prefix` se não encontrar as tabelas, em
vez de reportar um arquivo vazio como uma importação limpa.

**As mídias.** No backup entregue elas estão dentro de `wordpress-files.tar.gz`, partido
em 19 pedaços de 5 GB (~101 GB no total), sob
`www.maquinanerd.com.br/wp-content/uploads/` — verificado listando a primeira parte. Para
extrair só os uploads, sem gravar o WordPress inteiro:

```bash
cd '.../2026-09-08_095840'
sha256sum -c PARTS-SHA256SUMS.txt            # confira antes de gastar horas
cat wordpress-files.tar.gz.part-* | tar -xzf - -C /destino \
  --strip-components=2 'www.maquinanerd.com.br/wp-content/uploads/*'
```

Depois `--uploads /destino/uploads`. A transferência ainda exige as credenciais do Kal El;
sem `--apply` nenhum byte sai do lugar.

`--allow-private-assets` é **recusado** com esta origem: ela não faz requisição nenhuma,
então não há guarda de endereço para relaxar.

#### `--source rest` (padrão) — um WordPress no ar

```bash
export WP_BASE_URL='https://www.exemplo.com.br'
pnpm wp:import
```

Um dump também pode ser restaurado num WordPress local e lido por aqui, se o objetivo for
reproduzir o `the_content` do site com todos os plugins ativos:

```bash
# 1. Suba MySQL e WordPress apontando para um banco vazio (docker, ou o que preferir).
# 2. Restaure o dump:
mysql -h 127.0.0.1 -u wp -p wordpress < backup.sql
# 3. Ajuste siteurl/home para o host local, senão a REST devolve URLs de produção:
mysql -h 127.0.0.1 -u wp -p wordpress   -e "UPDATE wp_options SET option_value='http://localhost:8080' WHERE option_name IN ('siteurl','home');"
# 4. Confirme que a REST responde antes de qualquer outra coisa:
curl -s http://localhost:8080/wp-json/wp/v2/posts?per_page=1 | head -c 200
```

> O passo 3 importa mais do que parece: sem ele, `source_url` das mídias aponta para o
> domínio de produção e o download dos assets sai do ambiente local sem ninguém pedir.

Se o WordPress local ficar em `localhost`, o guarda de SSRF recusa os assets — ele
rejeita endereço privado e porta fora de 80/443, por projeto. Para um ensaio inteiramente
local existe `--allow-private-assets`, que **só é aceito quando todos os endpoints são
loopback**: apontar para um Kal El real com essa flag é recusado com erro.

Para ver o pipeline funcionando sem ter arquivo nenhum:

```bash
pnpm import:sandbox      # sobe um WordPress falso e um Kal El vazio, e imprime o env
```

### 4.0.1 Categorias que não são editorias

O portal tem sete editorias (as do kit: `cinema`, `series-e-tv`, `games`, `quadrinhos`,
`animes`, `videos`, `especiais`); este WordPress tem 8.619 categorias. Uma categoria vira
editoria se o slug for uma das sete ou um dos apelidos antigos (`filmes` → `cinema`,
`series` → `series-e-tv`, `reviews` → `especiais` e também tag `reviews`), e **tag** caso
contrário — nada é descartado. As URLs antigas de editoria (`/filmes`, `/series`,
`/noticias`, `/reviews`) redirecionam 308 para as novas, preservando página e slug.

Sobram os posts que não caem em nenhuma: **298 no arquivo real**, a maioria filada só em
`noticias`. Eles **falham a execução em vez de importar sem editoria**, porque um artigo
sem editoria é removido de toda listagem e do sitemap — existiria no CMS sem poder ser
encontrado no site.

O ensaio escreve a lista para você decidir:

```bash
cat artifacts/migration/full/unmapped-categories.json
```

```json
{ "categories": [{ "slug": "noticias", "posts": 222, "desk": null }, ...] }
```

Preencha os destinos num arquivo próprio (o formato é
`"categoria-do-wordpress": "editoria"`, veja
[`data/import/category-map.example.json`](../../data/import/category-map.example.json)) e
passe em `--category-map`. Um destino que não seja uma das seis é recusado com erro:
arquivos sob uma rota inexistente dariam 404 na própria URL canônica.

### 4.1 Ensaio

```bash
pnpm wp:import --limit 100
```

Leia `artifacts/migration/import-report.json` antes de qualquer coisa:

- `unknownBlocks` — o que o parser não soube representar. Uma cauda longa é normal em dez
  anos de redação; um tipo com contagem alta merece um caso no parser.
- `imagesMissingAlt` — mutirão editorial, não bloqueio técnico.
- `droppedTags` / `droppedAttributes` — o que a sanitização removeu.
- `unknown-blocks.ndjson` — amostras com o trecho, para julgar o que os números significam.

### 4.2 Importação

```bash
pnpm wp:import --apply --resume
```

Reexecutável por construção: `externalKey` mais idempotency key por entidade fazem a
segunda passada **atualizar**, nunca duplicar. Prova disso é rodar duas vezes e comparar —
a segunda deve reportar `created: 0`.

Um artigo editado no CMS após a importação responde 409 e é deixado intacto: sobrescrever
uma mudança editorial com uma reimportação é pior que pular e reportar.

Uma falha de download ou de metadados **conta como falha da execução** — `--apply`
termina com código 1. Alt text que não chegou a ser gravado fica registrado em
`pendingMediaMeta` no state file e é reescrito na execução seguinte, mesmo que o arquivo
em si já esteja no Kal El. Perder alt text em silêncio seria permanente.

#### Rede durante a importação

O importador só busca assets nos hosts declarados (`WP_BASE_URL` mais `WP_ASSET_HOSTS`) e,
com `--external-images`, nos hosts de terceiros que o pré-passe encontrou nos corpos das
matérias. Em todos os casos:

- rejeita qualquer nome que resolva para faixa privada, loopback ou link-local;
- **conecta só ao endereço que a verificação aprovou**: a resolução que o socket usa é a
  verificada, então um nome que mude de resposta entre a checagem e a conexão (DNS
  rebinding) é recusado;
- revalida host e endereço a cada redirect;
- corta a leitura do corpo ao passar de `--max-asset-mb`;
- só aceita bytes que sejam de fato imagem raster (SVG é recusado).

A limitação que existia — resolver o nome sem fixar o endereço do socket — está fechada
(`scripts/wp/pinned-fetch.ts`).

### 4.2.1 A sequência exata, do inventário à verificação

Copiável, na ordem. Nada aqui escreve em produção sem `--apply`.

```bash
# 0. Inventário: quantos itens existem na origem, sem tocar em nada.
curl -sI "$WP_BASE_URL/wp-json/wp/v2/posts?per_page=1"      | grep -i x-wp-total
curl -sI "$WP_BASE_URL/wp-json/wp/v2/media?per_page=1"      | grep -i x-wp-total
curl -sI "$WP_BASE_URL/wp-json/wp/v2/categories?per_page=1" | grep -i x-wp-total

# 1. Ensaio de uma fatia, para ler o relatório antes de qualquer escrita.
pnpm wp:import --limit 100
cat artifacts/migration/import-report.json

# 2. Ensaio completo. Continua sem escrever nada.
pnpm wp:import

# 3. Importação real, retomável.
pnpm wp:import --apply --resume

# 4. Segunda execução: a prova de idempotência. Deve reportar created: 0.
pnpm wp:import --apply --resume

# 5. Delta final, na virada, só o que mudou depois da data.
pnpm wp:import --apply --resume --since 2026-09-01T00:00:00Z

# 6. Redirects e verificação. Zero 404 é bloqueante de lançamento.
pnpm redirects:build --apply
pnpm urls:verify --base https://staging.exemplo --urls data/import/top-urls.txt
```

O passo 4 não é cerimônia: é o teste que o
[wp-import-end-to-end](../../tests/integration/wp-import-end-to-end.test.ts) executa
automaticamente contra stand-ins, e é o mesmo comportamento que se espera contra o CMS
real. Se ele reportar `created` diferente de zero, **pare** — algo em `externalKey` ou no
state file não está funcionando, e continuar duplica o acervo.

### 4.2.2 Em produção: a sessão de importação

Os passos 3 e 4 acima, contra o Kal El de produção, rodam como uma sessão
([DECISIONS §7.15](./DECISIONS.md)):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\acervo-import.ps1 `
  -KalElBaseUrl https://<api do kal el> -SiteId <uuid do site> -AdminEmail <owner> `
  -Dump C:\caminho\127_0_0_1.sql -Uploads C:\mn-import\uploads
```

A senha do owner é pedida sem eco. A sessão:

1. pausa os webhooks do site;
2. cria um token de importação de 48 horas, que nunca aparece;
3. roda o importador com `--external-images --auto-desk --concurrency 4`;
4. roda de novo e exige `created: 0`;
5. retoma os webhooks e revoga o token, com sucesso ou falha.

O relatório fica em `artifacts/migration/producao/`: `import-report.json` (contagens, mídia
ausente do disco, falhas), `external-images.json` (por host), `auto-desk.json` (cada decisão
com a evidência, e a lista do que ficou de fora) e `duplicates.json`.

O que a primeira passada faz sem falhar, por decisão (DECISIONS §7.16 e §7.18):

- **posts publicados duas vezes** (título e corpo idênticos) entram uma vez só; a cópia é
  contada em `duplicatesSkipped`;
- **arquivo ausente de `--uploads` que nenhuma matéria importada usa** é pulado, em
  `mediaMissingUnused`; um arquivo ausente que alguma matéria usa continua falhando;
- **imagem de terceiro que não baixa** (404, página HTML, host de exemplo) conta por host em
  `externalImagesFailed` e sai do corpo, como antes; falha de gravação no Kal El conta como
  `failed`;
- **post sem editoria que o `--auto-desk` não classifica** fica de fora, em `noDesk`;
- **matéria que a redação editou no Kal El depois da importação** fica como a redação deixou,
  conta em `editedInCms` e é listada em `edited-in-cms.json`;
- **nome de termo** é decodificado (`&amp;` vira `&`) e, se passar do limite do Kal El, cortado
  numa palavra (`termsShortened`); uma tag que uma execução anterior gravou com o nome escapado é
  renomeada (`termsRenamed`), a não ser que a redação já a tenha renomeado;
- **parágrafo acima de 10.000 caracteres** vai em vários nós de texto, e o leitor vê o mesmo
  parágrafo.

- **Antes:** o Kal El com a leitura por ids e `GET /media/storage`
  ([kal-el#12](https://github.com/maquinanerd/kal-el/pull/12)) no ar, o portal com o H3 no
  ar, e `RATE_LIMIT_MAX` do Kal El elevado para a janela — o limite é por token por minuto, e
  com o padrão de 600 a primeira passada (~340 mil requisições) leva perto de 10 horas. O
  compose do Coolify repassa a variável desde
  [kal-el#13](https://github.com/maquinanerd/kal-el/pull/13); em 2026-09-17 ela foi posta em
  5000 nas Environment Variables do recurso.
- **`WP_BASE_URL` não pode estar definido** no ambiente: o leitor do arquivo a usaria como
  URL do site e mudaria quais imagens contam como do próprio site.
- **Janela fechada no meio:** rode o mesmo comando com `-Recover` antes de qualquer outra
  coisa. Ele retoma os webhooks e revoga o token da sessão interrompida; a importação em si é
  retomável com `--resume`.
- **A máquina que roda a importação:** a memória do processo fica na casa de 1 GB do começo ao
  fim. Memória que cresce junto com o que já subiu é o corpo do upload segurando cada arquivo
  ([DECISIONS §7.17](./DECISIONS.md)) — interrompa, atualize o código e retome; o que já está
  no Kal El é reconhecido pelo `externalKey`.
- **Depois:** `WP_ARCHIVE_DUMP=… pnpm redirects:build --source archive --auto-desk --apply`
  (as exceções que a regra de runtime não cobre: slugs cortados em 120 caracteres,
  percent-escapes e o endereço antigo das cópias; sem `KAL_EL_*` no ambiente ele lê só o
  arquivo), commit de `data/legacy-redirects.json` e redeploy do portal; `pnpm urls:verify`
  sobre todos os endereços antigos; `RATE_LIMIT_MAX` removido das variáveis do Kal El e
  redeploy.
- **Uma vez hospedadas as imagens de terceiros, todo `--apply` precisa de
  `--external-images`**: sem a flag, os corpos converteriam com essas imagens sem resolver, e
  cada matéria atualizada perderia as imagens. O importador recusa antes de escrever.
- **Cuidado com `--skip-media --apply`** num acervo já importado: pelo mesmo motivo, tira as
  imagens dos corpos.

### 4.3 Redirects

```bash
pnpm redirects:build --apply
pnpm urls:verify --base https://staging.exemplo --urls data/import/top-urls.txt
```

**Critério de bloqueio de lançamento: zero 404 acidental e zero loop.** `urls:verify` sai
com código não-zero se qualquer URL terminar em 404, loop ou mais hops que o permitido.

> Sem a amostra de URLs de maior tráfego este critério **não pode ser declarado atendido**.
> A ferramenta diz isso e sai com código 2 em vez de fingir sucesso.

---

## 4.4 O build precisa do CMS

`next build` pré-renderiza as editorias. Se o Kal El estiver inalcançável nesse momento,
**o build falha** — e isso é intencional: publicar estaticamente uma editoria vazia é pior
que um deploy que não acontece, porque a editoria vazia fica no CDN.

As exceções são `/feed.xml` e `/news-sitemap.xml`, que degradam para um documento válido
e vazio, com `cache-control` curto para que a próxima revalidação repare. O motivo é
assimétrico e vale dizer: uma página tem estado de erro, um feed não tem. Um feed que
explode derruba o deploy inteiro; um feed vazio por cinco minutos não derruba nada, e a
linha `discovery.degraded` no log é o que faz alguém olhar.

Antes de rodar um build de produção, confira `GET /v1/health` no CMS.

## 4.5 Imagem e deploy

O portal sai como imagem Docker (Next standalone, Node 22, usuário sem privilégio), pensada
para o mesmo tipo de host do Kal El: container atrás do proxy reverso da plataforma, TLS
terminado no proxy.

```bash
cp .env.example .env.production     # preencha; o arquivo é ignorado pelo git
DOCKER_BUILDKIT=1 docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
curl -fsS http://127.0.0.1:3002/api/health
curl -fsS 'http://127.0.0.1:3002/api/health?ready=1'
```

- **O build lê o Kal El** (seção 4.4), então precisa das variáveis. Neste compose elas
  entram como _secret_ do BuildKit (`portal_env`), montado só no `RUN` do build: não ficam
  em camada, em `docker history` nem em argumento de build. O Coolify não monta _secret_, e
  o compose dele passa as mesmas variáveis como _build args_ (4.5.1).
- `KAL_EL_BASE_URL` é a origem **https pública** do CMS, não o nome do serviço no compose:
  a validação de ambiente recusa origem em texto puro em produção.
- Porta publicada só em `127.0.0.1:3002`: um proxy no próprio host usa
  `http://127.0.0.1:3002`; um proxy em container (Traefik, Easypanel) entra numa rede
  compartilhada com o serviço `portal` e dispensa a porta. Nunca publique em `0.0.0.0`:
  com `TRUST_PROXY=true` (o compose já define) quem chegasse direto forjaria
  `X-Forwarded-For`.
- **`TRUST_PROXY=true` pressupõe um proxy que escreve em `X-Forwarded-For` o endereço de
  quem se conectou a ele**, como o Traefik faz no padrão (sem `forwardedHeaders.insecure` nem
  `trustedIPs`). Os limites usam a **última** entrada do cabeçalho, a única que o chamador
  não escreve. Quando ela é do Cloudflare, usam o `CF-Connecting-IP`; de qualquer outro
  endereço esse cabeçalho é ignorado, porque a origem é alcançável por fora do Cloudflare
  (`lib/client-address.ts`). IPv6 conta por /64. As faixas do Cloudflare são as de
  <https://www.cloudflare.com/ips/>, conferidas em 2026-09-16: uma faixa nova só junta os
  leitores dela no balde do servidor de borda até a lista ser atualizada. Outro CDN na
  frente precisa do mesmo tratamento para o cabeçalho dele.
- **Uma instância.** Cache ISR e nonce do webhook vivem no processo (seção 3). Escalar
  horizontalmente exige cache handler e `NonceStore` compartilhados antes.
- **Rollback de deploy:** marque cada imagem com o commit (`-t maquinanerd-portal:<sha>`) e
  volte com `docker compose up -d` na tag anterior. Nada no portal tem estado a migrar.

### 4.5.1 No Coolify

É como o staging roda, no mesmo servidor do Kal El, com `docker-compose.coolify.yml` — o
mesmo modelo do compose do Kal El:

1. **Recurso novo:** repositório `maquinanerd/MN_Next` (público), branch
   `chore/maquina-nerd-kalel-migration`, build pack **Docker Compose**, arquivo
   `/docker-compose.coolify.yml`.
2. **Domínio** do serviço `portal` em **https** antes do primeiro deploy. O `sslip.io`
   gerado serve; um host real precisa do DNS antes. `NEXT_PUBLIC_SITE_URL` sai daí e entra
   no build — trocar o domínio exige redeploy.
3. **Variáveis**, em Environment Variables: `KAL_EL_BASE_URL` (a origem https da API do
   Kal El) e `KAL_EL_SITE_ID`. `MEDIA_ALLOWED_HOSTS` fica vazio: a mídia do Kal El exige
   token e sai pelo proxy `/media/[id]`. `SERVICE_BASE64_64_WEBHOOK` e
   `SERVICE_BASE64_64_PREVIEW` o Coolify gera. O campo de valor do Coolify é do tipo senha:
   o preenchimento automático do navegador pode pôr um e-mail salvo em "Comment" e uma senha
   salva em "Value". Escreva o comentário antes do valor e confira os dois antes de salvar.
   Uma variável que ficar vazia aparece no build como `… is required in staging`.
4. **Provisionamento** (seção 1.0), na máquina do operador, com `PORTAL_PUBLIC_URL` = o
   domínio do passo 2 e `KAL_EL_WEBHOOK_SECRET` = o valor de `SERVICE_BASE64_64_WEBHOOK`:
   `pnpm kalel:provision --apply --new-token`. O token de entrega aparece **uma vez**.
5. **`KAL_EL_SERVICE_TOKEN`** colado direto no Coolify. Nunca em arquivo, chat ou commit.
6. **Deploy.** Depois: `GET /api/health` → 200; `GET /api/health?ready=1` → 200 com
   `"contract":"ok"`; `robots.txt` com `Disallow: /` e `X-Robots-Tag: noindex, nofollow`
   enquanto `APP_ENV=staging`.

No Windows, `scripts/coolify-provision.ps1` faz os passos 4 e 5 e dispara o deploy: lê
`SERVICE_BASE64_64_WEBHOOK` pela API do Coolify, roda o provisionamento e grava o token de
entrega direto em `KAL_EL_SERVICE_TOKEN`, sem imprimi-lo. Pede, sem eco, um token da API do
Coolify (leitura de segredos, escrita e deploy) e a senha do owner no Kal El.

O token chega ao build como _build arg_, e o Coolify injeta um `ARG` por variável do recurso
em todas as etapas do Dockerfile, inclusive a final: o valor fica nos metadados da imagem
naquele servidor (`docker history`). Quem o vê é quem tem acesso ao Docker do host — o mesmo
grupo que já o lê no ambiente do container em execução. Lembre que é um token com escopos
`*.manage` de taxonomia e SEO (seção 1.1): se o host mudar de mãos, revogue e emita outro.

## 5. Virada

> Feita em 2026-09-16, fora desta ordem: o WordPress já estava fora do ar, e o owner decidiu
> virar antes da importação do acervo. Registro em
> [FINAL-VERIFICATION §4.3](./FINAL-VERIFICATION.md), decisões em
> [DECISIONS §7.14](./DECISIONS.md). A lista abaixo fica como procedimento de referência.

0. **Kal El pronto.** [kal-el#6](https://github.com/maquinanerd/kal-el/pull/6) (filtro
   `?slug=`) e [kal-el#7](https://github.com/maquinanerd/kal-el/pull/7) (ordem por
   publicação) estão mergeados e publicados desde 2026-09-14; a migração `0006` rodou no
   boot da API. `?ready=1` com `"contract":"ok"` é a confirmação. Depois
   `pnpm kalel:provision --apply --new-token` contra o site de produção.
1. **Staging com `noindex`.** `APP_ENV=staging`: `robots.txt` devolve `Disallow: /` e toda
   resposta leva `X-Robots-Tag: noindex, nofollow`. Aberto à redação por uma semana.
2. **Sitemaps no Search Console antes do DNS.**
3. **Congelamento de publicação no WordPress.** Delta final:
   `pnpm wp:import --apply --resume --since <ISO>`.
4. **Verificação de URLs contra staging.** Zero 404 é bloqueante.
5. **TTL do DNS para 300 s** com pelo menos 24 h de antecedência.
6. **Virada em janela de tráfego baixo** — madrugada de domingo, horário de Brasília.
7. **Primeiros 30 minutos:** readiness, taxa de 5xx, `kalel.contract.violation`, e uma
   amostra manual de URLs de tráfego.

### Cloudflare, como ficou

| Onde                       | Estado                                                                                                                                                         |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DNS                        | raiz, `www` e `vps` pelo proxy. O proxy só leva HTTP: SSH pelo nome `vps.maquinanerd.com.br` não conecta mais, e vai pelo IP do servidor                       |
| SSL/TLS                    | modo "Completo"; "Sempre usar HTTPS" **desligado**: http → https sai do Traefik (302), e a renovação do Let's Encrypt na origem depende de o http chegar lá    |
| Regras de redirecionamento | `https://maquinanerd.com.br/*` → `https://www.maquinanerd.com.br/${1}`, 301, com a query string                                                                |
| Cache Rules                | "[DO NOT EDIT] WP Super Page Cache Plugin rules", que sobrou do WordPress: o HTML do `www` fica na borda pelo `s-maxage` da página (60 s na home e na matéria) |
| Webhook do Kal El          | pelo `sslip.io` do recurso, direto na origem, sem o Cloudflare no caminho                                                                                      |

Uma publicação chega ao `www` em até cerca de um minuto: o webhook revalida a origem na hora,
e a borda busca de novo quando o `s-maxage` vence. Para não esperar: Caching → Configuração →
limpar o cache da URL.

### Rollback

Na virada não havia WordPress no ar para onde voltar o DNS. Um problema na borda se desfaz
no painel do Cloudflare: desligar a regra de redirecionamento, ou pôr o registro em "somente
DNS". Se o problema for do portal:

- CMS fora do ar → páginas em ISR continuam servindo; a readiness já estará vermelha.
- Regressão de conteúdo → `revalidateTag` na tag afetada, ou redeploy do commit anterior.
- Regressão visual → a baseline diz exatamente o que mudou (`pnpm test:visual`).

---

## 6. Incidentes comuns

**Imagens sumiram dos cards.** O índice de mídia é paginado por `offset` até o `total`; se
o CMS mudar para cursor, o índice trunca. Procure `kalel.contract.violation` e confira
`fetchMediaIndex`.

**Preview devolve 404.** O grant é preso a um slug e dura 15 minutos. Um link antigo, ou
para outro artigo, é 404 por projeto. Peça um preview novo no CMS.

**Anúncio não aparece em um artigo.** Provavelmente brand safety: artigos com tag
`morte`, `acidente`, `tragedia`, `processo-judicial` ou `violencia` não recebem inventário.
É decidido no servidor e é intencional.

**Newsletter responde 501.** Não há provedor configurado (`NEWSLETTER_PROVIDER_URL`). O
formulário mostra erro real em vez de fingir uma inscrição.

**Build falha com `Invalid environment`.** A mensagem lista cada variável faltando ou
inválida. É o comportamento pretendido: uma configuração errada deve falhar no boot, não
em produção.
