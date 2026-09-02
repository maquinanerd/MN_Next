# Auditoria visual

Cada arquivo do Claude Design ligado à rota que o implementa, à evidência que os compara
lado a lado, e — o que faltava — **à diferença real encontrada e ao que foi feito com
ela**.

## As duas coisas que esta auditoria faz, e que são diferentes

**Baseline** prova que a tela não mudou desde que foi aprovada. Não prova que ela
corresponde ao protótipo: uma tela errada, congelada, passa para sempre.

```bash
pnpm test:visual                      # confere contra a baseline
pnpm test:visual --update-snapshots   # regenera
```

172 verificações — 20 superfícies × 2 temas × 4 viewports (390 / 768 / 1024 / 1440), mais
as asserções de sistema. Rodam sobre um build de produção em modo fixture, com anúncios
mascarados e animação desligada, então uma diferença é mudança de layout e não ruído de
amostragem. São ~32 MB versionados, e ficam: sem baseline no repositório o gate não prova
nada.

**Comparação** é a outra metade, e é a que estava faltando.

```bash
pnpm visual:compare                       # todas as superfícies, 1440 e 390
pnpm visual:compare -- --only home        # uma superfície
VISUAL_APP_URL=http://127.0.0.1:3210 pnpm visual:compare
```

Sobe os protótipos em um servidor próprio, abre cada um e a rota correspondente no mesmo
viewport, e escreve os dois lados em `artifacts/visual/` para alguém folhear. Foi assim
que as diferenças abaixo foram encontradas — nenhuma delas era detectável por baseline,
porque a baseline concordava consigo mesma.

> **Limitação da ferramenta:** as capturas em 390 px saem sem estilo em algumas execuções,
> por uma condição de corrida entre `networkidle` e a folha de estilo. A evidência de
> mobile que vale é a baseline do Playwright, que renderiza corretamente e está verde. A
> ferramenta é confiável em 1024 e 1440.

## Matriz de cobertura

| Fonte Claude Design                            | Rota                                                               | Evidência                                       |
| ---------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------- |
| `Máquina Nerd Índice.dc.html`                  | mapa de telas; não vira rota                                       | `indice-{1440,390}-{proto,app}.png`             |
| `Máquina Nerd Template.dc.html`                | `/`                                                                | `home-1440-{proto,app}.png` + 8 baselines       |
| `Máquina Nerd Categorias.dc.html`              | `/series`, `/[categoria]/page/[n]`                                 | `categoria-1440-{proto,app}.png` + 8 baselines  |
| `Máquina Nerd Notícias.dc.html` — 5 templates  | `/series/{slug}` e variantes por tag                               | `artigo-1440-{proto,app}.png` + 40 baselines    |
| `Máquina Nerd Especiais.dc.html` — hub         | `/especiais/marvel`                                                | `especiais-1440-{proto,app}.png` + 8 baselines  |
| `Máquina Nerd Especiais.dc.html` — dossiê      | `/especiais/marvel/a-decada-que-apostou-tudo`                      | ver divergência 6                               |
| `Máquina Nerd Especiais.dc.html` — ao vivo     | `/ao-vivo/comic-con-2026`                                          | ver divergência 6                               |
| `Máquina Nerd Comercial.dc.html` — 4 templates | `/reviews/{slug}`, `/quadrinhos/{slug}`, `/ofertas/{campanha}`     | `comercial-1440-{proto,app}.png` + 32 baselines |
| `Máquina Nerd Design System.dc.html`           | `packages/tokens/src/tokens.css` + `packages/ui/src/styles/ui.css` | asserções, não imagem — ver abaixo              |
| `assets/mn-logo-on-*.png`                      | `public/brand/`                                                    | cabeçalho, rodapé e a faixa da home             |
| `uploads/*`                                    | não usado                                                          | são capturas do processo de design, não fotos   |

Superfícies sem protótipo, acrescentadas conforme a carta de execução: `/reviews`,
`/ofertas`, `/autor/[slug]`, `/tag/[slug]`, `/busca`, `/newsletter`, `/sobre`. Todas têm
baseline e passam pelo axe.

O Design System é verificado por asserção e não por imagem, porque é um sistema e não uma
tela: contraste (axe em 18 superfícies × 2 temas, 0 violações), piso de 11px, vermelho de
marca nunca como cor de texto sobre fundo claro, e ausência de scroll horizontal.

---

## Diferenças encontradas na comparação, e o que foi feito

### 1. A home omitia três módulos inteiros

Extraindo a sequência de blocos dos dois lados, o protótipo tinha doze e a aplicação dez —
e os que faltavam não eram decorativos:

| Protótipo                                  | Aplicação, antes         |
| ------------------------------------------ | ------------------------ |
| Faixa full-width "Saga do Infinito"        | **ausente**              |
| Especial · Star Wars (composição 700/520)  | **ausente**              |
| "Mais, mais, mais" (9 itens com miniatura) | "Mais lidas", só texto   |
| —                                          | "Editorias" (não existe) |

**Por que importava.** Uma página editorial ganha ritmo por contraste — uma faixa cheia,
depois uma composição assimétrica, depois uma cauda densa. Substituir os três pela mesma
grade de três colunas achata exatamente isso, e é o que fazia a home ler como wireframe
mesmo com espaçamento correto.

**Corrigido.** Os três módulos existem, com as medidas lidas do protótipo: a faixa é
1440/380 com scrim de 90° para a direita (o texto fica desse lado; um scrim de baixo para
cima poria tipo branco sobre céu claro), o especial divide 700fr contra 520fr — não
metades —, e a cauda pareia miniatura de 96px com a manchete.

**Onde o protótipo mostra dado que não existe:** cada item da cauda tem "12.7k visitas ·
34 comentários". Nenhum dos dois é registrado por esta plataforma. A linha carrega a
assinatura — mesma forma, dado verdadeiro. Inventar um número seria pôr ficção numa página
que no resto reporta.

### 2. O herói da home tinha três desvios

| Elemento           | Protótipo                       | Estava                 |
| ------------------ | ------------------------------- | ---------------------- |
| Rótulo de editoria | pílula preenchida, 9/16, raio 6 | texto vermelho simples |
| "Ler mais"         | versal, 800, 13px, ls .04em     | caixa de sentença      |
| Fileira de baixo   | 2 cards grandes                 | 3 cards médios         |
| Manchete           | 800, clamp(26,2.4vw,34), lh 1.3 | 900, 3.2vw, lh 1.08    |

Três cards iguais sob o herói é a mesma batida duas vezes; a manchete em 900/1.08 lê como
cartaz, não como front page. Todos corrigidos.

### 3. O hub de franquia abria como um artigo, não como um lugar

O protótipo abre `/especiais/{franquia}` com uma faixa full-bleed escura: arte ao fundo sob
scrim vertical, as franquias irmãs como pílulas, sobrancelha vermelha com filete, título em
clamp(38px, 6.6vw, 78px) e um painel 2×2 de números ao lado.

A aplicação abria com uma capa contida e um título em cima — uma página diferente.

**Corrigido**, com uma decisão honesta no painel: o protótipo mostra "9,3 mi na estreia" e
"612 matérias", e esta plataforma não registra audiência. As células carregam o que é
contável — matérias, dossiês, capítulos, data da última — respondendo a mesma pergunta
("quão grande é isso, e está vivo?") com o que de fato existe.

A "linha do tempo" também virou o que o protótipo mostra: uma fileira de cartões datados
sob "O que vem por aí", em vez de uma lista de texto.

### 4. A editoria não tinha o par de números do cabeçalho

O protótipo põe "12.480 MATÉRIAS / 9 HOJE" à direita do título da editoria. Ambos são
conhecíveis — o total vem da listagem, "hoje" conta o que foi publicado desde a meia-noite
— então foram acrescentados. A `<dl>` mantém o termo antes da definição, como a
especificação exige, e a ordem visual do design é feita no CSS.

### 5. As capas eram gradientes

O acervo de fixtures apontava para gradientes gerados. São um bom placeholder e uma
apresentação errada: uma home cujas dez capas são retângulos de duas cores lê como
wireframe, e nenhum espaçamento correto resgata isso.

`pnpm fixtures:media:reference` baixa as quinze fotografias que os sete protótipos usam —
todas uploads do WordPress do próprio operador — redimensiona para 1600px e as grava em
`public/fixtures/`. `pnpm fixtures:media` volta aos gradientes. A decisão está registrada
em [DECISIONS.md](./DECISIONS.md) e se desfaz com um comando.

Com o provider Kal El, as capas são as do CMS, servidas pelo proxy autenticado.

### 6. Dossiê e ao vivo dependem de modelo que o CMS não tem

Inalterado desde a auditoria anterior, e continua sendo a resposta honesta: o Kal El não
tem franquia, dossiê nem evento ao vivo. As rotas renderizam a partir do que ele sabe
expressar — categoria filha, artigo com tag `ao-vivo` cujos headings viram a timeline — mas
o fixture não tem capítulos de verdade, então essas duas telas não entram na baseline. Um
screenshot de estado vazio não prova fidelidade.

A faixa da home tem o mesmo limite pelo lado do CMS: sem modelo de dossiê, ela promove o
artigo mais recente com tag reservada (`especial`, `dossie`, `documentario`) e uma capa, e
compõe o título em uma linha em vez do lockup de três pesos — que é desenho, não dado.

---

## Divergências deliberadas, mantidas

### A `NetworkBar` não existe nos protótipos

Requisito de `docs/03` e `docs/10`, ausente dos sete markups. Implementada conforme a
documentação: tira preta, altura fixa, sem JS.

### O cabeçalho tem busca e tema; o protótipo tem só um ícone de busca

O alternador de tema é requisito de produto e os protótipos não o desenharam. Abaixo de
600px os rótulos viram ícones com `aria-label` — some o texto visível, não o nome
acessível.

### Corpo de artigo em 16px/1.78

O Design System mostra 17px numa seção e 15px em outra; `docs/02` normaliza para
16px/1.78, e é a normalização que vale.

### `--mn-fg2` e o avatar âmbar mudaram de tom

`#7C818A` é 3,91:1 sobre branco e o axe reprovava todas as páginas; `#C77800` com iniciais
brancas é 3,43:1. Escurecidos para o tom mais próximo que passa.
[DECISIONS §2.1–2.2](./DECISIONS.md).

---

## O que ainda não foi comparado item a item

A comparação cobriu, lado a lado e em 1440px: home, editoria, artigo padrão, hub de
especiais, comercial, índice e design system. As diferenças de **composição** encontradas
estão corrigidas.

Não foram percorridos elemento a elemento: os cinco templates de artigo entre si, as quatro
telas comerciais entre si, e os viewports 768 e 1024 fora da baseline. Esses continuam
cobertos por baseline e por axe — o que garante que não regridem, não que sejam idênticos
ao protótipo. É trabalho de revisão humana, e está dito aqui em vez de marcado como feito.
