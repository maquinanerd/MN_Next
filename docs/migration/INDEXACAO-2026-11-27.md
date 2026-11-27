# Indexação — "Detectada, mas não indexada" (2026-11-27)

Por que ~23 mil matérias de `/cinema`, `/series-e-tv` e `/games` aparecem como "Detectada, mas
não indexada" no Search Console, o que este PR corrige e o que depende de outra coisa.

**Fontes**

- **Search Console** (`sc-domain:maquinanerd.com.br`): relatório Páginas de 22/11 e Estatísticas
  de rastreamento (90 dias até 24/11), lidos no painel; inspeção de URL pela API em 27/11, numa
  amostra aleatória estratificada de 28 matérias do sitemap (semente 20261127); status dos
  sitemaps pela API.
- **Site no ar** em 27/11, 16:55–17:19 UTC: 32 requisições `GET`, uma por vez, 2 s entre elas,
  `robots.txt` respeitado, user-agent identificado. Sitemaps, home, editoria, paginação, três
  matérias, uma imagem original e uma capa.
- **Logs do contêiner do portal** (Coolify, só leitura) nos minutos das falhas.
- **Este repositório** (base `95900d0`) e o PR #35, aberto.

Cada item separa o **observado** (medido, com a fonte) da **inferência** (conclusão a partir do
observado, com a confiança).

---

## 1. Resumo

1. **As matérias novas estão sendo indexadas.** Das 12 matérias da amostra publicadas entre
   01/10 e 23/11, **12 estão indexadas** (última leitura do Google entre 20/10 e 27/11). O
   "detectada, mas não indexada" é, sobretudo, o **acervo migrado**: das 12 matérias anteriores a
   16/09, 2 estão indexadas, 1 está "detectada" e **9 são "URL desconhecida pelo Google"** — o
   Google ainda nem registrou o endereço novo delas, embora estejam no sitemap.
2. **O tamanho do problema.** O sitemap lista ~45 mil matérias. Pelo `lastmod`, ~4,1 mil foram
   publicadas ou editadas desde a virada de 16/09; ~40,9 mil são o acervo (jun/2025–set/2026),
   que ganhou endereço novo (`/{editoria}/{slug}`) em 16/09.
3. **Por que o Google adia.** "Detectada, mas não indexada" é, na definição do próprio Google, a
   página que ele quis rastrear mas adiou porque esperava sobrecarregar o site. O site deu motivo:
   52% das solicitações de rastreamento de 90 dias foram 5XX, a conectividade falhou de ~10/09 a
   ~29/10 e, ainda hoje, os sitemaps levam de 3 a 30 s e um deles responde 500 (§2.2). O Google
   gasta a capacidade que sobra com o que é novo — e as novas estão indexadas.
4. **Corrigido neste PR** (§4): sitemaps servidos da memória, com a última cópia boa quando o CMS
   falha; `/page/N` e `/{editoria}/page/N` em cache, como já dizia o `revalidate`; e o
   `robots.txt` deixa de oferecer as imagens originais `/media/{id}` ao rastreador, mantendo as
   capas.
5. **Decisivo e fora deste PR**: o **PR #35** (aberto desde 18/11, CI verde), que faz as leituras
   do Kal El acertarem o cache de dados do Next — hoje nenhuma acerta — e a lentidão do Kal El nas
   listas profundas (§5).

---

## 2. Achados por item

### 2.1 Sitemap índice e `news-sitemap.xml`

| Observado (27/11)                                                                                                                    | Leitura                       |
| ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| `/sitemap.xml`: 200 em 0,8 s; nomeia `articles-1…9`, editorias, tags, autores e o de notícias; sem `lastmod` (decisão já registrada) | correto                       |
| `/news-sitemap.xml`: 200 em 1,9 s; 146 matérias, todas das últimas 48 h (25/11 17:00 → 27/11 16:54); `news:language` = `pt`          | correto; ~73 matérias por dia |
| API do Search Console: índice lido em 22/11, "Válido", 45.151 URLs enviadas; notícias lido em 27/11, 148 URLs                        | o Google lê os dois           |

### 2.2 Sitemaps de matérias — **lentos, sem cache, e um deles falhando**

| Observado                                                                                                                                                         | Fonte                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| 9 arquivos de 5.000 (o 9º com 4.969); 820 KB a 900 KB cada; `lastmod` = data editorial real (não a da importação); nenhuma URL repetida entre os 8 arquivos lidos | varredura                     |
| `articles-1.xml`: 4,6 s; o mesmo arquivo, 2 min depois: **18,7 s** — nada ficou em cache                                                                          | varredura                     |
| `articles-3…9.xml`: 3,1 a 11,6 s                                                                                                                                  | varredura                     |
| **`articles-2.xml`: 500 depois de 29,6 s (17:00 UTC) e 500 depois de 13,0 s (17:18 UTC)** — 2 de 2                                                                | varredura                     |
| Log das duas falhas: `Kal El GET /articles timed out after 5000ms` em `sitemapSlice` — `offset` 7100–7500 na primeira, `offset=5000` na segunda                   | logs do contêiner             |
| Log: `Failed to set fetch cache … AbortError` nas leituras de `offset` 100–500 que deram certo na 2ª tentativa                                                    | logs do contêiner             |
| `cf-cache-status: DYNAMIC` em todos: a Cloudflare não guarda XML                                                                                                  | cabeçalhos                    |
| Build: `ƒ /sitemap/[kind]` — renderizado a cada pedido, apesar do `revalidate = 3600`                                                                             | `pnpm build`, tabela de rotas |

**Inferência (alta).** Cada leitura de um arquivo de matérias pelo Googlebot custava 50 leituras
do Kal El, nenhuma em cache (PR #35 explica o porquê), e uma só que passasse de 5 s derrubava o
arquivo inteiro. `articles-2.xml` é onde estão as matérias de jun–jul/2026 — inclusive todas as de
Games mais recentes (a editoria não publica desde ~28/07; a matéria de games da home é de 08/07).

### 2.3 Links internos para matérias recentes

| Observado                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------- |
| Home: 35 matérias linkadas, das mais novas; paginação `1 2 3 4 … 4995`                                                                |
| `/page/2`: 9 matérias; `/cinema`: 18, paginação até 2.210; `/cinema/page/2`: 10                                                       |
| Matérias: 10 a 16 links para outras matérias recentes da mesma editoria; 6–7 links para tags-hub (indexáveis); 1 para o autor         |
| `/page/N` e `/cinema/page/N`: **`private, no-cache, no-store`**, `cf BYPASS`, 1,2 s; build: `ƒ /page/[n]` e `ƒ /[categoria]/page/[n]` |

**Inferência (média).** A matéria nova tem caminho curto (home, editoria, notícias, relacionados) —
e é indexada. O acervo só é alcançável pelo sitemap ou por uma corrente linear de páginas de 9
itens (a página 2.000 está a ~2.000 cliques da home). Para um site que o Google já rastreia com
cautela, isso pesa contra o acervo. Mudar a paginação mexe no desenho aprovado do kit (docs/03) e
fica como proposta (§6).

### 2.4 Canonical e hreflang

Observado: as 3 matérias, a home, `/cinema`, `/page/2` e `/cinema/page/2` têm canônica para si
mesmas e `index, follow`; nenhum `hreflang`. **Leitura:** correto — o site tem um idioma só, e
`hreflang` só serve entre versões de idioma ou região.

### 2.5 Cabeçalhos de cache

| Rota                                   | Observado                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------- |
| `/`, `/cinema`, matérias               | `s-maxage=60…120, stale-while-revalidate`; Cloudflare `EXPIRED`/`MISS` (guarda) |
| `/page/N`, `/{editoria}/page/N`        | `private, no-store` (corrigido neste PR)                                        |
| Sitemaps de matérias                   | `public, s-maxage=3600` — mas renderizados a cada pedido (corrigido neste PR)   |
| `/media/{id}` e `/media/{id}/…-v1.jpg` | `public, max-age=31536000, immutable`; Cloudflare `MISS` e depois `HIT` (0,1 s) |

### 2.6 Imagens `/media/`

| Observado                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Original `/media/{id}`: 200, **5,3 s** com a Cloudflare em `MISS`                                                                                                                                          |
| Capa `/media/{id}/16x9-v1.jpg`: 200, **5,5 s** em `MISS`; 0,1 s em `HIT`                                                                                                                                   |
| Log às 17:18 UTC: `media.variant-timeout` (capa que passou dos 20 s da fila, resposta 504)                                                                                                                 |
| Nenhuma página aponta para o original: o `<img>` usa `/_next/image?url=%2Fmedia%2F{id}…`; o endereço puro só aparece no payload RSC (`src` do next/image); `og:image` e JSON-LD usam os recortes `-v1.jpg` |
| GSC (22/11): metade dos 1.000 exemplos de "rastreada, mas não indexada" são `/media/{id}` sem extensão; Googlebot Imagem = 63% das solicitações de 90 dias                                                 |
| Busca de imagens (GSC, 30/10–25/11): 2 a 9 cliques por dia; as impressões caem de ~6 mil para ~1 mil por dia a partir de 14/11 (causa não verificada)                                                      |

### 2.7 `X-Robots-Tag: noindex` em `/media/{id}`?

**Não.** Três motivos:

1. `noindex` não tira a URL do relatório Páginas: ela só troca de linha, de "rastreada, mas não
   indexada" para "excluída pela tag noindex" — as duas são "não indexadas".
2. Para ler o `noindex`, o Google precisa buscar a URL. É o custo que se quer evitar: ~5 s e duas
   leituras do Kal El por original, tirados do rastreamento que as matérias esperam. O Google diz
   isso no guia de orçamento de rastreamento: para o que não deve ser rastreado, `robots.txt`, não
   `noindex`.
3. Nas capas (`…-v1.jpg`), `noindex` tiraria a imagem do Google Imagens e do Discover.

O que este PR faz em vez disso: `Disallow: /media/` com `Allow: /media/*/`. Pela regra da maior
correspondência (Google e Bing), os recortes continuam liberados e o original puro, não. O
`/_next/image` é outro caminho e não muda. Essas URLs vão migrar, com o tempo, para "bloqueada pelo
robots.txt" — continuam no relatório, mas deixam de custar rastreamento.

---

## 3. O que causou os 5XX de setembro e outubro

Pela história deste repositório e pelos relatórios já registrados aqui:

| Quando                    | O quê                                                                                                                                                        | Onde está                                |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| 11–16/09                  | 5XX em URLs do WordPress (servidor antigo) durante a importação; conectividade falhando em 90–100% no Search Console. Causa no WordPress: **não registrada** | GSC (exemplos de 5XX)                    |
| 16–21/09                  | permalinks do WordPress em `308` sem `Location` (redirecionamento vindo de página em cache)                                                                  | `middleware.ts`, DECISIONS               |
| 21/09                     | deploy falha no build: 500 matérias pré-renderizadas, Kal El responde 429                                                                                    | `52b9200`                                |
| 25–28/09                  | todo deploy falha na troca de contêiner (milhões de arquivos de cache na camada gravável); **28/09: 503 por três horas**                                     | `b9d3ecc`, RUNBOOK §4.5.3                |
| 29/09 ~20:30 UTC – ~01/10 | regeneração ISR presa numa leitura do Kal El sem prazo: home velha por dois dias, páginas sem cópia penduradas para todo visitante                           | `withDeadline` em `kalel/transport.ts`   |
| ~23/09 – 30/10            | a fila das capas travou com duas vagas presas: **toda capa em 503 "Busy"** até o deploy de 30/10                                                             | `6f08bc4`, SEO-AUDITORIA-2026-10-30 §4.1 |
| 18–26/11                  | invasão: minerador ocupando ~3 núcleos da VPS                                                                                                                | INCIDENTE-2026-11                        |
| 26/11                     | 38 min fora do ar (contenção e deploy corrigido)                                                                                                             | INCIDENTE-2026-11                        |
| permanente                | nenhuma leitura do Kal El acerta o cache de dados (PR #35); cota do Kal El de 600 leituras/min por token; prazo de 5 s por leitura                           | PR #35; `kalel/transport.ts`             |

**Inferência (média).** O fio comum de 23/09 a hoje: o portal não guarda quase nada (cache em
memória de 256 MB para 45 mil matérias, e o cache de dados sem acertar), então o rastreamento do
Google vira leitura direta do Kal El — que tem cota e fica lento sob carga. Imagem (63% das
solicitações) e página disputam a mesma capacidade.

**Para não repetir:** revisar e fazer o merge do PR #35; este PR; deixar o Kal El rápido nas listas
profundas (§5); acompanhar nos logs `discovery.unavailable`, `sitemap.refresh-failed`,
`media.queue-full` e `media.variant-timeout`; trocar o build pack para Dockerfile com
`HEALTHCHECK` para o deploy não derrubar o site (RUNBOOK); concluir a troca dos segredos do
incidente.

---

## 4. O que este PR muda

| Mudança                                                                                                                                                                                                                                                                                                                                                                                      | Arquivos                                                                    | Teste                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Sitemaps-filho servidos da memória: frescos por 1 h (10 min o `articles-1`, 1 min se degradado); vencidos, servidos na hora e atualizados por trás; com o CMS fora, a última cópia boa; sem cópia, **503 + `Retry-After: 120`** em vez de 500; uma atualização por arquivo de cada vez; pausa de 1 min depois de uma falha; no máximo 32 arquivos; cabeçalho `x-sitemap-cache` para conferir | `lib/stale-cache.ts`, `lib/sitemap-cache.ts`, `app/sitemap/[kind]/route.ts` | `tests/unit/stale-cache.test.ts`, `tests/integration/sitemap-route.test.ts` |
| `/page/N` e `/{editoria}/page/N` com ISR sob demanda (`generateStaticParams` vazio): passam de `ƒ` a `●`, e o `revalidate = 120` que já estava no arquivo passa a valer                                                                                                                                                                                                                      | `app/page/[n]/page.tsx`, `app/[categoria]/page/[n]/page.tsx`                | tabela de rotas do `pnpm build`; e2e de paginação existentes                |
| `robots.txt`: `Disallow: /media/` + `Allow: /media/*/`                                                                                                                                                                                                                                                                                                                                       | `app/robots.ts`                                                             | `tests/security/deployment-guards.test.ts` (avalia a regra como o Google)   |

**Por que não o ISR do Next para os sitemaps.** A entrada ISR de uma rota fica no mesmo LRU de
256 MB das páginas (`next-cache-handler.mjs`): um arquivo de 800 KB lido pelo Googlebot algumas
vezes por dia sai do cache muito antes de ser pedido de novo. E o ISR guardaria um arquivo degradado
pelo `revalidate` inteiro (1 h), sem como encurtar.

**Por que este PR não mexe no transporte nem no `DECISIONS.md`.** O PR #35 altera
`kalel/transport.ts`, `kalel/repository.ts` (outros trechos), `DECISIONS.md` (acrescenta §7.33 no
fim) e `RUNBOOK.md`. Este PR não toca esses arquivos, para os dois entrarem em qualquer ordem sem
conflito. Depois do merge dos dois, vale uma linha no DECISIONS apontando para este relatório.

---

## 5. Fora deste repositório

- **Kal El lento nas listas profundas.** `GET /articles?order=published&limit=100&offset=5000`
  passou de 5 s duas vezes seguidas, e `offset` 7100–7500 também. A paginação por `offset` faz o
  banco percorrer tudo o que vem antes. Proposta para o repositório do Kal El: paginação por chave
  (`publishedAt`, `id`) ou índice que cubra `status` + `publishedAt`, e o `total` contado uma vez
  e guardado. Depois disso o sitemap pode deixar de pedir 50 páginas por arquivo.
- **Prazo de 5 s por leitura** (`KAL_EL_TIMEOUT_MS`). Com os sitemaps atualizados por trás da
  resposta, um prazo maior só para eles não seguraria nenhum leitor; mudar o prazo global seguraria.
  Decisão do dono, não deste PR.

---

## 6. Propostas que dependem de decisão

1. **Paginação com saltos** (por exemplo `… 10 20 50 …` ou arquivo por mês): encurta o caminho até
   o acervo. Mexe no desenho do kit (docs/03).
2. **Editoria Games parada desde ~28/07**: a faixa de Games da home mostra matérias de julho. É
   sinal de site desatualizado para leitor e para o Google. Decisão editorial.
3. **O acervo pode não ser todo indexado, e está tudo bem.** 33 mil "rastreadas, mas não
   indexadas" são decisão de qualidade do Google sobre o que ele já leu. Volume de abril de 2026
   (~7,2 mil matérias no mês, pelo `lastmod`) e o core update de maio pesam nisso. Nenhuma
   correção técnica muda essa parte; consolidar ou retirar o que é raso no acervo é decisão
   editorial. Nada de Indexing API para notícias, nem de pedir indexação em massa.

---

## 7. O que não foi verificado

- **Por que o Kal El é lento** nas listas profundas: o código dele não está neste repositório; a
  causa proposta em §5 é hipótese.
- **Como o Google descobre `/media/{id}`**: o endereço puro só aparece no payload RSC; que o Google
  o tire de lá é inferência (alta), não registro do Google.
- **Que URL de imagem o Google Imagens indexa**: o esperado é a do `<img>` (`/_next/image…`), que
  continua liberada. A queda de impressões de imagem desde 14/11 é anterior a este PR e não foi
  explicada.
- **A amostra é pequena** (28 URLs): mostra a diferença entre novas e acervo, não a proporção exata.
- **Efeito no Search Console**: só depois do deploy e de 2–4 semanas de rastreamento.

## 8. Como conferir depois do deploy

1. `curl -sI https://www.maquinanerd.com.br/sitemap/articles-3.xml` duas vezes: a primeira
   `x-sitemap-cache: miss`, a segunda `fresh`, em menos de 1 s.
2. `curl -sI https://www.maquinanerd.com.br/page/2`: `cache-control` com `s-maxage=120`, não
   `private`.
3. `https://www.maquinanerd.com.br/robots.txt`: `Allow: /media/*/` e `Disallow: /media/`. No Search
   Console, inspecionar ao vivo uma capa (`/media/{id}/16x9-v1.jpg`): rastreamento permitido.
4. Logs: `discovery.unavailable` e `sitemap.refresh-failed` devem ser raros; se `articles-2.xml`
   seguir em 503, o problema é o Kal El (§5).
5. Em 2–4 semanas: no relatório Páginas, "detectada, mas não indexada" e "URL desconhecida" do
   acervo; nas Estatísticas de rastreamento, a fatia de 5XX e o tempo médio de resposta.
