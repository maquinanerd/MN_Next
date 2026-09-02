# Runbook — operação, virada e rollback

Escrito para quem estiver de plantão às três da manhã. Cada procedimento diz o que
observar, o que fazer, e como saber que funcionou.

---

## 1. Provisionamento

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
  "events": ["article.published"],
  "description": "Revalidação do portal Next"
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

| Sinal                       | Onde        | O que significa                                                     |
| --------------------------- | ----------- | ------------------------------------------------------------------- |
| `GET /api/health`           | balanceador | processo vivo. Não depende do CMS de propósito                      |
| `GET /api/health?ready=1`   | balanceador | ambiente válido **e** Kal El alcançável                             |
| `content.optional-degraded` | log         | um módulo opcional caiu; a página continuou. Cinerie é o caso comum |
| `kalel.contract.violation`  | log         | o CMS mudou de formato. **Alerta**                                  |
| `kalel.read.error`          | log         | indisponibilidade do CMS                                            |
| `revalidate.rejected`       | log         | webhook com assinatura ou evento inválido. Investigar               |
| `revalidate.duplicate`      | log         | reentrega normal. Não é erro                                        |
| `preview.rejected`          | log         | token de preview inválido ou expirado                               |
| `rum.metric`                | log         | Core Web Vitals por template e editoria                             |
| `discovery.degraded`        | log         | feed ou sitemap renderizado vazio por falha do CMS. **Alerta**      |

Toda linha é JSON com `event`, `time` e um `correlationId` quando existe um. Segredos são
removidos na saída; nenhum log carrega token.

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

### 4.0 O que o importador lê — e o que fazer com um dump SQL

**Só a REST API do WordPress.** Não existe leitor de WXR nem de SQL, e não vale fingir que
existe: um leitor escrito antes de o arquivo chegar seria adivinhação sobre prefixo de
tabela, plugins e charset.

Um backup em SQL vira uma origem legível em quatro passos, todos locais:

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

O importador só busca assets nos hosts declarados (`WP_BASE_URL` mais
`WP_ASSET_HOSTS`), rejeita qualquer resposta cujo hostname resolva para faixa privada,
loopback ou link-local, revalida isso a cada redirect e corta a leitura do corpo ao
ultrapassar `--max-asset-mb`.

> **Limitação conhecida:** a validação resolve o nome, mas não fixa o endereço usado pelo
> socket. Um nome que mude de resposta entre a resolução e a conexão (DNS rebinding)
> continua teoricamente possível; fechar isso exige um dispatcher com endereço fixado.
> Enquanto isso, o controle real é o allowlist: **não inclua em `WP_ASSET_HOSTS` nenhum
> host cujo DNS você não controle**, e rode a importação de uma máquina sem acesso a
> serviços internos sensíveis.

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

## 5. Virada

1. **Staging com `noindex`.** `APP_ENV=staging` e um host que não seja o de produção — o
   `robots.ts` já devolve `Disallow: /` para host de staging. Aberto à redação por uma
   semana.
2. **Sitemaps no Search Console antes do DNS.**
3. **Congelamento de publicação no WordPress.** Delta final:
   `pnpm wp:import --apply --resume --since <ISO>`.
4. **Verificação de URLs contra staging.** Zero 404 é bloqueante.
5. **TTL do DNS para 300 s** com pelo menos 24 h de antecedência.
6. **Virada em janela de tráfego baixo** — madrugada de domingo, horário de Brasília.
7. **Primeiros 30 minutos:** readiness, taxa de 5xx, `kalel.contract.violation`, e uma
   amostra manual de URLs de tráfego.

### Rollback

O WordPress fica de pé por 30 dias. Reverter é **apontar o DNS de volta** — nada foi
apagado na origem, porque nada é escrito nela em momento algum.

Se o problema for do portal e não do DNS:

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
