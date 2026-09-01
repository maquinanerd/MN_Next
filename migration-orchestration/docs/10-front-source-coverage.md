# 10. Cobertura obrigatória do front aprovado

Este é o inventário completo dos artefatos Claude Design encontrados em `Máquina Nerd template completo.zip`. O objetivo é garantir que o Claude Code use **todo** o front aprovado como fonte visual, e não só a home ou a documentação técnica.

## Preparação

- [ ] Executar `migration-orchestration/scripts/Inspect-Inputs.ps1 -ExtractReferences`.
- [ ] Confirmar os ZIPs por SHA-256 em `docs/migration/INPUT-INVENTORY.md`.
- [ ] Confirmar que os arquivos abaixo existem em `.migration-reference/claude-design/`.
- [ ] Manter a extração fora do git; os ZIPs e seus arquivos internos não devem ser modificados.

## Matriz de uso do front

| Fonte Claude Design | Superfícies/implementação que ela governa | Evidência de aceite |
|---|---|---|
| `Máquina Nerd Índice.dc.html` | mapa navegável das telas e cobertura de rotas | rota equivalente por item ou justificativa documentada |
| `Máquina Nerd Template.dc.html` | Home: hero, destaques, grids, rede, ads, módulos e rodapé | screenshot home por viewport/tema |
| `Máquina Nerd Categorias.dc.html` | editoria, abas, listagem e paginação | screenshot categoria e página 2; tabs como links reais |
| `Máquina Nerd Notícias.dc.html` | artigo standard, longform, urgente, vídeo e lista | uma rota/teste/screenshot por variante |
| `Máquina Nerd Especiais.dc.html` | índice de especiais, hub, dossiê, capítulos e ao vivo | screenshots de hub/dossiê/live e testes de interação |
| `Máquina Nerd Comercial.dc.html` | publieditorial, review, comparativo, oferta/campanha | disclosure, tabela/BuyBox e links `sponsored nofollow` testados |
| `Máquina Nerd Design System.dc.html` | cores, tipografia, grids, espaçamento, componentes, tema e acessibilidade | tokens implementados e auditoria de contraste/foco |
| `assets/mn-logo-on-dark.png`, `assets/mn-logo-on-light.png` | logos em fundos claro/escuro | assets copiados/otimizados legalmente e renderizados no header/footer |
| `uploads/*` | somente referência de conteúdo/recortes, não dependência de produção | nenhuma URL/asset de placeholder é dependência de runtime |

## Regra de preservação

Os arquivos `*.dc.html` não precisam virar HTML de produção nem ser copiados para `app/`: eles são protótipos autônomos. O requisito é traduzir sua composição e sistema visual para componentes React sustentáveis, preservando todas as variantes aprovadas. Funcionalidades de produção ausentes no protótipo (erro, vazio, loading, mobile, busca etc.) devem ser adicionadas sem alterar a direção visual.

## Prova final obrigatória

`docs/migration/VISUAL-AUDIT.md` deve possuir uma linha para cada item da tabela com: fonte, rota de implementação, fixture utilizada, viewports testados, caminho do screenshot e divergências justificadas. Nenhuma fonte pode ficar sem linha.
