# Diagnóstico de SEO — Máquina Nerd (2026-09-21)

Auditoria técnica e editorial do portal em produção (`www.maquinanerd.com.br`, Next.js 15 sobre o
Kal El, atrás da Cloudflare desde 2026-09-16), com os dados do Search Console da propriedade de
domínio, o acervo do WordPress (41.318 posts) e o levantamento de 11 concorrentes — IGN,
GameSpot, Screen Rant, Collider, CBR e Polygon nos EUA; Omelete, Canaltech, Jovem Nerd, Legião
dos Heróis e IGN Brasil no Brasil. As regras citadas vêm da documentação do Google Search Central
e do Bing, consultada em 2026-09-21.

O método segue o protocolo pós-core-update: separar impacto algorítmico, problema técnico e queda
de demanda; comparar a semana anterior ao update com a primeira semana limpa depois dele; olhar
Pesquisa, Discover e Google Notícias separadamente.

---

## 1. Diagnóstico frio

**O tráfego orgânico do site caiu 99% no core update de maio de 2026 — quatro meses antes da
migração.** Na semana anterior ao update o site teve 1.970 cliques e posição média 5,7; na
primeira semana depois dele, 15 cliques e posição média 53,7. Não há ação manual nem problema de
segurança, e a busca pela marca continua em primeiro lugar: o site não foi removido, foi
**reavaliado inteiro** e rebaixado.

A causa mais provável, com alta confiança, é o **volume de conteúdo automatizado**: 41.318 posts
em 14 meses, com pico de 7.261 em abril de 2026 (cerca de 240 por dia), quase todos reescritas de
notícias de veículos estrangeiros (terminam em "Fontes: Variety, ComicBook, Movieweb"), e desde
março de 2026 todos — 20.521 — assinados por um único autor. É o padrão que a política de spam do
Google chama de _abuso de conteúdo em escala_ e que a cobertura do setor associa ao core update de
maio (agregadores e compiladores perderam, fontes originais ganharam). O próprio Google já sinaliza
isso fora do tráfego: **109.621 URLs do site ele decidiu não indexar** (77.086 "detectadas, mas não
indexadas" e 32.535 "rastreadas, mas não indexadas"), e o site **nunca apareceu no Discover**
(0 cliques em 16 meses).

A migração de 2026-09-16 somou problemas técnicos graves por cima — o pior deles, os endereços
antigos das matérias sem destino (§3.1). Eles estão sendo corrigidos e precisam ser, mas **não
explicam a queda de maio e, sozinhos, não trazem o tráfego de volta.**

Não dá para prometer recuperação nem prazo. Um site rebaixado por qualidade só volta a ser
reavaliado quando o conjunto muda, e isso costuma aparecer em core updates seguintes.

---

## 2. Linha do tempo

| Data               | Evento                                                                            |
| ------------------ | --------------------------------------------------------------------------------- |
| jul/2025           | início da publicação em escala: 1.560 posts no mês (antes, quase nada desde 2018) |
| ago–nov/2025       | 3.500 a 5.100 posts por mês                                                       |
| jan/2026           | 96 posts                                                                          |
| abr/2026           | **7.261 posts** — pico de volume e pico de tráfego                                |
| 21/05 a 02/06/2026 | **core update de maio de 2026** (Google Search Status Dashboard)                  |
| 03 a 09/06/2026    | primeira semana limpa depois do update: −99% de cliques                           |
| jun–ago/2026       | 3.364, 2.558 e 718 posts por mês; tráfego perto de zero                           |
| 16/09/2026         | virada para o portal novo no Kal El                                               |
| 17/09/2026         | importação do acervo (40.907 matérias)                                            |
| 16 a 21/09/2026    | nenhuma matéria nova publicada; sitemap de notícias vazio                         |
| 21/09/2026         | site fora do ar das 19:56 às 23:45 UTC (503), falha do Docker num deploy (§3.3)   |

---

## 3. Evidências

### 3.1 Search Console (propriedade `sc-domain:maquinanerd.com.br`)

**Pesquisa na Web, antes e depois do update:**

|               | 14 a 20/05/2026 | 03 a 09/06/2026 | Variação     |
| ------------- | --------------- | --------------- | ------------ |
| Cliques       | 1.970           | 15              | −99,2%       |
| Impressões    | 394 mil         | 2,09 mil        | −99,5%       |
| CTR           | 0,5%            | 0,7%            | —            |
| Posição média | 5,7             | 53,7            | −48 posições |

- 16 meses: 22,5 mil cliques, 4,37 milhões de impressões, CTR 0,5%, posição média 13,8.
- 10 a 19/09/2026: de 0 a 2 cliques por dia, cerca de 120 impressões por dia, posição média entre
  62 e 73.
- Consultas que mais trouxeram cliques em 16 meses: "the boys", "gta 6", "the pitt",
  "outlander", "superman bilheteria", "vingadores doomsday" — tráfego de notícia quente.
- Depois do update, "máquina nerd" segue em posição 1; genéricas foram para 60 a 90.

**Por tipo de busca (16 meses):** Pesquisa 22,5 mil cliques; Google Notícias 378 cliques;
**Discover 0 cliques e 3 impressões.**

**Indexação:** 9.620 páginas indexadas, 132 mil não indexadas:

| Motivo                                      | Páginas |
| ------------------------------------------- | ------- |
| Detectada, mas não indexada no momento      | 77.086  |
| Rastreada, mas não indexada no momento      | 32.535  |
| Excluída pela tag `noindex`                 | 15.801  |
| Página com redirecionamento                 | 5.138   |
| Não encontrado (404)                        | 811     |
| Erro no servidor (5xx)                      | 209     |
| Página alternativa com canônica adequada    | 133     |
| Cópia sem canônica selecionada pelo usuário | 65      |
| Erro de redirecionamento                    | 53      |
| Bloqueada pelo robots.txt                   | 23      |

**Ações manuais:** nenhuma. **Problemas de segurança:** nenhum.

**Core Web Vitals:** celular sem dados (tráfego insuficiente para o CrUX); computador, 1.541
URLs "adequadas". A API pública do PageSpeed estava sem cota no dia da auditoria.

**Sitemaps:** `sitemap.xml` processado (78.071 URLs); `news-sitemap.xml` com erro por estar vazio;
três sitemaps do WordPress ainda cadastrados (`post-sitemap.xml`, `page-sitemap.xml`,
`sitemap_index.xml`).

### 3.2 O acervo

| Medida                                | Valor                                                               |
| ------------------------------------- | ------------------------------------------------------------------- |
| Posts                                 | 41.318 (quase todos de jul/2025 a ago/2026)                         |
| Pico mensal                           | 7.261 (abr/2026)                                                    |
| Autores                               | Pablo Gameleira 22.194 · Abel 16.877 · João 2.240 · José 7          |
| Desde mar/2026                        | 20.521 posts, todos de um único autor                               |
| Posts com link externo                | 29.848                                                              |
| Posts que terminam citando "Fonte(s)" | 29.817                                                              |
| Tamanho médio desde mar/2026          | 557 palavras                                                        |
| Tags                                  | 36.438 tags e 8.613 categorias rebaixadas a tag (37.150 no sitemap) |

Sinais de automação sem revisão no próprio acervo: três posts de um parágrafo só com 11.802 a
15.018 caracteres, 17 "tags" que são listas de títulos com mais de 80 caracteres, 236 posts
publicados duas vezes com título e corpo idênticos (DECISIONS §7.16 e §7.18).

### 3.3 O site novo, no ar

Problemas técnicos encontrados em produção:

| #   | Problema                                                                                   | Efeito                                                                                                                 | Situação                                              |
| --- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| T1  | Endereço antigo (`/{slug}`) respondia 308 sem `Location` ou 404 em cache (DECISIONS §7.19) | as 41.316 URLs indexadas do WordPress não levavam a lugar nenhum; 0 de 40 na amostra chegavam à matéria                | **corrigido** (PR #8)                                 |
| T2  | `robots.txt` bloqueava `/media/`                                                           | o Google não podia buscar nenhuma capa: sem card grande no Discover, sem Google Imagens, imagem do Article inacessível | **corrigido** (PR #8)                                 |
| T3  | Nenhuma matéria publicada desde 16/09                                                      | sitemap de notícias vazio (erro no Search Console); sem frescor para Notícias e Discover                               | depende da redação                                    |
| T4  | Capa enviada em AVIF sai AVIF no `og:image`                                                | Facebook e WhatsApp não mostram AVIF: link compartilhado sem imagem                                                    | **corrigido** (PR #10)                                |
| T5  | Dados estruturados com uma imagem só, no tamanho original (até 3200×1800)                  | o Google recomenda 16:9, 4:3 e 1:1, com pelo menos 1200 px de largura                                                  | **corrigido** (PR #10)                                |
| T6  | `author: []` em matéria criada no Kal El sem autor                                         | Article sem autor; nenhuma assinatura visível                                                                          | **corrigido** (PR #10): assina "Redação Máquina Nerd" |
| T7  | `dateModified` de 40.907 matérias = data da importação                                     | parece atualização em massa, o "frescor artificial" que as diretrizes desaconselham                                    | **corrigido** (PR #10)                                |
| T8  | 37.150 tags indexáveis e no sitemap, a maioria com uma ou duas matérias                    | páginas finas em volume; dilui rastreamento e a avaliação do site                                                      | **corrigido** (PR #10)                                |
| T9  | `lastmod` do índice de sitemaps e das tags = hora da geração                               | o Google para de confiar no `lastmod` do site inteiro quando ele não é verdadeiro                                      | **corrigido** (PR #10)                                |
| T10 | Nenhuma página de política editorial, correções, expediente ou metodologia de crítica      | sinais de confiança (E-E-A-T) ausentes                                                                                 | conteúdo do dono (P1)                                 |
| T11 | Imagens antigas (`/wp-content/uploads/…`) respondem 404                                    | perde Google Imagens e as imagens embutidas em outros sites                                                            | a corrigir (P2)                                       |
| T12 | Sem `<link rel="alternate">` do RSS no `<head>`; datas sem `<time datetime>`               | descoberta e leitura de data mais frágeis                                                                              | **corrigido** (PR #10)                                |
| T13 | Endereço antigo com barra final faz dois saltos (`/slug/` → `/slug` → `/cinema/slug`)      | o Google segue, mas o ideal é um salto                                                                                 | **corrigido** (PR #10)                                |

O que está certo e fica como está: `lang="pt-BR"`, título e descrição por página, canonical,
`max-image-preview:large`, Open Graph e Twitter Card, `NewsMediaOrganization`, `WebSite`,
`NewsArticle` com `BreadcrumbList`, sitemap de notícias implementado, RSS, 404 real, busca
interna `noindex`, HTTPS com HSTS, paginação de editoria com canonical próprio.

Em 2026-09-21 o site ficou fora do ar das 19:56 às 23:45 UTC: no deploy do PR #9 o Docker travou
ao remover o contêiner antigo, e o rollback do Coolify, que remonta a imagem a partir do commit,
falhou pelo limite de requisições do Kal El. O portal respondeu 503 o tempo todo — o código certo
para indisponibilidade temporária, que o Google trata como passageira quando dura horas, não dias.
Na primeira meia hora depois da volta, parte das requisições pela Cloudflare levou de 7 a 60
segundos, com a origem respondendo em menos de 1 s quando chamada direto; normalizou sozinho.
Conferido depois disso: 40 de 40 endereços antigos da amostra chegam à matéria, em dois saltos.

---

## 4. Como os concorrentes fazem

Levantamento feito em 2026-09-21 no HTML, `robots.txt` e sitemaps de cada site. O "nós" é o
estado depois do PR #8.

| Prática                                                | EUA (IGN, GameSpot, Valnet¹)                                                                                                                         | Brasil (Omelete, Canaltech, IGN BR, Jovem Nerd, Legião)                                                    | Nós                                            |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Sitemap de notícias do Google News                     | todos, janela de ~48 h                                                                                                                               | Omelete, Canaltech e IGN BR (os dois primeiros com janela longa demais); Jovem Nerd não tem sitemap nenhum | tem, vazio por falta de publicação             |
| Sitemaps de matérias por mês/ano                       | todos                                                                                                                                                | Omelete (mensal)                                                                                           | por blocos de 5.000                            |
| Tags indexadas                                         | Valnet indexa, mas só ~300 a 2.500 "listing pages" no sitemap; GameSpot bloqueia `/tags/` e expõe 8 hubs curados; IGN usa hubs de entidade           | Omelete: 1.775 temas no sitemap                                                                            | **37.150 no sitemap**                          |
| Página 2+ de tag/autor                                 | `noindex` + canonical para a página 1 (Valnet)                                                                                                       | IGN BR: canonical para a página 1                                                                          | `noindex`, canonical próprio                   |
| `NewsArticle` com várias proporções de imagem          | Valnet: 4 (16:9, 2:1, 4:3, 1:1); IGN: 3                                                                                                              | Omelete: 3 tamanhos; Canaltech: 5                                                                          | 1, e bloqueada até o PR #8                     |
| Autor como `Person` com `url` e `sameAs`               | todos                                                                                                                                                | parcial (sem `sameAs`)                                                                                     | `url` sem `sameAs`; vazio em matéria sem autor |
| Página de autor com `ProfilePage`, bio e redes         | todos                                                                                                                                                | Omelete sem bio; Jovem Nerd e Legião sem nada                                                              | a verificar e completar                        |
| Crítica com nota estruturada (`Review`/`reviewRating`) | IGN, GameSpot, Valnet (com prós e contras); Polygon não dá nota por política                                                                         | Omelete e IGN BR                                                                                           | nó `Review` existe no código                   |
| Política editorial, correções, expediente              | IGN tem tudo, declarado no JSON-LD (`ethicsPolicy`, `correctionsPolicy`); Valnet tem página central de integridade editorial e expediente no "Sobre" | fraco: Omelete nada; Canaltech equipe no "Sobre"; Jovem Nerd só fundadores                                 | nada                                           |
| `robots.txt` para robôs de IA                          | Valnet e IGN bloqueiam GPTBot, ClaudeBot, CCBot etc.; quase ninguém bloqueia Google-Extended                                                         | a maioria não menciona; Canaltech libera explicitamente                                                    | não menciona                                   |
| `max-image-preview:large`                              | todos                                                                                                                                                | quase todos                                                                                                | tem                                            |

¹ Screen Rant, Collider, CBR e Polygon pertencem à Valnet e compartilham a mesma plataforma.

**A diferença que importa não está na tabela técnica.** Tecnicamente, o Máquina Nerd já está no
nível dos concorrentes brasileiros e perto dos americanos; nos sinais de confiança, está abaixo de
todos os americanos e empatado com os brasileiros, que também são fracos nisso — é uma
oportunidade de diferenciação. O que separa os concorrentes que o Google premia do Máquina Nerd é
o que o texto entrega: apuração própria, crítica com opinião assinada por alguém com histórico,
fontes primárias. O Máquina Nerd publica, em volume, a tradução resumida do que eles publicaram.

---

## 5. Hipóteses, em ordem

1. **Rebaixamento do site inteiro por conteúdo em escala sem valor próprio — confiança alta.**
   Evidência: queda de 99% concentrada na janela do core update; posição de 5,7 para 53,7 em todas
   as consultas não-marca; 109 mil URLs que o Google não quis indexar; volume de 240 posts por dia
   num único autor; texto que reescreve fontes estrangeiras. Como confirmar: comparar as consultas e
   páginas que mais perderam com as fontes citadas nelas; ver se algum grupo de conteúdo original
   (críticas, listas próprias) resistiu melhor.
2. **Excesso de páginas finas (tags e arquivos) — confiança média.** 37 mil tags com uma ou duas
   matérias diluem a avaliação do conjunto. Contribui, não explica sozinho.
3. **Falta de sinais de confiança — confiança média.** Sem política editorial, expediente,
   correções e com autoria concentrada. Pesa mais depois de um rebaixamento por qualidade.
4. **Problemas técnicos da migração — confiança alta de que existem, baixa como causa da queda de
   maio.** Ocorreram depois da queda. Precisam ser corrigidos para não piorar e para que qualquer
   recuperação futura consiga aparecer.
5. **Queda de demanda — descartada.** As mesmas franquias ("the boys", "gta 6") seguem com
   demanda; o site perdeu posição, não público.

---

## 6. Plano

### P0 — já

| Ação                                                                                                           | Situação                                                                |
| -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Endereços antigos com destino (T1) e capas liberadas no `robots.txt` (T2)                                      | **feito** (PR #8, no ar; o cache da Cloudflare não precisou de limpeza) |
| Voltar a publicar no Kal El (T3), mas **não** no ritmo de antes                                                | decisão do dono                                                         |
| Tirar do Search Console os sitemaps do WordPress (`post-sitemap.xml`, `page-sitemap.xml`, `sitemap_index.xml`) | operacional                                                             |
| Terminar a segunda sessão de importação (3 matérias, 17 tags, 235 nomes com `&amp;`)                           | aguardando o comando do dono                                            |

### P1 — próximas semanas, no código

- **Capas:** `og:image` em JPEG 1200×675 gerado a partir da mídia (T4) e imagem do Article em
  16:9, 4:3 e 1:1 com pelo menos 1200 px (T5).
- **Autor:** assinatura visível e `author` como a própria organização quando a matéria não tem
  autor (T6); `sameAs` do autor e `ProfilePage` completo.
- **Datas:** `dateModified` só quando a redação edita, não quando a importação regrava (T7).
- **Tags:** indexar e pôr no sitemap só as tags com volume (por exemplo, 5 matérias ou mais);
  `noindex, follow` nas demais, que continuam navegáveis (T8).
- **Sitemaps:** `lastmod` verdadeiro no índice e nas tags (T9).
- **Confiança:** páginas de política editorial, correções, expediente e metodologia de crítica,
  declaradas no JSON-LD como a IGN faz (T10) — o texto é do dono; a estrutura, do código.

### P2 — reconstrução editorial (o que decide a recuperação)

1. **Parar o volume automatizado.** Publicar menos, com valor que a fonte original não tem:
   contexto para o leitor brasileiro, cronologia, análise, crítica assinada, fonte primária.
2. **Autoria real.** Cada texto assinado por quem escreveu, com página de autor, bio e redes.
3. **Decidir o destino do acervo automatizado.** Opções, da mais conservadora à mais forte:
   manter tudo; `noindex` nos posts sem clique nem link externo em 16 meses, que continuam no ar
   para quem chega por link; consolidar reescritas da mesma notícia; remover. O protocolo é não
   apagar em massa como primeira ação — mas manter 40 mil reescritas indexáveis mantém o sinal que
   rebaixou o site.
4. **Hubs de assunto** para as franquias que já trazem busca (The Boys, GTA 6, The Pitt, Outlander,
   Marvel/DCU): página própria com contexto e as matérias ligadas a ela.
5. Imagens antigas redirecionadas (T11) e IndexNow para o Bing. O RSS no
   `<head>` e o `<time datetime>` (T12) e o salto único para o endereço antigo com barra (T13) já
   foram feitos (PR #10).

### O que não fazer

- Não apagar o acervo em massa sem medir: primeiro separar o que tem clique, link e valor.
- Não trocar datas para parecer recente.
- Não voltar a publicar em volume para "compensar" a queda.
- Não esperar que a correção técnica, sozinha, traga o tráfego de volta.

---

## 7. Dados que ainda faltam

- As 20 páginas e as 20 consultas que mais perderam entre maio e junho, para confirmar a hipótese 1
  por grupo de conteúdo.
- Discover e Notícias por página, se houver algum dado residual.
- Core Web Vitals de campo no celular (sem dados no CrUX por falta de tráfego) — medir com
  Lighthouse local.
- Levantamento do Tecmundo (a pesquisa daquele site não tinha voltado quando este relatório foi
  fechado).

## 8. O que acompanhar, toda semana

Cliques, impressões e posição média na Pesquisa; páginas indexadas e as duas filas de "não
indexadas"; erros de redirecionamento e 404; o sitemap de notícias com URLs; e, a partir da volta
da publicação, a parcela de matérias novas indexadas em até 48 horas.
