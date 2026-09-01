# Pacote de orquestração — Máquina Nerd → Next.js + Kal El

Extraia este pacote na raiz de `C:\Users\pablo\Documents\Máquina Nerd Next JS`. Ele cria `CLAUDE.md` e `migration-orchestration/`; abra essa raiz no Claude Code e solicite: **"Execute integralmente o CLAUDE.md."**

O pacote não altera os dois ZIPs originais já presentes no repositório. O script de inspeção somente confere seus hashes e expande cópias sob uma pasta ignorada. Os protótipos do Claude Design são a referência visual obrigatória; a documentação técnica é a referência de produto e engenharia.

## Conteúdo

- `docs/00-execution-charter.md`: escopo, decisões padrão e segurança.
- `docs/01-delivery-waves.md`: implementação por waves, sem checkpoints humanos.
- `docs/02-kalel-integration.md` e `contracts/kalel-openapi.yaml`: adaptador direto Kal El, auth, preview e revalidação.
- `docs/03-wordpress-migration.md`: importação idempotente, mídia, slugs e redirects.
- `docs/04-seo-performance-security.md`: SEO, cache, observabilidade, LGPD e performance.
- `docs/05-file-matrix.md`, `06-test-and-audit-plan.md`, `07-ci-and-operations.md`: matriz de entrega, testes, CI e operação.
- `docs/08-definition-of-done.md`: critérios objetivos de aceite.
- `scripts/*.ps1`: inspeção, bootstrap e gates para Windows/PowerShell.
- `fixtures/`: dados mínimos e contratos para testes locais.

## Execução local (PowerShell)

```powershell
Set-Location 'C:\Users\pablo\Documents\Máquina Nerd Next JS'
Set-ExecutionPolicy -Scope Process Bypass
.\migration-orchestration\scripts\Inspect-Inputs.ps1
.\migration-orchestration\scripts\Bootstrap-Workspace.ps1
```

Os scripts são seguros por padrão: não chamam produção, não modificam os ZIPs e não criam conteúdo externo. O agente deve concluir o código e então executar `Run-Quality-Gates.ps1`.
