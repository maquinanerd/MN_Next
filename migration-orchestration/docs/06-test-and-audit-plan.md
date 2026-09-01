# 6. Plano de testes, auditoria visual e funcional

## Pirâmide obrigatória

| Camada | Casos mínimos |
|---|---|
| Unitário | slug/canonical, schemas/mappers Kal El, cache tags, HMAC/replay, preview token, HTML sanitizer/parser, normalização de redirect, cálculo de leitura, targeting e lógica comercial. |
| Integração | handlers com request real simulado, Kal El MSW, cache/revalidate, middleware 301/410/loop, upload validation, estado Cinerie fora e consentimento ads. |
| Contrato | cada endpoint/DTO do OpenAPI contra mock/instância Kal El disponível; resposta inválida, 401, 404, 429, timeout e 5xx. |
| E2E | home, categoria/paginação, standard, longform, urgent, video, list, especial/dossiê/live, review/comercial, busca, autor/tag, preview e redirects. |
| Acessibilidade | axe em todas as telas/temas; tab order, foco, menu, busca, share, formulário newsletter e reduced motion. |
| Visual | Playwright screenshots dos sete protótipos/superfícies em 390/768/1024/1440, claro/escuro; revisão diff com máscaras justificadas para anúncios/dados dinâmicos. |
| Performance | Lighthouse mobile em home/artigo/categoria, bundle analyzer e assertions de budget. |
| Segurança | testes de auth webhook/preview, XSS, open redirect, SSRF, upload e secret leakage. |

## Fixtures exigidas

Criar fixtures estáveis, sem dados de produção: home com destaque, artigo para cada template, artigo comercial, especial, ao vivo, autores/tags/categorias, Cinerie success/failure, Kal El paginado e erros, payload webhook assinado/expirado/replayed, mapa redirects e WP HTML adverso. Data/hora congelável para snapshot.

## Auditoria de fidelidade

Para cada tela canônica: extrair protótipo em referência, iniciar fixture mode e capturar screenshot com mesma viewport. Comparar estrutura (header/rede, grids, tipografia, cores, card, ad slots, footer) e interações. Ajustar até que diferenças sejam de conteúdo dinâmico ou comportamento exigido de produção; registrar exceção com motivo em `docs/migration/VISUAL-AUDIT.md`.

## Comandos que devem existir

```
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test:unit
pnpm test:integration
pnpm test:contract
pnpm test:e2e
pnpm test:a11y
pnpm test:visual
pnpm build
pnpm test:performance
pnpm test:security
```

Use nomes equivalentes apenas quando a ferramenta do repo já fornece outro padrão. Não declare um script inexistente como sucesso. Falhas de credenciais em testes de contrato devem selecionar mock determinístico e aparecer no relatório como teste real pendente, não verde falso.
