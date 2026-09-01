# Verificação final — preencher com resultados reais

Data: `YYYY-MM-DD`  
Branch/commit: ``  
Kal El: `mock | staging validado | produção (não executar sem autorização)`

## Implementado

- [ ] Front e rotas
- [ ] Adaptador Kal El, preview e webhook
- [ ] Migração e redirects
- [ ] SEO, ads/LGPD, observabilidade e segurança
- [ ] Testes/CI/documentação

## Gates executados

| Comando | Resultado | Evidência/observação |
|---|---|---|
| `pnpm format:check` |  |  |
| `pnpm lint` |  |  |
| `pnpm typecheck` |  |  |
| `pnpm test:unit` |  |  |
| `pnpm test:integration` |  |  |
| `pnpm test:contract` |  |  |
| `pnpm test:a11y` |  |  |
| `pnpm test:e2e` |  |  |
| `pnpm test:visual` |  |  |
| `pnpm test:performance` |  |  |
| `pnpm test:security` |  |  |
| `pnpm build` |  |  |

## Dependências externas / não executadas

Registrar somente itens que exigem segredo, infraestrutura ou autorização: variável requerida, impacto, fallback que foi testado e ação do operador. Não usar esta seção para esconder falha de código.

## Scorecard de staging e virada

- [ ] Env Kal El staging configurado e readiness verde
- [ ] Import dry-run e espelho concluídos; contagens comparadas
- [ ] 1.000 URLs (ou amostra disponível) sem 404/loop
- [ ] Rich Results, sitemaps, robots, canonical e RSS validados
- [ ] Auditoria visual e CWV aprovadas
- [ ] WP de rollback e TTL/runbook confirmados
- [ ] Aprovação explícita recebida para virada/DNS
