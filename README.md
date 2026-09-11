# Máquina Nerd

Portal de cultura pop — cinema, séries, quadrinhos, games e animes — em Next.js 15 (App
Router), servido em runtime pelo CMS [Kal El](https://github.com/maquinanerd/kal-el).
Substitui o WordPress, que passa a ser apenas origem de importação.

O front segue o kit `maquina-nerd-kit` (`PROMPT-FRONTEND.md`, `docs/01–06` e sete
protótipos `*.dc.html`): home, editoria, matéria padrão, matéria com capa em tela cheia,
matéria de oferta, busca e páginas institucionais.

## Começar

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Sem nenhuma credencial o site sobe em **modo demonstração** (fixture): um acervo
determinístico com os títulos dos protótipos, marcado por uma faixa "Demonstração" no
topo de toda página. Produção recusa esse modo.

Para apontar ao CMS real, preencha `KAL_EL_*` em `.env.local` e defina
`CONTENT_SOURCE=kalel`.

## Arquitetura

```
app/                 rotas do App Router (kit docs/03)
lib/content/         adaptador: domínio do CMS → modelo de tela do kit (docs/04)
components/          composições de página (feed, abertura, matéria, institucional)
packages/tokens/     tokens do kit como tema Tailwind v4 + propriedades --brand*
packages/ui/         primitivos do kit (HeroCard, OverlayCard, BigCard, SideList, RowCard,
                     SectionTitle, Pagination, AdSlot…); nenhum hex de marca
packages/content/    domínio, KalElClient, mappers, fixtures, cache tags, segurança
packages/seo/        metadata, JSON-LD, sitemaps e RSS
scripts/             provisionamento do Kal El, importação WordPress, redirects, URLs
tests/               unit, contrato, integração, segurança e Playwright
docs/migration/      decisões, descoberta do CMS, runbook e verificação final
```

Três limites fazem o resto funcionar:

- **Nenhuma rota conhece o Kal El.** Páginas falam com `ContentRepository` através de
  `lib/content/`; nomes de campo e formatos de endpoint param no mapper.
- **Cor de editoria só em faixa, filete e estado ativo**, e só com o par de contraste
  medido (`tests/unit/tokens-contrast.test.ts`). Componentes compartilhados usam
  `--brand`, `--brand-ink` e `--brand-on-dark`.
- **Nenhum segredo alcança o browser.** Todo módulo com credencial importa `server-only`,
  e um teste estático reprova um módulo `'use client'` que tente importá-lo.

O layout da matéria vem de tag reservada no CMS: `capa-em-tela-cheia` abre na capa em
tela cheia; `oferta` publica em `/ofertas/{slug}`. Ver
[KAL-EL-DISCOVERY.md](docs/migration/KAL-EL-DISCOVERY.md).

## Comandos

| Comando                   | O que faz                                                         |
| ------------------------- | ----------------------------------------------------------------- |
| `pnpm dev`                | desenvolvimento                                                   |
| `pnpm build` / `start`    | build e execução de produção                                      |
| `pnpm lint` / `typecheck` | ESLint e TypeScript estrito                                       |
| `pnpm test:unit`          | adaptador, contraste dos tokens, redirects, parser WordPress      |
| `pnpm test:contract`      | adaptador Kal El contra o contrato real, incluindo entrada hostil |
| `pnpm test:integration`   | repositórios contra um CMS simulado                               |
| `pnpm test:security`      | env, HMAC de webhook, preview e fronteira cliente/servidor        |
| `pnpm test:e2e`           | comportamento das superfícies em 4 viewports                      |
| `pnpm test:a11y`          | axe-core, teclado, alvos de toque e movimento reduzido            |
| `pnpm test:visual`        | baselines das superfícies em 390, 768, 1024 e 1440 px             |
| `pnpm test:kalel`         | a app inteira em `CONTENT_SOURCE=kalel` contra um CMS de contrato |
| `pnpm test:performance`   | orçamento de bundle                                               |
| `pnpm visual:compare`     | protótipo e rota lado a lado em `artifacts/visual/`               |
| `pnpm kalel:provision`    | prepara o site no Kal El (editorias, tags, webhook, token)        |

Os gates completos: `.\migration-orchestration\scripts\Run-Quality-Gates.ps1`, com o
ambiente do bloco `env:` de `.github/workflows/ci.yml` (`APP_ENV=test`,
`CONTENT_SOURCE=fixture` e os placeholders). Sem ele o `build` recusa, de propósito, um
build de produção sem credenciais do Kal El.

## Publicar

Imagem Docker (Next standalone) e `docker-compose.prod.yml` para o mesmo tipo de host do
Kal El. Passo a passo, com provisionamento, virada e rollback, no
[RUNBOOK.md](docs/migration/RUNBOOK.md) (seções 1, 4.5 e 5).

## Migração WordPress

Todas as ferramentas são **dry run por padrão**. Sem `--apply` nenhum cliente de escrita
é sequer construído — não existe caminho de código de um ensaio até um POST.

```bash
pnpm wp:import --help              # todas as flags
pnpm wp:import                     # ensaio: só relatórios
pnpm wp:import --limit 50          # ensaia uma fatia
pnpm wp:import --apply --resume    # importa de verdade, do checkpoint

pnpm redirects:build --apply       # compila data/legacy-redirects.json
pnpm urls:verify --base https://staging.exemplo --urls data/import/top-urls.txt
```

A importação é reexecutável: `externalKey` mais uma idempotency key derivada da entidade
de origem fazem a segunda execução **atualizar**, nunca duplicar. Um artigo editado no CMS
depois de importado responde 409 e é deixado em paz.

## Documentação

| Documento                                                     | Para quê                                                |
| ------------------------------------------------------------- | ------------------------------------------------------- |
| [DECISIONS.md](docs/migration/DECISIONS.md)                   | escolhas feitas sem consulta, com o porquê e a reversão |
| [KAL-EL-DISCOVERY.md](docs/migration/KAL-EL-DISCOVERY.md)     | contrato real do CMS e as mudanças propostas/aplicadas  |
| [VISUAL-AUDIT.md](docs/migration/VISUAL-AUDIT.md)             | cada protótipo ligado à rota e à evidência              |
| [RUNBOOK.md](docs/migration/RUNBOOK.md)                       | provisionamento, deploy, virada e rollback              |
| [FINAL-VERIFICATION.md](docs/migration/FINAL-VERIFICATION.md) | resultados reais dos gates e pendências externas        |
| [RELATORIO-EXECUCAO.md](docs/migration/RELATORIO-EXECUCAO.md) | registro da execução anterior ao kit                    |

## O que este projeto não faz

- Não mantém fallback para o WordPress em runtime.
- Não renderiza HTML bruto do CMS: o corpo é `ContentBlock[]` tipado.
- Não inventa dado: preço, avatar, contagem ou data que o CMS não tem não aparece.
- Não bloqueia a página por anúncio, analytics ou embed remoto (vídeo só carrega após
  clique).
- Não sobe anúncio sem reserva de espaço nem sem o rótulo "Publicidade".
