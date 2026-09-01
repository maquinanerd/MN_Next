# Máquina Nerd — execução autônoma da migração

Você é o agente de implementação responsável por concluir a migração do Máquina Nerd para Next.js integrado diretamente ao Kal El CMS. Execute este plano até o fim no repositório atual, sem solicitar confirmações para decisões não críticas e sem interromper a execução entre fases. O resultado é código de produção, testado e documentado — não apenas um plano.

## Mandato e limites

- Repositório-alvo: a raiz atual. Os arquivos `Máquina Nerd template completo.zip` e `doc tecnico.zip` são **originais imutáveis**. Nunca os edite, substitua, delete, descompacte por cima de si mesmos ou adicione-os ao controle de versão.
- Os sete arquivos `*.dc.html` dentro do template são a fonte visual canônica. Reproduza o front aprovado com fidelidade; não faça uma releitura visual. Extraia-os apenas para uma pasta temporária/ignorada de referência.
- O WordPress é fonte de importação, nunca dependência no runtime público. O Kal El é a fonte de conteúdo no runtime.
- Se o Kal El não estiver no checkout, use somente as credenciais de ambiente para a integração; não invente endpoints de produção. Implemente o adaptador, o contrato testável e o modo mock local; descubra o contrato real por documentação, código adjacente ou endpoint de health/OpenAPI/GraphQL introspection autorizados.
- Não peça permissões nem checkpoints para escolhas reversíveis. Registre premissas em `docs/migration/DECISIONS.md`, escolha o padrão mais seguro e avance.
- Não faça deploy, mudança de DNS, publicação no WordPress, exclusão de dados, rotação de credenciais ou chamada de migração em produção sem as respectivas variáveis explícitas. Prepare tudo e execute local/staging quando configurado.

## Ordem obrigatória de trabalho

1. Leia integralmente `migration-orchestration/README.md` e `migration-orchestration/docs/00-execution-charter.md`.
2. Execute `migration-orchestration/scripts/Inspect-Inputs.ps1 -ExtractReferences`, confirme hashes e extraia cópias de trabalho sob `.migration-reference/` (ignorado). Leia e conclua a checklist de cobertura em `migration-orchestration/docs/10-front-source-coverage.md` antes de escrever componentes.
3. Inspecione o repositório e o Kal El conforme `docs/02-kalel-integration.md`; registre o contrato adotado e as lacunas. Nunca bloqueie o build por segredo ou serviço ausente.
4. Implemente as waves em `docs/01-delivery-waves.md`, em ordem. Conclua e teste cada wave antes da próxima.
5. Mantenha o design aprovado. Compare cada uma das sete superfícies com seu protótipo em 390, 768, 1024 e 1440 px; capture evidências sob `artifacts/visual/` (ignorado). A verificação final precisa listar o arquivo-fonte e a rota/evidência correspondente para as sete superfícies.
6. Execute todos os gates em `scripts/Run-Quality-Gates.ps1`. Corrija falhas atribuíveis ao projeto. Gere `docs/migration/FINAL-VERIFICATION.md` com resultados reais, comandos e pendências externas.

## Regras de autonomia e fallback

| Situação                       | Ação sem perguntar                                                                                                                                                               |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repo vazio                     | Inicialize Next App Router TypeScript, escolha pnpm se não houver lockfile, e siga a arquitetura alvo.                                                                           |
| Kal El inacessível/sem segredo | Prossiga com `KalElClient` tipado, MSW/fixture contratual e feature flags seguras. A aplicação deve compilar; produção falha de forma observável e degradada, nunca mostra mock. |
| Contrato Kal El divergente     | Preserve a interface de domínio, adapte somente a camada de mapeamento e registre exemplos request/response sanitizados.                                                         |
| Dados WordPress ausentes       | Construa importador idempotente, dry-run, fixtures e relatório; não simule uma migração concluída.                                                                               |
| Serviço Cinerie indisponível   | O módulo "Onde assistir" não renderiza e o restante da página permanece 200.                                                                                                     |
| Design sem estado especificado | Use estados neutros e acessíveis coerentes com os tokens: skeleton com dimensões reservadas, vazio explicativo, erro recuperável.                                                |
| Dependência incompatível       | Prefira a versão estável compatível com o Next instalado; documente a escolha e evite atualizar major sem necessidade.                                                           |

## Padrões não negociáveis

- Next App Router, React Server Components por padrão, TypeScript estrito, validação de runtime (Zod ou equivalente), lint e formatação.
- Sem hex de marca em componentes compartilhados: use `--brand`, `--brand-ink`, `--brand-on-dark`. `#E30613` só para fundo/borda/foco; texto em fundo claro usa `#B00710`.
- Conteúdo de artigo é `ContentBlock[]` tipado e sanitizado; não injete HTML WordPress bruto.
- Segredos ficam apenas em `.env*` ignorados. `KAL_EL_SERVICE_TOKEN` jamais é exposto a browser, log, fixture ou bundle.
- Toda mutação Kal El exige autenticação server-to-server, idempotency key e log/auditoria. Webhook exige HMAC e tolera replay.
- Rotas de leitura usam cache por tag; publicação/revisão revalida tags. Busca é dinâmica/no-store. Preview exige token assinado e é noindex.
- Cada template possui metadata, JSON-LD, estados loading/empty/error, anúncios com reserva de espaço, teclado/axe, temas claro/escuro e responsividade.
- Não use `any`, não deixe TODOs críticos, não desabilite testes/ESLint para passar gates e não faça `git reset --hard`.

## Estratégia de Git

Crie `chore/maquina-nerd-kalel-migration` a partir do estado atual, preservando alterações pré-existentes. Faça commits pequenos e convencionais ao terminar cada wave (`chore`, `feat`, `test`, `docs`, `fix`). Nunca faça commit de `.env`, mídia importada, backups, relatórios sensíveis ou ZIPs de referência. Antes do último commit, `git status`, testes e build devem estar limpos/explicados.

## Coordenação paralela com Codex CLI

Se o comando `codex` estiver instalado e autenticado, coordene **dois** auxiliares do Codex em paralelo por CLI logo após a Wave 0. Faça isso sem pausar a implementação principal e sem delegar a eles escrita no working tree compartilhado:

1. Crie `artifacts/codex-workers/` (ignorado pelo git) e execute dois `codex exec` em processos separados, ambos com sandbox `read-only` e `--output-last-message` apontando para arquivos distintos.
2. Worker A: auditar os protótipos Claude Design e produzir inventário objetivo de componentes, rotas, tokens, breakpoints e diferenças proibidas.
3. Worker B: auditar o contrato/integração Kal El, migração WordPress, segurança e testes; produzir riscos, endpoints/DTOs a confirmar e testes de aceite.
4. Aguarde os dois relatórios, leia-os, incorpore somente recomendações consistentes com este `CLAUDE.md` e registre as decisões. Você, Claude Code, é o único autor de código e commits.
5. Na Wave 5, inicie um terceiro Codex CLI em `read-only` para revisar o diff final, testes, segurança, SEO e Definition of Done. Corrija os achados válidos antes da verificação final.

Modelo PowerShell (ajuste apenas paths já existentes):

```powershell
$out = Join-Path (Get-Location) 'artifacts/codex-workers'; New-Item -ItemType Directory -Force $out | Out-Null
$a = Start-Process codex -ArgumentList 'exec','-C','.', '-s','read-only','-o',"$out/design-audit.md",'Audite em modo somente leitura os protótipos e os docs de migração. Entregue matriz de componentes, rotas, tokens, breakpoints e critérios de fidelidade. Não modifique arquivos.' -PassThru -WindowStyle Hidden
$b = Start-Process codex -ArgumentList 'exec','-C','.', '-s','read-only','-o',"$out/integration-audit.md",'Audite em modo somente leitura a integração Kal El, migração WordPress, SEO, segurança e testes. Entregue riscos, contrato e testes exigidos. Não modifique arquivos.' -PassThru -WindowStyle Hidden
Wait-Process -Id $a.Id, $b.Id
```

Se Codex CLI não estiver disponível, não tente instalar, não interrompa e registre a indisponibilidade em `FINAL-VERIFICATION.md`; execute as mesmas auditorias você mesmo. Nunca use bypass de sandbox/aprovações e nunca execute workers paralelos escrevendo no mesmo checkout.

## Loop obrigatório: Claude implementa, Codex revisa, Claude corrige

Você, Claude Code, escreve e integra o código. Ao concluir cada Wave 1–5 e antes de cada commit, execute o Codex CLI como revisor independente do diff não commitado. Salve o resultado sob `artifacts/codex-reviews/wave-N-inicial.md`, analise-o, corrija todos os achados válidos de severidade alta/média e registre a decisão para falsos positivos. Então rode o mesmo review novamente e salve `wave-N-final.md`. Só faça o commit se o segundo review não tiver achado bloqueante e os gates da wave estiverem verdes.

O prompt do revisor deve ser específico à wave e exigir: bugs/regressões, contratos Kal El, vazamento de segredo, cache/ISR, SEO/redirects, XSS/SSRF/auth, acessibilidade, fidelidade ao protótipo, testes faltantes e aderência ao Definition of Done. O Codex deve retornar achados ordenados por gravidade, com arquivo/linha, impacto, evidência e correção sugerida; não deve modificar arquivos. Exemplo:

```powershell
$reviewDir = Join-Path (Get-Location) 'artifacts/codex-reviews'; New-Item -ItemType Directory -Force $reviewDir | Out-Null
$prompt = 'Revise somente as mudanças não commitadas da Wave 2 do Máquina Nerd. Não modifique arquivos. Encontre bugs e regressões reais, priorizando integração Kal El, secrets, validação de DTO, webhook HMAC/replay, preview, cache/revalidate, erros e testes. Retorne somente achados acionáveis com severidade, arquivo/linha, evidência e correção.'
codex review --uncommitted $prompt 2>&1 | Set-Content -LiteralPath (Join-Path $reviewDir 'wave-2-inicial.md') -Encoding utf8
```

Isso é uma conversa em ciclos por relatório: Claude passa contexto/diff ao Codex, interpreta a revisão, envia a revisão posterior após corrigir e fecha somente quando o revisor e os gates concordam. Não simule uma aprovação; se a CLI de review falhar, faça a revisão equivalente internamente e registre o motivo.

## Encerramento obrigatório

Só considere o trabalho concluído depois de atender todos os itens de `docs/08-definition-of-done.md`. A resposta final deve declarar: implementado, comandos/gates com resultado, variáveis que o operador ainda precisa fornecer, plano seguro de staging/virada e quaisquer limitações externas reais.
