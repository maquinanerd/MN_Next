# 8. Definition of Done objetiva

O agente não pode encerrar afirmando "pronto" sem uma linha de evidência real para cada item abaixo em `docs/migration/FINAL-VERIFICATION.md`.

## Produto e front

- [ ] As sete superfícies dos protótipos foram implementadas em React, com NetworkBar, header, footer, grids, artigo, especiais e comercial coerentes com a referência; `VISUAL-AUDIT.md` vincula cada arquivo-fonte à rota, screenshot e viewport de aceite.
- [ ] Tokens, Figtree, claro/escuro, marca MN/Cinerie e contraste vermelho obedecem a especificação; sem cores da marca hardcoded em UI compartilhada.
- [ ] Todas as rotas da matriz existem, têm estado loading/empty/error/not-found e foram testadas em 390/768/1024/1440.
- [ ] Componentes interativos têm teclado, foco visível, aria adequada, reduced motion e 44px de alvo útil em mobile.

## Kal El e conteúdo

- [ ] Descoberta do Kal El e interface/adaptador/mappers documentados; response schemas, timeouts, erros e cache tags cobertos por testes.
- [ ] Produção não contém fixture provider nem token no cliente. Ausência de Cinerie degrada o módulo opcional sem derrubar página.
- [ ] Webhook HMAC/replay, preview seguro/noindex e invalidação seletiva funcionam e possuem testes.
- [ ] Modelo de domínio suporta todos os tipos de artigo, `ContentBlock[]`, mídia, autores, taxonomias, especiais, comercial, ofertas e live.

## Migração e URLs

- [ ] Scripts WP possuem help, dry-run, resume, logs redigidos, relatório e reexecução sem duplicar registros.
- [ ] Parser sanitiza HTML e contabiliza blocos desconhecidos; mídia preserva metadados e é validada/deduplicada.
- [ ] Mapa de redirects contempla permalinks, `?p=`, feeds/WP endpoints e removidos 410; sem open redirect/loop.
- [ ] A amostra disponível de URLs de alto tráfego possui 0 redirect inesperado e 0 404 acidental; limitação de amostra está registrada, se houver.

## SEO, performance, segurança

- [ ] Metadata, canonical, OG/Twitter, JSON-LD adequado, breadcrumbs, robots, sitemap(s), news sitemap e RSS estão corretos/validados.
- [ ] ISR/SSR/cache e `revalidateTag` seguem a matriz; busca é no-store, preview noindex e páginas indexáveis têm HTML útil sem JS.
- [ ] Imagens, fontes, embeds e anúncios preservam dimensões; budgets/Lighthouse têm resultado registrado e CLS não aumenta por ad slot.
- [ ] Env validation, headers/CSP, sanitização, upload validation, rate limit, LGPD gating, segredo redaction, health/readiness e error reporting foram implementados/testados.

## Engenharia e entrega

- [ ] `format:check`, lint, typecheck, unit, integration, contract, E2E, a11y, visual, security e build foram executados (ou cada indisponibilidade externa tem causa, impacto e fallback documental).
- [ ] CI executa os gates relevantes com fixtures e publica artefatos. Nenhum segredo, ZIP original, mídia, referência extraída ou output local foi versionado.
- [ ] README/env/runbooks/decisões/rollback e verificação final estão atualizados. Branch/commits seguem a política e `git status` final está explicado.
- [ ] Staging/virada não foram realizados sem credenciais/autorização, mas o runbook e scorecard estão completos e acionáveis.
