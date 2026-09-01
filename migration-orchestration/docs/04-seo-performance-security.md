# 4. SEO, performance, segurança e observabilidade

## SEO técnico

- `generateMetadata` server-side em toda rota; `NEXT_PUBLIC_SITE_URL` é a única base canônica. Artigo: canonical próprio (ou Cinerie para republicação), OpenGraph `article`, Twitter large image, `pt_BR`, published/modified/author; `noindex` por SEO/preview/campanha.
- Inserir um JSON-LD `@graph` server-side por página: Organization + WebSite no layout e NewsArticle/Article/Review/LiveBlogPosting/ItemList/CollectionPage + BreadcrumbList no template. Validar headline ≤110 chars, imagem ≥1200px para Discover e datas reais.
- Implementar `robots.ts`, sitemap index/paginado (máximo 50k/arquivo), categorias/autores/tags, news sitemap das últimas 48h/máx. 1000, RSS 30 itens. Permitir `/_next/image` e estáticos. Busca e tags com query: noindex, follow.
- Serve HTML completo sem depender de JS. Páginas paginadas são canonical de si mesmas, não da primeira. Links internos usam URLs canônicas.

## Render e budgets

| Área | Estratégia | Limite |
|---|---|---|
| Home | ISR 60s + tag | LCP p75 mobile <2.0s |
| Artigo | ISR 300s + `generateStaticParams` 500 recentes | LCP <2.0s, HTML completo |
| Categoria | ISR 120s | CLS <0.05 |
| Busca | dinâmica/no-store | INP <200ms |
| Ao vivo | shell estático + polling isolado | não recarregar rota inteira |
| JS inicial | RSC por padrão | <120 KB comprimido |
| CSS | tokens/utilitários | <25 KB |
| imagens acima da dobra | uma prioridade | <250 KB |

Usar `next/image`, `sizes`, aspect-ratio/reserva de espaço, AVIF/WebP e apenas uma imagem priority por viewport. Fontes Figtree via `next/font`; adicionar `prefers-reduced-motion`. Facades com IntersectionObserver para YouTube/redes sociais.

## Publicidade e LGPD

GAM via `next/script afterInteractive`; `AdSlot` exige `minHeight` e nunca recebe foco. Leaderboard 90px, sidebar 600px, in-article 280px, anchor mobile 50px. Carregar/segmentar ads somente após consentimento aplicável. Targeting vem de dados sanitizados do servidor; não usar tags sensíveis para monetização. Conteúdo comercial sempre tem disclosure antes do título, e afiliados usam `rel="sponsored nofollow"` com preço/data visível.

## Segurança

- Validar todo input com schema; limitar tamanho, paginação, query, upload e taxa por IP/identidade. Sanitizar HTML no servidor com allowlist; CSP compatível com Next/GAM/Sentry e headers `nosniff`, referrer policy, frame-ancestors e HSTS em produção.
- SSRF: URLs externas em allowlist, DNS/IP privados bloqueados no importador e redirects apenas paths relativos/site allowlist. Uploads: MIME + magic bytes + dimensão + limites, nomes gerados, sem executar SVG/HTML.
- Cookies Secure/HttpOnly/SameSite, CSRF para mutações browser, OAuth/bearer no servidor. Logs redigem `authorization`, cookies, tokens, senha e PII. Dependabot/audit no CI e revisão de dependências.

## Observabilidade e erros

- Propagar `x-request-id`/correlation ID entre Next e Kal El; logs JSON com rota, status, cache outcome, template e categoria, nunca conteúdo/segredo.
- Instrumentar server/client errors em provedor configurável; health não testa dependências e readiness testa Kal El com timeout sem expor detalhes.
- `useReportWebVitals` envia métricas consentidas para endpoint rate-limited, agrupadas por template/categoria/device. Alertar erro de webhook, falha de import, aumento de 5xx e regressão CWV.
- `error.tsx`, `not-found.tsx` e error boundaries por segmento devem ser úteis, acessíveis e não revelar internals.
