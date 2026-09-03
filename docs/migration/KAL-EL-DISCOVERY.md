# Descoberta do Kal El

Levantamento feito por **inspeção do código-fonte** do CMS no checkout local
(`C:\Users\pablo\Documents\OpenCode\Kal El`), não por suposição a partir do contrato-alvo.
Nenhum segredo, host de produção ou token aparece neste documento.

| Item             | Valor                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------- |
| Transporte       | REST sobre HTTP, versionado em `/v1`                                                  |
| Envelope         | `{ "data": … }` em toda resposta de sucesso; `{ "error": { code, message } }` em erro |
| Multi-site       | Sim — quase tudo vive sob `/v1/sites/:siteId`                                         |
| Autenticação     | `Authorization: Bearer ke_st.…` (service token opaco, revogável, preso a um site)     |
| Documentação     | OpenAPI gerado em memória (`@kal-el/contracts`), servido em `/docs` quando habilitado |
| Health           | `GET /health`, `/ready`, `/v1/health`, `/v1/ready` — públicos                         |
| Fonte da verdade | `packages/contracts/src/*.ts` (Zod) e `apps/api/src/routes/site.ts`                   |

## Recursos confirmados

| Recurso    | Endpoint                                    | Escopo exigido                |
| ---------- | ------------------------------------------- | ----------------------------- |
| Artigos    | `GET /v1/sites/:siteId/articles`            | `articles.read`               |
| Artigo     | `GET /v1/sites/:siteId/articles/:articleId` | `articles.read`               |
| Categorias | `GET /v1/sites/:siteId/categories`          | `taxonomy.categories.manage`  |
| Tags       | `GET /v1/sites/:siteId/tags`                | `taxonomy.tags.manage`        |
| Autores    | `GET /v1/sites/:siteId/authors`             | `taxonomy.authors.manage`     |
| Entidades  | `GET /v1/sites/:siteId/entities`            | `taxonomy.entities.manage`    |
| Mídia      | `GET /v1/sites/:siteId/media`               | `media.read`                  |
| Bytes      | `GET /v1/sites/:siteId/media/:mediaId/file` | `media.read`                  |
| Redirects  | `GET /v1/sites/:siteId/redirects`           | `seo.manage`                  |
| Preview    | `GET /v1/preview/:token`                    | capability token (sem sessão) |

### Paginação — dois modelos na mesma API

- **Artigos: cursor.** `?cursor=&limit=` (máx. 100), resposta `{ items, nextCursor }`,
  ordenada por `updatedAt DESC, id DESC`.
- **Mídia: offset.** `?limit=&offset=` (máx. 200), resposta `{ items, total }` — **sem
  cursor**.

Confundir os dois trunca o índice de mídia na primeira página e faz capas antigas
sumirem dos cards. Está coberto por teste de regressão em
`tests/integration/review-regressions.test.ts`.

## Modelo de conteúdo real

- `type`: `article | review | list | video | audio`
- `status`: `draft | in_review | scheduled | published | blocked | archived`
- `document`: `{ version: 2, nodes: [...] }`, nós `paragraph`, `heading`, `quote`, `list`,
  `table`, `image`, `gallery`, `embed`, `source`. Texto é _inline content_ com marks
  (`bold`, `italic`, `code`, `underline`, `strike`, `link`).
- Relações (`authors`, `categories`, `tags`, `entities`) chegam como **arrays de UUID**;
  o mapper hidrata a partir dos índices de taxonomia.
- `seo`: `seoTitle`, `metaDescription`, `canonicalUrl`, `robotsIndex`, `robotsFollow`,
  `socialTitle`, `socialDescription`, `socialImageMediaId`, `primaryCategoryId`.
- `externalKey` (≤256) e `provenance` — é o que torna a importação idempotente.

## Webhook — o que realmente chega

O Kal El **não recebe** webhook; ele **envia**. O worker (`apps/worker/src/dispatcher.ts`)
faz POST no destino cadastrado.

```http
POST /api/revalidate
Content-Type: application/json
X-Kal-El-Event: article.published
X-Kal-El-Delivery: <uuid por tentativa>
X-Kal-El-Idempotency: article:<id>:publish:<epoch>
X-Kal-El-Signature: sha256=<hex hmac-sha256 do corpo bruto>

{ "articleId": "...", "slug": "...", "publishedAt": "...", "version": 3 }
```

- Assinatura: `HMAC-SHA-256(secret, rawBody)` em hex, prefixada por `sha256=`.
- Entrega **at-least-once**, com backoff exponencial por assinante e no máximo 5
  tentativas. Não segue redirects.
- Eventos cadastráveis: `article.published`, `article.scheduled`, `article.updated`.
  **Só `article.published` é efetivamente emitido** hoje.

### Divergência registrada: não existe timestamp assinado

O contrato-alvo (`docs/02-kalel-integration.md`) presume `timestamp ≤ 5 min` no header.
**O Kal El não envia timestamp.** A proteção contra replay foi construída com o que existe:

1. `X-Kal-El-Idempotency` como nonce, com claim **atômico** (`MemoryNonceStore.claim`);
2. o `publishedAt` **assinado** limita quão antiga uma publicação pode ser.

Isso impede replay de uma entrega capturada. É mais fraco do que um timestamp assinado
apenas contra um adversário que consiga forjar `publishedAt` — o que a assinatura já
impede. **Mudança sugerida ao Kal El:** incluir `issuedAt` e `eventId` no payload
assinado.

> **Operação multi-instância.** O nonce store é em processo. Com mais de uma instância o
> pior caso é uma revalidação redundante — nunca um efeito colateral duplicado, porque
> revalidar é idempotente. A interface `NonceStore` tem um único método para que trocar
> por Redis (`SET key NX PX ttl`) seja uma mudança de um arquivo. Está no runbook.

## Preview

O Kal El emite `kpv.<base64url({s,a,e})>.<hex hmac>`, assinado com o **`SESSION_SECRET`
do CMS**, TTL de 15 minutos, sem `aud`, `slug` ou uso único.

Esta aplicação não pode — e não deve — ter o `SESSION_SECRET` do CMS. Portanto:

1. `/api/preview?token=…` trata o token como **opaco** e o resgata server-side em
   `GET /v1/preview/:token`;
2. compara o `slug` devolvido com o solicitado;
3. emite **um grant próprio** (cookie `HttpOnly`, assinado com `KAL_EL_PREVIEW_SECRET`)
   que nomeia aquele único slug.

O passo 3 existe porque `draftMode()` é um interruptor global: sem ele, um token
legítimo de um rascunho abriria **qualquer** slug não publicado que alguém adivinhasse.

## Lacunas entre o contrato-alvo e a API real

| Contrato-alvo                                             | Realidade                            | Como foi adaptado                                                                       |
| --------------------------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------- |
| Endpoint público de leitura                               | Não existe; tudo exige service token | Leitura server-only; nenhum bearer chega ao browser                                     |
| `GET /articles/{idOrSlug}`                                | Só por UUID                          | **Mudança mínima aplicada no Kal El**: filtro `?slug=` (commit próprio, branch própria) |
| `/content/home`                                           | Não existe                           | Home composta a partir da listagem, com cache por tag                                   |
| Sitemap                                                   | Não existe                           | Gerado no Next a partir de um índice completo cacheado                                  |
| URL de imagem navegável                                   | Bytes exigem `media.read`            | Proxy autenticado em `/media/[id]`, tipo fixado pelo MIME do CMS                        |
| `content.deleted`, `taxonomy.updated`, `redirect.updated` | Não emitidos                         | TTL de ISR cobre; documentado como limitação                                            |
| Escopos `media:write`, `content:write`                    | Não existem                          | Traduzidos no provisionamento para os escopos reais                                     |

### Lacunas que permanecem abertas (sem mudança no Kal El)

1. **Comercial.** Não há modelo de oferta/preço/nota. `CommercialMeta` é derivada de tag
   reservada (`patrocinado`, `afiliado`, `review-amostra`, `campanha`) + entidade de tipo
   `brand`. Preço, `verifiedAt`, prós/contras, nota, logo do anunciante e as condições de
   campanha (`campaignTerms`) **não têm onde morar** no CMS.
   _Proposta:_ coluna `commercial jsonb` nullable em `articles` + schema Zod.

   _Consequência hoje:_ a caixa de compra do review, o selo "Oferecido por" e a tarja de
   condições da landing sazonal renderizam em modo fixture e **não renderizam** com o
   provider Kal El. Não é degradação silenciosa — é o modelo faltando, e o componente não
   desenha o que não recebe.

2. **Especiais e ao vivo.** Não há modelo de franquia/dossiê/evento. Um especial é uma
   categoria filha de `especiais`; um evento ao vivo é um artigo com a tag `ao-vivo` cujos
   `heading` viram a timeline.
3. **`longform` e `urgent`** não existem como `type`; são tags reservadas.
4. **Leitura de taxonomia exige escopo de escrita** (`taxonomy.*.manage`) e a de redirects
   exige `seo.manage`. Um token de entrega fica sobre-privilegiado.
   _Proposta:_ permissões `taxonomy.read` e `seo.read` aceitas nos GETs correspondentes.

## Mudança aplicada no Kal El

Uma única mudança, isolada, testada e em **commit separado no repositório do Kal El**
(branch `feat/article-slug-filter`, commit `83ad1e8`):

- `slug` em `articleListQuerySchema`;
- uma condição `eq(articles.slug, …)` em `listArticles`;
- a query documentada no OpenAPI;
- `apps/api/tests/article-slug-filter.test.ts` — 5 casos, verdes contra Postgres real.

**Por que era indispensável.** O portal serve `/{categoria}/{slug}` e só tem o slug. Sem
filtro, resolver um artigo custa percorrer o acervo inteiro a cada request — O(n), pior a
cada ano de arquivo. `q` não substitui: é `ilike` no _título_.

O adaptador continua correto **sem** essa mudança: como o schema da query não é `.strict()`,
uma instância sem o patch ignora o parâmetro e responde com o artigo mais recente — por
isso o resultado é sempre reconferido contra o slug pedido e, se divergir, cai no índice
completo. Correto nos dois casos, uma ida e volta no caso corrigido.

## Verificação sem credenciais: o CMS de contrato

Nenhuma execução contra o Kal El real foi possível. O que passou a existir no lugar de
uma afirmação de desenho é um **stand-in fiel ao contrato** em `tests/fake-kalel/`, e um
gate que roda a aplicação inteira contra ele com `CONTENT_SOURCE=kalel`:

```bash
pnpm test:kalel          # sobe o CMS falso + a app em modo kalel e roda 23 verificações
pnpm kalel:fake          # só o CMS falso, para desenvolvimento manual
```

Duas regras o mantêm honesto:

1. **Toda resposta é validada antes de sair** — contra `packages/content/src/kalel/dto.ts`,
   os mesmos schemas que a aplicação usa para parsear. Um duplo que deriva para "o que
   faz o app passar" não prova nada; este falha com 500 nomeando o campo.
2. **Ele imita o que a API real tem de incômodo**: artigo pagina por cursor opaco, mídia
   pagina por `limit`/`offset` com `total`. São dois modelos na mesma API, e código que
   presume um só quebra aqui.

O corpus tem 40 artigos publicados em seis editorias, 24 mídias (duas páginas de offset)
e um rascunho que só o preview abre. As formas foram transcritas de
`packages/contracts/src/*.ts` do Kal El — que é lido, nunca copiado para este repositório.

**O que o gate observou funcionando:** home, artigo com documento renderizado nó a nó, as
seis editorias, tag, autor, 404 real, busca com e sem resultado, proxy de mídia
autenticado devolvendo bytes de imagem, índice de sitemap e seus filhos, news sitemap,
RSS, JSON-LD com `NewsArticle` e `BreadcrumbList`, readiness, ausência de token em toda
página, e o rascunho invisível para leitura pública.

O que ele **não** substitui: latência real, volume real, e o comportamento do CMS sob
carga. Isso continua pendente de credenciais.

## Escopos mínimos por finalidade

| Finalidade           | Escopos                                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| Entrega (runtime)    | `articles.read`, `media.read`, `taxonomy.*.manage` (leitura), `seo.manage` (leitura de redirects)     |
| Importação WordPress | acima + `articles.create`, `articles.update`, `articles.publish`, `articles.schedule`, `media.manage` |

O token de importação é temporário e deve ser revogado ao fim da migração.
