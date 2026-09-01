# 5. Matriz de arquivos da implementação

O agente deve adaptar nomes ao checkout, mas entregar responsabilidades equivalentes. `C` = criar, `A` = alterar/adaptar, `V` = verificar. Não sobrescrever arquivos existentes sem primeiro integrá-los.

| Área | Arquivos mínimos | Ação | Resultado verificável |
|---|---|---:|---|
| Workspace | `package.json`, `pnpm-workspace.yaml`, `tsconfig*.json`, `next.config.*`, `.gitignore`, `.env.example`, `README.md` | C/A | Next strict, env documentado, hosts de imagem allowlisted |
| App shell | `app/layout.tsx`, `app/globals.css`, `app/(site)/layout.tsx`, `app/not-found.tsx`, `app/error.tsx`, `app/loading.tsx` | C | tema/brand, Figtree, shell e erros |
| Rotas | `app/page.tsx`, `app/[categoria]/page.tsx`, `app/[categoria]/page/[n]/page.tsx`, `app/[categoria]/[slug]/page.tsx` | C | home/editoria/paginação/artigo |
| Rotas complementares | `app/especiais/**`, `app/ao-vivo/[evento]`, `app/reviews/**`, `app/ofertas/**`, `app/autor/[slug]`, `app/tag/[slug]`, `app/busca`, `app/newsletter`, institucionais | C | todas as superfícies da especificação |
| UI | `packages/ui/src/{layout,cards,article,ads,commercial,specials,states}/**` | C | componentes fiéis e acessíveis |
| Tokens | `packages/tokens/src/index.css`, `packages/tokens/tailwind.*` | C | variações claro/escuro e MN/Cinerie |
| Conteúdo | `packages/content/src/{domain,schemas,repository,kalel,fixtures,cache,errors}/**` | C | interface isolada e DTOs validados |
| SEO | `packages/seo/src/**`, `app/sitemap.ts`, `app/robots.ts`, `app/news-sitemap.xml/route.ts`, `app/feed.xml/route.ts` | C | metadata, graph, sitemaps, RSS |
| APIs Next | `app/api/{revalidate,preview,preview/disable,health,ready,web-vitals}/route.ts` | C | webhook/preview/monitoramento seguros |
| Redirects | `middleware.ts`, `packages/content/src/redirects/**`, `data/redirects/**` | C | 301/410 sem loop/open redirect |
| WP import | `scripts/wp/{export,transform,media,import,build-redirects,verify}.ts` | C | dry-run/resume/upsert/relatórios |
| Operação | `docs/migration/{DECISIONS,KAL-EL-DISCOVERY,INPUT-INVENTORY,FINAL-VERIFICATION,ROLLBACK}.md` | C | evidência e runbooks reais |
| Testes | `tests/{unit,integration,contract,e2e,visual,fixtures}/**`, config Vitest/Playwright/MSW | C | gates automatizados |
| CI | `.github/workflows/{ci,security}.yml`, `.lighthouserc.*` | C | PR gates e audit |

## Rotas e expectativas

| Rota | Fonte | render/cache | SEO |
|---|---|---|---|
| `/` | home Kal El | ISR 60/tag home | WebSite + coleção |
| `/{categoria}` e `/page/{n}` | categoria | ISR 120 | CollectionPage, página canonical própria |
| `/{categoria}/{slug}` | artigo | ISR 300/tag artigo | NewsArticle/Article/live, breadcrumbs |
| `/especiais/*`, `/ao-vivo/*` | especial/live | ISR; polling isolado live | Article/LiveBlogPosting |
| `/reviews/*`, `/ofertas/*` | comercial | ISR/SEO conforme conteúdo | Review/Product/ItemList; campanha noindex |
| `/autor/*`, `/tag/*` | taxonomia | ISR | coleção; consulta filtrada noindex quando aplicável |
| `/busca?q=` | pesquisa Kal El | dynamic/no-store | noindex, follow |
| `/sitemap*`, `/news-sitemap.xml`, `/feed.xml`, `/robots.txt` | content | regras do doc SEO | válidos/absolutos |

## Arquivos de referência imutáveis

`Máquina Nerd template completo.zip` e `doc tecnico.zip` são preservados. Extrações de trabalho devem ficar em `.migration-reference/` no `.gitignore`. Não inclua os 47 MB de exportação na CI, npm package ou bundle.
