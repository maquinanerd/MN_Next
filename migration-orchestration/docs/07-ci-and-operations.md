# 7. CI, operação, commits e virada

## CI por pull request

1. Instalar com lockfile imutável, cache de dependências e Node LTS.
2. Rodar format, lint, typecheck, unit, integration, contract mock, build, a11y e E2E em fixture mode.
3. Publicar artefatos de Playwright, screenshots, coverage e Lighthouse; falhar em regressão de budgets e violações graves axe.
4. Rodar auditoria de dependências e secret scan. Nunca injetar segredos de produção em PR/fork.

## Branches e commits

- Branch de trabalho `chore/maquina-nerd-kalel-migration`; branches auxiliares somente se o repo exigir.
- Commits convencionais, atômicos, com testes junto do código. Exemplo: `feat(content): add Kal El article repository`.
- Antes de cada commit: `git diff`, formato/lint afetado e nenhum `.env`, artefato de mídia/zip, node_modules, coverage ou referência extraída.
- Não rebase/force push/reset que destrua trabalho prévio. Documentar alterações preexistentes que não pertencem à migração.

## Staging e virada (não executar sem autorização)

1. Provisionar staging com `noindex`, domínio canônico de staging e env Kal El de staging.
2. Rodar importação completa dry-run, importar espelho, teste de redirects/SEO/visual e revisão editorial de amostra.
3. Congelar publicação WP, capturar delta, importar idempotentemente e comparar contagens.
4. Baixar TTL antes da janela aprovada; apontar DNS somente com scorecard verde. Manter WP em leitura por 30 dias.
5. Monitorar 404, 5xx, cache, CWV, erros de webhook, indexação e receita/CLS diariamente na primeira semana.

## Rollback

Rollback é DNS/proxy para o WordPress ainda preservado, não uma deleção do Next/Kal El. Documentar owner, janela, TTL, comandos do provedor como placeholders e condições objetivas: taxa 5xx/404 anormal, perda de conteúdo crítico, redirect loop ou incidente de segurança. Preservar logs/mapeamentos e corrigir em staging antes de nova virada.

## Operação diária

Publicação Kal El deve enviar webhook assinado; dashboard evidencia cache invalidation. Importador fornece progress/retry. On-call recebe correlation ID e pode verificar `/api/health` e `/api/ready`. Cada alerta deve ter severidade, limiar, owner e runbook linkado.
