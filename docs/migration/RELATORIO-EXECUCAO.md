# Relatório de execução — migração Máquina Nerd → Next.js + Kal El

Registro completo do que foi construído, como foi verificado, o que custou e o que ficou
de fora. Todos os números vêm de comandos executados ou do transcript da sessão; nenhum é
estimativa.

- **Repositório:** [maquinanerd/MN_Next](https://github.com/maquinanerd/MN_Next)
- **Branch:** `chore/maquina-nerd-kalel-migration` (4 commits, empurrada)
- **Janela:** 2026-09-01 16:00 UTC → 2026-09-02 14:50 UTC (~22 h 50 min)
- **Ambiente:** Windows 11, Node 24.19.0, pnpm 11.15.1, Next 15.5.4, React 19

---

> **Continuação, 2026-09-02.** Quatro waves depois deste relatório — auditoria técnica,
> integração observada, importador executado e fidelidade visual — mudaram números e
> conclusões. O estado corrente está em [FINAL-VERIFICATION.md](./FINAL-VERIFICATION.md)
> §1.1 e em [VISUAL-AUDIT.md](./VISUAL-AUDIT.md). O que segue abaixo descreve a entrega
> original e continua válido como história; onde divergir do estado atual, valem os dois
> documentos citados.

## 1. Sumário em uma página

Um portal de cultura pop que rodava em WordPress foi reescrito em Next.js 15 (App Router),
servido em runtime pelo CMS Kal El. O WordPress deixou de ser dependência: virou **origem
de importação**, lida uma vez, nunca consultada em produção.

O que existe hoje no repositório:

| Camada     | Entregue                                                            |
| ---------- | ------------------------------------------------------------------- |
| Front      | 31 rotas, 31 componentes, 4 pacotes internos, temas claro/escuro    |
| Conteúdo   | `ContentRepository` com duas implementações (Kal El e fixture)      |
| Integração | Cliente tipado, DTOs validados em runtime, cache por tag, preview   |
| Migração   | Importador idempotente, redirects, verificador de URLs              |
| SEO        | Metadata, JSON-LD, sitemaps paginados, news sitemap, RSS            |
| Segurança  | HMAC de webhook, anti-replay, fronteira cliente/servidor, CSP, SSRF |
| Testes     | 236 testes Node + 469 de browser = **705 verificações**             |
| Operação   | CI, runbook, orçamento de performance, 6 documentos de migração     |

E o que **não** foi feito, deliberadamente: nenhum deploy, nenhuma mudança de DNS, nenhuma
escrita no WordPress, nenhuma execução contra o Kal El de produção.

---

## 2. Contexto

### 2.1 O ponto de partida

O repositório continha um andaime de orquestração (`migration-orchestration/`) com 11
documentos de planejamento, dois ZIPs originais imutáveis e nada de aplicação:

| Insumo                               |    Bytes | Papel                                   |
| ------------------------------------ | -------: | --------------------------------------- |
| `Máquina Nerd template completo.zip` | 47750189 | 7 protótipos `*.dc.html` — fonte visual |
| `doc tecnico.zip`                    |    27843 | especificação técnica do portal         |

Os dois foram tratados como somente leitura. Os hashes SHA-256 registrados em
[INPUT-INVENTORY.md](./INPUT-INVENTORY.md) foram reconferidos no fim da execução e
**batem byte a byte** — nada foi editado, substituído ou versionado.

As sete superfícies canônicas extraídas para `.migration-reference/` (ignorada):

`Máquina Nerd Índice` · `Notícias` · `Categorias` · `Template` · `Especiais` ·
`Comercial` · `Design System`

### 2.2 O CMS

O Kal El estava aberto no workspace como pasta irmã — **fora** do repositório do portal, e
assim permaneceu. Foi lido para descobrir o contrato real em vez de presumi-lo. O que a
leitura revelou, e que mudou o desenho da integração:

- **Não existe API pública de entrega.** Toda leitura é autenticada server-to-server com
  token opaco `ke_st.` e escopos RBAC. O portal nunca fala com o CMS a partir do browser.
- **Não existe busca por slug.** A rota de artigo recebe um slug; o CMS só sabe buscar por
  id. Foi a única lacuna que justificou tocar no CMS (§7).
- **Duas paginações na mesma API.** Artigos paginam por _cursor_; mídia pagina por
  _offset_ com `total`. O adaptador implementa as duas — presumir uma só teria feito o
  índice de mídia parar nos primeiros 200 itens.
- **Envelope `{ data }`** em todas as respostas, com `{ error: { code, message } }` no
  caminho de erro.

O contrato adotado, com exemplos sanitizados de request/response, está em
[KAL-EL-DISCOVERY.md](./KAL-EL-DISCOVERY.md).

### 2.3 As regras que moldaram tudo

Do `CLAUDE.md`, não negociáveis e seguidas à risca:

- RSC por padrão, TypeScript estrito, validação de runtime com Zod.
- Nenhum hex de marca em componente compartilhado — só `--brand`, `--brand-ink`,
  `--brand-on-dark`. `#E30613` apenas em fundo/borda/foco; texto em fundo claro usa
  `#B00710`.
- Corpo de artigo é `ContentBlock[]` tipado e sanitizado. **Nunca** HTML bruto do CMS.
- `KAL_EL_SERVICE_TOKEN` jamais alcança browser, log, fixture ou bundle.
- Toda mutação exige auth server-to-server, idempotency key e auditoria; webhook exige
  HMAC e tolera replay.
- Sem `any`, sem TODO crítico, sem teste ou regra de lint desabilitada para passar gate,
  sem `git reset --hard`.

---

## 3. Custo da execução

Números extraídos do transcript da sessão (`0d491715-…jsonl`, 3.182 registros, 6,5 MB).

### 3.1 Tokens

| Categoria            |          Tokens | O que é                                   |
| -------------------- | --------------: | ----------------------------------------- |
| Entrada não cacheada |           1.784 | prompt novo, cobrado cheio                |
| **Escrita de cache** |   **3.629.224** | contexto gravado para reuso               |
| **Leitura de cache** | **409.975.200** | contexto relido a cada chamada            |
| **Saída**            |   **1.062.180** | tudo que foi escrito: código, docs, texto |
| **Total processado** | **414.668.388** |                                           |

A leitura de cache é 98,9% do volume: com 892 chamadas ao modelo sobre uma base de código
que só cresce, cada chamada relê o contexto acumulado. É por isso que o total é ordens de
grandeza maior que o que foi de fato escrito — **1,06 milhão de tokens de saída** é o
número que corresponde ao trabalho produzido.

Razão de eficiência: **113 tokens lidos do cache para cada token escrito**. Sem prompt
caching, o mesmo trabalho teria custado ~414 M de tokens de entrada cheia.

### 3.2 Chamadas e ferramentas

| Métrica                 |   Valor |
| ----------------------- | ------: |
| Chamadas ao modelo      |     892 |
| Mensagens de ferramenta |     579 |
| **Total de tool calls** | **572** |
| — `Bash`                |     347 |
| — `Write`               |     155 |
| — `PowerShell`          |      47 |
| — `Edit`                |      23 |

### 3.3 Produção

| Métrica                                     |  Valor |
| ------------------------------------------- | -----: |
| Commits                                     |      4 |
| Arquivos alterados (soma dos commits)       |    403 |
| Linhas inseridas                            | 27.785 |
| Linhas removidas                            |    236 |
| Arquivos versionados ao fim                 |    377 |
| Linhas de código versionadas (sem binários) | 22.922 |

Por commit:

| Commit    | Escopo                                  | Arquivos | Inserções | Remoções |
| --------- | --------------------------------------- | -------: | --------: | -------: |
| `371f92f` | Portal em Next.js sobre o Kal El (w0–2) |      362 |    23.701 |        0 |
| `4bff2ef` | Migração WordPress, CI, operação (w3–5) |       18 |     2.558 |        6 |
| `98f5ff3` | 7 achados bloqueantes da revisão        |       12 |       671 |      110 |
| `0347d66` | Falhas de importação que não falhavam   |       11 |       855 |      120 |

---

## 4. O que foi construído

### 4.1 Arquitetura

```
app/                 31 rotas do App Router
components/          3 wrappers de client boundary
lib/                 7 utilitários de servidor (tema, preview, rate limit)
packages/tokens/     CSS custom properties, temas, marcas MN e Cinerie
packages/ui/         31 componentes visuais, nenhum hex de marca
packages/content/    domínio, KalElClient, mappers, fixtures, cache, segurança
packages/seo/        metadata, JSON-LD, sitemaps, RSS
scripts/wp/          importação, redirects, verificação de URLs
tests/               unit, contrato, integração, segurança, Playwright
docs/migration/      decisões, descoberta do CMS, auditoria visual, runbook
```

Linhas por área:

| Área                       | Arquivos | Linhas |
| -------------------------- | -------: | -----: |
| `packages/`                |       64 | 10.661 |
| `tests/`                   |       16 |  3.227 |
| `app/`                     |       37 |  3.184 |
| `scripts/`                 |       10 |  2.586 |
| `docs/`                    |        6 |    967 |
| `migration-orchestration/` |       21 |    814 |
| `lib/`                     |        7 |    387 |
| `components/`              |        3 |    155 |

Três fronteiras sustentam o resto:

1. **Nenhuma rota conhece o Kal El.** Páginas falam com `ContentRepository`; nomes de
   campo e formatos de endpoint param no mapper. Trocar de CMS é escrever outra
   implementação da interface — e a implementação `fixture` prova isso, porque é
   exatamente o que ela é.
2. **Nenhum componente compartilhado sabe que é vermelho.** Só variáveis de marca. É o que
   permite o mesmo `packages/ui` servir o Máquina Nerd e o Cinerie.
3. **Nenhum segredo alcança o browser.** Todo módulo com credencial importa `server-only`,
   e um teste estático reprova qualquer módulo `'use client'` que tente importá-lo.

### 4.2 Rotas

**19 páginas**

| Rota                                                                | Estratégia | Papel                       |
| ------------------------------------------------------------------- | ---------- | --------------------------- |
| `/`                                                                 | SSG + ISR  | home                        |
| `/[categoria]`                                                      | SSG + ISR  | editoria                    |
| `/[categoria]/page/[n]`                                             | ISR        | paginação de editoria       |
| `/[categoria]/[slug]`                                               | SSG + ISR  | artigo (5 templates)        |
| `/tag/[slug]`                                                       | ISR        | tag                         |
| `/autor/[slug]`                                                     | ISR        | autor                       |
| `/reviews`                                                          | ISR        | listagem de reviews         |
| `/especiais`, `/especiais/[franquia]`                               | ISR        | hubs de franquia            |
| `/especiais/[franquia]/[dossie]`                                    | ISR        | dossiê                      |
| `/ao-vivo/[evento]`                                                 | dinâmica   | cobertura ao vivo           |
| `/ofertas`, `/ofertas/[campanha]`                                   | ISR        | comercial                   |
| `/busca`                                                            | no-store   | busca                       |
| `/preview/[slug]`                                                   | dinâmica   | preview assinado, `noindex` |
| `/newsletter`, `/sobre`, `/publicidade`, `/politica-de-privacidade` | estáticas  | institucionais              |

**12 rotas de API e feed**

`/api/health` · `/api/revalidate` · `/api/preview` · `/api/preview/disable` ·
`/api/newsletter` · `/api/live/[slug]` · `/api/vitals` · `/media/[id]` · `/feed.xml` ·
`/sitemap.xml` · `/sitemap/[kind]` · `/news-sitemap.xml`

### 4.3 Componentes (31)

**Artigo** — `ArticleBody`, `ArticleHeader`, `AuthorByline`, `ShareBar`, `EmbedBlock`,
`RichText`, `MnImage`, `WhereToWatch`
**Listagem** — `ArticleCard`, `ArticleGrid`, `CategoryTabs`, `Pagination`, `Breadcrumbs`
**Comercial** — `BuyBox`, `ComparisonTable`, `ProductScore`, `SpecTable`,
`SponsoredLabel`, `AdSlot`
**Casca** — `SiteHeader`, `SiteFooter`, `NetworkBar`, `MobileNav`, `ThemeToggle`,
`SearchForm`, `NewsletterForm`
**Especiais e estados** — `PollVS`, `specials`, `states`, `parts`, `misc`

`<AdSlot />` tem `minHeight` como prop **obrigatória**: um anúncio sem reserva de espaço é
um CLS garantido, e o tipo impede que alguém esqueça.

### 4.4 Camada de conteúdo (`packages/content`)

20 módulos. Os que carregam o peso:

- **`kalel/transport.ts`** — HTTP tipado, timeout, retry, envelope `{ data }`, erros
  classificados. O token vive só aqui.
- **`kalel/dto.ts`** — schemas Zod de tudo que o CMS devolve. Resposta fora do contrato é
  erro observável, não `undefined` propagando.
- **`kalel/mapper.ts`** — DTO → domínio. Toda divergência de nome ou formato morre aqui.
- **`kalel/repository.ts`** — paginação por cursor (artigos) e por offset (mídia),
  `resolveIdBySlug` com verificação e fallback para índice completo, `listRecentNews` que
  pagina até cobrir a janela do news sitemap.
- **`fixture/`** — acervo determinístico que exercita as 7 superfícies, os 5 templates de
  artigo e todos os estados de vazio e erro. É o que torna a auditoria visual
  reproduzível — e o que faz o site subir sem nenhuma credencial.
- **`env.ts`** — validação de ambiente. Introduziu `APP_ENV` porque `next build` sempre
  define `NODE_ENV=production`: sem isso, seria impossível construir em modo fixture, ou
  seria possível servir fixture em produção. Em produção real, `CONTENT_SOURCE` **tem** de
  ser `kalel` e `TRUST_PROXY` tem de ser explícito.
- **`security/webhook.ts`** — HMAC-SHA256 sobre o corpo cru, com `NonceStore` cuja
  operação `claim()` é uma checagem-e-gravação atômica. Duas entregas simultâneas do mesmo
  webhook não passam as duas.
- **`security/preview.ts`** — token assinado **atado a um slug**: um grant de preview de um
  rascunho não abre outro.
- **`sanitize.ts`**, **`slug.ts`**, **`cache-tags.ts`**, **`sitemap-page-size.ts`**.

### 4.5 Migração WordPress (`scripts/wp`, 2.586 linhas)

Três ferramentas, **dry run por padrão**. Sem `--apply` nenhum cliente de escrita é
sequer construído: não existe caminho de código de um ensaio até um POST.

| Comando                | Função                                                       |
| ---------------------- | ------------------------------------------------------------ |
| `pnpm wp:import`       | importa taxonomias, autores, mídia e posts, idempotentemente |
| `pnpm redirects:build` | compila o mapa de redirects legados                          |
| `pnpm urls:verify`     | verifica que URLs legadas resolvem sem 404 nem loop          |

Propriedades que o desenho garante:

- **Idempotência** — `externalKey` mais uma idempotency key derivada da entidade de origem
  fazem a segunda execução _atualizar_, nunca duplicar.
- **Reconciliação** — a atualização manda todos os campos que a migração possui
  (categorias, tags, autores, capa, proveniência), então uma primeira execução defeituosa
  pode ser reparada rodando de novo.
- **Respeito editorial** — artigo editado no CMS depois de importado responde 409 e é
  deixado em paz. Sobrescrever mudança editorial com reimportação é pior que pular.
- **Contabilidade honesta** — o parser conta tudo que não consegue representar, com
  amostra do trecho. Uma migração que perde conteúdo em silêncio parece uma migração
  limpa.
- **Rede fechada** — assets só de hosts declarados, hostname resolvido a cada hop,
  qualquer endereço privado reprova, corpo lido incrementalmente e cancelado no limite.

O parser de conteúdo converte shortcodes (`[caption]`, `[gallery]`, `[embed]`), preserva
`<cite>`, e reporta qualquer coisa com forma de shortcode que tenha sobrado.

### 4.6 SEO (`packages/seo`)

Metadata por template, JSON-LD (`NewsArticle`, `BreadcrumbList`, `Organization`,
`ItemList`), sitemap paginado por tipo, **news sitemap** que pagina até cobrir a janela de
48 h, RSS, canonicals corretos para os dois esquemas de paginação em uso (`/page/N` e
`?page=`).

### 4.7 Segurança

| Vetor               | Tratamento                                                         |
| ------------------- | ------------------------------------------------------------------ |
| Segredo no bundle   | `server-only` + teste estático que reprova import de client        |
| XSS via CMS         | corpo é `ContentBlock[]` tipado e sanitizado, nunca HTML bruto     |
| Webhook forjado     | HMAC-SHA256 sobre corpo cru                                        |
| Webhook repetido    | nonce com claim atômico, TTL, resposta 409                         |
| Preview vazado      | token assinado atado ao slug, `noindex`                            |
| SSRF no proxy       | allowlist de host + rejeição de endereço privado                   |
| SSRF na importação  | allowlist, resolução de DNS por hop, IPv6 classificado por parsing |
| Exaustão de memória | leitura incremental do corpo, cancelada no limite                  |
| Upload hostil       | magic bytes verificados, SVG recusado                              |
| Abuso de rota       | rate limit por instância                                           |
| Injeção de header   | `TRUST_PROXY` explícito e obrigatório em produção                  |

### 4.8 Testes (705 verificações)

**236 no Node**, por vitest:

| Suíte         | Casos | Cobre                                                     |
| ------------- | ----: | --------------------------------------------------------- |
| `unit`        |   113 | slug, sanitização, redirects, parser WordPress            |
| `contract`    |    45 | adaptador Kal El contra o contrato real, incluindo hostil |
| `integration` |    46 | repositórios contra CMS simulado, pipeline de mídia       |
| `security`    |    32 | env, HMAC, preview, fronteira cliente/servidor            |

**469 no browser**, por Playwright, em 4 viewports (390/768/1024/1440) × 2 temas:
comportamento das superfícies, axe-core, teclado, alvos de toque, movimento reduzido, e
**160 baselines visuais** versionadas — sem elas no repositório o gate visual não prova
nada.

### 4.9 Operação

- **CI** — `.github/workflows/ci.yml` roda os mesmos gates da máquina local.
- **Orçamento de performance** — `scripts/performance-budget.mjs`, medido sobre o bundle
  produzido, não por Lighthouse: tamanho de bundle é determinístico e é o número que
  regride em silêncio.
- **21 variáveis de ambiente** documentadas em `.env.example`, nenhum segredo versionado.
- **6 documentos** em `docs/migration/`: decisões, descoberta do CMS, inventário dos
  insumos, auditoria visual, runbook e verificação final.

---

## 5. Fidelidade visual

Cada uma das sete superfícies aprovadas foi comparada com sua rota em 390, 768, 1024 e
1440 px, nos dois temas. O mapa superfície → rota → evidência está em
[VISUAL-AUDIT.md](./VISUAL-AUDIT.md).

Estados que os protótipos não desenharam — vazio, erro, carregamento, mobile, busca —
foram acrescentados com tokens existentes, sem mudar a direção visual: skeleton com
dimensão reservada, vazio explicativo, erro recuperável.

**As baselines provam que nada mudou desde a aprovação. Elas não substituem revisão
humana lado a lado com os `*.dc.html`** — isso continua pendente e está dito como tal.

---

## 6. Correções de acessibilidade

O axe-core reprovou **18 de 18 superfícies** por contraste na primeira execução. As
correções foram nos tokens, não nas páginas:

| Token             | Antes     | Depois    | Problema                    |
| ----------------- | --------- | --------- | --------------------------- |
| `--mn-fg2`        | `#7c818a` | `#6b7078` | 3,91:1 — reprova AA         |
| `--mn-fg2-strong` | —         | `#5f646c` | variante para texto pequeno |
| `--mn-author-2`   | `#c77800` | `#8a5b00` | 3,43:1 sobre branco         |

E um escopo de tinta escura em `packages/ui/src/styles/ui.css`, para que componentes
aninhados em faixas escuras (`.mn-networkbar`, `.mn-footer`, `.mn-videoband`,
`.mn-newsletter`) herdem automaticamente a paleta certa. Antes disso havia texto a
**1,04:1** — praticamente invisível.

---

## 7. A única mudança no Kal El

O portal recebe um slug na URL; o CMS só sabia buscar artigo por id. O adaptador funciona
sem a mudança (varre e indexa), mas ao custo de uma varredura por resolução.

Uma mudança mínima, isolada, testada, em branch e commit próprios **no repositório do
CMS** — nada foi copiado, movido ou misturado:

- **Branch:** `feat/article-slug-filter` · **Commit:** `83ad1e8`
- 4 arquivos, 113 inserções, 1 remoção
  - `packages/contracts/src/editorial.ts` — `slug` opcional na query de listagem
  - `apps/api/src/services/articles.ts` — a condição de filtro
  - `packages/contracts/src/openapi.ts` — query documentada
  - `apps/api/tests/article-slug-filter.test.ts` — 5 testes, verdes contra Postgres real

---

## 8. O ciclo de revisão independente

O `CLAUDE.md` exige: Claude implementa, Codex CLI revisa em modo somente leitura, Claude
corrige, Codex revisa de novo, e só então o commit. O ciclo rodou **seis rodadas** e
fechou com o revisor dizendo, textualmente, **"SEM ACHADO BLOQUEANTE"**.

Antes disso, dois auxiliares do Codex rodaram em paralelo logo após a Wave 0 — um
auditando os protótipos, outro auditando integração, migração, segurança e testes. Os dois
relatórios estão em `artifacts/codex-workers/`.

**38 achados corrigidos ao todo.** Os que mudaram o resultado:

### Rodada 1 — 9 achados (5 altos)

Corrigidos com teste de regressão que falha se a correção for revertida.

### Rodada 2 — auto-revisão, 12 problemas

O Codex abortou por cota. Conforme o `CLAUDE.md` manda nesse caso, a revisão equivalente
foi feita internamente e registrada com o motivo. Encontrou:

- **Soft-404 em todo o site.** Um `loading.tsx` na raiz fazia `notFound()` e `redirect()`
  devolverem HTTP 200. Medido antes: `/isto-nao-existe` → 200. Depois: 404. Um site que
  responde 200 para tudo é um site que o Google indexa inteiro como conteúdo válido.
- **Loop de redirect** em `/reviews/{slug}`, que redirecionava para si mesmo.
- **Contraste AA reprovado em todas as páginas** (§6).
- Overflow horizontal em 390 px.

### Rodada 3 — 7 achados bloqueantes

1. **A importação publicaria artigos sem editoria, sem tags e sem autor.** O post do
   WordPress carrega **ids numéricos**, e o importador os procurava em mapas indexados por
   _slug_ — toda busca falhava. Como o portal descarta artigos sem editoria das listagens
   e do sitemap, os artigos teriam sido importados e ficado invisíveis.
2. **A reexecução não reconciliava** — o update mandava só título, resumo, documento e
   slug, o que anula o propósito de um importador idempotente.
3. **Falha de taxonomia ou mídia terminava com exit 0** sob `--apply`.
4. **Shortcodes reconhecidos sumiam em silêncio** entre dois parágrafos.
5. **O news sitemap parava nos primeiros 100 itens.**
6. **Canonicals de paginação apontavam para URLs inexistentes.**
7. **SSRF no importador de mídia** — `source_url` é dado do sistema legado e era buscado
   sem restrição de host, seguindo redirects.

Escrever os testes do parser revelou mais dois defeitos por conta própria: `<cite>` era
removido pela sanitização antes de o parser lê-lo — **toda citação migrada perdia a
atribuição** — e nomes de shortcode com dígito não eram reconhecidos.

### Rodada 4 — 5 achados bloqueantes

Todos do mesmo feitio: _uma falha que não vira falha_.

1. **Download de asset perdido não contava como falha.** As três falhas vizinhas
   incrementavam o contador; essa só escrevia na lista. Como o exit code lê o contador, um
   `--apply` que perdesse **todas** as capas por falha de rede saía com código 0.
2. **Alt text perdido era perdido para sempre** — o mapeamento era gravado mesmo com o
   PATCH falhando, e a execução seguinte reusava o arquivo sem voltar a ele.
3. **Nenhuma imagem de galeria chegava ao artigo.** O parser emitia `/wp-media-id/N`; o
   importador indexava a mídia só pela URL legada. O teste anterior passava porque
   construía o próprio resolvedor e lhe entregava os placeholders na mão — concordava
   consigo mesmo.
4. **O corpo da resposta era lido inteiro antes da checagem de tamanho** — um host
   permitido decidia quanta memória o importador alocava.
5. **A defesa de SSRF não resolvia nomes** — um host allowlisted que respondesse
   `169.254.169.254` passava.

### Rodada 5 — 2 achados bloqueantes

1. **O débito de alt text não sobrevivia a uma exceção.** `updateMediaMetadata()` pode
   _rejeitar_, não só responder com erro; a rejeição escapava e matava a execução antes do
   checkpoint que registra a dívida. A correção foi maior que o achado: o mapeamento local
   passou a significar **"asset concluído"** e só é gravado quando o PATCH landa.
2. **A defesa de IPv6 era textual, não semântica.** `::ffff:10.0.0.1` era reconhecido;
   `::ffff:7f00:1` — o **mesmo endereço** em hexadecimal — passava como público. Agora o
   endereço é expandido e classificado de verdade: IPv4-mapped, IPv4-translated (RFC
   6145), IPv4-compatible, NAT64 `64:ff9b::/96`, `fc00::/7`, `fe80::/10`, `fec0::/10`.

### Rodada 6 — SEM ACHADO BLOQUEANTE

Um achado **médio**, também corrigido: no caminho de reuso, um PATCH que finalmente
landasse não gravava o mapeamento, então o asset receberia PATCH em toda reexecução.

### Sobre as rodadas que falharam

Três execuções do revisor terminaram sem relatório e estão preservadas no diretório, não
descartadas: uma esgotou o contexto explorando o repositório, outra tentou rodar o vitest e
bateu no sandbox `read-only`, outra recusou-se a ler arquivos por uma instrução minha
excessivamente restritiva. A solução foi entregar o recorte revisado por stdin. **Nenhuma
rodada foi simulada**; quando o revisor não pôde rodar, isso está dito e a revisão
substituta está identificada como tal.

### Ajuste estrutural que o ciclo exigiu

Os três scripts de migração chamavam `main()` no topo do módulo — então importar um deles
para testar uma função **executava a migração inteira com o argv do test runner**. Agora
usam `runAsScript(import.meta.url, main)`.

---

## 9. Gates — resultados reais

| Gate                    | Comando                 | Resultado                                                    |
| ----------------------- | ----------------------- | ------------------------------------------------------------ |
| Formatação              | `pnpm format:check`     | ✅ _All matched files use Prettier code style_               |
| Lint                    | `pnpm lint`             | ✅ 0 problemas                                               |
| Tipos                   | `pnpm typecheck`        | ✅ 0 erros, `strict` + `noUncheckedIndexedAccess`, sem `any` |
| Unit                    | `pnpm test:unit`        | ✅ 113 passed                                                |
| Contrato                | `pnpm test:contract`    | ✅ 45 passed                                                 |
| Integração              | `pnpm test:integration` | ✅ 46 passed                                                 |
| Segurança               | `pnpm test:security`    | ✅ 32 passed                                                 |
| Build                   | `pnpm build`            | ✅ compilado em 6,8 s, 38 páginas geradas                    |
| Playwright              | `npx playwright test`   | ✅ 469 passed, 3 skipped, 3,6 min                            |
| Performance             | `pnpm test:performance` | ✅ JS 109 KB / 120 · CSS 14 KB / 25                          |
| Ferramentas de migração | `--help` nas três       | ✅ exit 0                                                    |

`git status` limpo. Branch empurrada para `origin/chore/maquina-nerd-kalel-migration`.

---

## 10. Decisões tomadas sem consulta

27 decisões estão registradas com contexto, alternativa considerada e caminho de reversão
em [DECISIONS.md](./DECISIONS.md). As de maior consequência:

| Decisão                                   | Por quê                                                        |
| ----------------------------------------- | -------------------------------------------------------------- |
| `APP_ENV` além de `NODE_ENV`              | `next build` força `production`; sem isso não há build fixture |
| Sem `cookies()` no layout raiz            | tornaria **todas** as rotas dinâmicas e mataria o ISR          |
| Script de tema inline e bloqueante        | a alternativa é flash de tema errado em toda navegação         |
| CSP com `'unsafe-inline'` em `script-src` | Next emite bootstrap inline por página; nonce destruiria o ISR |
| Rota `/reviews/[slug]` removida           | colidia com `/[categoria]/[slug]` e gerava loop                |
| `eslint-config-next` substituído          | incompatível com ESLint 9; plugins diretos no lugar            |
| Nonce de webhook em processo              | Redis seria dependência nova; a troca é de um arquivo          |

---

## 11. O que falta — e não é código

Nenhuma destas é contornável por implementação.

| #   | Pendência                             | O que bloqueia                                    |
| --- | ------------------------------------- | ------------------------------------------------- |
| 1   | Amostra de URLs de maior tráfego      | o critério **zero 404**, bloqueante de lançamento |
| 2   | Padrão real de permalink do WordPress | tamanho do mapa de redirects                      |
| 3   | Modelo comercial no Kal El            | BuyBox e nota de review com conteúdo do CMS       |
| 4   | Credenciais do Kal El                 | rodar contra o CMS real                           |
| 5   | Endpoint interno do Cinerie           | "Onde assistir" com dado real                     |
| 6   | Provedor de newsletter                | inscrição real (hoje responde 501)                |
| 7   | Network code do GAM                   | anúncios reais (reserva de espaço já pronta)      |
| 8   | CMP LGPD                              | se um CMP for exigido pelo jurídico               |

Variáveis que o operador precisa fornecer: `KAL_EL_BASE_URL`, `KAL_EL_SITE_ID`,
`KAL_EL_SERVICE_TOKEN`, `KAL_EL_WEBHOOK_SECRET`, `KAL_EL_PREVIEW_SECRET`; opcionalmente
`CINERIE_INTERNAL_URL`, `CINERIE_SERVICE_TOKEN`, `NEWSLETTER_PROVIDER_URL`.

---

## 12. Limitações declaradas

**Cobertas por teste, com custo conhecido:**

- **CSP com `'unsafe-inline'` em `script-src`** — ainda bloqueia script de outra origem; o
  vetor inline está fechado estruturalmente porque nenhum HTML do CMS é injetado.
- **Nonce de webhook em processo** — em N instâncias, até N purgas redundantes; nunca um
  efeito duplicado.
- **Rate limit por instância** — não é cota distribuída; o teto real fica no edge/WAF.
- **A validação de SSRF resolve o nome, não fixa o endereço do socket.** DNS rebinding
  continua teoricamente possível. Fechar isso exige um dispatcher com endereço fixado. O
  controle efetivo enquanto isso é o allowlist, e o [RUNBOOK](./RUNBOOK.md) diz o que ele
  exige: **não declarar em `WP_ASSET_HOSTS` nenhum host cujo DNS você não controle**.

**Não verificáveis aqui:**

- **Nenhuma execução contra o Kal El real.** Tudo foi validado contra o contrato lido do
  código-fonte e um CMS simulado. A idempotência da importação é uma propriedade do
  desenho, **não uma observação**.
- **Fidelidade visual é uma baseline, não um julgamento.** Comparação humana lado a lado
  com cada `*.dc.html` continua pendente.
- **Dossiê e ao vivo** renderizam a partir do que o CMS consegue expressar e não entram na
  baseline visual — screenshot de estado vazio não prova fidelidade.

---

## 13. Plano seguro de staging e virada

O passo a passo completo, com rollback, está em [RUNBOOK.md](./RUNBOOK.md). Em resumo:

1. **Provisionar** — token de serviço com escopos mínimos, segredo de webhook, segredo de
   preview. Nada em arquivo versionado.
2. **Subir em staging** com `CONTENT_SOURCE=kalel` e verificar `/api/health`.
3. **Ensaiar a importação** — `pnpm wp:import` sem `--apply`, ler o relatório de
   inconversíveis antes de escrever qualquer coisa.
4. **Importar** — `pnpm wp:import --apply --resume`, de uma máquina sem acesso a serviços
   internos sensíveis. Rodar duas vezes e conferir que a segunda reporta `created: 0`.
5. **Redirects** — `pnpm redirects:build --apply`, depois `pnpm urls:verify` contra
   staging com a amostra do Search Console. **Zero 404 e zero loop é bloqueante.**
6. **Virar** — DNS só depois do item 5 verde. O WordPress fica de pé, intocado, por 30
   dias.
7. **Rollback** — reverter o DNS. Nada foi escrito no WordPress, então o retorno é
   imediato e sem perda.

---

## 14. Como retomar

```bash
git checkout chore/maquina-nerd-kalel-migration
pnpm install
cp .env.example .env.local
pnpm dev
```

Sem nenhuma credencial o site sobe em **modo fixture**. Para apontar ao CMS real, preencha
`KAL_EL_*` e defina `CONTENT_SOURCE=kalel`.

Gates completos: `.\migration-orchestration\scripts\Run-Quality-Gates.ps1`

| Documento                                        | Para quê                                               |
| ------------------------------------------------ | ------------------------------------------------------ |
| [DECISIONS.md](./DECISIONS.md)                   | 27 escolhas feitas sem consulta, com porquê e reversão |
| [KAL-EL-DISCOVERY.md](./KAL-EL-DISCOVERY.md)     | contrato real do CMS e divergências adotadas           |
| [INPUT-INVENTORY.md](./INPUT-INVENTORY.md)       | hashes dos insumos originais                           |
| [VISUAL-AUDIT.md](./VISUAL-AUDIT.md)             | cada protótipo ligado à rota e ao screenshot           |
| [RUNBOOK.md](./RUNBOOK.md)                       | operação, virada e rollback                            |
| [FINAL-VERIFICATION.md](./FINAL-VERIFICATION.md) | resultados dos gates e pendências externas             |
