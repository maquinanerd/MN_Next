# 0. Carta de execução

## Resultado esperado

Entregar o portal Máquina Nerd em Next.js, conectado em runtime ao Kal El CMS, visualmente fiel aos sete protótipos aprovados e apto a substituir o WordPress com SEO, mídia, redirects e operação segura. A primeira implementação pode viver como app único no repositório vazio; ela deve isolar `packages/content`, `packages/ui`, `packages/tokens` e `packages/seo` para permitir o monorepo MN/Cinerie sem reescrita.

## Fontes de verdade e prioridades

1. Comportamento seguro, URLs legadas e dados de produção.
2. Contrato confirmado do Kal El e modelo de domínio deste pacote.
3. Arquivos `*.dc.html` do ZIP do template: composição, tokens, espaçamento e superfícies aprovadas.
4. Especificação técnica extraída do `doc tecnico.zip`.
5. Convenções existentes do repositório, quando não conflitarem com os itens acima.

## Decisões padrão executáveis

| Tema | Decisão padrão |
|---|---|
| Framework | Next App Router atual estável, TypeScript strict, Node LTS, pnpm salvo lockfile existente. |
| Dados | Kal El é o único adaptador de produção. Cliente de domínio no servidor com timeout, schema validation, retries só para leitura idempotente e circuit breaker/degradação. |
| Banco local | Não criar um segundo CMS. Usar banco apenas se o Kal El exigir outbox/auditoria operacional; migrations versionadas. |
| Auth editorial | Apenas server-to-server via bearer ou OAuth client credentials confirmado pelo Kal El. Leitores não precisam login. |
| Preview | Rota protegida por token HMAC de curta duração, cookie `HttpOnly`, `SameSite=Lax`, noindex, sem cache compartilhado. |
| Render | Home ISR 60s/tag `home`; artigo ISR 300s/tag por artigo e listagens; editoria ISR 120s; busca dinâmica `no-store`; ao vivo shell + polling. |
| Armazenamento | A mídia é criada/servida pelo provider configurado no Kal El; URLs remotas em allowlist no `next.config`. Não faça proxy aberto. |
| Observabilidade | Logs estruturados, request/correlation ID, endpoint health/readiness, erro rastreável (Sentry ou adapter), RUM Web Vitals com privacidade. |
| Consentimento | Analytics, ads, embeds e RUM não essencial são condicionados ao consentimento LGPD; conteúdo editorial não depende deles. |

## Arquitetura mínima

```
app/                           rotas, layouts e Route Handlers Next
packages/content/              modelos, KalElClient, mapeadores, cache tags, fixtures
packages/ui/                   componentes visuais sem cor hardcoded
packages/tokens/               CSS vars e temas MN/Cinerie
packages/seo/                  metadata, JSON-LD, sitemap e canonical
scripts/                       importação WP, verificação de URL e smoke tests
tests/                         unit, integration, contract, e2e, visual/a11y
docs/migration/                decisões, relatórios e evidências reais
```

## Invariantes de conteúdo

- Article: `id`, `slug` imutável, categoria, autor, datas ISO, cover ≥1200px para Discover, estado editorial, SEO e `ContentBlock[]`.
- Blocos permitidos: paragraph sanitizado, heading, image, quote, list, callout, embed com allowlist, specTable, comparison, buyBox, ad, whereToWatch. Desconhecidos geram relatório de importação, nunca sumiço silencioso.
- Slug é ASCII/minúsculo/hífen. Título pode mudar sem mudar slug. Tags não viram segmentos de rota.
- Autor, categoria, tag e mídia têm IDs estáveis. Todo ativo de imagem contém alt (vazio apenas se decorativo) e crédito quando aplicável.

## Não fazer

- Não reimplementar o Kal El nem manter fallback WordPress no frontend.
- Não lançar sem mapa de redirects e amostra de URLs de tráfego validada.
- Não inserir `dangerouslySetInnerHTML` para conteúdo sem sanitização server-side baseada em allowlist.
- Não bloquear render por anúncios, Cinerie, analytics ou um embed remoto.
- Não tratar credencial/URL de produção ausente como permissão para improvisar ou publicar.
