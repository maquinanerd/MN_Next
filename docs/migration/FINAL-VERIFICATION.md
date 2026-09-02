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
| Unit                    | `pnpm test:unit`        | ✅ **115 passed**                                            |
| Contrato                | `pnpm test:contract`    | ✅ **56 passed**                                             |
| Integração              | `pnpm test:integration` | ✅ **56 passed**                                             |
| Segurança               | `pnpm test:security`    | ✅ **42 passed**                                             |
| **Entrega Kal El**      | `pnpm test:kalel`       | ✅ **26 passed** — a app em `CONTENT_SOURCE=kalel`           |
| Build                   | `pnpm build`            | ✅ compila; home estática, artigo e editoria em SSG+ISR      |
| E2E                     | `pnpm test:e2e`         | ✅ incluído nos 469 abaixo                                   |
| Acessibilidade          | `pnpm test:a11y`        | ✅ incluído nos 469 abaixo                                   |
| Visual                  | `pnpm test:visual`      | ✅ incluído nos 469 abaixo                                   |
| Playwright (total)      | `npx playwright test`   | ✅ **469 passed** em 4 viewports                             |
| Performance             | `pnpm test:performance` | ✅ JS 109 KB / 120 · CSS 14 KB / 25                          |
| Ferramentas de migração | `--help` nas três       | ✅ exit 0                                                    |

**Total: 269 testes Node + 469 de browser fixture + 26 de browser Kal El = 764
verificações.**

O orçamento de performance é medido sobre o bundle produzido, não por Lighthouse:
tamanho de bundle é determinístico e é o número que regride em silêncio. Lighthouse
contra staging continua no checklist de pré-lançamento, onde um LCP real pode ser medido.

## 1.1 O que mudou depois da primeira verificação

Quatro waves de continuação, cada uma com o ciclo de revisão independente fechado.

### Wave 1 — auditoria técnica

Os gates estavam verdes. O que não estava era o que acontece quando o deployment não é
produção mas também não é ninguém.

- **`APP_ENV=staging` passava por todas as travas**, e o runbook abre staging para a
  redação por uma semana antes da virada: `CONTENT_SOURCE=fixture` era aceito lá.
- **`robots.ts` decidia por `NODE_ENV` mais um regex de hostname.** Um build de staging
  _é_ um build de produção, e um host chamado `homolog.` não casava com nenhum padrão —
  recebia robots.txt totalmente rastreável.
- **O classificador de endereço privado existia em duas cópias**, e a do ambiente só
  conhecia `10.`, `192.168.` e `127.`. A revisão acrescentou que FQDN com ponto final
  (`localhost.`) também passava.
- `vitest.config.ts` não resolvia `@mn/content/x`, então um arquivo de teste falhava na
  coleta em vez de rodar — uma suíte podia parar de existir com o resumo verde.
- `app/global-error.tsx` não existia: `error.tsx` não cobre falha do layout raiz.

### Wave 2 — a integração, observada

Toda suíte rodava no provider de fixtures, que entrega objetos de domínio prontos. Os
schemas de DTO, o mapper, a hidratação de taxonomia, a divisão cursor/offset e o proxy de
mídia nunca eram exercitados por um render real.

`tests/fake-kalel/` é um CMS fiel ao contrato — valida cada resposta contra os schemas da
própria aplicação antes de enviar — e `pnpm test:kalel` sobe a app apontada para ele. O
corpus é grande o bastante para forçar os dois modelos de paginação: 140 artigos (cursor
pede 100) e 260 mídias (offset pede 200).

Encontrou, na primeira execução, que **`next build` falhava inteiro se o CMS estivesse
fora do ar**, porque `/feed.xml` e `/news-sitemap.xml` são pré-renderizados. Agora
degradam para documento vazio com TTL curto — e só em `kind=unavailable`: violação de
contrato e bug próprio continuam explodindo, porque publicar um feed permanentemente vazio
com 200 é pior que não publicar.

### Wave 3 — o importador, executado

O importador nunca tinha sido rodado de ponta a ponta. `tests/fake-wp/` serve uma REST API
do WordPress, o Kal El falso ganhou escrita com `externalKey`, `Idempotency-Key` e
`If-Match`, e um teste roda o CLI real como subprocesso, duas vezes.

- **`findArticleByExternalKey` tratava falha de consulta como ausência**, então um erro do
  CMS mandava criar um artigo que já existia — recusado pela unicidade, nunca atualizado.
- **O runbook prometia algo que o código não fazia.** `If-Match` protege os milissegundos
  entre ler a versão e escrever, não a semana desde a importação. O state file agora guarda
  a versão escrita, e `--resume` decide de onde continuar, não se lembramos o que
  escrevemos.
- **O comentário em `source.ts` afirmava existir um `--wxr`.** Nunca existiu. O caminho
  para um dump SQL está no runbook, com a sequência exata do inventário à verificação.

### Wave 4 — fidelidade visual

A comparação lado a lado com os `*.dc.html` mostrou que a home não estava mais pobre:
estava **incompleta**. Três módulos do protótipo não existiam. Detalhe em
[VISUAL-AUDIT.md](./VISUAL-AUDIT.md).

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
| Produção sem fixture e sem token no cliente    | ✅ duas travas independentes + teste estático da fronteira. **Staging agora conta como produção**   |
| Ausência do Cinerie degrada só o módulo        | ✅ testado (`keeps the home up when the Cinerie module is unavailable`)                             |
| Webhook HMAC / replay, preview, invalidação    | ✅ 19 testes; claim de nonce **atômico**; preview preso a um slug                                   |
| Domínio cobre todos os tipos                   | ⚠️ o **domínio** cobre; o **CMS** não tem modelo para comercial, dossiê e ao vivo — ver pendência 4 |

### Migração e URLs

| Item                                         | Situação                                                                                                                                                  |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scripts com help, dry-run, resume, relatório | ✅ dry run é o padrão; sem `--apply` o cliente de escrita nem é construído                                                                                |
| Reexecução sem duplicar                      | ✅ **executado**: o CLI real, duas vezes, contra stand-ins que impõem `externalKey`, `Idempotency-Key` e `If-Match`. Segunda passada reporta `created: 0` |
| Parser sanitiza e contabiliza desconhecidos  | ✅ 58 testes; quatro bugs reais encontrados por eles (ver §3)                                                                                             |
| Mapa de redirects e 410                      | ✅ permalinks, `?p=`, feeds, `wp-json`; sem open redirect (19 testes)                                                                                     |
| Amostra de URLs com zero 404                 | ❌ **não verificável**: a amostra não existe — pendência 2                                                                                                |

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

O ciclo do `CLAUDE.md` — implementa, Codex revisa, corrige, revisa de novo — rodou
seis rodadas, e fechou.

**Rodada 1 — Codex** (`artifacts/codex-reviews/wave-12-inicial.md`): 9 achados, 5 de
severidade alta. Todos corrigidos, cada um com teste de regressão que falha se a correção
for revertida.

**Rodada 2 — auto-revisão.** O Codex abortou por limite de cota no meio da execução
(`wave-12-final.log`). Conforme o `CLAUDE.md` manda nesse caso, a revisão equivalente foi
feita internamente e registrada com o motivo em `wave-12-final.md`. Encontrou mais 12
problemas, entre eles:

- **soft-404 em todo o site** — um `loading.tsx` na raiz fazia `notFound()` e `redirect()`
  devolverem HTTP 200. Medido: `/isto-nao-existe` → 200. Depois: 404;
- **loop de redirect** em `/reviews/{slug}`, que redirecionava para si mesmo;
- **contraste AA reprovado em todas as páginas**, e texto a **1,04:1** em faixas escuras;
- overflow horizontal em 390px.

**Rodada 3 — Codex** (`artifacts/codex-reviews/wave-final.md`), com a cota restabelecida:
**7 achados bloqueantes**, todos reais, todos corrigidos e cobertos por teste:

1. **A importação publicaria artigos sem editoria, sem tags e sem autor.** O post do
   WordPress carrega **ids numéricos**, e o importador os procurava em mapas indexados por
   _slug_ — toda busca falhava. Como o portal descarta artigos sem editoria das listagens e
   do sitemap, os artigos teriam sido importados e ficado invisíveis. O autor nunca entrava
   no payload.
2. **A reexecução não reconciliava.** O update mandava só título, resumo, documento e slug,
   então uma primeira execução defeituosa não podia ser reparada rodando de novo — o que
   anula o propósito de um importador idempotente.
3. **Falha de taxonomia ou de mídia terminava com exit 0** sob `--apply`. Uma migração que
   perde uma capa e sai zero parece sucesso.
4. **Shortcodes reconhecidos sumiam em silêncio.** `[caption]`, `[gallery]` e `[embed]`
   eram preservados pelo stripper, mas o parser seguinte só lê tags HTML — então o
   shortcode desaparecia entre dois parágrafos, sem sequer ser contado.
5. **O news sitemap parava nos primeiros 100 itens.** A rota pede mil; o Kal El limita a
   consulta a 100 por página e não havia paginação.
6. **Canonicals de paginação apontavam para URLs inexistentes.** Reviews, autor e ofertas
   paginam com `?page=`, mas o gerador emitia `/page/N`; `/ofertas` ignorava a página.
7. **SSRF no importador de mídia.** `source_url` é dado do sistema legado e era buscado
   sem restrição de host, seguindo redirects — um registro de mídia manipulado apontaria a
   busca para a rede interna durante a migração.

Além disso, escrever os testes do parser revelou dois defeitos por conta própria: `<cite>`
era removido pela sanitização antes de o parser lê-lo — **toda citação migrada perdia a
atribuição** — e nomes de shortcode com dígito não eram reconhecidos.

**Rodada 4 — Codex** (`artifacts/codex-reviews/wave-final-2.md`), sobre as correções da
rodada 3: **5 achados bloqueantes**, todos reais, todos corrigidos e cobertos por teste.
Quatro deles são o mesmo tipo de erro — uma falha que não vira falha:

1. **Download de asset perdido não contava como falha.** As três falhas vizinhas
   incrementavam o contador; essa só escrevia na lista. Como o exit code lê o contador,
   um `--apply` que perdesse **todas** as capas por falha de rede saía com código 0.
2. **Alt text perdido era perdido para sempre.** Se o PATCH de metadados falhasse, o
   mapeamento era gravado assim mesmo; a execução seguinte reusava a mídia e nunca mais
   voltava a ela. Agora o débito fica em `pendingMediaMeta` no state file e é pago na
   próxima execução — sem custar um PATCH por asset quando não há nada devendo.
3. **Nenhuma imagem de galeria chegava ao artigo.** O parser emite `/wp-media-id/12`, mas
   o importador indexava a mídia **só** pela URL legada, então o resolvedor não achava
   nada e a imagem simplesmente não era emitida. O teste anterior passava porque construía
   o próprio resolvedor e lhe entregava os placeholders na mão — concordava consigo mesmo.
   O formato do placeholder agora existe em um lugar só (`shortcodeAssetRef`), e o teste
   novo atravessa `importAsset` → `imageResolver` → `htmlToBlocks` reais.
4. **O corpo da resposta era lido inteiro antes de checar o tamanho.** Um host permitido
   podia declarar 512 bytes e enviar gigabytes: quem decidia a memória do importador era
   ele. A leitura agora é incremental e cancela no limite.
5. **A defesa de SSRF não resolvia nomes.** O allowlist julga um _nome_; um nome permitido
   que responda `169.254.169.254` passava. Agora todo hostname é resolvido a cada hop e
   qualquer resposta em faixa privada, loopback ou link-local reprova — IPv6 incluído.
   O que **não** está fechado está dito abaixo, nas limitações.

**Rodada 5 — Codex** (`artifacts/codex-reviews/wave-final-3.md`), sobre as correções da
rodada 4: **2 achados bloqueantes**, ambos reais, ambos corrigidos.

1. **O débito de alt text não sobrevivia a uma exceção.** `updateMediaMetadata()` pode
   _rejeitar_ — timeout, conexão derrubada — e não só responder com erro. A rejeição
   escapava, matava a execução antes do checkpoint que registra o débito, e a execução
   seguinte encontrava o arquivo já enviado e nunca voltava a ele. A correção foi maior
   que o achado: o mapeamento local passou a significar **"asset concluído"** e só é
   gravado quando o PATCH landa, então uma queda em qualquer ponto entre o upload e o
   checkpoint deixa a próxima execução capaz de perceber que ainda se deve algo.
2. **A defesa de IPv6 era textual, não semântica.** `::ffff:10.0.0.1` era reconhecido;
   `::ffff:7f00:1`, o **mesmo endereço** em hexadecimal, passava como público. Agora o
   endereço é expandido e classificado de verdade, cobrindo IPv4-mapped, IPv4-translated
   (RFC 6145), IPv4-compatible, o prefixo NAT64 `64:ff9b::/96`, `fc00::/7`, `fe80::/10`
   e `fec0::/10` — e um endereço que não faz sentido reprova em vez de passar.

**Rodada 6 — Codex** (`artifacts/codex-reviews/wave-final-4.md`): **"SEM ACHADO
BLOQUEANTE"**, textualmente, na primeira linha. É o critério do `CLAUDE.md` para fechar o
ciclo. Restou um achado **médio**, também corrigido: no caminho de reuso, um PATCH que
finalmente landasse não gravava o mapeamento, então o asset continuaria sem registro de
conclusão e receberia PATCH em toda reexecução — idempotente, mas caro para sempre.

Duas rodadas do revisor terminaram sem relatório antes disso (`wave-final-3-tentativa-1`
e `-2.log`): a primeira esgotou o contexto explorando o repositório, a segunda tentou
rodar o vitest e bateu no sandbox `read-only`. A terceira tentativa, restrita a leitura e
apontada ao diff, produziu os dois achados acima. As tentativas frustradas estão no
diretório, não descartadas. A rodada 6 precisou do mesmo cuidado: o diff acumulado
esgotava o contexto do revisor, então o recorte revisado foi entregue por stdin
(`round6-focus.md`).

Fechar o ciclo exigiu também um ajuste estrutural: os três scripts de migração chamavam
`main()` no topo do módulo, então importar um deles para testar uma função executava a
migração com o argv do test runner. Agora usam `runAsScript(import.meta.url, main)`.

> Nenhuma rodada foi simulada. Quando o revisor independente não pôde rodar, isso está
> dito, e a revisão substituta está identificada como tal.

## 4. Mudança no Kal El

Uma única mudança, em branch e commit próprios no repositório do CMS:

- **Branch:** `feat/article-slug-filter` · **Commit:** `83ad1e8`
- Filtro `?slug=` em `GET /v1/sites/:siteId/articles`, três linhas de lógica, mais o
  schema e o OpenAPI
- **Teste:** `apps/api/tests/article-slug-filter.test.ts`, 5 casos, verdes contra
  PostgreSQL real
- Regressão conferida: `articles.test.ts` e `pipeline-contract.test.ts` seguem verdes

**Commitada no repositório do Kal El, não enviada.** Fica na branch `feat/article-slug-filter`
para revisão de quem cuida do CMS; nenhum push foi feito. O portal funciona sem ela — o resultado filtrado é sempre reconferido contra o slug
pedido e uma divergência cai no índice completo.

## 5. Pendências externas

Nenhuma é contornável por código.

| #   | Pendência                             | O que bloqueia                                          | Como resolver                                                                                                 |
| --- | ------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 1   | Amostra de URLs de maior tráfego      | o critério **zero 404**, que é bloqueante de lançamento | exportar do Search Console para `data/import/top-urls.txt` e rodar `pnpm urls:verify`                         |
| 2   | Padrão real de permalink do WordPress | tamanho do mapa de redirects                            | confirmar em Configurações → Links permanentes                                                                |
| 3   | Modelo comercial no Kal El            | BuyBox e nota de review com conteúdo do CMS             | aceitar a proposta em [KAL-EL-DISCOVERY.md](./KAL-EL-DISCOVERY.md)                                            |
| 4   | Credenciais do Kal El                 | rodar contra o CMS real                                 | `KAL_EL_BASE_URL`, `KAL_EL_SITE_ID`, `KAL_EL_SERVICE_TOKEN`, `KAL_EL_WEBHOOK_SECRET`, `KAL_EL_PREVIEW_SECRET` |
| 5   | Endpoint interno do Cinerie           | "Onde assistir" com dado real                           | `CINERIE_INTERNAL_URL`, `CINERIE_SERVICE_TOKEN`                                                               |
| 6   | Provedor de newsletter                | inscrição real (hoje responde 501)                      | `NEWSLETTER_PROVIDER_URL`                                                                                     |
| 7   | Network code do GAM                   | anúncios reais                                          | reserva de espaço já implementada                                                                             |
| 8   | CMP LGPD                              | se um CMP for exigido                                   | o banner próprio atende enquanto não houver                                                                   |

## 6. Limitações declaradas

**Cobertas por teste, com um custo conhecido:**

- **CSP com `'unsafe-inline'` em `script-src`.** O Next emite scripts inline de bootstrap
  por página; hash não cobre e nonce destruiria o ISR. Ainda bloqueia script de outra
  origem. O vetor inline está fechado estruturalmente.
- **Nonce de webhook em processo.** Em N instâncias, até N purgas redundantes — nunca um
  efeito duplicado. Troca por Redis é de um arquivo.
- **Rate limit por instância.** Não é uma cota distribuída; o teto real fica no edge/WAF.
- **A validação de SSRF resolve o nome, não fixa o endereço.** O importador rejeita
  qualquer hostname que resolva para faixa privada, a cada redirect, mas o socket faz a
  própria resolução depois — um nome que mude de resposta nesse intervalo (DNS rebinding)
  continua teoricamente possível. Fechar isso exige um dispatcher com endereço fixado. O
  controle efetivo enquanto isso é o allowlist, e o [RUNBOOK](./RUNBOOK.md) diz o que ele
  exige do operador: não declarar host cujo DNS não seja seu.

**Não verificáveis aqui:**

- **Nenhuma execução contra o Kal El real.** O que existe agora é mais forte que antes —
  a aplicação inteira renderiza em `CONTENT_SOURCE=kalel` contra um CMS que valida as
  próprias respostas pelos schemas da app, e o importador roda duas vezes contra um alvo
  que impõe as mesmas regras do real. O que isso **não** substitui: latência, volume e
  comportamento sob carga do CMS de verdade.
- **A comparação lado a lado foi feita, e não cobriu tudo.** As sete superfícies foram
  abertas contra seus protótipos em 1440px e as diferenças de composição encontradas estão
  corrigidas ([VISUAL-AUDIT.md](./VISUAL-AUDIT.md)). Não foram percorridos elemento a
  elemento: os cinco templates de artigo entre si, as quatro telas comerciais entre si, e
  os viewports 768 e 1024 fora da baseline. Isso continua sendo revisão humana.
- **A ferramenta de comparação não é confiável em 390px** — as capturas saem sem estilo em
  algumas execuções. A evidência de mobile que vale é a baseline do Playwright.
- **Dossiê e ao vivo** renderizam a partir do que o CMS consegue expressar e não entram na
  baseline visual — um screenshot de estado vazio não prova fidelidade.

## 7. Estado do repositório

`git status` limpo na branch `chore/maquina-nerd-kalel-migration`. Ignorados por
`.gitignore`, deliberadamente: os dois ZIPs originais (intactos, hashes em
[INPUT-INVENTORY.md](./INPUT-INVENTORY.md)), `.migration-reference/`, `artifacts/`,
`.next/`, `node_modules/` e todo `.env*`.

Versionados de propósito: as 160 baselines visuais (~32 MB). Sem elas no repositório o
gate visual não prova nada.
