# Diagnóstico — matérias do Máquina Nerd, MN-Prime e RSS Prime (28/09/2026)

Segue o [diagnóstico de 23/09](DIAGNOSTICO-ROBO.md). Tudo abaixo é medido no ar ou lido no
código; onde é dedução, está dito. Horários em UTC (Brasília = UTC−3), salvo a tabela de volume
por dia.

## Resumo frio

1. **O robô quase parou e virou um tradutor da THR.** Eram ~88 matérias por dia até 24/09; de 25
   a 28/09 foram 15, 12, 7 e 2. Das 36 matérias desde 25/09 14h, **35 têm só a The Hollywood
   Reporter como fonte**.
2. **A causa são duas regras que se encontraram em 24/09.** O RSS Prime passou a dividir as
   fontes entre os portais — o Máquina Nerd ficou com THR, Collider, MovieWeb e ComicBook —, e o
   MN-Prime só publica fonte única de uma lista fechada (Variety, Deadline, THR, IGN…) em que,
   dessas quatro, só a THR está. Nas últimas 48h o superfeed do Máquina Nerd ofereceu 187 pautas:
   **16 das 18 da THR viraram matéria; das 164 da Collider, MovieWeb e ComicBook, nenhuma.** Isso
   contraria a decisão de 24/09 de que fonte única publica.
3. **A matéria multi-fonte praticamente acabou.** A divisão de fontes separa os pares que mais se
   agrupavam (THR+Variety, MovieWeb+ScreenRant), e o `cinema_mn` tem 4 acontecimentos multi-fonte
   em 132 itens. Dos 5 que houve em 48h, o MN-Prime publicou 1 — e descartou o trailer de
   _Werwulf_, _A Múmia 4_, o diretor do novo _Star Wars_ e _Reacher_, porque, pelo código, trata
   como conflito o acontecimento que cresce de uma fonte para várias.
4. **As correções de 23–25/09 funcionaram onde miraram.** Nenhuma matéria duplicada desde 25/09
   (antes foram cinco com `-2` no endereço, ainda no ar) e 86% das matérias novas têm link
   interno no texto. Mas o "Leia também" aponta para a matéria anterior, não para uma relacionada,
   e um quarto dos links no corpo são frases inventadas para encaixar o título de outra matéria.
5. **Defeitos de texto no ar:** "Leia tambem" e "Divulgacao" sem acento em todo bloco e todo
   crédito, parágrafos inteiros em inglês em duas matérias (uma de 27/09), um título truncado,
   "consolida" em 56% dos textos.
6. **RSS Prime coleta bem e limpa nada.** Todas as fontes do Máquina Nerd entregaram hoje, mas o
   job de limpeza nunca conseguiu rodar, e o feed não traz texto das fontes, só resumo e URL.
7. **Games, Quadrinhos e Animes estão parados** (últimas matérias em 09/07, 22/07 e 13/05). O
   MN-Prime baixa o superfeed de games a cada ciclo e descarta tudo por uma trava no código.

---

## Método e limites

- **Matérias:** as 255 assinadas pelo Maquinista entre 22/09 23h08 e 28/09 12h31, lidas uma a
  uma do HTML entregue ao leitor (JSON-LD, corpo, fontes, links, legendas), a partir de
  `sitemap/articles-1.xml` e `articles-2.xml`. Palavras contadas só no texto corrido, sem "Leia
  também", linha de fontes, anúncios e rodapé.
- **Superfeeds:** `cinema_mn`, `series_mn`, `movies`, `tv`, `games`, `cinema_cinerie` e
  `series_cinerie`, baixados de `rss.kalel.online` em 28/09 por volta de 13h, mais a home e o
  `/health` do RSS Prime.
- **Código:** MN-Prime em `origin/main` `d180068` (o commit do último deploy no Coolify, 25/09
  14h07); RSS Prime em `origin/main` `99b4b03`. Os checkouts locais estavam atrás do GitHub e não
  foram tocados; o código foi lido de uma cópia.
- **O que não deu para ver:** o registro de pautas e recusas do MN-Prime. O token do MCP do
  Coolify não tem a permissão `read:sensitive` (os logs do contêiner voltam "Missing required
  permissions") e o Claude in Chrome estava desconectado, então nem o painel do MN-Prime nem o
  Easypanel do RSS Prime foram abertos. A prova em produção é o cruzamento feed × site; o motivo
  é leitura do código. A consulta que fecha a questão está em §2.6.

---

## 1. As matérias

### 1.1 Volume por dia (horário de Brasília)

| Dia   | Matérias | Observação                                                                  |
| ----- | -------: | --------------------------------------------------------------------------- |
| 22/09 |       44 | início às 20h08                                                             |
| 23/09 |       88 |                                                                             |
| 24/09 |       87 | a última da Variety sai às 19h09; depois, nenhuma                           |
| 25/09 |       15 | **nenhuma publicação das 21h09 de 24/09 às 12h29 de 25/09**; depois, só THR |
| 26/09 |       12 |                                                                             |
| 27/09 |        7 |                                                                             |
| 28/09 |        2 | até 9h31                                                                    |

A Variety sumir de uma hora para outra, embora continue no superfeed `movies` com 18 itens
avulsos de fonte confiável, indica que o MN-Prime passou a ler `cinema_mn`/`series_mn` na noite
de 24/09 (a troca é feita no painel, em _Fontes_, e não foi confirmada). A pausa de 15 horas não
tem causa confirmada; é compatível com a troca de feed, porque a proteção do PR #10 marca como
já coberto tudo o que o feed anterior trouxe (§2.3).

### 1.2 Antes e depois da troca

| Medida                           | 22–24/09 (211)                                                            | 25–28/09 (36)             |
| -------------------------------- | ------------------------------------------------------------------------- | ------------------------- |
| Palavras (mediana)               | 620                                                                       | **441**                   |
| Abaixo de 350 palavras           | 8 (4%)                                                                    | **6 (17%)**               |
| Subtítulos (mediana)             | 4                                                                         | 3                         |
| Nenhuma foto no corpo, só a capa | 103 (49%)                                                                 | **30 (83%)**              |
| Vídeo incorporado                | 22 (10%)                                                                  | 5 (14%)                   |
| Link interno no texto corrido    | 114 (54%)                                                                 | **31 (86%)**              |
| Bloco "Leia também"              | 108 (51%)                                                                 | 28 (78%)                  |
| Fonte única                      | 175 (83%)                                                                 | **35 (97%)**              |
| Duas fontes ou mais              | 36 (17%)                                                                  | **1 (3%)**                |
| Fontes citadas                   | Variety 136, THR 67, ScreenRant 20, MovieWeb 15, Collider 11, ComicBook 7 | **THR 36**, Collider 1    |
| Editorias                        | Cinema 155, Séries e TV 56                                                | Cinema 24, Séries e TV 12 |

As 8 matérias entre os deploys dos PRs #10 e #11 do MN-Prime (24/09 21h15 a 25/09 14h07) ficam
fora das duas colunas. A foto no corpo foi objeto do PR #11 ("foto de corpo volta à matéria");
não conferi se as matérias da THR sem foto tinham foto na fonte.

A pauta de depois de 25/09 continua com indústria: "Iberseries & Platino Industria" em dois dias
seguidos, "New York Film Festival inaugura lounge exclusivo para cineastas", "SNL promove Keri
Powers a chefe do departamento de talentos", "NFL atrasa início da transmissão dos MTV VMAs",
"Universal Pictures supera US$ 5 bilhões". É a pauta da THR, que é imprensa de mercado.

### 1.3 Matérias em dobro

Cinco matérias saíram **duas vezes com o mesmo título**; a segunda ganhou `-2` no endereço.
Todas antes das correções — **nenhum `-2` depois de 25/09 14h07**.

| Endereço da segunda                                                                     | Por quê                                             |
| --------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `/cinema/fusao-da-paramount-e-warner-bros-destina-us-5-milhoes-a-indies-2`              | a **mesma URL** da THR, 26 horas depois             |
| `/series-e-tv/ryan-murphy-revela-crossover-de-scream-queens-em-american-horror-story-2` | a **mesma URL** da THR, 13 horas depois             |
| `/series-e-tv/a-man-on-the-inside-termina-na-3-temporada-pela-netflix-2`                | Variety na 1ª, THR na 2ª                            |
| `/cinema/clayface-ganha-trailer-final-e-confirma-tom-de-horror-no-dcu-2`                | ScreenRant+Collider na 1ª, Collider+ComicBook na 2ª |
| `/series-e-tv/netflix-renova-the-beast-in-me-para-a-segunda-temporada-2`                | Variety na 1ª, THR+Collider na 2ª                   |

Outros pares sobre o mesmo fato, com título diferente (UTC): _After Midnight_ de Taylor
Tomlinson (24/09 16h29 e 16h32), o livro de UAP de Terence Winter (14h29 e 14h32), o incentivo
fiscal do Congresso (18h39 e 18h47), _Black Doves_ 2ª temporada (16h49 e 22h52), _Dynamic Duo_
(08h51 e 16h37), _NAZA_ distribuição global (11h35 e 14h11), o roteiro do reboot de _Glee_ (24/09
04h59 e 25/09 00h09), David Ellison confirmando a fusão (23/09 05h20 e 05h31) e a juíza
questionando o acordo (23/09 e 24/09). A fusão Paramount/Warner e seus personagens renderam **14
matérias em dois dias**.

### 1.4 O texto

- **Link interno encaixado à força.** Das 265 ligações internas no texto corrido, **64 (24%)
  usam como âncora o título inteiro de outra matéria**, e a IA escreve uma frase só para
  acomodá-lo: "O sucesso de produções como _Alexander Ludwig celebra nova fase na carreira com
  The White Lotus_ exemplifica como talentos…"; "…um fenômeno similar ao que se observa em
  outros setores da indústria, como quando o _Letterboxd atrai interesse de compra da A24 e New
  York Times_". O leitor percebe na hora.
- **"Leia também" é a matéria anterior, não uma relacionada.** Em 112 dos 113 casos rastreáveis
  o destino é uma das três publicadas logo antes; só 10 dividem uma palavra-chave com a matéria.
  _Rose_, drama de época com Sandra Hüller, manda ler "Estrelas de Off Campus apresentam
  performance no MTV VMAs 2026".
- **"Leia tambem"**, sem acento, nas 141 matérias que têm o bloco. **"Divulgacao"**, sem cedilha
  e sem til, em todos os créditos de imagem, com o veículo ora "Variety", ora "variety" ou
  "hollywoodreporter", e às vezes "Imagem da materia Divulgacao/variety".
- **Parágrafos em inglês.** "Dozens of Israeli Americans and members of local Jewish communities
  gathered outside the Lincoln Center…" em
  `/cinema/protesto-marca-estreia-de-naza-no-new-york-film-festival` (27/09); e os **últimos sete
  parágrafos** de `/cinema/resident-evil-estreia-no-topo-da-bilheteria-com-us-108-milhoes`
  (22/09) são o texto da Variety em inglês, colado depois da conclusão em português.
- **Título truncado no ar:** "Ryan Murphy finaliza roteiro para reboot de Glee em criador Ry"
  (`/series-e-tv/ryan-murphy-finaliza-roteiro-para-reboot-de-glee-em-criador-ry`), que ainda
  repete uma matéria da véspera.
- **Muletas.** "Consolida/consolidando" em 56% das matérias, "reforça" em 53%, "expectativa" em
  33%; 210 das 255 (82%) têm ao menos uma dessas ou "promete"/"marco". Em 29 matérias o último
  parágrafo fala em "expectativa", embora o prompt proíba fechar assim (§2.5).
- **O que está bom:** nenhuma matéria sem fonte, sem assinatura ou sem imagem de capa; título com
  mediana de 62 caracteres, descrição com 147, 5 palavras-chave; `NewsArticle` com autor, datas e
  três proporções de imagem; canonical e Open Graph corretos; nenhuma com `noindex`. Com cache da
  Cloudflare a matéria responde em ~0,1 s; sem cache, em 1,3 a 2,7 s.
- **Instabilidade pontual:** numa leitura com 6 acessos simultâneos, 21 matérias seguidas
  voltaram 500; relidas uma a uma, todas voltaram 200, e 36 matérias antigas lidas depois com a
  mesma concorrência deram 200. Sem os logs do portal não dá para dizer a causa; fica registrado.

---

## 2. MN-Prime

### 2.1 Por que só a THR passa

O superfeed do Máquina Nerd baixado em 28/09 cobre de 26/09 13h14 a 28/09 12h15 — 187 itens
diferentes. Cruzando cada item com as fontes citadas nas 18 matérias publicadas no período:

| Origem do item                  | Itens | Viraram matéria |
| ------------------------------- | ----: | --------------: |
| The Hollywood Reporter, sozinha |    18 |    **16 (89%)** |
| Collider, sozinha               |    91 |           **0** |
| MovieWeb, sozinha               |    57 |           **0** |
| ComicBook.com, sozinha          |    16 |           **0** |
| Acontecimento com 2 a 4 fontes  |     5 |               1 |

A regra que produz isso está em `app/superfeed_policy.py:24-37` e `:151-159`: um item de fonte
única só passa se o domínio estiver em `TRUSTED_SINGLE_SOURCES` — `deadline.com`, `variety.com`,
`hollywoodreporter.com`, `ign.com`, `gamespot.com`, `polygon.com`, `marvel.com`, `dc.com` e sites
de console. Collider, MovieWeb, ComicBook e ScreenRant não estão. O resto é recusado antes da IA
como `EARLY_SUPERFEED_POLICY` / `SINGLE_SOURCE_NOT_RELIABLE` (`app/pipeline.py:1214-1235`). A
válvula `ALLOW_SINGLE_SOURCE` existe (`app/early_reject.py:51`), vale `false` por padrão e não
está nas variáveis do recurso no Coolify nem no painel.

Até 24/09 isso não aparecia: `movies` e `tv` traziam Variety e THR (ambas na lista) e muitos
acontecimentos multi-fonte. Com as fontes do Máquina Nerd (§3.1), a lista deixa passar só a THR.
**O código não reflete a decisão de 24/09 de que fonte única publica.**

### 2.2 Por que os acontecimentos multi-fonte se perdem

Os quatro acontecimentos que ficaram de fora — _Werwulf_ (4 fontes), _A Múmia 4_, o diretor da
trilogia Skywalker e _Reacher_ — estão no `cinema_mn` com `sf:revision` 3, 2, 2 e 3: começaram com
uma fonte e cresceram. O caminho no código:

1. O item nasce com uma fonte da Collider ou da MovieWeb e uma `event_key`. O MN-Prime o registra
   e o recusa por fonte única (§2.1).
2. O acontecimento ganha fontes. O RSS Prime mantém a mesma `event_key` e sobe a revisão.
3. O MN-Prime **ignora a revisão**: o adaptador força `revision=1`
   (`app/contracts/legacy_feed_v0.py:76,139`, "the legacy feed has no notion of revisions") e o
   leitor do feed não lê `sf:revision` (`app/feeds.py`). Mesma chave, mesma revisão, conteúdo
   diferente = `REVISION_HASH_CONFLICT`, descartado e nunca reavaliado
   (`app/contracts/revisions.py:104-133`).

O único que entrou mostra o outro lado. A THR deu John Goodman em _The Last of Us_ às 15h00 de
26/09; o robô publicou às 15h52 com **315 palavras e só a THR** — a menor matéria do período.
Horas depois o acontecimento juntou Collider, ComicBook e MovieWeb no `series_mn` e seis fontes
no `tv`, mas a matéria nunca é atualizada, e a proteção contra duplicata (correta) impede uma
segunda. **O maior assunto do dia sai com a pior versão**, porque o robô publica a primeira fonte
aceita e não volta a ela. O mesmo com Robert Pattinson e o Batman no DCU: THR, The Wrap e
Variety no `movies`; no site, 335 palavras só da THR.

### 2.3 A proteção de duplicata dos PRs #10 e #11

Funciona: nenhum `-2` desde 25/09. O custo, pelo código:

- **Troca de chave sem janela** (`app/store.py:875-926`): uma `event_key` nova vira
  `SUPERSEDED` se qualquer URL dela pertence a outra chave ainda em andamento (NEW, QUEUED,
  PROCESSING…) ou já coberta, olhando o histórico inteiro, e a decisão é permanente. Um item de
  fonte única ainda em NEW trava a URL; o acontecimento maior vira `SUPERSEDED`; depois o de
  fonte única é recusado pela política — e a pauta some inteira. `movies` e `cinema_mn`
  compartilham 111 dos 132 itens e **nenhum com a mesma chave** (83 com chaves diferentes, 28 sem
  chave de um dos lados): trocar de um para o outro descarta tudo o que o anterior já trouxe.
- **Duplicata por título roda depois da IA** (`app/prime/destinations.py:184-200`): a matéria
  recusada já foi paga.

### 2.4 Outros defeitos no caminho de publicação

1. **Falha no Kal El perde a pauta.** O retorno de `_publish_to_kalel` é ignorado
   (`app/pipeline.py:1968`) e as URLs do acontecimento são registradas como cobertas logo depois,
   publicando ou não (`:2013-2016`). Se o Kal El estiver fora do ar, a matéria não sai e nunca
   mais volta.
2. **Games é baixado para ser jogado fora.** `BLOCKED_TOPICS={'games'}` (`app/config.py:983-984`)
   descarta tudo do `rssprime_games`, que é semeado ligado; o ciclo ainda espera 45 s por ele.
3. **Recusa de pauta compara com o título original, em inglês** (`app/early_reject.py:68-97`).
   Termo em português na lista de _Ajustes_ nunca casa. A lista em produção não foi vista.
4. **Não há idade máxima de item nem limpeza da fila** (`cleanup_old_entries` não tem quem a
   chame): a fila é FIFO e a reconciliação recria tarefas antigas primeiro
   (`app/store.py:759-830`).
5. **Legenda e `alt` de imagem entram sem escape** em `_image_candidate_to_html`
   (`app/pipeline.py:416-422`): uma aspa na legenda da fonte quebra o HTML intermediário antes
   da conversão para os blocos do Kal El.
6. Exceções engolidas em série (`except Exception: pass` em `app/pipeline.py:1618-1619`; entrega
   e publicação capturam tudo) — é por isso que um defeito como o do item 1 não aparece em lugar
   nenhum.

### 2.5 De onde vêm os defeitos de texto

| Defeito                          | Origem                                                                                                                                                                                                                                             |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Leia tambem" sem acento         | `app/internal_linking.py:27,37`                                                                                                                                                                                                                    |
| "Leia também" = matéria anterior | quando nenhuma entidade casa, `add_internal_links` cai em `other_options[0]`, a mais recente (`app/internal_linking.py:147-160`); é chamado com `current_post_categories=[]` (`app/pipeline.py:1741-1743`), então nunca há opção da mesma editoria |
| Frase inventada para o link      | `select_internal_links` entrega ao redator candidatos com **uma** palavra em comum com o título em inglês (`app/pipeline.py:278-342`), e a IA escreve a frase para usá-los                                                                         |
| "Divulgacao/THR"                 | `app/kalel_service.py:1153-1159`, com o nome cru da fonte                                                                                                                                                                                          |
| Fecho com "expectativa"          | o prompt proíbe "A expectativa é que…", "…promete…", "…reforça a importância…" (`universal_prompt.txt:179-188`, `:385-389`), mas o QA só registra (`app/editorial_qa.py`)                                                                          |
| Subtítulos                       | regras contraditórias: "MÍNIMO 3 `<h2>`" (`app/ai_processor.py:125`), "2 a 4" (`universal_prompt.txt:378`), "máx 6" (`:436`)                                                                                                                       |
| Inglês e título truncado         | nenhum validador olha idioma do parágrafo nem título cortado; o QA editorial bloqueia só título ausente/com HTML, concorrente citado e fonte omitida no crédito (`app/editorial_validator.py:369-415`)                                             |

### 2.6 Como confirmar com o registro de produção

Nenhuma rota do painel mostra as recusas; elas ficam em `seen_articles` (`status`,
`fail_reason`) e `rssprime_events` (`validation_status`), em `/data/app.db`. No terminal do
contêiner no Coolify (a imagem não tem `sqlite3`):

```bash
python -c "import sqlite3;c=sqlite3.connect('/data/app.db');[print(r) for r in c.execute(\"SELECT status, substr(fail_reason,1,60), count(*) FROM seen_articles WHERE inserted_at>='2026-09-25' GROUP BY 1,2 ORDER BY 3 DESC LIMIT 25\")];[print(r) for r in c.execute(\"SELECT validation_status, count(*) FROM rssprime_events GROUP BY 1\")];[print(r) for r in c.execute('SELECT id, enabled, urls FROM prime_feeds')]"
```

O esperado, se o diagnóstico está certo: `FAILED` com `EARLY_SUPERFEED_POLICY` /
`SINGLE_SOURCE_NOT_RELIABLE` no topo, `REVISION_HASH_CONFLICT` presente, e `cinema_mn`/`series_mn`
ligados em `prime_feeds`.

---

## 3. RSS Prime

### 3.1 A divisão de fontes desfaz os acontecimentos

Desde o PR #18 (24/09), os superfeeds de portal repartem as fontes de `movies` e `tv` **de forma
exclusiva**, por desenho (`app/portal_topics.py:60-65`: "Every outlet of `movies`/`tv` belongs to
exactly one portal, so the two portals never share a source text"):

| Portal       | Fontes                                                        |
| ------------ | ------------------------------------------------------------- |
| Cinerie      | Variety, ScreenRant, The Wrap                                 |
| Máquina Nerd | The Hollywood Reporter, Collider, MovieWeb, ComicBook (`cbr`) |

O agrupamento é calculado **dentro de cada tópico** (`engine.py:404-410`,
`article_ledger.py:370`, `orchestrator.py:242`) e só vira multi-fonte com duas fontes
(`event_store.py:268`, `server.py:737`). Os pares que mais se agrupam cruzam a divisão —
THR+Variety, MovieWeb+ScreenRant, THR+The Wrap+Variety. Nos XMLs de 28/09:

| Superfeed   | Itens | Multi-fonte |
| ----------- | ----: | ----------: |
| `movies`    |   197 |    27 (14%) |
| `tv`        |   165 |     11 (7%) |
| `cinema_mn` |   132 |      4 (3%) |
| `series_mn` |    59 |      1 (2%) |

Dos 27 acontecimentos de `movies`, só 3 sobrevivem com as fontes do Máquina Nerd (10 com as da
Cinerie); dos 11 de `tv`, 1. (A home do RSS Prime mostra 58%, 46%, 10% e 0% porque soma os
agrupamentos acumulados; a ordem de grandeza é a mesma.) A divisão resolve um problema real — os
dois portais reescrevendo o mesmo texto — ao custo de tirar do Máquina Nerd quase todo o
material multi-fonte.

Agravantes: as fontes entregam ~10 itens por coleta (ComicBook, 50); e a pré-deduplicação funde
títulos quase iguais de fontes diferentes antes do agrupamento (`fuzz.ratio ≥ 92` em até 6h,
`feed_processor.py:117-120`) sem que o motor V2 leia o `merged_from` — a segunda fonte some antes
de o acontecimento se formar.

### 3.2 O que chega ao MN-Prime

- **Não vem texto.** `description` é o resumo do RSS da fonte (mediana ~130 caracteres) e
  `content:encoded` traz só uma `<img>`; 25 dos 132 itens do `cinema_mn` vêm sem imagem. O
  MN-Prime baixa cada URL para redigir.
- No acontecimento multi-fonte, título, link, resumo e imagem são de uma fonte; as outras vêm só
  como URLs em `sf:urls`.
- **28 dos 128 itens avulsos** do `cinema_mn` (11 de 58 no `series_mn`) vêm **sem
  `sf:event_key`** — só membros de acontecimentos abertos recebem chave
  (`event_store.py:600-640`). É a identidade que as proteções do MN-Prime usam.
- Janela de 48h (`SUPERFEED_FEED_MAX_AGE_HOURS`), itens por data, com os multi-fonte misturados
  aos avulsos (posições 59, 62, 65 e 98 no `cinema_mn`). A `sf:revision` vem certa — quem a
  ignora é o MN-Prime (§2.2).

### 3.3 A limpeza nunca rodou

A home avisa "ÚLTIMA LIMPEZA nunca". O job de retenção roda a cada 6h (`scheduler.py:568-576`) e
**pula a vez, sem tentar de novo, se a coleta estiver em andamento** (`scheduler.py:846-852`). A
coleta roda a cada 30 min, foi agendada no mesmo boot e leva mais de 30 min (a de 28/09 foi de
12h04 a 12h34, com o superfeed depois): como 6h é múltiplo de 30 min, todo tick da limpeza cai
numa coleta em andamento. Não há rota para disparar a limpeza (`trigger_retention`,
`scheduler.py:890`, não está ligado a nada), só a linha de comando `tools/retention_cleanup.py`.

Nada é podado: `sf_articles`, `sf_events`, `sf_event_members`, embeddings, uso do Gemini, fila e
logs só crescem, e o `VACUUM` nunca roda. São 38,5 MB de banco e 21,2 MB de logs — pequeno; o
custo aparece em consultas sem limite de tempo, como a que lê todos os acontecimentos abertos já
criados (`event_store.py:632-640`). O aviso "artigo com 6d 17h" vem da tabela `articles`, que o
superfeed nem usa.

### 3.4 Outros defeitos

1. **Duas identidades no mesmo XML.** Sem acontecimento V2 para o tópico, o XML mostra os
   agrupamentos do motor antigo com `event_key` e GUID do antigo (`server.py:494-520`), e os
   avulsos com chaves do V2. Em erro do V2 a troca é silenciosa, com GUIDs novos — o MN-Prime
   pode tomar por pauta nova o que já publicou. `series_mn`, com poucos acontecimentos, é o mais
   exposto.
2. **Fallback sem filtro.** Se os filtros zeram o tópico, o XML publica os itens crus, sem a
   janela de 48h nem os filtros de assunto (`server.py:758-765`).
3. **A fronteira entre portais não é conferida na saída** (`rss_filtering.py:792-794` devolve
   verdadeiro para fonte de fora do tópico); depende só da coleta.
4. **Erro engolido** em `_superfeed_topic` (`scheduler.py:474-481`), que desliga em silêncio o
   monitoramento das fontes do superfeed.

### 3.5 Saúde

`/health`: agendador ligado, 146 fontes monitoradas, status `degraded` com 12 alertas, 0 alertas
de superfeed. Todas as fontes dos superfeeds do Máquina Nerd entregaram entre 12h16 e 12h17 de
28/09. Das 45 fontes paradas há 72h, as de interesse do site são Kotaku, Euronews Culture e Onde
Assistir — nenhuma alimenta superfeed.

---

## 4. O que fazer

Respeitando o que já foi decidido: publicação automática, sem teto diário, fonte única publica.

**P0 — devolvem volume e pauta**

1. **MN-Prime: aceitar fonte única das fontes do Máquina Nerd.** Incluir `collider.com`,
   `movieweb.com` e `comicbook.com` em `TRUSTED_SINGLE_SOURCES` — melhor ainda, tornar a lista
   editável por site em _Ajustes_. É o que alinha o código à decisão de 24/09. Pelo feed de 48h,
   são ~80 pautas a mais por dia antes da recusa de pauta e da deduplicação; `ALLOW_SINGLE_SOURCE=true`
   faz o mesmo, mas abre qualquer domínio.
2. **MN-Prime: ler `sf:revision` e tratar crescimento como atualização.** Acontecimento recusado
   com uma fonte que volta com duas deve ser reavaliado; acontecimento já publicado que ganha
   fontes deve atualizar a matéria no Kal El (nova versão do mesmo documento), não virar conflito
   nem segunda matéria. Recupera _Werwulf_, _Star Wars_, _A Múmia 4_ e transforma o "John Goodman
   em 315 palavras" numa matéria de quatro fontes.
3. **RSS Prime: não dividir os acontecimentos multi-fonte.** Manter a divisão para os avulsos
   (é ali que dois portais reescreveriam o mesmo texto) e agrupar sobre todas as fontes de
   `movies`/`tv`, entregando o acontecimento multi-fonte aos dois portais — cada um redige a sua
   combinação. Alternativa: dividir por acontecimento, não por fonte. **Decisão do dono**, porque
   muda o que a Cinerie recebe.

**P1 — qualidade por matéria**

4. "Leia também" com acento e com critério: mesma editoria ou mesma entidade (passar a
   categoria em vez de `[]`); sem relação, sem bloco.
5. Link no corpo só onde a entidade já está no texto (o `add_internal_links` faz isso); parar de
   entregar candidatos ao redator e proibir no prompt âncora com título inteiro.
6. "Divulgação/The Hollywood Reporter" — acento e nome de exibição da fonte.
7. Validadores que bloqueiam antes de publicar: parágrafo em inglês, título terminado em palavra
   cortada, fecho com "expectativa". Hoje o QA só registra.
8. Falha no Kal El: não marcar as URLs como cobertas quando a publicação não aconteceu; tentar de
   novo.
9. Revisar a lista de pauta recusada em _Ajustes_: tem de estar em inglês ou ser nome próprio
   (ex.: "Iberseries", "Platino Industria", "lounge", "promotes", "hires").

**P2 — acervo e manutenção**

10. Consolidar as 5 matérias `-2` e a do título truncado: despublicar e redirecionar (301) para a
    primeira. Os pares da §1.3 podem ficar.
11. RSS Prime: retenção que espera a coleta terminar em vez de pular, e rota para disparar.
12. RSS Prime: não misturar identidades V2 e legado no mesmo XML.
13. Games: tirar o `rssprime_games` das fontes do MN-Prime ou abrir a editoria (o site tem
    Games, Quadrinhos e Animes parados desde julho/maio; o superfeed de games tem GameRant e
    TheGamer, que também não estão na lista de fonte única). **Decisão do dono.**
14. Observabilidade: dar `read:sensitive` ao token do MCP do Coolify ou criar no painel do
    MN-Prime uma página com a contagem de `seen_articles` por status e motivo nas últimas 24h. Sem
    isso, cada diagnóstico depende de inferir pelo site.
