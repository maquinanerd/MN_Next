# Auditoria de SEO — Máquina Nerd (2026-10-30)

Segunda auditoria do portal em produção (`www.maquinanerd.com.br`, Next.js 15 sobre o Kal El,
atrás da Cloudflare), seis semanas depois da virada de 2026-09-16 e cinco semanas depois do
[diagnóstico de 2026-09-21](./SEO-DIAGNOSTICO.md). Fontes:

- **Search Console**, propriedade de domínio `sc-domain:maquinanerd.com.br`, dados até
  2026-10-28 (o relatório tem dois dias de atraso), lidos no painel em 2026-10-30;
- **Google Analytics 4**, propriedade "Máquina Nerd" (conta `141309275`), lida no painel;
- **varredura do site no ar** em 2026-10-30 — `curl` com navegador comum e Googlebot, sitemaps,
  redirecionamentos de endereços do WordPress, PageSpeed Insights;
- o código deste repositório, para apontar a origem de cada problema.

## 1. Resumo

1. **O orgânico voltou a existir.** De 0–2 cliques por dia em setembro para 50–120 por dia em
   outubro; a melhor semana (08 a 14/10) teve 657 cliques. É um terço da semana anterior ao
   core update de maio (1.970) — o site voltou a ser exibido, não voltou ao patamar. As duas
   últimas semanas caíram um pouco (547 e 497).
2. **A indexação mais que dobrou**: 10 mil páginas indexadas em agosto, 26,2 mil em 22/10.
   Sitemaps lidos em 29/10, sem erro. Nenhuma ação manual.
3. **Achado crítico, corrigido neste PR: toda imagem de capa respondia 503.** Os recortes
   que vão no `og:image` e no `NewsArticle` (`/media/<id>/16x9-v1.jpg` e afins) davam
   `503 Busy` em 16 de 16 tentativas, porque a fila que gera essas imagens travou e não tinha
   como se soltar. Sem elas não há imagem grande para Discover, Principais notícias e Google
   Imagens, e as prévias em WhatsApp e redes saem sem foto (§4.1).
4. **Google Analytics religado** (§2): estava sem coleta desde ~13/09, quando o WordPress
   saiu. Agora usa o fluxo vinculado ao Search Console e só mede quem aceita os cookies.
5. **Core Web Vitals reprovados nos dados de campo**: CLS 0,23 e LCP 3 s no celular (home);
   1.387 URLs "precisam de melhorias" no Search Console (§4.2).
6. **Discover continua em zero** e Google Notícias quase zero (§3.6).
7. Outros quatro ajustes técnicos entraram no PR (sitemap, redirecionamentos, descrição
   vazia); os que dependem de painel ou de decisão estão no plano (§5).

---

## 2. Google Analytics: religado, atrás do consentimento

**O que havia.** A propriedade "Máquina Nerd" continua de pé, com três fluxos da Web. Todos
mostravam "nenhum dado nas últimas 48 horas": a medição vinha do plugin MonsterInsights do
WordPress e parou com ele — o gráfico de usuários cai a zero por volta de 2026-09-13. O site
novo nunca teve tag do Google Analytics. Desde então o único número de audiência era o Search
Console, que só vê a busca orgânica.

**O que foi feito** (este PR; decisão em [DECISIONS §7.25](./DECISIONS.md)):

| Item                            | Estado                                                                                                                                        |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Fluxo usado                     | `Máquina Nerd – GA4`, `G-CQ0S5G3DY9` — o que está **vinculado ao Search Console** desde 2026-03-31                                            |
| Onde entra                      | `NEXT_PUBLIC_GA_MEASUREMENT_ID`, criada no recurso do portal no Coolify (build e runtime)                                                     |
| Quando carrega                  | só depois do "Aceitar todos" da barra de privacidade; antes disso, nenhum script e nenhuma requisição ao Google                               |
| Troca de página dentro do site  | contada pela métrica otimizada do fluxo (eventos de histórico), já ligada no painel; o código não manda `page_view` em dobro                  |
| Política de segurança (CSP)     | ganha `www.googletagmanager.com` em `script-src` e os hosts de coleta do GA4 em `connect-src`/`img-src`, só num build com id                  |
| `/cookies` e privacidade        | citam o Google Analytics, os cookies `_ga`/`_ga_<id>` e o que ele recebe                                                                      |
| Verificado no navegador (build) | sem aceite: zero requisição ao Google; com aceite: `gtag.js`, cookies `_ga`, `page_view` na carga e na navegação interna, sem bloqueio de CSP |

**Limite que precisa ficar claro.** O GA4 vai contar **só quem aceitou** os cookies. Isso é o
que a barra e a política prometem ao leitor, e é o padrão mais seguro na LGPD. O número de
visitas do GA4 será, portanto, menor que o real; para o orgânico, o Search Console segue sendo
a referência. Ligar o modo "avançado" do Consent Mode (o Google estima quem recusou a partir
de sinais sem cookie) aumentaria os números, mas exige mudar o texto da barra e da política —
é decisão do dono, não do código.

**Configurações do painel que merecem atenção:**

1. **Retenção de dados de eventos em 2 meses** (padrão do Google). Explorações e relatórios
   personalizados não enxergam nada além disso. O recomendado para um portal é **14 meses**
   (Administrador → Coleta e modificação de dados → Retenção de dados). Não alterei sem a sua
   confirmação.
2. **O histórico de agosto e setembro tem tráfego de robô.** Nos últimos 90 dias, os países com
   mais "usuários" são Singapura (5,6 mil) e China (1,7 mil), à frente do Brasil (3,4 mil), e o
   canal "Direct" tem 10 mil sessões contra 3,2 mil do orgânico. Esse padrão é o de robôs que o
   filtro automático do GA4 não pega. Comparar períodos antigos com os novos sem excluir esses
   países distorce tudo.
3. **Dois fluxos sobrando** (os do MonsterInsights). Não atrapalham — nada envia para eles —,
   mas podem ser arquivados para ninguém instalar o id errado no futuro.
4. **URL do fluxo** ainda diz `http://www.maquinanerd.com.br`. É só um rótulo; não muda a
   coleta.

O vínculo com o Search Console já existia e continua ativo: os relatórios "Search Console →
Consultas" e "Tráfego de pesquisa orgânica" do GA4 voltam a ter dados do lado do Analytics
assim que o deploy deste PR entrar.

---

## 3. Search Console

### 3.1 O tráfego orgânico voltou a crescer depois da migração

Pesquisa na Web, por blocos de sete dias até o último dia com dados (28/10):

| Semana          | Cliques | Impressões | Observação                                                  |
| --------------- | ------: | ---------: | ----------------------------------------------------------- |
| 14 a 20/05/2026 |   1.970 |    394 mil | semana antes do core update de maio (referência)            |
| 03 a 09/06/2026 |      15 |    2,1 mil | primeira semana depois do update                            |
| 17 a 23/09/2026 |       8 |        643 | primeira semana do site novo                                |
| 24 a 30/09/2026 |     153 |   20,9 mil | a virada começa em 26/09: de 0–2 para 25–41 cliques por dia |
| 01 a 07/10/2026 |     310 |   44,6 mil |                                                             |
| 08 a 14/10/2026 | **657** |   61,2 mil | melhor semana desde maio                                    |
| 15 a 21/10/2026 |     547 |   59,3 mil |                                                             |
| 22 a 28/10/2026 |     497 |   56,6 mil | duas semanas seguidas de leve queda                         |

- Posição média de outubro: **14** (setembro, antes da virada: 60 a 73).
- CTR média de outubro: 0,9% (era 0,5% antes do update).
- Celular: 78% dos cliques (1.577 de 2.011 em outubro); computador 20%; tablet 1%.
- A semana boa ainda é **um terço** da semana anterior ao update de maio, e as impressões, um
  sexto. O site voltou a ser exibido, não voltou ao patamar.
- As duas últimas semanas caíram 17% e 9%. É cedo para chamar de tendência — em notícia, uma
  matéria que estoura numa semana distorce a média —, mas é o número a acompanhar.

### 3.2 O que traz o clique

Outubro, por página: o tráfego é de **notícia quente, cauda longa**. Nenhuma página passa de
141 cliques no mês.

| Página                                                                      | Cliques | Impressões |   CTR | Posição |
| --------------------------------------------------------------------------- | ------: | ---------: | ----: | ------: |
| `/series-e-tv/netflix-adiciona-felicity-ao-catalogo-apos-acordo-com-disney` |     141 |      1.013 | 13,9% |     5,0 |
| `/cinema/remain-calm-traz-terror-com-pauly-shore-e-doug-jones`              |      73 |     12.022 |  0,6% |     6,8 |
| `/cinema/animals-marca-pior-recepcao-critica-da-carreira-de-ben-affleck`    |      28 |        472 |  5,9% |     5,6 |
| `/cinema/franquia-jogos-vorazes-deixa-o-catalogo-da-netflix-em-breve`       |      24 |      2.105 |  1,1% |     6,7 |
| `/cinema/marjoe-gortner-ator-e-ex-pregador-mirim-morre-aos-82-anos`         |      22 |        359 |  6,1% |     3,7 |

**Oportunidade clara: intenção de "onde assistir".** A matéria de _Remain Calm_ tem 12 mil
impressões e 0,6% de CTR na posição 6,8. As consultas que a mostram são "remain calm filme"
(2.575 impressões) e **"remain calm onde assistir" (2.363 impressões, posição 6,5, CTR 0,3%)**.
O título — "Remain Calm traz terror com Pauly Shore e Doug Jones" — não responde a nenhuma das
duas. O mesmo padrão aparece em "felicity netflix" e "jogos vorazes netflix": quem busca quer
saber **onde e quando** ver. Matéria de estreia que diz isso no título e no primeiro parágrafo
captura esse clique; o módulo "Onde assistir" da Cinerie, previsto no projeto, é o lugar
natural dessa informação.

### 3.3 Indexação: mais que dobrou

| Data       | Indexadas | Não indexadas |
| ---------- | --------: | ------------: |
| 24/08/2026 |    10.023 |        62.627 |
| 22/10/2026 |  26,2 mil |      91,1 mil |

Por que as páginas não foram indexadas (22/10):

| Motivo                                       | Páginas | Leitura                                                                                                                                                                                                            |
| -------------------------------------------- | ------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Rastreada, mas não indexada                  |  32.268 | decisão de qualidade do Google; quase todo o acervo antigo                                                                                                                                                         |
| Detectada, mas não indexada                  |  24.397 | idem, nem chegou a rastrear                                                                                                                                                                                        |
| Excluída pela tag `noindex`                  |  22.631 | **proposital**: tags com poucas matérias e páginas 2+ de tag (`app/tag/[slug]/page.tsx`); os exemplos são `/tag/aza`, `/tag/lev`, `/tag/x?page=4` e as tags antigas na raiz (`/perry-mason/` → `/tag/perry-mason`) |
| Página com redirecionamento                  |  10.708 | proposital: os permalinks do WordPress redirecionando para o endereço novo                                                                                                                                         |
| Não encontrado (404)                         |     844 | §4; eram ~600 antes da migração, subiram para ~860 na virada e estão estáveis                                                                                                                                      |
| Página alternativa com tag canônica adequada |      99 | endereços com maiúscula (`…-da-Netflix`) que respondem 200 com canônica em minúsculas; §4                                                                                                                          |
| Erro no servidor (5xx)                       |      44 | as quedas de 21/09 e de 29/09–01/10, já corrigidas                                                                                                                                                                 |
| Bloqueada pelo robots.txt                    |      23 | —                                                                                                                                                                                                                  |
| Erro de redirecionamento                     |      17 | —                                                                                                                                                                                                                  |

O `noindex` em massa não é defeito: é a regra do projeto para não oferecer ao Google
milhares de páginas de tag com uma ou duas matérias, exatamente o tipo de página que o
diagnóstico de setembro apontou como sinal de baixa qualidade.

### 3.4 Sitemaps

| Sitemap            | Tipo     | Última leitura | Status     | URLs encontradas |
| ------------------ | -------- | -------------- | ---------- | ---------------: |
| `sitemap.xml`      | índice   | 29/10/2026     | processado |           43.377 |
| `news-sitemap.xml` | Notícias | 29/10/2026     | processado |               87 |

Os sitemaps do WordPress foram retirados em 22/09 e não voltaram.

### 3.5 Core Web Vitals (dados de campo)

Celular e computador: **1.387 URLs "precisam de melhorias", nenhuma boa, nenhuma ruim** — um
único grupo, com dois problemas: **LCP acima de 2,5 s** e **CLS acima de 0,1**. INP sem problema.
Detalhe e causa provável em §4.

### 3.6 Discover e Google Notícias

- **Discover: zero** impressões em três meses. Era zero também antes (16 meses sem nada).
- **Google Notícias: 174 impressões e 1 clique** em três meses; 120 delas numa matéria antiga.
- Nada disso é problema técnico isolado (as matérias têm `max-image-preview:large` e capa
  grande): Discover e Notícias dependem de o Google confiar no site como fonte, o que ainda não
  aconteceu depois do update de maio.

### 3.7 Ações manuais e segurança

Nenhuma ação manual. Nenhum problema de segurança.

---

## 4. Técnica

Varredura de 2026-10-30 (147 requisições sequenciais, navegador comum e Googlebot), PageSpeed
Insights pelo navegador e leitura do código. Saídas brutas fora do repositório.

### 4.1 Crítico — capas em 503 (corrigido neste PR)

| Observado      | Valor                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------- |
| URL de exemplo | `/media/d7d655f0-3f6e-4c4e-b420-0c61b56dd358/16x9-v1.jpg` (capa da matéria do topo)         |
| Resposta       | `503`, corpo `Busy`, `retry-after: 5`, `cache-control: no-store`, `cf-cache-status: BYPASS` |
| Frequência     | 16 de 16 recortes de 8 matérias diferentes, 16x9 e 1x1, em 0,5–0,9 s                        |
| Portal         | saudável: `/api/health?ready=1` → `ok`; a imagem original por `/_next/image` responde 200   |
| Contêiner      | no ar desde o deploy de 2026-10-01                                                          |

**Por quê.** A rota desenha os recortes numa fila de 2 vagas e 32 lugares de espera, e nada
limitava quanto tempo um trabalho segurava a vaga (o prazo valia só para o download; o
desenho não tinha prazo). Dois trabalhos que nunca terminaram prenderam as duas vagas, quem
chegou depois esperou para sempre e todo pedido novo recebeu 503. Detalhe e correção em
[DECISIONS §7.26](./DECISIONS.md): prazo duro de 20 s por trabalho, cancelamento real do
download, saída da fila para quem desiste, limite de tempo no `sharp` e log quando a fila
enche. O deploy troca o contêiner e destrava as capas na hora.

**Impacto no Google.** O `og:image` e as três imagens do `NewsArticle` são os recortes. O
Google não conseguiu buscar nenhum deles enquanto a fila estava travada — por quanto tempo,
não dá para saber sem os logs. Isso pesa diretamente no Discover (exige imagem grande) e nas
Principais notícias, e pode explicar parte do zero no Discover.

### 4.2 Alto — Core Web Vitals

Dados de campo (Chrome UX Report, 28 dias, celular, home):

| Métrica | Valor | Limite "bom" | Situação                                   |
| ------- | ----: | -----------: | ------------------------------------------ |
| LCP     |   3 s |        2,5 s | precisa melhorar                           |
| CLS     |  0,23 |          0,1 | precisa melhorar (o "ruim" começa em 0,25) |
| INP     | 77 ms |       200 ms | bom                                        |
| FCP     | 2,5 s |        1,8 s | precisa melhorar                           |
| TTFB    | 1,9 s |        0,8 s | ruim                                       |

Laboratório (Lighthouse, Moto G Power em 4G lento): desempenho 76, LCP 5,4 s, TBT 160 ms,
CLS 0; acessibilidade 100, SEO 100, práticas recomendadas 92. Sugestões: 144 KiB de
JavaScript sem uso, 2,1 s de trabalho na thread principal.

**Leitura.** O CLS de campo (0,23) não aparece no laboratório (0), que não aceita cookies nem
recebe anúncio. A causa mais provável são os anúncios: a reserva de espaço do kit cresce
quando o criativo é maior que ela (decisão de não cortar anúncio,
[DECISIONS §7.23](./DECISIONS.md)), empurrando o texto. É hipótese: confirmar com os eventos
`CLS` por template que `/api/vitals` já registra nos logs. O TTFB de 1,9 s vem das páginas
que não ficam em cache (§4.3) e dos redirecionamentos de entrada (§4.4).

### 4.3 Médio — páginas e sitemaps sem cache

- `/tag/*`, `/autor/*` e `/page/N` respondem `private, no-store` (`cf BYPASS`), TTFB de
  1 a 2,3 s; `/page/2` também não tem JSON-LD.
- Os sitemaps de matérias (`/sitemap/articles-1…9.xml`) levam 3,8 a 5,8 s, sem cache no Next
  nem na Cloudflare, apesar do `s-maxage=3600`. Cada leitura do Googlebot consulta o Kal El.

### 4.4 Médio — redirecionamentos

| Caso                                | Antes                               | Agora                                            |
| ----------------------------------- | ----------------------------------- | ------------------------------------------------ |
| `http://www.maquinanerd.com.br/`    | **302** para o https                | igual — é do Traefik/Cloudflare, não do app (§5) |
| `http://maquinanerd.com.br/<post>/` | 302 → 301 → 308 → 200 (3 saltos)    | igual (§5)                                       |
| `/category/filmes/`                 | `/filmes` → `/cinema` (2 saltos)    | `/cinema` em 1 salto                             |
| `/<post>/amp/`                      | `/<post>/amp` → **404**             | matéria em 1 salto                               |
| `/sitemap/categories.xml`           | listava `/filmes` e `/series` (301) | só endereços finais                              |
| `/?p=<id>`                          | 301 para a home (soft 404)          | igual — falta o mapa de ids (§5)                 |

O que está certo: 10 de 10 permalinks do WordPress chegam à matéria certa (9 em um salto);
`/feed/`, `/author/x/`, `/tag/x/`, `/page/2/`, `/category/games/` e `/wp-content/uploads/…`
em um salto; o domínio sem `www` vai ao `www` em um salto.

### 4.5 Médio — os 844 endereços 404

São permalinks antigos que não existem no Kal El (exemplos:
`/batman-knightfall-part-1-upgrade-bane/`, `/jason-statham-shelter-critica-rotten-tomatoes/`,
`/ick-filme-prime-video-trilha-sonora/`) e páginas de demonstração do tema do WordPress
(`/shortcodes/twitter-feed/`, `/content-formatting/styled-lists/`,
`/integer-maecenas-eget-viverra/`). A busca do site não acha essas matérias: ficaram fora da
importação ou foram apagadas antes. Eram ~600 antes da virada. 404 para conteúdo que não
existe é correto; os do tema poderiam ser 410.

### 4.6 Baixo

- **Títulos longos**: 74 a 78 caracteres com o " | Máquina Nerd" nas matérias recentes (até
  101 no acervo). O Google mostra ~60; o resto é cortado ou reescrito por ele.
- **Descrição das editorias genérica**: "Tudo sobre Cinema no Máquina Nerd." (34–39 caracteres,
  `app/[categoria]/view.tsx`).
- **Endereços com maiúscula** (`…-da-Netflix`): respondem 200 com canônica em minúsculas; o
  Google lista 99 como "página alternativa". Funciona, mas um 301 para minúsculas consolidaria.
- **Página 404**: sai no esqueleto de erro do Next (sem `lang`, sem `h1`), com canônica para a
  home e duas metas `robots`. O status 404 está certo.
- **robots.txt**: a Cloudflare acrescenta o próprio bloco `User-agent: *`
  (`Content-Signal: search=yes,ai-train=no`) e bloqueia robôs de treino de IA (GPTBot,
  ClaudeBot, Google-Extended, CCBot, Applebot-Extended, meta-externalagent) e também
  Baiduspider e PetalBot. Bloquear Google-Extended não afeta a Pesquisa nem os AI Overviews.
  OAI-SearchBot, ChatGPT-User e PerplexityBot passam.
- **Imagens**: uma capa com `alt` vazio (`/cinema/melhores-filmes-netflix-fim-de-semana-4`); no
  acervo, o título repetido como `alt` de todas as imagens do corpo.
- **Uma matéria importada saía sem descrição** (`/cinema/superman-2025-todos-os-21-personagens…`)
  — corrigido neste PR: sem resumo, a descrição vem do primeiro parágrafo.
- Feed sem imagens; logo do JSON-LD sem dimensões; índice de sitemaps sem `lastmod`.

### 4.7 O que está certo

| Item                 | Evidência                                                                                             |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| HTTPS, HSTS, CSP     | HSTS de 2 anos com `preload`; CSP presente                                                            |
| Canônicas            | 21 de 21 páginas 200 da amostra apontam para si mesmas                                                |
| Sitemap de matérias  | 43.289 URLs em 9 arquivos; amostra de 16 sem `noindex` nem redirecionamento; `lastmod` do dia         |
| `news-sitemap.xml`   | 83 itens, todos das últimas 48 h, formato do Google Notícias válido                                   |
| Home                 | `x-nextjs-cache: HIT`; a matéria do topo é a primeira do sitemap de notícias                          |
| Páginas indexáveis   | 1 `h1`, `lang="pt-BR"`, `max-image-preview:large`, `twitter:card` grande                              |
| JSON-LD das matérias | `NewsArticle` com título, datas, autor com URL, editora, imagens 1200 px (16:9, 4:3, 1:1), breadcrumb |
| Busca e 404          | `/busca` com `noindex, follow`; URL inexistente responde 404 de verdade                               |
| Links internos       | 44 de 44 verificados respondem 200                                                                    |

---

## 5. Plano de ação

| #   | Prioridade | O quê                                                                                              | Onde               | Estado        |
| --- | ---------- | -------------------------------------------------------------------------------------------------- | ------------------ | ------------- |
| 1   | P0         | Destravar e blindar a fila das capas                                                               | código             | **neste PR**  |
| 2   | P0         | Google Analytics 4 atrás do consentimento                                                          | código + Coolify   | **neste PR**  |
| 3   | P0         | Sitemap só com URLs finais; `/category/` e `/amp/` em um salto; descrição nunca vazia              | código             | **neste PR**  |
| 4   | P1         | "Sempre usar HTTPS" na Cloudflare: `http://` vira 301 na borda, sem o 302 e sem a cadeia           | painel Cloudflare  | aguarda OK    |
| 5   | P1         | Retenção de eventos do GA4 de 2 para 14 meses                                                      | painel GA4         | aguarda OK    |
| 6   | P1         | Medir de onde vem o CLS (logs de `/api/vitals` por template) e reservar a altura real dos anúncios | código             | próximo passo |
| 7   | P1         | Cache para `/tag/*`, `/autor/*`, `/page/N` e sitemaps de matérias (TTFB 1–6 s)                     | código             | próximo passo |
| 8   | P2         | Matérias de estreia com "onde e quando assistir" no título e no primeiro parágrafo (§3.2)          | redação / MN-Prime | recomendação  |
| 9   | P2         | Título de SEO até ~60 caracteres (o campo `seoTitle` do Kal El já existe)                          | MN-Prime           | recomendação  |
| 10  | P2         | `?p=<id>` para a matéria certa, pelo id do WordPress que o Kal El guarda                           | código             | backlog       |
| 11  | P2         | 410 para as páginas-demo do tema; 301 de maiúsculas para minúsculas; 404 com o layout do site      | código             | backlog       |
| 12  | P2         | Descrições das editorias escritas pela redação                                                     | código / redação   | backlog       |

**O que acompanhar a partir do deploy:** cliques semanais no Search Console (a referência é
657); a primeira impressão no Discover; o relatório de Core Web Vitals; no GA4, a proporção
de visitas orgânicas sobre o total e as páginas de entrada.

---

## 6. O que não foi verificado

- **Causa raiz exata da trava** das capas: sem os logs do contêiner (o token do MCP do
  Coolify não tem `read:sensitive`), não dá para dizer se travou o download ou o desenho. A
  correção cobre os dois e passa a registrar `media.variant-timeout` e `media.queue-full`.
- **Desde quando as capas falhavam**: idem; o contêiner estava no ar desde 01/10.
- **PageSpeed de uma matéria** e o detalhamento do LCP: a cota pública da API estava esgotada
  e a página do PageSpeed travou no navegador antes do detalhe.
- **Se o WordPress usava AMP**: o redirecionamento de `/amp/` foi feito mesmo assim, porque não
  custa nada e nenhuma rota do site novo vive nesse formato.
- **Página renderizada com JavaScript**: a varredura leu o HTML do servidor; a amostra foi de
  algumas dezenas de URLs, não das 43 mil.
- **Número real de visitas**: o GA4 só começa a contar depois do deploy, e só quem aceitar.
