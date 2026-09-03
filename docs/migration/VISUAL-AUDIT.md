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

### 5. Os cinco templates de artigo estavam em um arquivo só, e quatro nunca tinham sido olhados

`Máquina Nerd Notícias.dc.html` não é uma página: são cinco telas empilhadas, cada uma
atrás de um `data-screen-label`. Capturar o arquivo inteiro comparava o template padrão
com uma página e os outros quatro com nada — que é exatamente como passaram despercebidos.

`pnpm visual:compare -- --screens` recorta cada tela pelo seu rótulo e a compara com a
rota que a implementa:

| Template | `data-screen-label` | Rota                               |
| -------- | ------------------- | ---------------------------------- |
| Padrão   | Notícia padrão      | `/series/resident-evil-2026-…`     |
| Longform | Longform            | `/series/como-ahsoka-virou-…`      |
| Urgente  | Urgente             | `/series/lanterns-atinge-…`        |
| Vídeo    | Vídeo               | `/animes/netflix-revela-trailer-…` |
| Lista    | Lista               | `/series/5-coisas-que-o-trailer-…` |

**Padrão** — batia, depois de a pílula de editoria e o painel "Mais lidas" serem
corrigidos (divergências 2 e 4 acima).

**Longform** — a estrutura batia e o texto estava ilegível. O scrim ia de 20% no topo a
92% na base, mas o bloco de texto fica nos 45% de baixo de uma capa de até 620px, e sobre
uma fotografia clara o kicker e o olho simplesmente sumiam. Além disso "Grande reportagem"
era tipo vermelho sobre foto — a única coisa que a regra da marca existe para impedir.
Agora o scrim segura 88% onde o texto está (6,2:1 para branco contra a pior foto
possível), o kicker é pílula preenchida, e o olho subiu para 86% de branco.

**Urgente** — a tarja era **preta**; no protótipo é vermelho de marca, com cantos
arredondados só no topo porque ela tampa o bloco do artigo, e traz a contagem de
atualizações à direita. Corrigido, e a contagem sai das mesmas headings que viram a
timeline, para que as duas não possam discordar. O chip "AO VIVO" precisou de um véu
**escuro**: clareando o vermelho ele compunha #E8333D, e branco ali é 4,22:1.

> **Divergência assumida:** o protótipo preenche a tarja com `#E30613`, onde branco é
> 4,0:1. Serve para o tipo grande que ele mostra ali e não para a contagem de 11px que a
> tarja de fato carrega. Ela usa o vermelho escuro (`--brand-solid`, 6,6:1), que lê como o
> mesmo alarme. Fidelidade cedeu à legibilidade.

**Vídeo** — era o template padrão com um embed no meio. O design abre a matéria de vídeo
sobre tinta, largura cheia, sem sidebar, com o player como assunto. Agora tem sua própria
faixa e a coluna inteira; o embed continua no corpo, onde a fachada e o gate de
consentimento já vivem.

**Lista** — faltavam as duas coisas que fazem o template: os numerais grandes ao lado de
cada entrada, e o índice "Nesta lista" na sidebar. Os numerais vêm de um contador CSS, não
do texto — o número é propriedade da posição, e uma heading que carrega o próprio "03"
erra no instante em que uma entrada muda de lugar. O índice é construído das mesmas
headings do corpo, então não pode listar uma entrada que o artigo não tem.

> Nenhuma dessas quatro seria pega por baseline nem por axe: a baseline concordava consigo
> mesma, e o axe reporta texto sobre imagem como _incomplete_, nunca como violação.

### 6. As quatro telas comerciais, e uma delas não mostrava o preço

`Máquina Nerd Comercial.dc.html` empilha quatro telas do mesmo jeito que o de notícias:
publieditorial, review de produto, comparativo e landing de oferta. Mesma armadilha, mesmo
recorte por `data-screen-label`.

| Tela              | Rota                                       |
| ----------------- | ------------------------------------------ |
| Publieditorial    | `/quadrinhos/como-montar-uma-estante-…`    |
| Review de produto | `/reviews/box-sandman-edicao-definitiva-…` |
| Comparativo       | `/quadrinhos/os-10-melhores-box-…`         |
| Landing de oferta | `/ofertas/semana-nerd-2026`                |

**Review** — a **BuyBox não era renderizada**. As ofertas chegavam à página: preço,
varejista, preço de lista, data de verificação, tudo carregado e descartado. No único
template cuja razão de existir é responder "compro ou não", a resposta inteira estava
faltando. Agora abre a coluna da direita, como no protótipo.

**Comparativo** — a tabela existe e renderiza. O que não renderizava era o **botão de
compra**: ele saía com o preço em vermelho e sublinhado sobre o verde, ~2:1. A regra de
link de prosa, `.mn-body :where(p, li, td…) a`, vence `.mn-cta` na especificidade —
`:where()` não conta, então (0,1,1) contra (0,1,0). Agora a regra é `a:not([class])`: um
link que o parser produziu do texto não tem classe, um link que um componente renderizou
sempre tem. Era o controle que a página existe para ser clicado.

**Publieditorial** — faltava o slot "Oferecido por" com a marca do anunciante à direita da
tarja. O campo `brandLogo` já existia em `CommercialMeta` e nada o lia. A marca do
anunciante é parte da divulgação, não enfeite. Em modo fixture ele não aparece porque não
há anunciante — o protótipo também desenha ali um placeholder.

**Landing de oferta** — a rota abria com uma barra preta e o título dentro, que é a mesma
página de qualquer artigo com título escuro. O design abre como campanha: a marca, o selo
"Ofertas", o nome em escala de cartaz, a imagem ao lado e uma tarja de condições correndo
por baixo. As condições são autorais (`campaignTerms`) porque são compromissos que a área
comercial assume — derivá-las das ofertas seria inventar uma promessa que ninguém fez.

> **Não implementados, e por quê:** o contador regressivo e a grade de ofertas da landing.
> O primeiro precisa de uma data de fim de campanha e o segundo de um catálogo; nenhum dos
> dois existe no modelo. Um relógio falso e preços falsos numa página comercial são pior
> que uma seção ausente.

> **Divergência assumida:** a tarja de condições é `#E30613` no protótipo, onde branco a
> 12px bold é 4,0:1. Usa `--brand-solid`, pelo mesmo motivo e com o mesmo resultado da
> tarja de urgência.

### 7. As capas eram gradientes

O acervo de fixtures apontava para gradientes gerados. São um bom placeholder e uma
apresentação errada: uma home cujas dez capas são retângulos de duas cores lê como
wireframe, e nenhum espaçamento correto resgata isso.

`pnpm fixtures:media:reference` baixa as quinze fotografias que os sete protótipos usam —
todas uploads do WordPress do próprio operador — redimensiona para 1600px e as grava em
`public/fixtures/`. `pnpm fixtures:media` volta aos gradientes. A decisão está registrada
em [DECISIONS.md](./DECISIONS.md) e se desfaz com um comando.

Com o provider Kal El, as capas são as do CMS, servidas pelo proxy autenticado.

### 8. Dossiê e ao vivo dependem de modelo que o CMS não tem

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

Os **cinco templates de artigo** (divergência 5) e as **quatro telas comerciais**
(divergência 6) foram percorridos um a um, e as diferenças estruturais estão corrigidas.

Não foram percorridos: os viewports **768 e 1024** fora da baseline, e o **contador
regressivo** e a **grade de ofertas** da landing sazonal — ambos exigem dado que a
plataforma não modela (uma data de fim de campanha, um catálogo de produtos), e inventá-los
poria um relógio falso e preços falsos numa página comercial. Continuam cobertos por
baseline e por axe, o que garante que não regridem, não que sejam idênticos ao protótipo.
É trabalho de revisão humana, e está dito aqui em vez de marcado como feito.
