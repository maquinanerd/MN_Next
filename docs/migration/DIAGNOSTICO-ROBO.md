# Diagnóstico das matérias publicadas pelo robô

Corpus: as 76 matérias que o `news-sitemap.xml` trazia em 23/09/2026 às 12h40 UTC, lidas
do HTML servido ao leitor, mais o registro de publicações do MN-Prime (cerca de 95
publicadas e 42 falhas entre 22/09 23h08 e 23/09 12h14). Tudo abaixo é medido, não
impressão.

## Resumo frio

O robô funciona: escreve, ilustra, categoriza, assina e publica sozinho. O que ele
publica, porém, não é o que o Máquina Nerd vende, e o ritmo é o de uma agência de
notícias — 76 matérias em sete horas e meia. Três defeitos técnicos reduzem o valor de
cada matéria, e um deles (zero link interno) é o mais caro em SEO. A publicação está
**pausada** desde 12h29, decisão certa até os ajustes abaixo.

## O que os números dizem

| Medida                             | Valor                                | Leitura                                  |
| ---------------------------------- | ------------------------------------ | ---------------------------------------- |
| Matérias na janela                 | 76 em 7h30                           | ~10 por hora, madrugada inteira          |
| Palavras (mediana)                 | 593                                  | tamanho de notícia, adequado             |
| Abaixo de 350 palavras             | 8                                    | risco de conteúdo fino                   |
| Parágrafos / subtítulos (medianas) | 8 / 4                                | estrutura de leitura ok                  |
| Imagens no corpo (mediana)         | 3                                    | nenhuma matéria sem imagem               |
| Entidades declaradas (mediana)     | 5                                    | bom para grafo de tópicos                |
| **Links internos no texto**        | **0 em 76**                          | nenhuma matéria leva a outra             |
| **Fonte única**                    | **56 de 76 (74%)**                   | o "cacho multi-fonte" quase não acontece |
| Assunto repetido no mesmo dia      | fusão Paramount/Warner em 6 matérias | canibalização                            |

## Os quatro problemas, em ordem de custo

### 1. Zero link interno — e a causa é um defeito, não uma escolha

Nenhuma das 76 matérias tem um link para outra matéria do site ou para um hub de tag. O
pipeline tem um mecanismo para isso (`link_map`), e o log do contêiner mostra por que ele
não entrega nada:

```
[LINKS] link_map atualizado: 0 do DB + 0 do JSON = 0 total
```

O mapa é alimentado com o endereço público que a **Cinerie** devolve ao publicar
(`canonicalSlug`). No MN-Prime esse caminho está fechado de propósito — quem publica é o
Kal El —, então nada volta para o mapa e toda matéria nasce órfã. É o ganho de SEO mais
barato que está sobre a mesa: um site de notícias sem link interno desperdiça a própria
autoridade e deixa o Google descobrir tudo por sitemap.

### 2. A pauta não é a do site

A leitura dos títulos mostra imprensa de mercado, não cultura pop: "Busan Market define
programação de 2026", "Verve contrata Quan Millz", "Urban Sales assume vendas
internacionais", "Madrid reforça posição como polo audiovisual", "National Hispanic Media
Coalition revela nova turma de roteiristas". São matérias legítimas da Variety e da
Deadline — e irrelevantes para quem entra no Máquina Nerd atrás de filme, série, game e
quadrinho. Sete das 76 são sobre festivais e mercados.

O Superfeed de `movies`/`tv` do RSS Prime agrega o noticiário **da indústria**. Ou se
escolhe outro tópico do catálogo, ou se filtra por assunto antes de redigir — hoje não há
filtro de pauta entre a coleta e a redação.

### 3. Ritmo de agência, com o Google olhando

Dez matérias por hora, ininterruptas, é exatamente o padrão que o Google descreve como
conteúdo produzido em escala primeiro e justificado depois. O teto diário por site existe
no dashboard e está em `0` (sem teto). Com o volume atual, seis matérias tratam da mesma
fusão Paramount/Warner no mesmo dia, duas do fim de _Daredevil: Born Again_, duas do
mesmo balanço do _60 Minutes_ — o agrupador deveria ter unido cada um desses conjuntos em
uma matéria só.

### 4. Fonte única em 74% das matérias

O valor prometido pelo Superfeed é a matéria costurada de várias fontes. Na prática, 56
das 76 saíram com uma fonte só — passaram pela regra de domínio confiável
(`TRUSTED_SINGLE_SOURCES`), que aceita Variety, Deadline, THR e afins sozinhos. Do ponto
de vista do leitor e do Google, uma reescrita de fonte única é commodity: o original está
a um clique.

## Defeitos já corrigidos nesta rodada

- **Editoria de séries derrubou 42 matérias** entre 06h45 e 11h58 com "editoria
  inexistente no site: series-e-tv" — e a editoria existe. O cache de taxonomia era
  reidratado do banco local, o que marcava a coleção como carregada e impedia a consulta
  ao Kal El. Corrigido em `fix(kalel)`, com teste que reproduz a falha.
- **Lista de fontes duplicada** no fim do texto (corpo + bloco do portal). Corrigido na
  origem; 22 matérias antigas ainda têm a linha.
- **Sete matérias sem assinatura**, publicadas antes de o autor ser configurado.
- **Categoria inventada** (`tom-cruise`, `plataformas`): resolvido ao fixar a editoria por
  fonte; as duas categorias órfãs foram apagadas.

## O que fazer, antes de despausar

**P0 — impedem estrago continuado**

1. Ligar o **teto diário** por site (sugestão: 15 a 20), em _Sites do Kal El → Máquina
   Nerd → teto diário_.
2. Escolher a **pauta**: trocar o tópico do Superfeed ou filtrar por assunto. Sem isso, o
   volume só multiplica matéria de mercado.
3. Corrigir o **link interno**: alimentar o `link_map` com a URL pública do Kal El, como o
   caminho da Cinerie faz com o `canonicalSlug`.

**P1 — qualidade por matéria**

4. Exigir **duas fontes** para publicar direto e mandar fonte única para revisão, em vez
   de publicar (a regra e a lista de domínios confiáveis já existem; muda o destino).
5. Revisar o agrupador: seis matérias sobre a mesma fusão indicam janela de cacho curta
   demais ou chave de evento estreita demais.
6. Limpar as 22 matérias com a linha de fontes repetida e assinar as 7 sem autor.

**P2 — estrutura**

7. Hubs por franquia (Marvel, DC, Star Wars) alimentados pelas entidades que o robô já
   declara — é o que transforma 100 notícias soltas em um acervo navegável.
8. Acompanhar no Search Console, separando Discover de Pesquisa, a partir de uma semana
   de publicação estável.

## O que não fazer

- Não apagar em massa o que já foi publicado: quase tudo é aproveitável com link interno e
  consolidação.
- Não aumentar o volume para "compensar" — é o caminho contrário ao que o Google premia
  desde o core update de maio.
- Não mexer nas 17 matérias importadas do WordPress que têm "Fonte:" no corpo: ali a linha
  é legítima, veio do texto original.
