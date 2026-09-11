# Auditoria visual — kit de front-end

Fonte visual canônica: os sete protótipos de `maquina-nerd-kit/prototypes/` (ZIP de
2026-09-10, ver [INPUT-INVENTORY.md](./INPUT-INVENTORY.md)). A auditoria anterior, dos
protótipos Claude Design de 2026-09-01, está no histórico do git; aquela direção visual
foi substituída pelo kit.

## Duas verificações diferentes

1. **Comparação com o protótipo**, feita por pessoa: `pnpm visual:compare` abre cada
   protótipo (do disco, `file://`) e a rota correspondente na mesma largura e grava o par
   em `artifacts/visual/{superfície}-{largura}-{proto|app}.png`, com `index.json`. É o que
   diz se o site **é** o desenho.
2. **Baselines de regressão** (`pnpm test:visual`, 48 PNGs em
   `tests/e2e/__screenshots__/`): 12 superfícies × 4 viewports. Provam que o site **não
   mudou** desde a última aprovação; não dizem nada sobre fidelidade.

Evidência desta rodada: 28 capturas (7 protótipos × 4 larguras, mais as 5 rotas × 4),
servidor em modo demonstração, `deviceScaleFactor` 1, consentimento respondido.

## Matriz: fonte → rota → evidência

| Protótipo                               | Rota                                                                   |            390            |           768           |           1024           |           1440           |
| --------------------------------------- | ---------------------------------------------------------------------- | :-----------------------: | :---------------------: | :----------------------: | :----------------------: |
| `Máquina Nerd Template.dc.html`         | `/`                                                                    |       `home-390-*`        |      `home-768-*`       |      `home-1024-*`       |      `home-1440-*`       |
| `Máquina Nerd Categorias.dc.html`       | `/cinema`                                                              |     `editoria-390-*`      |    `editoria-768-*`     |    `editoria-1024-*`     |    `editoria-1440-*`     |
| `Máquina Nerd Notícias.dc.html`         | `/cinema/o-misterio-de-scarlett-johansson-a-estrela-perdida-da-marvel` |      `materia-390-*`      |     `materia-768-*`     |     `materia-1024-*`     |     `materia-1440-*`     |
| `Máquina Nerd Notícias Overlay.dc.html` | `/cinema/o-misterio-de-scarlett-johansson-edicao-capa`                 |  `materia-overlay-390-*`  | `materia-overlay-768-*` | `materia-overlay-1024-*` | `materia-overlay-1440-*` |
| `Máquina Nerd Notícias Publi.dc.html`   | `/ofertas/controle-xbox-edicao-especial-tem-queda-de-preco-na-amazon`  |  `materia-oferta-390-*`   | `materia-oferta-768-*`  | `materia-oferta-1024-*`  | `materia-oferta-1440-*`  |
| `Máquina Nerd Design System.dc.html`    | — (referência de tokens)                                               | `design-system-390-proto` |      `…-768-proto`      |      `…-1024-proto`      |      `…-1440-proto`      |
| `Máquina Nerd Índice.dc.html`           | — (índice das telas)                                                   |    `indice-390-proto`     |      `…-768-proto`      |      `…-1024-proto`      |      `…-1440-proto`      |

O Design System e o Índice não são páginas do site. O primeiro é verificado contra
`packages/tokens/src/tokens.css` e pelos testes de contraste
(`tests/unit/tokens-contrast.test.ts`); o segundo só lista as telas acima.

## O que a comparação mostrou

**Home (1440 e 390).** Mesma sequência do protótipo: abertura (manchete 3/4, três
overlays, lateral com quatro chamadas e 300×250), "Notícias de Cinema", "Games" com
970×250, "Notícias de Séries e TV" com "Últimas de Quadrinhos", "Animes | Especiais",
"Vídeo em destaque", "Mais do Máquina Nerd" com 728×90 a cada três e 300×600 sticky,
paginação e rodapé. No celular, a mesma ordem em coluna única, sem rolagem horizontal.

**Editoria.** Título na cor de texto da editoria, filtros de assunto à direita, abertura
igual à da home, "Todas as notícias de Cinema" em RowCards com 300×600, paginação. A lista
é mais curta que no protótipo porque a fixture tem menos matérias de Cinema.

**Matéria padrão.** Trilho de 200px (autor, datas, "Nesta editoria"), título com os
círculos de compartilhar, figura, linha fina, "Mais como este" depois do primeiro
parágrafo, figura larga (72px para fora acima de 1240px), dois 728×90 entre parágrafos,
citações com filete, intertítulos, notas finais, próxima matéria e relacionadas 3×2. A
coluna de texto começa e termina alinhada ao menu (`tests/e2e/layout.spec.ts`).

**Matéria overlay.** Capa em largura total com o cabeçalho sobre a foto (logo claro),
rótulo e título sobre a imagem, coluna de 760px com a linha de autor e compartilhar.

**Matéria de oferta.** "Leia também" acima e abaixo, linha fina, caixa "Relacionado"
flutuante, caixa de produto com preço marcado como demonstração, intertítulos em vermelho,
aviso de afiliados, "Conteúdo patrocinado" com 300×600 e relacionadas.

## Divergências mantidas, com o motivo

As de conteúdo e comportamento estão em [DECISIONS.md §7.11](./DECISIONS.md). As
visíveis nas capturas:

| Onde           | Protótipo                          | Site                               | Motivo                                                             |
| -------------- | ---------------------------------- | ---------------------------------- | ------------------------------------------------------------------ |
| todas          | —                                  | faixa "Demonstração" no topo       | modo fixture precisa se declarar; some com o Kal El                |
| matéria padrão | retrato do autor no trilho         | só o nome                          | a fixture não tem retrato real; nenhum avatar é inventado          |
| overlay        | capa com ~1000px de altura (100vh) | `clamp(360px, 62vh, 640px)`        | medida escrita no doc 02; retrato de tela inteira vetado no doc 06 |
| overlay        | linha fina repetida dentro da capa | só abaixo, antes do texto          | evita o mesmo parágrafo duas vezes em sequência                    |
| oferta         | 728×90 logo após a foto            | anúncios só entre dois parágrafos  | doc 05, "nunca imediatamente após uma imagem"                      |
| home           | abas "Mais vistos / Recomendados"  | só "Recentes"                      | não há dado de audiência                                           |
| todas          | imagens do site atual              | imagens de demonstração da fixture | as do protótipo são URLs externas, só de referência                |

## O que ainda precisa de olho humano

- As capturas de 768 e 1024 foram geradas e ficam para conferência par a par; a leitura
  feita nesta rodada foi em 1440 e 390.
- Estados sem protótipo (busca, autor, tag, ofertas, institucionais, 404, erro) seguem os
  componentes do kit e passam em axe, mas não têm par de comparação.
- Com o Kal El real, a composição depende do acervo: rodar `pnpm visual:compare` contra
  staging antes da virada.
