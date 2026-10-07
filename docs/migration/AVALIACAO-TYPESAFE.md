# Avaliação — TypeSafe (modelo Jev) no ecossistema Máquina Nerd (07/10/2026)

Fonte: a documentação inteira em `https://docs.typesafe.ai` (índice `llms.txt`, cerca de 40
páginas lidas), uma análise independente (DataCamp) e a leitura do código de três projetos:
este portal (MN_Next), o MN-Prime e o MNScr. **Nenhuma chamada à API foi feita**: não há
chave. Tudo o que está aqui sobre qualidade é o que a documentação afirma, mais o que o
nosso código mostra.

## Resumo frio

1. **O TypeSafe não escreve texto.** Ele só responde perguntas fechadas sobre um texto:
   _escolha uma destas opções_ (Choice), _dê uma nota nesta escala_ (Score) ou _isto é
   verdade?_ (Noul, de 0 a 1). Cada resposta vem com probabilidades e um grau de confiança. Não
   substitui o Gemini que redige as matérias nem o Claude/Codex que escrevem código.
2. **É muito barato e rápido.** US$ 0,042 por milhão de tokens de entrada, saída grátis,
   cerca de 100–500 ms por chamada, várias perguntas na mesma chamada pelo preço de uma.
   Rodar nas decisões de 160 matérias custaria por volta de **US$ 0,08**, contra os US$ 5,07
   que essas 160 matérias custaram em IA de 22 a 24/09.
3. **O lugar dele é o MN-Prime, não o portal.** O portal não toma nenhuma decisão por IA; o
   MN-Prime toma dezenas, e hoje decide quase todas por **substring, regex e contas de
   sobreposição de palavras** calibradas à mão: pauta, "é o mesmo acontecimento?", "a fonte
   apoia esta afirmação?", tipo de matéria, tags. É exatamente o que o Jev faz.
4. **Os três riscos reais:**
   - o Jev foi treinado em inglês, e a própria documentação diz que outros idiomas têm
     **precisão menor**, sem dizer quanto;
   - o produto foi lançado em **15/09/2026**, há três semanas: o SDK de JavaScript quebrou a
     compatibilidade quatro dias depois da primeira versão e os limites de uso "mudam sem aviso";
   - os números de desempenho são todos da própria empresa.
5. **Recomendação:** um piloto fora do ar e sem risco, no acervo do WordPress. São 41.022
   matérias que a redação já classificou, e o teste custa menos de US$ 1. Ele mede o português
   antes de qualquer coisa ir para produção. Se passar, o próximo passo é o MN-Prime em modo
   sombra: o Jev roda e é registrado no log, mas não decide nada.
6. **Não resolve os problemas P0 de 28/09.** A fonte única barrada pela lista
   `TRUSTED_SINGLE_SOURCES` e a `sf:revision` ignorada são defeitos de regra e de código. O Jev
   não conserta nenhum dos dois, e eles vêm antes.

---

## 1. O que é

O TypeSafe chama o Jev de modelo "System One", em referência ao pensamento rápido de
Kahneman. Ele recebe um **estado** e um conjunto de **perguntas tipadas** e devolve uma
resposta tipada por pergunta. O estado pode ser um texto, um objeto JSON ou uma lista. As
perguntas são avaliadas em paralelo e isoladas umas das outras.

| Tipo   | Pergunta                     | Devolve                                                  | Limite         |
| ------ | ---------------------------- | -------------------------------------------------------- | -------------- |
| Choice | Qual destas opções?          | opção escolhida, probabilidade de cada uma, confiança    | até 255 opções |
| Score  | Que nota nesta escala?       | nota (pode cair entre níveis), probabilidades, confiança | 2 a 10 níveis  |
| Noul   | Esta afirmação é verdadeira? | número de 0 a 1                                          | —              |

- **Endpoint:** `POST https://api.typesafe.ai/v1/systemone`, autenticado com `Bearer`. Erros
  possíveis: 401, 422, 429 e 529.
- **SDKs:**
  - Python `typesafe-sdk`, para Python 3.10 ou mais. O MN-Prime usa 3.12.
  - JavaScript `@typesafe-ai/sdk` v0.6.0, para Node 20 ou mais. O portal usa Node 22.
  - Os dois fazem retry com backoff e respeitam o `retry-after`.
- **Modelo:**
  - Versão atual `jev-1.13.0`. Os apelidos `jev-latest` e `jev-preview` mudam de versão
    sozinhos.
  - Contexto de 64 mil tokens por chamada; o estado mais a maior pergunta podem somar até 32 mil.
  - Aceita só texto.
- **Limites de uso:** 100 mil tokens/s e 80 requisições/s, "ajustados dinamicamente" e
  sujeitos a mudar sem aviso.
- **Dados:**
  - A empresa declara que não treina com dados de clientes.
  - Há DPA e política de privacidade.
  - Retenção zero só no plano enterprise.
- **Ferramentas para agentes:** há uma _skill_ para Claude Code e Codex
  (`claude plugin install typesafe@typesafe-ai`), que ensina o agente a escrever integrações.
  Ela não transforma o Jev em modelo de agente; a documentação deixa isso explícito.

### O que a documentação admite que ele faz mal (jev-1.13, revisado em 02/10)

| Ponto fraco                         | O que isso significa para nós                                                     |
| ----------------------------------- | --------------------------------------------------------------------------------- |
| Leitura literal                     | A pergunta tem de dizer exatamente o critério. "Pauta do portal" é vago demais.   |
| Números, contas, contagem           | Bilheteria, datas de estreia, número de temporada: comparação continua no código. |
| Datas                               | Ordenar ou comparar datas não é com ele; extrair dia/mês/ano como Choice, sim.    |
| Estado grande com coisa irrelevante | Mandar só o trecho necessário, não a matéria inteira com menu e rodapé.           |
| Conteúdo adversarial                | Texto de fonte que "argumenta" a própria classificação pode mexer na resposta.    |
| Ordem das opções no Choice          | Tende à primeira opção; testar reordenando.                                       |
| Gerar texto                         | Não faz. Extração livre (nome de obra, afirmação) continua com o Gemini.          |
| Idioma                              | Inglês é o principal; outros idiomas "funcionam, mas não igualmente bem".         |

---

## 2. Onde ele cabe no que já construímos

### 2.1 Portal (MN_Next, este repositório) — quase nada, e de propósito

O portal não chama nenhum LLM. Ele lê o Kal El, aplica cache por tag e renderiza. Colocar o
Jev no caminho de uma página pública contraria a arquitetura: o Kal El é a única dependência
do runtime, e o Cinerie é opcional e degrada. Também traria uma falha nova e um custo por
visita, e serviria para decisões que o portal não toma.

| Ideia                                                           | Veredito             | Por quê                                                                                                                         |
| --------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Editoria dos 296 posts sem uma (`scripts/wp/auto-desk.ts`)      | **Sim, como piloto** | É offline e há gabarito. Ver §4.                                                                                                |
| Reordenar a busca (`lib/search.ts`) com o Jev                   | Não                  | A busca é `no-store` por requisição: seria custo e latência a cada busca, e mais uma dependência externa.                       |
| Ler "tema sensível" para suprimir anúncio na hora de renderizar | Não aqui             | A decisão tem de vir pronta do CMS como tag reservada (`RESERVED_TAGS` no `mapper.ts`). Quem marca é o MN-Prime (§2.2, item 6). |
| Duplicatas do importador (`scripts/wp/duplicates.ts`)           | Não                  | A regra é estreita de propósito (título e corpo idênticos byte a byte). Um juízo probabilístico ali só traz risco.              |
| Revisão de código / lint semântico na CI                        | Não                  | O Jev não lê código como um revisor. ESLint, testes e a revisão do Codex já cobrem isso.                                        |

### 2.2 MN-Prime — onde ele realmente rende

O MN-Prime usa o Gemini para redigir (US$ 3,56 de US$ 5,07), mas quase todas as decisões ao
redor da redação são de substring, regex e limiares calibrados à mão. A tabela está em ordem
de valor, e todos os caminhos são relativos à raiz do MN-Prime.

| #   | Decisão                                                          | Como é hoje                                                                                                                                                                                                                   | Com o Jev                                                                                                                                                                                                                          | Ganho                                                                                                                                                                                                                                                 |
| --- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **A pauta interessa ao portal?**                                 | `_fora_da_pauta` (`app/early_reject.py:68`): termo da lista do painel **contido no título**. A lista tem de estar em inglês e só pega o que o editor previu.                                                                  | Choice de editoria (`cinema`, `series`, `games`, `quadrinhos`, `animes`, `fora_do_escopo`) e Noul "é notícia de negócio do mercado audiovisual (vendas, contratação, feira)?", com título e resumo da fonte, **antes** da redação. | Pega pauta de indústria que não usa as palavras da lista e não paga redação de pauta recusada.                                                                                                                                                        |
| 2   | **É o mesmo acontecimento de uma matéria já publicada?**         | Dedup por `event_key`, URL, assinatura e `SequenceMatcher ≥ 0,92` (`app/feeds.py:158`). A duplicata por título roda **depois** da IA (`app/prime/destinations.py:184-200`), quando a matéria já foi paga.                     | Noul "este item noticia o mesmo fato que `publicada[i]`?" contra os títulos e leads das últimas 48 h da mesma editoria, numa chamada só.                                                                                           | Pega os pares de título diferente (Paramount/Warner rendeu 14 matérias em dois dias) e dá base para o P0 nº 2 de 28/09: se é o mesmo fato, **atualizar** a matéria em vez de criar outra.                                                             |
| 3   | **A fonte secundária fala do mesmo fato?**                       | Cobertura de "âncoras" ≥ 0,65 (`app/multi_source_builder.py:260-336`), calibrada em 16 pares rotulados à mão.                                                                                                                 | Score de 3 níveis (`outro fato` / `relacionado` / `mesmo fato`), o padrão do _cookbook_ de alinhamento de entidades.                                                                                                               | Menos fonte boa descartada como `OFF_TOPIC` e menos fonte errada misturada.                                                                                                                                                                           |
| 4   | **A fonte apoia esta afirmação da matéria?**                     | Sobreposição de palavras (Jaccard) com `MIN_TOPICAL_OVERLAP=0,12` e `STRONG_TEXT_OVERLAP=0,55` (`app/factual/matching.py:59-61`), sinônimos escritos à mão e uma tradução feita pelo LLM para casar o português com o inglês. | Choice (`apoia`, `apoia em parte`, `contradiz`, `só menciona`, `sem relação`), com o trecho da fonte em inglês como estado. **Números e datas continuam comparados no código.**                                                    | Juízo semântico entre idiomas no lugar de contar palavras em comum. **Ressalva:** no caminho Kal El, o resultado do gate não é consultado (`destinations.py`, `kalel_service.py`), então isso só melhora a matéria se algo usar o resultado (ver §3). |
| 5   | **Tags**                                                         | Texto livre do LLM (até 12) **criado no Kal El** quando não existe (`app/kalel_service.py:877-920`). Já gerou "categoria inventada" (`tom-cruise`, `plataformas`).                                                            | O código pré-seleciona candidatas por nome; um Choice (até 255 opções) ou vários Noul escolhem **entre as tags que já existem**.                                                                                                   | A taxonomia para de crescer com termo solto, e as páginas de tag ficam com volume.                                                                                                                                                                    |
| 6   | **Tema sensível → sem anúncio**                                  | Depende de um humano pôr a tag reservada que o `mapper.ts` do portal já entende. O robô não marca.                                                                                                                            | Vários Noul (tragédia, morte, violência, abuso, saúde) e um Score de gravidade, mesmo padrão do _cookbook_ de guardrails. Acima do limiar, o MN-Prime aplica a tag reservada.                                                      | Protege a conta do AdSense sem trabalho manual. O custo é irrisório.                                                                                                                                                                                  |
| 7   | **Tipo da matéria** (notícia, lista, guia, análise, crítica)     | Regex **em português** sobre o **título da fonte, que vem em inglês** (`app/policy_engine.py:466-539`).                                                                                                                       | Choice com o título e o lead.                                                                                                                                                                                                      | Os sinais da regex são quase todos em português ("melhores", "guia", "análise"); com título em inglês, a decisão cai quase sempre na contagem de palavras da fonte.                                                                                   |
| 8   | **"Leia também"**                                                | Aponta para a matéria anterior, não para uma relacionada (diagnóstico de 28/09, P1 nº 4).                                                                                                                                     | Choice entre as candidatas da mesma editoria: "qual trata do mesmo assunto ou da mesma obra?", com opção "nenhuma".                                                                                                                | Bloco relacionado de verdade, ou nenhum bloco.                                                                                                                                                                                                        |
| 9   | Fecho genérico ("expectativa"), CTA residual, concorrente citado | Listas e regex (`app/editorial_qa.py`, `app/editorial_validator.py:62-78`, `app/html_utils.py:235-333`). O QA só registra no log.                                                                                             | Noul por defeito.                                                                                                                                                                                                                  | Pega variações que a regex não prevê. Prioridade baixa: as literais a regex já pega.                                                                                                                                                                  |

**O que continua com o Gemini:** redação, expansão e extração de afirmações e de obras citadas,
porque tudo isso gera texto. O Jev entra **em volta** dessas etapas, nunca no lugar delas.

**Custo estimado com folga:** uns 12 mil tokens de entrada por matéria (pauta, mesmo fato, fontes,
afirmações, tags e tema sensível) dão **cerca de US$ 0,0005 por matéria**, contra os US$ 0,03 de
hoje. A checagem de pauta sobre todos os itens do superfeed, publicados ou não, fica abaixo de
um centavo por dia. Cada pauta recusada ou duplicata pega **antes** da redação economiza cerca de
US$ 0,02 de Gemini.

### 2.3 RSS Prime — hipótese, sem leitura do código nesta rodada

O agrupamento por acontecimento é do RSS Prime, que usa Gemini e embeddings (diagnóstico de
28/09). O padrão do TypeSafe ali seria este:

- o embedding propõe os pares candidatos;
- um Score confirma se é "mesmo fato", "relacionado" ou "outro fato".

Isso também substituiria a pré-deduplicação por `fuzz.ratio ≥ 92`, que hoje funde fontes
diferentes antes de o acontecimento se formar. **A divisão de fontes entre os portais é decisão
do dono** e não muda com o Jev.

### 2.4 MNScr

Os arquivos de decisão são os mesmos do MN-Prime (`superfeed_policy.py`,
`multi_source_builder.py`, `editorial_validator.py` e outros), então tudo o que vale para o
MN-Prime vale para o MNScr. O teto de US$ 2/dia do MNScr não é afetado: o Jev custa menos de 2%
do gasto atual.

### 2.5 Processo de desenvolvimento (Claude Code e Codex)

A _skill_ do TypeSafe só faz sentido **quando formos implementar** a integração. É um plugin de
terceiro, de um marketplace de terceiro, e deve ser lido antes de instalar. Ela não substitui o
Codex como revisor e não muda nada no fluxo do `CLAUDE.md`.

---

## 3. O que é bom e o que é ruim

### Bom

- **Resposta tipada por construção.** Acabam as cinco camadas de reparo de JSON
  (`app/ai_processor.py:754-1180`) para essas decisões. A resposta nunca sai do conjunto de
  opções que nós definimos.
- **Probabilidade e confiança em toda resposta.** Isso permite a regra "na dúvida, o
  comportamento de hoje", sem inventar limiar.
- **Barato a ponto de não precisar de orçamento próprio.**
- **Os limiares ficam no código, não no prompt.** A documentação recomenda pôr perguntas e
  limiares num arquivo só, revisado como constante, que é como o projeto já trabalha.
- **Pedaços pequenos e testáveis.** Cada pergunta é uma unidade que pode ganhar fixture e teste
  no `pytest` do MN-Prime, com `fetch` falso no SDK.
- **Os dois SDKs cabem na nossa stack** (Python 3.12, Node 22) sem trocar versão de nada.

### Ruim

- **Português.** É o maior risco. Nossas matérias e o acervo estão em português. As fontes do
  MN-Prime estão em inglês, o que ajuda nas decisões 1 a 4, mas não nas de tags, tema sensível,
  "Leia também" e editoria do acervo. **Só um teste com os nossos dados responde isso** (§4).
- **Produto de três semanas.** As evidências:
  - lançado em 15/09/2026, com acesso por lista de espera no lançamento;
  - o SDK de JavaScript saiu em 11/09 (v0.5.7) e quebrou a compatibilidade em 15/09 (v0.6.0);
  - os limites de uso "podem mudar sem aviso";
  - os _benchmarks_ são da própria empresa;
  - a própria análise independente diz que não dá para saber se o preço é subsidiado.
- **Mais um fornecedor externo.** É mais uma chave para guardar, mais uma conta e mais um ponto
  de falha no ciclo do MN-Prime. Os dados enviados são texto público de notícia, então a
  privacidade não preocupa. Mesmo assim, nada de e-mail de newsletter nem dado de leitor.
- **Leitura literal e pontos cegos conhecidos.** Pergunta mal escrita dá resposta errada com
  confiança alta. A documentação avisa que "agentes não são bons em escrever perguntas": as
  perguntas precisam ser revisadas por quem conhece a pauta.
- **Os apelidos de modelo mudam sozinhos.** Fixar `jev-1.13.0` e trocar de versão só quando
  decidirmos, senão um limiar calibrado deixa de valer de um dia para o outro.
- **Não resolve o que está quebrado hoje.** O robô quase parou por regra de fonte única e por
  revisão ignorada (diagnóstico de 28/09, P0 nº 1 e nº 2). Adotar o Jev antes disso é
  distração.
- **No caminho Kal El, ninguém lê o resultado do gate.** Melhorar a checagem de afirmações
  (item 4) só tem efeito se o resultado for usado, por exemplo para tirar da matéria a frase
  sem apoio antes de publicar. **Mandar para revisão está fora:** a decisão do dono é publicação
  automática, sem teto e com fonte única.

---

## 4. Plano recomendado

**Regras que valem em todas as etapas.** O Jev **nunca** vira teto de publicação nem fila de
revisão. Quando ele falha ou tem pouca confiança, vale o comportamento de hoje, e a matéria
segue.

1. **Piloto no acervo (portal, offline, sem risco).**
   - **O teste:** pegar as 41.022 matérias que a redação classificou, esconder a editoria e
     pedir ao Jev um Choice entre as editorias com título, tags e primeiro parágrafo.
   - **Custo:** uns 400 tokens por matéria dão cerca de 16 milhões de tokens, **por volta de
     US$ 0,70**.
   - **A régua:** a regra de palavras-chave do `auto-desk.ts` decide 73,7% das matérias e
     concorda 95,7% (cinema), 97,6% (games) e 82,2% (séries). O Jev tem de igualar isso onde a
     regra decide e decidir parte do que ela deixa de fora, com confiança alta.
   - **O que entrega:** a precisão do Jev **em português e no nosso assunto**, além das editorias
     dos 296 posts pendentes (FINAL-VERIFICATION §7, item 4).
   - **Onde fica:** um script em `scripts/wp/`, em dry run como os outros. Ele só escreve o
     relatório e um `--category-map` sugerido.
2. **Corrigir os P0 de 28/09 no MN-Prime e no RSS Prime** (fonte única, `sf:revision`). Isso
   independe do Jev e vem antes.
3. **MN-Prime em modo sombra, por 1 a 2 semanas.**
   - Rodar as decisões 1 a 3 (pauta, mesmo fato, fonte secundária) em paralelo e gravar a
     resposta junto do `seen_articles`, sem mudar nada no que é publicado.
   - Depois, comparar com o que de fato foi ao ar e com o que foi recusado.
4. **Ligar uma decisão por vez, com proteção.**
   - Fixar `jev-1.13.0`, com timeout de 2 a 3 s e um único retry.
   - Ter uma chave `TYPESAFE_ENABLED` no painel e as perguntas e limiares num módulo só, com
     teste.
   - Começar pela pauta (1) e pelo tema sensível (6). Os dois são aditivos: não tiram nada do
     que hoje é publicado, a não ser a pauta que o editor já mandaria recusar.
5. **Só depois, as tags (5) e o "Leia também" (8).** Os dois dependem do teste em português
   do passo 1.

### O que o operador precisa fornecer

- **Uma conta em `console.typesafe.ai` e uma chave de API.** Não está claro se o cadastro ainda
  passa por lista de espera. A chave entra só como variável de ambiente do recurso no Coolify,
  e nunca no repositório nem no chat.
- **Nada mais para o piloto 1.** O dump do acervo já está disponível para o importador.

---

## Fontes

- Documentação: <https://docs.typesafe.ai/introduction>, índice completo em
  <https://docs.typesafe.ai/llms.txt>. Páginas usadas: _models_, _api_,
  _model-jaggedness/jev-1.13_, _confidence_, _concepts/state_, _concepts/how-to-build-with-system-one_,
  _concepts/use-case-map_, _patterns/\*_, _cookbooks/llm_guardrails_,
  _cookbooks/entity_alignment_, _cookbooks/classifying_rag_passages_, _cookbooks/citation_check_,
  _cookbooks/parallel_questions_, _sdk/javascript_ (e changelog), _agent-skill_, _legal_.
- Análise independente: <https://www.datacamp.com/blog/system-one-models-jev>.
- Código: este repositório (`scripts/wp/auto-desk.ts`, `scripts/wp/duplicates.ts`,
  `packages/content/src/kalel/mapper.ts`), MN-Prime e MNScr nos caminhos citados.
- Diagnósticos anteriores: [DIAGNOSTICO-2026-09-28.md](./DIAGNOSTICO-2026-09-28.md),
  [DIAGNOSTICO-ROBO.md](./DIAGNOSTICO-ROBO.md), [FINAL-VERIFICATION.md](./FINAL-VERIFICATION.md).
