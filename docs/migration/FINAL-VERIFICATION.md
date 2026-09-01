# Verificação final

Resultados **reais**, obtidos executando os comandos listados. Nada aqui é estimativa, e o
que não pôde ser verificado está na seção de pendências em vez de marcado como feito.

- **Branch:** `chore/maquina-nerd-kalel-migration`
- **Ambiente:** Windows 11, Node 24.19.0, pnpm 11.15.1, Next 15.5.4
- **Modo:** `APP_ENV=test CONTENT_SOURCE=fixture` (o único que a validação de ambiente
  permite sem credenciais reais)

---

## 1. Gates executados

| Gate                    | Comando                 | Resultado                                                    |
| ----------------------- | ----------------------- | ------------------------------------------------------------ |
| Formatação              | `pnpm format:check`     | ✅ _All matched files use Prettier code style_               |
| Lint                    | `pnpm lint`             | ✅ 0 problemas                                               |
| Tipos                   | `pnpm typecheck`        | ✅ 0 erros (`strict`, `noUncheckedIndexedAccess`, sem `any`) |
| Unit                    | `pnpm test:unit`        | ✅ **89 passed**                                             |
| Contrato                | `pnpm test:contract`    | ✅ **45 passed**                                             |
| Integração              | `pnpm test:integration` | ✅ **33 passed**                                             |
| Segurança               | `pnpm test:security`    | ✅ **32 passed**                                             |
| Build                   | `pnpm build`            | ✅ compila; home estática, artigo e editoria em SSG+ISR      |
| E2E                     | `pnpm test:e2e`         | ✅ incluído nos 461 abaixo                                   |
| Acessibilidade          | `pnpm test:a11y`        | ✅ incluído nos 461 abaixo                                   |
| Visual                  | `pnpm test:visual`      | ✅ incluído nos 461 abaixo                                   |
| Playwright (total)      | `npx playwright test`   | ✅ **461 passed** em 4 viewports                             |
| Performance             | `pnpm test:performance` | ✅ JS 109 KB / 120 · CSS 14 KB / 25                          |
| Ferramentas de migração | `--help` nas três       | ✅ exit 0                                                    |

**Total: 199 testes Node + 461 de browser = 660 verificações.**

O orçamento de performance é medido sobre o bundle produzido, não por Lighthouse:
tamanho de bundle é determinístico e é o número que regride em silêncio. Lighthouse
contra staging continua no checklist de pré-lançamento, onde um LCP real pode ser medido.

## 2. Cobertura por item da Definition of Done

### Produto e front

| Item                                          | Situação                                                                                                            |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Sete superfícies implementadas                | ✅ [VISUAL-AUDIT.md](./VISUAL-AUDIT.md) liga cada fonte à rota e ao screenshot                                      |
| Tokens, Figtree, temas, contraste do vermelho | ✅ e **corrigido**: `--mn-fg2` reprovava AA em todas as páginas ([DECISIONS §2.1](./DECISIONS.md))                  |
| Rotas com loading / empty / error / not-found | ✅ estados dentro das páginas; `notFound()` devolve **404 de verdade** (era 200 — [DECISIONS §4.1](./DECISIONS.md)) |
| Teclado, foco, aria, reduced motion, 44px     | ✅ 4 viewports; axe-core **0 violações** em 18 superfícies × 2 temas                                                |

### Kal El e conteúdo

| Item                                           | Situação                                                                                            |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Descoberta, adaptador e mappers documentados   | ✅ [KAL-EL-DISCOVERY.md](./KAL-EL-DISCOVERY.md), por inspeção do código do CMS                      |
| Schemas, timeouts, erros e cache tags testados | ✅ 45 testes de contrato, incluindo timeout, 5xx com retry único e HTML de proxy                    |
| Produção sem fixture e sem token no cliente    | ✅ duas travas independentes + teste estático da fronteira                                          |
| Ausência do Cinerie degrada só o módulo        | ✅ testado (`keeps the home up when the Cinerie module is unavailable`)                             |
| Webhook HMAC / replay, preview, invalidação    | ✅ 19 testes; claim de nonce **atômico**; preview preso a um slug                                   |
| Domínio cobre todos os tipos                   | ⚠️ o **domínio** cobre; o **CMS** não tem modelo para comercial, dossiê e ao vivo — ver pendência 4 |

### Migração e URLs

| Item                                         | Situação                                                                                  |
| -------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Scripts com help, dry-run, resume, relatório | ✅ dry run é o padrão; sem `--apply` o cliente de escrita nem é construído                |
| Reexecução sem duplicar                      | ✅ por construção (`externalKey` + idempotency key). **Não executado contra dados reais** |
| Parser sanitiza e contabiliza desconhecidos  | ✅ 39 testes; dois bugs reais encontrados por eles (ver §3)                               |
| Mapa de redirects e 410                      | ✅ permalinks, `?p=`, feeds, `wp-json`; sem open redirect (19 testes)                     |
| Amostra de URLs com zero 404                 | ❌ **não verificável**: a amostra não existe — pendência 2                                |

### SEO, performance, segurança

| Item                                            | Situação                                                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Metadata, canonical, OG, JSON-LD, breadcrumbs   | ✅ um `@graph` por página, assertado no e2e                                                      |
| Sitemaps, news sitemap, RSS                     | ✅ index **enumera todos** os arquivos filhos (antes só as primeiras 100 URLs eram descobríveis) |
| ISR / cache / revalidateTag conforme a matriz   | ✅ busca `no-store`, preview `noindex`, HTML útil sem JS                                         |
| Imagens, fontes, embeds e anúncios com dimensão | ✅ `minHeight` obrigatório; embed atrás de fachada; teste de CLS de slot                         |
| Env, headers/CSP, sanitização, rate limit, LGPD | ✅ CSP com limitação declarada ([DECISIONS §5.1](./DECISIONS.md))                                |

### Engenharia e entrega

| Item                                  | Situação                                                                                  |
| ------------------------------------- | ----------------------------------------------------------------------------------------- |
| Todos os gates executados             | ✅ §1                                                                                     |
| CI com gates e artefatos              | ✅ `.github/workflows/ci.yml`. **Não executado** — sem remoto configurado (pendência 1)   |
| Nada proibido versionado              | ✅ job `hygiene`; ZIPs, `.env`, `.next`, `artifacts/` e `.migration-reference/` ignorados |
| Docs, runbook, decisões, rollback     | ✅                                                                                        |
| Sem deploy nem virada sem autorização | ✅ nada foi implantado; runbook completo                                                  |

## 3. O que a revisão encontrou

O ciclo do `CLAUDE.md` — implementa, Codex revisa, corrige, revisa de novo — rodou uma vez
por inteiro e uma vez pela metade.

**Primeira revisão do Codex** (`artifacts/codex-reviews/wave-12-inicial.md`): 9 achados,
5 de severidade alta. Todos corrigidos, cada um com teste de regressão que falha se a
correção for revertida.

**Segunda revisão:** o Codex **abortou por limite de cota** no meio da execução. O log
está em `wave-12-final.log`. Conforme o `CLAUDE.md` manda nesse caso, foi feita a revisão
equivalente internamente e registrada com o motivo em `wave-12-final.md`. Ela encontrou
mais 12 problemas, entre eles:

- **soft-404 em todo o site** — um `loading.tsx` na raiz fazia `notFound()` e `redirect()`
  devolverem HTTP 200. Medido: `/isto-nao-existe` → 200, `/series/page/1` → 200. Depois:
  404 e 307;
- **loop de redirect** em `/reviews/{slug}`, que redirecionava para si mesmo;
- **contraste AA reprovado em todas as páginas** (`--mn-fg2` a 3,91:1);
- texto a **1,04:1** em faixas escuras dentro do tema claro;
- CTA de compra repintado de vermelho pela regra de link do corpo, a 1,35:1;
- overflow horizontal em 390px.

Dois bugs adicionais no parser WordPress foram encontrados pelos próprios testes ao serem
escritos: `<cite>` era removido pela sanitização antes de o parser lê-lo — **toda citação
migrada perdia a atribuição** — e nomes de shortcode com dígito não eram reconhecidos,
deixando a tag como texto no corpo.

> A segunda opinião do Codex sobre o estado final continua **pendente**. Não é uma
> aprovação simulada e não deve ser tratada como uma.

## 4. Mudança no Kal El

Uma única mudança, em branch e commit próprios no repositório do CMS:

- **Branch:** `feat/article-slug-filter` · **Commit:** `83ad1e8`
- Filtro `?slug=` em `GET /v1/sites/:siteId/articles`, três linhas de lógica, mais o
  schema e o OpenAPI
- **Teste:** `apps/api/tests/article-slug-filter.test.ts`, 5 casos, verdes contra
  PostgreSQL real
- Regressão conferida: `articles.test.ts` e `pipeline-contract.test.ts` seguem verdes

**Não commitada, não enviada.** Fica no repositório do Kal El para revisão de quem cuida
dele. O portal funciona sem ela — o resultado filtrado é sempre reconferido contra o slug
pedido e uma divergência cai no índice completo.

## 5. Pendências externas

Nenhuma é contornável por código.

| #   | Pendência                             | O que bloqueia                                          | Como resolver                                                                                                 |
| --- | ------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 1   | Remoto GitHub não configurado         | push, CI                                                | `git remote add origin …` e push da branch                                                                    |
| 2   | Amostra de URLs de maior tráfego      | o critério **zero 404**, que é bloqueante de lançamento | exportar do Search Console para `data/import/top-urls.txt` e rodar `pnpm urls:verify`                         |
| 3   | Padrão real de permalink do WordPress | tamanho do mapa de redirects                            | confirmar em Configurações → Links permanentes                                                                |
| 4   | Modelo comercial no Kal El            | BuyBox e nota de review com conteúdo do CMS             | aceitar a proposta em [KAL-EL-DISCOVERY.md](./KAL-EL-DISCOVERY.md)                                            |
| 5   | Credenciais do Kal El                 | rodar contra o CMS real                                 | `KAL_EL_BASE_URL`, `KAL_EL_SITE_ID`, `KAL_EL_SERVICE_TOKEN`, `KAL_EL_WEBHOOK_SECRET`, `KAL_EL_PREVIEW_SECRET` |
| 6   | Endpoint interno do Cinerie           | "Onde assistir" com dado real                           | `CINERIE_INTERNAL_URL`, `CINERIE_SERVICE_TOKEN`                                                               |
| 7   | Provedor de newsletter                | inscrição real (hoje responde 501)                      | `NEWSLETTER_PROVIDER_URL`                                                                                     |
| 8   | Network code do GAM                   | anúncios reais                                          | reserva de espaço já implementada                                                                             |
| 9   | CMP LGPD                              | se um CMP for exigido                                   | o banner próprio atende enquanto não houver                                                                   |
| 10  | Segunda revisão do Codex              | fechar o ciclo do `CLAUDE.md`                           | reexecutar quando a cota voltar                                                                               |

## 6. Limitações declaradas

**Cobertas por teste, com um custo conhecido:**

- **CSP com `'unsafe-inline'` em `script-src`.** O Next emite scripts inline de bootstrap
  por página; hash não cobre e nonce destruiria o ISR. Ainda bloqueia script de outra
  origem. O vetor inline está fechado estruturalmente.
- **Nonce de webhook em processo.** Em N instâncias, até N purgas redundantes — nunca um
  efeito duplicado. Troca por Redis é de um arquivo.
- **Rate limit por instância.** Não é uma cota distribuída; o teto real fica no edge/WAF.

**Não verificáveis aqui:**

- **Nenhuma execução contra o Kal El real.** Tudo foi validado contra o contrato lido do
  código-fonte e um CMS simulado. A idempotência da importação é uma propriedade do
  desenho, **não uma observação**.
- **Fidelidade visual é uma baseline, não um julgamento.** As 160 imagens provam que nada
  mudou desde que a tela foi aprovada; comparar lado a lado com cada `*.dc.html` é revisão
  humana e continua pendente.
- **Dossiê e ao vivo** renderizam a partir do que o CMS consegue expressar e não entram na
  baseline visual — um screenshot de estado vazio não prova fidelidade.

## 7. Estado do repositório

`git status` limpo na branch `chore/maquina-nerd-kalel-migration`. Ignorados por
`.gitignore`, deliberadamente: os dois ZIPs originais (intactos, hashes em
[INPUT-INVENTORY.md](./INPUT-INVENTORY.md)), `.migration-reference/`, `artifacts/`,
`.next/`, `node_modules/` e todo `.env*`.

Versionados de propósito: as 160 baselines visuais (~32 MB). Sem elas no repositório o
gate visual não prova nada.
