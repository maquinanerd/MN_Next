# Auditoria visual

Cada arquivo do Claude Design ligado à rota que o implementa, ao fixture que a alimenta e
ao screenshot que serve de evidência. Nenhuma fonte fica sem linha — é a exigência de
`docs/10-front-source-coverage.md`.

## Como as evidências são produzidas

```bash
pnpm test:visual                      # confere contra a baseline
pnpm test:visual --update-snapshots   # regenera a baseline
```

Roda contra um build de produção em modo fixture, o que é o que torna a auditoria
reproduzível: mesmo acervo, mesmas imagens, mesma ordenação em qualquer máquina. Os
placeholders de anúncio são mascarados e a animação é desligada, então uma diferença
significa mudança real de layout, não ruído de amostragem.

**160 screenshots** — 20 superfícies × 2 temas × 4 viewports (390 / 768 / 1024 / 1440) —
em `tests/e2e/__screenshots__/visual.spec.ts/`. São ~32 MB versionados. Vale dizer o custo
em voz alta: sem baseline no repositório o gate visual não prova nada, então eles ficam.

## Matriz de cobertura

| Fonte Claude Design                               | Rota implementada                                                  | Fixture                                                | Screenshot (por tema, por viewport)                                                                                                                                                           |
| ------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Máquina Nerd Índice.dc.html`                     | mapa de telas; não vira rota                                       | —                                                      | Coberto por linha nesta tabela para cada tela que ele indexa                                                                                                                                  |
| `Máquina Nerd Template.dc.html`                   | `/`                                                                | `fixtureArticles`, `fixtureWatchTitles`, `fixturePoll` | `home-{light,dark}-{mobile-390,tablet-768,laptop-1024,desktop-1440}.png`                                                                                                                      |
| `Máquina Nerd Categorias.dc.html`                 | `/series`, `/[categoria]/page/[n]`                                 | artigos por editoria                                   | `categoria-*.png`                                                                                                                                                                             |
| `Máquina Nerd Notícias.dc.html` — padrão          | `/series/resident-evil-2026-…`                                     | `art-resident-evil`                                    | `artigo-padrao-*.png`                                                                                                                                                                         |
| `Máquina Nerd Notícias.dc.html` — longform        | `/series/como-ahsoka-virou-…`                                      | `art-ahsoka-longform` (tag `longform`)                 | `artigo-longform-*.png`                                                                                                                                                                       |
| `Máquina Nerd Notícias.dc.html` — urgente         | `/series/lanterns-atinge-…`                                        | `art-lanterns-urgente` (tag `ao-vivo`)                 | `artigo-urgente-*.png`                                                                                                                                                                        |
| `Máquina Nerd Notícias.dc.html` — vídeo           | `/animes/netflix-revela-trailer-…`                                 | `art-lego-one-piece`                                   | `artigo-video-*.png`                                                                                                                                                                          |
| `Máquina Nerd Notícias.dc.html` — lista           | `/series/5-coisas-que-o-trailer-…`                                 | `art-cinco-coisas`                                     | `artigo-lista-*.png`                                                                                                                                                                          |
| `Máquina Nerd Especiais.dc.html` — índice         | `/especiais`                                                       | categorias filhas de `especiais`                       | `especiais-indice-*.png`                                                                                                                                                                      |
| `Máquina Nerd Especiais.dc.html` — hub            | `/especiais/marvel`                                                | `cat-marvel` + `art-marvel-dossie`                     | `especiais-hub-*.png`                                                                                                                                                                         |
| `Máquina Nerd Especiais.dc.html` — dossiê         | `/especiais/marvel/a-decada-que-apostou-tudo`                      | `fixtureSpecial.dossiers[0]`                           | coberto pelo hub; ver divergência 3                                                                                                                                                           |
| `Máquina Nerd Especiais.dc.html` — ao vivo        | `/ao-vivo/comic-con-2026`                                          | `fixtureLiveEvent`                                     | ver divergência 3                                                                                                                                                                             |
| `Máquina Nerd Comercial.dc.html` — publieditorial | `/quadrinhos/como-montar-uma-estante-…`                            | `art-estante-publieditorial`                           | `comercial-publieditorial-*.png`                                                                                                                                                              |
| `Máquina Nerd Comercial.dc.html` — review         | `/reviews/box-sandman-…`                                           | `art-sandman-review`                                   | `comercial-review-*.png`                                                                                                                                                                      |
| `Máquina Nerd Comercial.dc.html` — comparativo    | `/quadrinhos/os-10-melhores-box-…`                                 | `art-melhores-box`                                     | `comercial-comparativo-*.png`                                                                                                                                                                 |
| `Máquina Nerd Comercial.dc.html` — landing        | `/ofertas/semana-nerd-2026`                                        | `art-semana-nerd`                                      | `comercial-landing-*.png`                                                                                                                                                                     |
| `Máquina Nerd Design System.dc.html`              | `packages/tokens/src/tokens.css` + `packages/ui/src/styles/ui.css` | —                                                      | Sem rota pública. Verificado por asserção, não por imagem: contraste (axe-core em 18 superfícies, 2 temas), piso de 11px, vermelho de marca nunca como texto, e ausência de scroll horizontal |
| `assets/mn-logo-on-*.png`                         | `public/brand/`                                                    | —                                                      | Renderizado no cabeçalho e no rodapé de toda página                                                                                                                                           |
| `uploads/*`                                       | não usado                                                          | —                                                      | Placeholder de protótipo; as fixtures usam imagens geradas localmente                                                                                                                         |

Superfícies sem protótipo, acrescentadas conforme a carta de execução (estados neutros e
acessíveis, sem mudar a direção visual): `/reviews`, `/ofertas`, `/autor/[slug]`,
`/tag/[slug]`, `/busca`, `/newsletter`, `/sobre`. Todas têm screenshot e passam pelo axe.

## Divergências, e por que

### 1. `--mn-fg2` e o avatar âmbar mudaram de tom

`#7C818A` é 3,91:1 sobre branco; texto normal exige 4,5:1. `docs/09` afirma que passa —
não passa, e o axe-core reprovava todas as páginas. Idem `#C77800` com iniciais brancas
(3,43:1). Ambos escurecidos para o tom mais próximo que passa. Detalhe em
[DECISIONS.md §2.1–2.2](./DECISIONS.md).

### 2. A `NetworkBar` não existe nos protótipos

A auditoria independente confirmou: ela é requisito de `docs/03` e `docs/10`, mas não
aparece em nenhum dos sete markups. Implementada conforme a documentação — tira preta,
altura fixa, sem JS.

### 3. Dossiê e ao vivo dependem de modelo que o CMS não tem

O Kal El não tem franquia, dossiê nem evento ao vivo. As rotas existem e renderizam a
partir do que o CMS sabe expressar (categoria filha; artigo com tag `ao-vivo` cujos
headings viram a timeline), mas o fixture não tem capítulos de verdade, então essas duas
telas não entram na baseline visual — um screenshot de estado vazio não prova fidelidade.
Entram assim que a mudança de modelo proposta em
[KAL-EL-DISCOVERY.md](./KAL-EL-DISCOVERY.md) for aceita.

### 4. Rótulos do cabeçalho colapsam abaixo de 600px

Busca, tema e menu não cabem em 390px como três pílulas rotuladas. Viram ícones com
`aria-label`; o texto volta em telas maiores. Os protótipos só simulam mobile com
`--mn-vw: 390px` e não desenharam esse caso.

### 5. Corpo de artigo em 16px/1.78

O protótipo do Design System mostra 17px em uma seção e 15px em outra. `docs/02` normaliza
para 16px/1.78, e é a normalização que vale — ela é a tradução de engenharia dos
protótipos.

## O que a auditoria visual não cobre

Uma baseline prova que nada mudou desde que a tela foi aprovada. Ela **não** prova que a
tela corresponde ao protótipo — isso é julgamento humano, e é a revisão que falta:
comparar lado a lado cada `*.dc.html` com a rota nos quatro viewports. As asserções de
sistema (contraste, piso tipográfico, uso do vermelho, overflow) cobrem as regras que se
pode verificar por máquina; a composição não.
