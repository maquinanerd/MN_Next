# 1. Waves de entrega autônoma

Cada wave termina com código, testes e um commit. Prossiga automaticamente. Dependências externas são substituídas por adapter/mock até que a credencial exista; não use isso como justificativa para pular a entrega.

## Wave 0 — Descoberta e proteção

- Inventariar o checkout, lockfile, versões e ZIPs; gerar `docs/migration/INPUT-INVENTORY.md` com hashes, sem copiar conteúdo para git.
- Extrair referências em `.migration-reference/`, adicioná-la ao `.gitignore`, ler todos os documentos e catalogar componentes/rotas dos 7 protótipos.
- Localizar Kal El no disco/monorepo ou por URL configurada: OpenAPI, `/health`, GraphQL schema, collection ou cliente existente. Registrar capabilities confirmadas e decisão de transporte em `docs/migration/KAL-EL-DISCOVERY.md`.
- Criar branch e configurar padrões de Node, `.nvmrc`/`packageManager`, lint, format, env validation, commitlint opcional e hooks não bloqueantes.

**Gate:** nenhum ZIP alterado; build básico, typecheck e lint executáveis.

## Wave 1 — Fundação e front fiel

- Implementar tokens do design: Figtree (400–900), temas `data-theme`, marca `data-brand`, shells 1440/1240 e gutter responsivo. Preservar a regra vermelho de fundo versus texto.
- Criar NetworkBar, header, footer, navegação/móvel, category tabs como links, SectionHeading, cards, byline, Image, loading/empty/error.
- Implementar as rotas: home, categoria/página, artigo, especiais/dossiê/ao-vivo, reviews, ofertas, autor, tag, busca, newsletter e institucionais.
- Usar fixtures para renderizar todas as telas sem Kal El. O layout deve refletir os protótipos, inclusive anúncios reservados, comercial e Onde assistir.

**Gate:** screenshots comparativos 390/768/1024/1440, axe sem violações críticas e rotas acessíveis em fixture mode.

## Wave 2 — Camada Kal El e domínio

- Criar interfaces de domínio e DTOs Zod, `KalElClient` server-only, mapper e repositórios por recurso. Só a camada de mapper conhece nomes de campos/endpoint do Kal El.
- Aplicar `fetch` cache tags e invalidação. Padronizar erros: 404 de conteúdo, 502 degradado para dependência, correlation ID sem vazar stack/segredo.
- Implementar webhook de publicação e preview conforme o contrato. Testar HMAC, expiração/replay e cache invalidation.
- Converter cada rota do fixture provider para o provider Kal El, mantendo fixture/mocks apenas para desenvolvimento/teste explicitamente marcado.

**Gate:** testes de contrato cliente↔mock, nenhum token no bundle/client, páginas funcionam se Cinerie falhar.

## Wave 3 — Migração WordPress e mídia

- Implementar exportador/leitor WP, parser seguro HTML→ContentBlock, normalização e relatório de blocos desconhecidos.
- Migrar taxonomias/autores/mídia antes dos posts. Fazer upload via API Kal El, preservar alt/crédito/dimensão, gerar blur placeholder se o CMS não o fizer e manter mapa WP ID→Kal El ID.
- Importar em lotes idempotentes com `--dry-run`, checkpoint, retry limitado, rate limit e resumo JSON/CSV. Incluir fixtures com casos adversos.
- Construir `legacy_redirects`, suportar 301/410 e middleware/cache de borda. Exportar e validar amostra de URLs.

**Gate:** duas execuções não duplicam dados; página importada preserva semântica principal; amostra de redirects sem 404.

## Wave 4 — SEO, descoberta e monetização

- `generateMetadata`, canonical, OpenGraph, Twitter e robots por rota. Um `@graph` JSON-LD por página com NewsArticle/Article/Review/LiveBlogPosting/ItemList/BreadcrumbList adequados.
- Sitemap index/paginado, `news-sitemap.xml` de 48h e RSS 30 itens. Busca/tag parametrizada noindex; páginas de página 2 têm canonical próprio.
- Ads GAM após interactive, `AdSlot` sempre com `minHeight`, targeting server-derived, LGPD gating e brand-safety por tag. Links afiliados `sponsored nofollow`, disclosure acima do título.
- Busca Kal El paginada, debounce no cliente opcional, URL compartilhável e no-store no servidor.

**Gate:** schema snapshots, sitemap/robots/RSS válidos, sem CLS introduzido por slots e teste de ausência de consentimento.

## Wave 5 — Robustez, qualidade e operação

- Implementar erros segmentados, `not-found`, health/readiness, rate limiting em handlers públicos, headers de segurança/CSP pragmática, sanitização, validação de env e logs redigidos.
- RUM segmentado por template/categoria, dashboards/alertas documentados, accessibility e performance budgets.
- Criar CI, testes unitários/integrados/contrato/E2E/visual, audit Lighthouse e documentação de operação/rollback.

**Gate final:** todos os itens de `08-definition-of-done.md` comprovados por `FINAL-VERIFICATION.md`.
