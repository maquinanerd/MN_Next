# 2. Integração direta com Kal El

## Descoberta antes de adaptação

O nome Kal El não basta para pressupor REST, GraphQL, paths ou credenciais. Descubra primeiro, nesta ordem: cliente/configuração existente no checkout; documentação/collection/OpenAPI local; endpoints de documentação/health autorizados por `KAL_EL_BASE_URL`; GraphQL introspection somente se habilitada. Salve em `docs/migration/KAL-EL-DISCOVERY.md`: versão, transporte, base URL mascarada, recursos disponíveis, webhook, upload, preview e limites. Nunca coloque um segredo no documento.

Adote o OpenAPI desta pasta como **contrato de borda alvo** quando o Kal El permitir ajustar suas APIs. Se a API real diferir, mantenha a interface de domínio abaixo e altere somente `KalElHttpTransport`/mappers. Não espalhe DTOs do CMS pelas páginas.

## Interface obrigatória (domínio)

```ts
interface ContentRepository {
  getHome(): Promise<HomePage>;
  getArticle(category: string, slug: string, options?: ReadOptions): Promise<Article | null>;
  listCategory(slug: string, page: number): Promise<Page<Article>>;
  search(query: string, page: number): Promise<Page<SearchResult>>;
  getAuthor(slug: string, page: number): Promise<Page<Article> & { author: Author }>;
  getTag(slug: string, page: number): Promise<Page<Article> & { tag: Tag }>;
  getSpecial(slugs: string[]): Promise<Special | null>;
  listSitemap(kind: SitemapKind, cursor?: string): Promise<SitemapPage>;
  listRecentNews(since: Date, limit: number): Promise<Article[]>;
}
```

`packages/content` expõe modelos TypeScript + schemas runtime, repo, erro normalizado e tags. Páginas consomem somente a interface. `KalElContentRepository` é server-only (`import 'server-only'`). `FixtureContentRepository` só pode ser carregado por `NODE_ENV=test/development` + `CONTENT_SOURCE=fixture`; produção deve recusar essa combinação em validação de env.

## Autorização e integração de escrita

| Fluxo | Método obrigatório |
|---|---|
| Leitura pública pelo Next | Credencial de serviço somente no servidor ou endpoint público com WAF/rate limit. Nunca expor bearer. |
| Importação WordPress | Service token com escopo mínimo `media:write, taxonomy:write, author:write, content:write, redirects:write`; idempotency key por entidade/WP ID. |
| Webhook Kal El → Next | `POST /api/revalidate`, assinatura HMAC SHA-256 no raw body, timestamp ≤5 min, nonce/replay store, allowlist de evento. |
| Preview editorial | `GET /api/preview?token=...&slug=...`: JWT/HMAC assinado pelo Kal El, audience/expiry/slug validados; cookie HttpOnly e `draftMode`; saída sempre noindex. |
| Encerrar preview | `POST /api/preview/disable`, CSRF-safe e sem redirecionamento aberto. |

Ao receber `content.published`, `content.updated`, `content.deleted`, `taxonomy.updated` ou `redirect.updated`, valide payload e execute `revalidateTag('article:'+id)`, `revalidateTag('category:'+slug)`, `revalidateTag('home')`, `revalidateTag('sitemap')` conforme necessário. Nunca aceite tag fornecida arbitrariamente pelo payload.

## Cache e disponibilidade

- Leituras: `fetch` com `next: { tags, revalidate }`; home 60s, article 300s, category 120s, Cinerie 3600s. Busca tem `cache: 'no-store'`.
- Timeout explícito (por exemplo, 5s leitura), uma repetição com jitter para GET e nenhum retry cego para escrita.
- 404 editorial gera `notFound()`. Indisponibilidade Kal El para conteúdo essencial gera página 503 amigável e logada; Cinerie e módulos opcionais retornam `null`.
- Use stale cache quando o framework/provider permitir; não recache uma resposta de erro.

## Environments

| Variável | Obrigatória em produção | Finalidade |
|---|---:|---|
| `NEXT_PUBLIC_SITE_URL` | sim | URL canônica, sem barra final |
| `KAL_EL_BASE_URL` | sim | API Kal El, HTTPS em produção |
| `KAL_EL_SERVICE_TOKEN` | sim | Segredo server-only |
| `KAL_EL_WEBHOOK_SECRET` | sim | HMAC de webhook |
| `KAL_EL_PREVIEW_SECRET` | sim | Assinatura/validação preview |
| `CINERIE_INTERNAL_URL`, `CINERIE_SERVICE_TOKEN` | não | módulo Onde assistir |
| `CONTENT_SOURCE` | sim | `kalel` produção; fixture só dev/test |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | não | observabilidade |
| `WP_BASE_URL`, `WP_APPLICATION_PASSWORD` | só importação | origem legada, nunca runtime |
| `MEDIA_ALLOWED_HOSTS` | sim | allowlist explícita de imagem remota |

## Requisitos de contrato

O Kal El deve entregar ou o adapter deve derivar: IDs estáveis, `status`, datas com timezone, slugs imutáveis, categoria/tags/autores completos, cover/mídia com dimensões e alt, SEO, blocos tipados, dados comerciais, paginação determinística e `updatedAt`. Valide respostas com Zod; campo inesperado pode ser ignorado, campo obrigatório ausente deve falhar controladamente com erro de integração e alerta.
