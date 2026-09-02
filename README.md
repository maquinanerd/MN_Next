# Máquina Nerd

Portal de cultura pop — cinema, séries, quadrinhos, games e animes — em Next.js 15 (App
Router), servido em runtime pelo CMS [Kal El](https://github.com/maquinanerd/kal-el).
Substitui o WordPress, que passa a ser apenas origem de importação.

## Começar

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Sem nenhuma credencial o site sobe em **modo fixture**: um acervo determinístico que
exercita as sete superfícies aprovadas, os cinco templates de artigo e todos os estados
de vazio e erro. É esse modo que torna a auditoria visual reproduzível.

Para apontar ao CMS real, preencha `KAL_EL_*` em `.env.local` e defina
`CONTENT_SOURCE=kalel`.

## Arquitetura

```
app/                 rotas do App Router — o mapa de URLs de docs/04
packages/tokens/     CSS custom properties, temas claro/escuro e marca MN/Cinerie
packages/ui/         componentes visuais; nenhum hex de marca, só --brand*
packages/content/    domínio, KalElClient, mappers, fixtures, cache tags, segurança
packages/seo/        metadata, JSON-LD, sitemaps e RSS
scripts/wp/          importação WordPress, redirects e verificação de URLs
tests/               unit, contrato, integração, segurança e Playwright
docs/migration/      decisões, descoberta do CMS e verificação final
```

Três limites fazem o resto funcionar:

- **Nenhuma rota conhece o Kal El.** Páginas falam com `ContentRepository`; nomes de
  campo e formatos de endpoint param no mapper. Trocar de CMS é escrever outra
  implementação.
- **Nenhum componente compartilhado sabe que é vermelho.** `--brand`, `--brand-ink` e
  `--brand-on-dark` — é o que permite o mesmo `packages/ui` servir os dois portais.
- **Nenhum segredo alcança o browser.** Todo módulo com credencial importa `server-only`,
  e um teste estático reprova um módulo `'use client'` que tente importá-lo.

## Comandos

| Comando                   | O que faz                                                         |
| ------------------------- | ----------------------------------------------------------------- |
| `pnpm dev`                | desenvolvimento                                                   |
| `pnpm build` / `start`    | build e execução de produção                                      |
| `pnpm lint` / `typecheck` | ESLint e TypeScript estrito                                       |
| `pnpm test:unit`          | slug, sanitização, redirects e parser WordPress                   |
| `pnpm test:contract`      | adaptador Kal El contra o contrato real, incluindo entrada hostil |
| `pnpm test:integration`   | repositórios contra um CMS simulado                               |
| `pnpm test:security`      | env, HMAC de webhook, preview e fronteira cliente/servidor        |
| `pnpm test:e2e`           | comportamento das superfícies em 4 viewports                      |
| `pnpm test:a11y`          | axe-core, teclado, alvos de toque e movimento reduzido            |
| `pnpm test:visual`        | 160 baselines: 20 superfícies × 2 temas × 4 viewports             |
| `pnpm test:kalel`         | a app inteira em `CONTENT_SOURCE=kalel` contra um CMS de contrato |
| `pnpm test:performance`   | orçamento de bundle (docs/08)                                     |
| `pnpm fixtures:media`     | regenera as imagens do acervo de fixtures                         |

Os gates completos: `.\migration-orchestration\scripts\Run-Quality-Gates.ps1`.

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
depois de importado responde 409 e é deixado em paz — sobrescrever uma mudança editorial
com uma reimportação é pior que pular.

O parser conta tudo o que não consegue representar em `artifacts/migration/`, incluindo
uma amostra do trecho: uma migração que perde conteúdo em silêncio parece uma migração
limpa.

## Documentação

| Documento                                                     | Para quê                                                 |
| ------------------------------------------------------------- | -------------------------------------------------------- |
| [DECISIONS.md](docs/migration/DECISIONS.md)                   | escolhas feitas sem consulta, com o porquê e a reversão  |
| [KAL-EL-DISCOVERY.md](docs/migration/KAL-EL-DISCOVERY.md)     | contrato real do CMS e as divergências adotadas          |
| [VISUAL-AUDIT.md](docs/migration/VISUAL-AUDIT.md)             | cada protótipo ligado à rota e ao screenshot             |
| [RUNBOOK.md](docs/migration/RUNBOOK.md)                       | operação, virada e rollback                              |
| [FINAL-VERIFICATION.md](docs/migration/FINAL-VERIFICATION.md) | resultados reais dos gates e pendências externas         |
| [RELATORIO-EXECUCAO.md](docs/migration/RELATORIO-EXECUCAO.md) | registro completo da execução: o que, como e a que custo |

Os sete `*.dc.html` do Claude Design são a fonte visual canônica. Eles não vão para
produção: são protótipos autônomos, traduzidos em componentes React. Estados que eles não
desenharam — vazio, erro, carregamento, mobile, busca — foram acrescentados sem mudar a
direção visual.

## O que este projeto não faz

- Não mantém fallback para o WordPress em runtime.
- Não renderiza HTML bruto do CMS: o corpo é `ContentBlock[]` tipado.
- Não bloqueia a página por anúncio, analytics, Cinerie ou embed remoto.
- Não sobe anúncio sem reserva de espaço — `minHeight` é prop obrigatória de `<AdSlot />`.
