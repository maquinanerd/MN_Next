# MN-Prime no Claude: matérias e custo das primeiras 12 horas

Levantado em 12/11/2026, às 09:30 (Brasília), e atualizado às 10:40 com o reenvio das
falhas. Fontes:

- painel do MN-Prime (`/publicacoes`), que registra cada entrega ao Kal El;
- Claude Console, em Uso da API (dados atualizados às 08:35 de Brasília);
- tabela de preços oficial do Claude Haiku 5.5.

Todos os horários estão em Brasília; o painel mostra UTC, três horas à frente.

## Resumo

| Medida                                        | Valor                                                    |
| --------------------------------------------- | -------------------------------------------------------- |
| Período                                       | 11/11 21:23 → 12/11 09:25, cerca de 12 horas             |
| Matérias escritas pelo Claude                 | **46**                                                   |
| Chegaram ao site na hora                      | **15**: 12 novas e 3 atualizações de matérias existentes |
| Falharam na entrega ao Kal El (erro dos 8 MB) | **28**                                                   |
| Das 28, reenviadas e publicadas às 10:36      | **24**; as outras 4 já tinham o assunto no site          |
| Não enviadas (fonte legada, sem `event_key`)  | 3                                                        |
| Custo da API até 08:35                        | **cerca de US$ 0,69**                                    |
| Custo por matéria escrita                     | cerca de US$ 0,016                                       |
| Custo do reenvio                              | zero: usa o texto já escrito, sem chamar a IA            |
| Saldo de crédito na conta da Anthropic        | US$ 100,64                                               |

## Custo

O Console mostra só o Haiku 5.5, nos dois papéis (redator e auxiliar). Para prompts de
até 100 mil tokens, o preço é US$ 0,10 por milhão de tokens de entrada e US$ 0,50 por
milhão de saída.

| Tipo    | Tokens        | Preço por milhão | Custo        |
| ------- | ------------- | ---------------- | ------------ |
| Entrada | 1.364.651     | US$ 0,10         | US$ 0,14     |
| Saída   | 1.105.361     | US$ 0,50         | US$ 0,55     |
| Total   | **2.470.012** |                  | **US$ 0,69** |

- **O valor cobrado de fato está no Console, em "Custo e gastos".** A conta acima usa a
  tarifa padrão. Se parte da entrada foi cache, o total muda alguns centavos para cima ou
  para baixo: cache lido custa 10% da entrada, cache gravado custa 125%.
- **Por matéria.** Até 08:35 o painel registra 43 matérias. US$ 0,69 ÷ 43 dá cerca de
  US$ 0,016 por matéria. Isso já inclui as chamadas do auxiliar em itens que não viraram
  matéria. A estimativa feita antes da troca era de US$ 0,013.
- **A saída é 80% do custo.** O Haiku 5.5 raciocina antes de escrever, e esse raciocínio
  é cobrado como saída.
- **Gasto que não virou publicação.** Das 43 matérias até 08:35, só 14 chegaram ao site
  na hora. Com o reenvio, quase todas as que falharam saíram. Ficaram sem retorno só as
  de fonte legada e as versões repetidas de um assunto que já estava no site.
- **Ritmo.** Cerca de US$ 1,50 por dia. Nesse ritmo, o saldo de US$ 100,64 dura em torno
  de dois meses. A correção da entrega não aumenta o custo: a matéria é escrita antes de
  ser entregue, então as que falhavam já estavam sendo pagas.

## Por que 28 falharam

Não foi o Claude. Desde 11/11 às 10:28, ainda com o Gemini, o mesmo erro derrubou pelo
menos outras 30 matérias.

A IA sugere tags para cada matéria. Algumas já existem no Kal El, porque o acervo
importado do WordPress tem dezenas de milhares de tags, mas o robô nunca tinha usado
essas tags. Nesse caso, o Kal El recusava a criação ("já existe"). O robô então baixava a
lista inteira de tags do site para achar a que já existia. Essa lista passou de 8 MB, que
é o limite de resposta que o robô aceita ler, e a matéria parava ali. Por isso só uma
parte das matérias caía: as que tinham ao menos uma tag do acervo que o robô ainda não
conhecia.

A correção está no
[PR #15 do MN-Prime](https://github.com/maquinanerd/MN-Prime/pull/15). Agora o robô
procura cada tag pelo nome, em vez de baixar a lista inteira, e só cria a tag quando ela
não existe. O merge foi às 09:23 e o deploy terminou às 09:25.

## Depois da correção

- **A falha das 09:25 (Andy Serkis) ainda é do código antigo.** O código novo acrescenta
  à mensagem a chamada que passou do limite ("em GET …"), e essa mensagem não tem esse
  final. A entrega aconteceu segundos antes de o contêiner novo entrar no ar.
- **Das 09:28 às 09:40, as 4 entregas do código novo foram publicadas, sem nenhuma
  falha.** Antes da correção, cerca de 6 em cada 10 falhavam.

| Brasília    | Matéria                                                       | Situação             |
| ----------- | ------------------------------------------------------------- | -------------------- |
| 12/11 09:28 | Jamie Dornan admite que chorou ao ser escalado como Aragorn   | publicada `2c56d00f` |
| 12/11 09:33 | Jamie Dornan vive Aragorn como Strider em The Hunt for Gollum | publicada `da384d9d` |
| 12/11 09:37 | The Chosen ganha especial de Natal na Fox em 14 de dezembro   | publicada `17399c9a` |
| 12/11 09:40 | Henry Cavill confirma série de Warhammer 40k no Prime Video   | publicada `e2575316` |

As duas de Jamie Dornan usam as tags de Aragorn e The Hunt for Gollum, que antes
derrubavam a entrega. O assunto da primeira tinha falhado duas vezes, em 11/11 às 16:36 e
em 12/11 às 01:54.

Até 10:30, o código novo fez 14 entregas: 10 publicadas e 4 de fonte legada, sem nenhum
erro de 8 MB.

## O reenvio das 28

O MN-Prime não tentava de novo uma entrega que falhou, embora o texto ficasse gravado
em disco. O [PR #16 do MN-Prime](https://github.com/maquinanerd/MN-Prime/pull/16) pôs um
botão em _Publicações → Reenviar falhas_. Ele relê o texto já escrito, sem chamar a IA,
e entrega pelo caminho de sempre:

- da falha mais nova para a mais velha;
- só ao site em que ela falhou;
- pulando o que já saiu no site depois da falha.

O deploy terminou às 10:34. O reenvio, com janela de 14 horas (só as falhas da era
Claude), rodou às 10:36 e levou menos de um minuto:

| Desfecho                                                   | Quantas |
| ---------------------------------------------------------- | ------- |
| Publicadas                                                 | **24**  |
| Puladas: o evento já estava no site                        | 2       |
| Puladas: versão mais velha de um evento que acabou de sair | 2       |
| Falharam de novo                                           | 0       |

- **As 24 estão na home pública.** Conferi Andy Tennant, Total Recall, Frankie Muniz,
  Blade Runner 2099, Gal Gadot, Nicole Kidman e Steve Downes.
- **Andy Serkis entrou como atualização** da matéria que já existia (`52ded210`, revisão 5),
  não como matéria nova.
- **As 4 puladas têm o assunto no site:**
  - Jamie Dornan "diz que chorou" (`2c56d00f`, publicada às 09:28);
  - as duas de Constantine 2 (`2b055026`);
  - a versão mais velha de Anthony Clark (saiu a outra, `6f4d9048`).
- **Russell Brand saiu duas vezes**, como `a4ccd041` (docuseries) e `908627b6`
  (documentário). Eram eventos diferentes no RSS Prime, e os títulos não são parecidos o
  bastante para a checagem de matéria repetida. Teria saído duas vezes também sem a
  falha. Às 11:05 a versão "docuseries" (`a4ccd041`) foi despublicada no CMS, com o
  motivo no histórico do artigo. Às 11:07 o endereço dela já dava 404 e tinha saído da
  home e do `news-sitemap.xml`. A "documentário" (`908627b6`) segue no ar.
  - **Resíduo:** o robô guarda o endereço de cada matéria publicada para sugerir links
    internos e não confere depois se ela continua no ar. Uma matéria nova sobre Russell
    Brand pode linkar para o endereço retirado até ele sair da lista, que guarda as
    200 mais recentes (uns dois dias no ritmo atual).
- **As 3 de fonte legada continuam sem envio.** Foram escritas e pagas, e a entrega
  recusa qualquer matéria sem `event_key`. Isso já acontecia antes da troca para o Claude.
- **Ficaram de fora as falhas mais antigas, da era Gemini** (pelo menos 30, de 11/11),
  porque já são notícia velha. O mesmo botão as reenvia, até a janela de 48 horas.

## Matéria por matéria

| #   | Brasília    | Matéria                                                           | Situação                                                       |
| --- | ----------- | ----------------------------------------------------------------- | -------------------------------------------------------------- |
| 1   | 11/11 21:23 | Sky deixa Fing no Reino Unido após acusações contra Walliams      | publicada `0e7dcde5`                                           |
| 2   | 11/11 21:27 | Andy Tennant dirige The Fun Lady com Jessica Alba no elenco       | falhou (8 MB) → **reenviada** `d5948c04`                       |
| 3   | 11/11 21:32 | In the Grey chega ao topo do Starz após fracasso nos cinemas      | publicada `cba6f7c6`                                           |
| 4   | 11/11 21:36 | Steve Downes critica série de Halo por afastamento dos games      | falhou (8 MB) → **reenviada** `bbbf128d`                       |
| 5   | 11/11 21:40 | Total Recall com Colin Farrell chega ao 2º lugar no Prime Video   | falhou (8 MB) → **reenviada** `74b7fb40`                       |
| 6   | 11/11 22:24 | Andy Serkis dirige e conclui filmagens de The Hunt for Gollum     | publicada (atualização) `52ded210`                             |
| 7   | 11/11 22:28 | Resident Evil se aproxima da bilheteria de No Time to Die         | publicada `182786e9`                                           |
| 8   | 11/11 22:32 | Henry Cavill retorna com bigode de Missão: Impossível em anúncio  | falhou (8 MB) → **reenviada** `44e593a8`                       |
| 9   | 11/11 22:36 | Netflix prepara docuseries sobre Russell Brand após condenação    | falhou (8 MB) → reenviada `a4ccd041` → despublicada (repetida) |
| 10  | 11/11 22:40 | Paapa Essiedu reafirma apoio a direitos trans sem citar Rowling   | falhou (8 MB) → **reenviada** `e88e4b4b`                       |
| 11  | 11/11 22:44 | The Crow de 2024 ganha público no Tubi após fracasso nos cinemas  | falhou (8 MB) → **reenviada** `df1e1c13`                       |
| 12  | 11/11 23:28 | Arnold Vosloo confirma retorno como Imhotep em novo The Mummy     | publicada (atualização) `204058ac`                             |
| 13  | 11/11 23:33 | Heritage Auctions leiloa réplica de guitarra de Marty McFly       | falhou (8 MB) → **reenviada** `a3e3d581`                       |
| 14  | 11/11 23:37 | Anthony Clark, comediante e ator de Yes, Dear, morre aos 62 anos  | falhou (8 MB) → não reenviada: o assunto já está no site       |
| 15  | 11/11 23:41 | Netflix marca estreia de The Take para 15 de janeiro de 2027      | falhou (8 MB) → **reenviada** `8f9e8419`                       |
| 16  | 11/11 23:45 | Scrubs retoma Dr. Acula em fantasia de JD no episódio 8           | publicada `15ffd94d`                                           |
| 17  | 11/11 23:49 | Cry Macho entra no ranking dos mais vistos da Netflix nos EUA     | falhou (8 MB) → **reenviada** `563e91a3`                       |
| 18  | 11/11 23:54 | Constantine 2 ganha nova esperança após saída de James Gunn       | falhou (8 MB) → não reenviada: o assunto já está no site       |
| 19  | 12/11 00:23 | Maya Hawke e Harry Melling estrelam filme produzido por Ari Aster | falhou (8 MB) → **reenviada** `42e35d9f`                       |
| 20  | 12/11 00:27 | Digger cai para 48 salas e acumula US$ 50 milhões no mundo        | publicada `df218b5a`                                           |
| 21  | 12/11 00:31 | Anthony Clark, comediante de Yes, Dear, morre aos 62 anos         | falhou (8 MB) → **reenviada** `6f4d9048`                       |
| 22  | 12/11 01:24 | Lionsgate adquire Wet com Connor Storrie e Rebecca Ferguson       | falhou (8 MB) → **reenviada** `eea38203`                       |
| 23  | 12/11 01:34 | Constantine 2 ganha novo fôlego após saída de Gunn da DC Studios  | falhou (8 MB) → não reenviada: o assunto já está no site       |
| 24  | 12/11 01:39 | The Rings of Power revela os planos de Sauron na 3ª temporada     | não enviada (fonte legada)                                     |
| 25  | 12/11 01:43 | Priyanka Chopra Jonas troca armas por palavras em Bluefly         | falhou (8 MB) → **reenviada** `afa2cc56`                       |
| 26  | 12/11 01:54 | Jamie Dornan diz que chorou ao ser escalado como Aragorn          | falhou (8 MB) → não reenviada: o assunto já está no site       |
| 27  | 12/11 02:23 | Black Doves revela Kestrel como nova ameaça na 2ª temporada       | falhou (8 MB) → **reenviada** `6b5b51bd`                       |
| 28  | 12/11 03:25 | Lawrence vê nova chance para Constantine 2 após saída de Gunn     | publicada (atualização) `2b055026`                             |
| 29  | 12/11 03:29 | Fred Baillif estreia drama sobre assistentes sociais em Tallinn   | publicada `a53311a1`                                           |
| 30  | 12/11 03:33 | Guy Ritchie tem filme sobre rei Arthur no Top 10 da Netflix       | falhou (8 MB) → **reenviada** `6c48a7bf`                       |
| 31  | 12/11 03:37 | South Park leva Tweek e Craig a uma paródia de Heated Rivalry     | publicada `26046d01`                                           |
| 32  | 12/11 03:42 | Netflix estreia East of Eden, nova adaptação de Steinbeck         | publicada `f9d09eb3`                                           |
| 33  | 12/11 03:45 | Nathaniel Buzolic acusa coestrela de vetá-lo em eventos de fãs    | publicada `9c984d75`                                           |
| 34  | 12/11 03:50 | The Wolverine chega ao top 10 de filmes mais vistos da HBO Max    | não enviada (fonte legada)                                     |
| 35  | 12/11 07:23 | Gal Gadot se emociona ao alertar sobre antissemitismo em gala     | falhou (8 MB) → **reenviada** `e69976cf`                       |
| 36  | 12/11 07:26 | Nicole Kidman recebe César honorário da Academia francesa         | falhou (8 MB) → **reenviada** `cfde2f5c`                       |
| 37  | 12/11 07:30 | Netflix prepara documentário sobre Russell Brand após condenação  | falhou (8 MB) → **reenviada** `908627b6`                       |
| 38  | 12/11 07:34 | Blade Runner 2099 estreia em 25 de novembro no Prime Video        | falhou (8 MB) → **reenviada** `29fef968`                       |
| 39  | 12/11 07:38 | Golshifteh Farahani protagoniza suspense sobre o Talibã em Kabul  | falhou (8 MB) → **reenviada** `b5239f44`                       |
| 40  | 12/11 07:42 | Henry Cavill não descarta voltar como Superman após saída de Gunn | publicada `df3dc1bd`                                           |
| 41  | 12/11 08:23 | Tinker Tailor Soldier Spy volta ao streaming no BBC iPlayer       | publicada `5c7f94d4`                                           |
| 42  | 12/11 08:27 | The Counselor ganha reavaliação 13 anos após fracasso comercial   | não enviada (fonte legada)                                     |
| 43  | 12/11 08:32 | Gang Dong-won e Kim Go-eun estrelam drama de época da Netflix     | falhou (8 MB) → **reenviada** `406c6d66`                       |
| 44  | 12/11 08:36 | Black Doves chega a 3,8 milhões de visualizações na Netflix       | publicada `3ac8dda6`                                           |
| 45  | 12/11 08:39 | Frankie Muniz recebe alta após acidente de carro em Daytona       | falhou (8 MB) → **reenviada** `991c68f8`                       |
| 46  | 12/11 09:25 | Andy Serkis conclui filmagens de The Hunt for Gollum na direção   | falhou (8 MB) → **reenviada** `52ded210`                       |
