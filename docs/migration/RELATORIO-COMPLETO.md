# Máquina Nerd — relatório completo e auditoria

Documento único, escrito para ser lido sem contexto prévio. Todo número aqui saiu de um
comando executado nesta máquina; o que não pôde ser verificado está nomeado como pendência
em vez de marcado como feito.

- **Repositório:** [maquinanerd/MN_Next](https://github.com/maquinanerd/MN_Next)
- **Branch:** `chore/maquina-nerd-kalel-migration` — 15 commits, empurrada
- **Estado:** pronto para staging. **Não** foi feito deploy, mudança de DNS, escrita no
  WordPress nem execução contra o Kal El de produção.
- **Ambiente da verificação:** Windows 11, Node 24.19.0, pnpm 11.15.1, Next 15.5.4,
  React 19

---

## 1. O que é

Um portal de cultura pop que rodava em WordPress foi reescrito em **Next.js 15 (App
Router)**, servido em runtime pelo CMS **Kal El**. O WordPress deixou de ser dependência:
virou **origem de importação**, lida uma vez e nunca consultada em produção.

O front reproduz sete protótipos aprovados (`*.dc.html`) que são a fonte visual canônica —
não uma releitura. Os dois ZIPs originais são imutáveis e seus hashes SHA-256 foram
reconferidos ao fim de cada wave: **batem byte a byte**.

| Camada     | O que existe                                                                  |
| ---------- | ----------------------------------------------------------------------------- |
| Front      | 31 rotas, 34 arquivos de componente, 4 pacotes internos, temas claro e escuro |
| Conteúdo   | `ContentRepository` com duas implementações — Kal El e fixture                |
| Integração | Cliente tipado, DTOs validados em runtime, cache por tag, preview assinado    |
| Migração   | Importador idempotente com **duas origens**, redirects, verificador de URLs   |
| SEO        | Metadata, JSON-LD, sitemaps paginados, news sitemap, RSS                      |
| Segurança  | HMAC de webhook, anti-replay, fronteira cliente/servidor, CSP, guardas SSRF   |
| Testes     | 320 no Node + 514 no browser = **834 verificações**                           |
| Operação   | CI em 5 jobs, runbook, orçamento de performance, 8 documentos de migração     |

---

## 2. Números do repositório

| Área                   | Arquivos |     Linhas |
| ---------------------- | -------: | ---------: |
| `app/`                 |       38 |      3.509 |
| `components/`          |        3 |        155 |
| `lib/`                 |        8 |        506 |
| `packages/content/src` |       21 |      4.958 |
| `packages/ui/src`      |       36 |      6.497 |
| `packages/seo/src`     |        5 |        538 |
| `packages/tokens/src`  |        2 |        294 |
| `scripts/`             |       16 |      4.391 |
| `tests/`               |       30 |      5.924 |
| **Total**              |  **159** | **26.772** |

**Dependências de runtime: nove.** `next`, `react`, `react-dom`, `zod`, `server-only` e os
quatro pacotes internos. Os quatro pacotes internos não têm nenhuma dependência externa —
`@mn/ui` não puxa biblioteca de componentes, `@mn/seo` não puxa gerador de JSON-LD,
`@mn/content` não puxa cliente HTTP.

---

## 3. Arquitetura

```
app/                  rotas do App Router — o mapa de URLs
components/           os poucos client components que existem
lib/                  cola de servidor: repo(), logger, redirects, legacy-permalink
packages/
  tokens/             variáveis CSS: cor, tipografia, espaço, sombra
  ui/                 componentes de apresentação, sem I/O
  content/            domínio, repositório, adaptador Kal El, fixtures, sanitização
  seo/                metadata, JSON-LD, canonical
scripts/wp/           migração WordPress → Kal El
tests/                unit, contract, integration, security, e2e, kalel
```

**RSC por padrão.** Componente de cliente só onde há estado de interação: alternador de
tema, menu móvel, fachada de embed, enquete, barra de compartilhamento. A fronteira é
mecânica, não convencional — `packages/content` importa `server-only`, então qualquer
tentativa de puxar o repositório para um bundle de cliente quebra o build em vez de vazar
um token.

**TypeScript estrito** com `noUncheckedIndexedAccess`, sem `any` em lugar nenhum.
**Validação de runtime com Zod** em toda fronteira: resposta do CMS, corpo de webhook,
parâmetro de rota, variável de ambiente.

---

## 4. As rotas

19 páginas e 12 handlers.

| Rota                                                                                                   | O que serve                                              | Cache      |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- | ---------- |
| `/`                                                                                                    | home editorial                                           | ISR 60 s   |
| `/[categoria]`                                                                                         | editoria **+ resolvedor de URL legada**                  | ISR 120 s  |
| `/[categoria]/page/[n]`                                                                                | paginação com canonical próprio                          | ISR 120 s  |
| `/[categoria]/[slug]`                                                                                  | artigo — 5 templates                                     | ISR 300 s  |
| `/especiais`, `/especiais/[franquia]`                                                                  | índice e hub de franquia                                 | ISR 300 s  |
| `/especiais/[franquia]/[dossie]`                                                                       | dossiê                                                   | ISR 300 s  |
| `/ao-vivo/[evento]`                                                                                    | cobertura ao vivo — casca estática, entradas por polling | ISR 120 s  |
| `/reviews`, `/ofertas`                                                                                 | índices comerciais                                       | ISR 300 s  |
| `/ofertas/[campanha]`                                                                                  | landing de campanha                                      | ISR 300 s  |
| `/autor/[slug]`, `/tag/[slug]`                                                                         | arquivos                                                 | ISR 300 s  |
| `/busca`                                                                                               | busca                                                    | `no-store` |
| `/preview/[slug]`                                                                                      | rascunho, com sessão presa ao slug                       | dinâmica   |
| `/newsletter`, `/sobre`, `/publicidade`, `/politica-de-privacidade`                                    | institucionais                                           | estáticas  |
| `/feed.xml`, `/sitemap.xml`, `/sitemap/[kind]`, `/news-sitemap.xml`, `/robots.txt`                     | descoberta                                               | ISR 1 h    |
| `/media/[id]`                                                                                          | proxy autenticado de mídia                               | imutável   |
| `/api/health`, `/api/revalidate`, `/api/preview`, `/api/newsletter`, `/api/vitals`, `/api/live/[slug]` | operação                                                 | —          |

Mais `error.tsx`, `global-error.tsx` e `not-found.tsx` — o global existe porque `error.tsx`
não cobre falha do layout raiz.

**Sub-editorias são tags, nunca segmentos de rota.** As seis editorias reais são `filmes`,
`series`, `quadrinhos`, `games`, `animes` e `reviews`. Isso não é estilo: é a regra que
decide o que acontece com as 8.619 categorias do WordPress (§7.4).

---

## 5. A camada de conteúdo

`ContentRepository` é uma interface de 20 métodos moldada pelas **URLs do site**, não pelo
CMS: uma página pede "o artigo em /series/resident-evil", nunca "artigo por uuid com estes
joins". Duas implementações a satisfazem — `KalElContentRepository` e
`FixtureContentRepository` —, e trocar de CMS é escrever uma terceira.

Corpo de artigo é `ContentBlock[]` tipado e sanitizado. **Nunca HTML bruto do CMS.** O
sanitizador tem lista branca de tags e de atributos, e valida toda URL de `href` e `src`:
esquema fora da lista, `//host`, caractere de controle e barra invertida são recusados.

O provider é escolhido por `CONTENT_SOURCE`, com duas travas independentes contra servir
fixtures a leitores: a validação de ambiente recusa `fixture` quando `APP_ENV` é
`production` **ou** `staging`, e um teste estático prova que nenhum módulo de cliente
alcança o repositório.

---

## 6. A integração com o Kal El

O CMS estava aberto no workspace como pasta irmã — **fora** do repositório do portal, e
assim permaneceu. Foi lido para descobrir o contrato real em vez de presumi-lo.

### 6.1 O que a leitura revelou

- **Não existe API pública de entrega.** Toda leitura é autenticada server-to-server com
  token opaco `ke_st.` e escopos RBAC. O portal nunca fala com o CMS a partir do browser.
- **Duas paginações na mesma API.** Artigos paginam por **cursor** (máx. 100); mídia pagina
  por **offset** com `total` (máx. 200). O adaptador implementa as duas — presumir uma só
  teria feito o índice de mídia parar nos primeiros 200 itens.
- **Envelope `{ data }`** em todas as respostas, com `{ error: { code, message } }` no
  caminho de erro.
- **Não existe busca por slug.** A rota de artigo recebe um slug; o CMS só sabia buscar por
  id.

### 6.2 A única mudança feita no CMS

Filtro `?slug=` em `GET /v1/sites/:siteId/articles` — três linhas de lógica, mais schema e
OpenAPI. Branch e commit próprios **no repositório do Kal El**
(`feat/article-slug-filter`, `83ad1e8`), com teste próprio (5 casos, verdes contra
PostgreSQL real). **Commitada, não empurrada.**

O adaptador continua correto sem ela: o resultado filtrado é sempre reconferido contra o
slug pedido, e uma divergência cai na varredura completa do índice.

### 6.3 O que não foi mudado, e a consequência

Comercial (oferta, preço, nota), especiais/dossiês e eventos ao vivo **não têm modelo** no
Kal El. Poderiam ter sido acrescentados; não foram, porque cada um exige migração de banco
e decisão de produto — o oposto de "mudança mínima indispensável".

**Consequência declarada:** BuyBox, selo "Oferecido por", nota de review e tarja de
condições **não renderizam** para conteúdo autorado no Kal El. Não é degradação silenciosa
— o componente não desenha o que não recebe, e isso está em `KAL-EL-DISCOVERY.md`.

### 6.4 Verificação sem credenciais

`tests/fake-kalel/` é um CMS **fiel ao contrato**: valida cada resposta contra os schemas
da própria aplicação antes de enviar. O corpus é dimensionado para que nenhum dos dois
modelos de paginação possa ser pulado — **140 artigos** (o cursor pede 100 por vez) e **260
mídias** (o offset pede 200). Nos tamanhos originais, 40 e 24, um provider que lesse só a
primeira página teria passado em tudo.

`pnpm test:kalel` sobe a aplicação em `CONTENT_SOURCE=kalel` apontada para ele: **29 testes
de browser** contra o caminho de conteúdo real — DTOs, mapper, hidratação de taxonomia,
divisão cursor/offset, proxy de mídia, preview.

---

## 7. Auditoria do arquivo WordPress

Esta é a seção mais nova e a que mais mudou o código. O backup foi entregue em
09/09/2026 e a migração deixou de ser um plano.

### 7.1 O que o arquivo contém

`127_0_0_1.sql` — 1,66 GB, dump phpMyAdmin de 21/08/2026, banco `maquinanerd`, prefixo
`wp_`, `utf8mb4`. Não é amostra: é o site inteiro.

| Item                   |              Quantidade |
| ---------------------- | ----------------------: |
| Posts publicados       |              **41.318** |
| Período                | 03/01/2018 → 21/08/2026 |
| Anexos                 |              **73.173** |
| Revisões               |                  22.427 |
| Páginas                |                      73 |
| Rascunhos              |                      69 |
| Posts na lixeira       |                      10 |
| Categorias             |               **8.619** |
| Tags                   |              **36.438** |
| Autores                |                       6 |
| Tamanho médio do corpo |                  4,6 KB |

Tipos de anexo: 69.483 JPEG, 1.956 PNG, 1.683 WebP, 27 AVIF, 13 GIF, **7 SVG**, 3
`text/plain`, 1 MP4. Os SVG são recusados pela lista branca de tipos — um SVG de um arquivo
de dez anos é conteúdo ativo, não imagem.

Formato do conteúdo: **21.594 Gutenberg**, **18.786 clássico**, 938 clássico com
colchetes. Blocos Gutenberg contados na renderização: 187.521 parágrafos, 62.601 títulos,
34.376 imagens, 3.705 listas, 757 citações, 86 galerias, 40 shortcodes, 34 embeds, 3
`nextpage`, 1 `html`.

Configuração relevante: `permalink_structure` = `/%postname%/`, `gmt_offset` = -3, plugin
`no-category-base-wpml` ativo, SEO pelo Yoast Premium.

### 7.2 Como o arquivo é lido

`scripts/wp/archive.ts` lê o dump **direto**, sem restaurar banco nenhum e **sem abrir
nenhuma conexão de rede**. Implementa `WpReadSource` — a mesma interface da REST, agora um
tipo que o compilador verifica —, então `import.ts` e `build-redirects.ts` não sabem qual
das duas origens receberam.

Aceita `.sql` e `.sql.gz`, nos dois dialetos: phpMyAdmin nomeia as colunas no `INSERT` e
põe uma tupla por linha; `mysqldump` não nomeia nenhuma e põe o insert inteiro numa linha
só. Um leitor escrito contra um só lê o outro como banco vazio e reporta uma importação
limpa de nada. Os dois estão testados um contra o outro por igualdade.

A execução completa sobre os 41.318 posts leva ~3 minutos e **cabe em 1 GB de heap**
(medido com `--max-old-space-size=1024`).

### 7.3 Os onze defeitos que só o corpus real expôs

O importador já tinha sido executado ponta a ponta contra stand-ins. Contra o arquivo de
verdade, apareceu isto — e a maioria era invisível por construção em qualquer corpus
sintético, porque um corpus sintético é escrito por quem escreveu o parser.

|   # | Achado                                         | Escala                     | O que era                                                                                                                                                                                                                                                                                                 |
| --: | ---------------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|   1 | **45% do arquivo não tem `<p>`**               | 18.786 posts               | A REST devolve conteúdo renderizado; o banco tem conteúdo cru. O parser casa tags de bloco e ignora o resto, então esses artigos importariam com as figuras e **nenhuma palavra do texto** — e o relatório contaria 41.318 sucessos. `wpautop` portado do WordPress, na ordem original das substituições. |
|   2 | **`categories[0]` não é a editoria**           | 32.858 de 41.318           | O WordPress ordena por term id, então a primeira categoria costuma ser a mais antiga que o post recebeu — `noticias` na maioria. `build-redirects.ts` usava exatamente isso e mandaria quatro em cada cinco redirects para uma seção inexistente.                                                         |
|   3 | **8.619 categorias para 6 editorias**          | 8.613 rebaixadas           | Importar uma a uma criaria 8.613 segmentos de rota que nenhum template tem.                                                                                                                                                                                                                               |
|   4 | **A tabela de redirects não cabe no edge**     | 5,06 MB / 206.590 entradas | `middleware.ts` importa o JSON e roda a cada requisição.                                                                                                                                                                                                                                                  |
|   5 | **Colchetes de prosa apagados como shortcode** | ~1.700 trechos             | `[risos]`, `[a presidente da Lucasfilm]`, `[SPOILER]` — o WordPress imprime esses literalmente.                                                                                                                                                                                                           |
|   6 | **68% das imagens de corpo não são nossas**    | 44.304 + 14.445            | Hotlink de outros veículos e URLs corrompidas na origem.                                                                                                                                                                                                                                                  |
|   7 | **`guid` aponta para um host morto**           | 73.173 anexos              | `http://13.48.147.139`, uma máquina AWS que não serve o site há anos.                                                                                                                                                                                                                                     |
|   8 | **Colisão de slug**                            | 3 posts                    | `slugify` corta em 120 caracteres e as manchetes chegam lá.                                                                                                                                                                                                                                               |
|   9 | **Slug com escape percent**                    | 5 posts                    | `%e0%aa%85` virava `e0-aa-85` na URL definitiva.                                                                                                                                                                                                                                                          |
|  10 | **Vídeos perdidos na sanitização**             | 454 iframes + 302 figuras  | Embeds de YouTube e X descartados junto com o iframe.                                                                                                                                                                                                                                                     |
|  11 | **`/embed/ID` quebrava o player**              | —                          | `frameSrc` lia o caminho inteiro como id do vídeo.                                                                                                                                                                                                                                                        |

### 7.4 A regra de taxonomia

Uma categoria do WordPress vira **editoria** se o slug for uma das seis; caso contrário
vira **tag**. Nada é descartado: `noticias`, em 32.781 posts, vira tag e continua em todos
eles.

As maiores categorias do arquivo:

| Categoria   |  Posts | Vira     |
| ----------- | -----: | -------- |
| `noticias`  | 32.781 | tag      |
| `filmes`    | 19.845 | editoria |
| `series`    | 16.108 | editoria |
| `games`     |  5.136 | editoria |
| `cinema`    |  3.984 | tag      |
| `series-3`  |  3.847 | tag      |
| `franquias` |  3.177 | tag      |
| `netflix`   |  2.362 | tag      |

Resolução da editoria por post:

| Situação       |  Posts | Tratamento                                                       |
| -------------- | -----: | ---------------------------------------------------------------- |
| Exatamente uma | 41.020 | direto                                                           |
| Duas           |    190 | precedência `reviews, animes, quadrinhos, games, series, filmes` |
| Nenhuma        |    298 | **falha a execução**                                             |

Distribuição final: filmes 19.845, series 16.014, games 5.088, quadrinhos 49, reviews 24,
animes 0.

**Os 298 sem editoria falham em vez de importar.** O portal remove um artigo sem editoria
de toda listagem e do sitemap — importá-lo produziria algo que existe no CMS e não pode ser
encontrado no site, que é a falha que mais se parece com sucesso. O ensaio escreve
`unmapped-categories.json` com as 101 categorias responsáveis e quantos posts cada uma
resgataria; preenchido, vira `--category-map`. `noticias` sozinha responde por 222.

### 7.5 As imagens

87.771 tags `<img>` no corpo dos artigos:

| Origem                      | Quantidade | Destino         |
| --------------------------- | ---------: | --------------- |
| Biblioteca de mídia do site |     28.140 | importada       |
| Hotlink de terceiros        | **44.304** | não baixada     |
| URL corrompida na origem    | **14.445** | não recuperável |
| `src` vazio                 |         13 | —               |

Os 61 domínios de terceiros, no topo: `static0.srcdn.com` (ScreenRant) 28.050,
`static0.thegamerimages.com` 4.805, `static0.moviewebimages.com` 3.173,
`static0.gamerantimages.com` 2.380, `variety.com` 2.105, `comicbook.com` 1.221,
`static0.colliderimages.com` 957, `www.hollywoodreporter.com` 897.

**O importador não baixa nenhuma.** Tecnicamente, uma imagem sem `mediaId` não vira nó de
documento no Kal El. Juridicamente — e é o que decide — baixá-las converteria _hotlink_ em
_hospedagem_, que é uma exposição materialmente maior. É decisão do operador, não de
engenharia, e por isso o relatório quebra o número **por domínio** em vez de somar tudo num
`image:unresolved` opaco que misturava uma questão de licenciamento com um bug de
mapeamento. O bug de mapeamento de verdade são **466** imagens do próprio domínio que não
casaram.

As URLs corrompidas têm espaços e quebras de linha dentro do host e do caminho —
`https://lumiere-a. akamaihd.\n\nnet/v1/images/image_49e88d01. jpeg. region=…`. Não são
recuperáveis: reverter "espaço depois do ponto" é ambíguo porque o `?` da query também
virou `. `. Adivinhar produziria URLs inventadas.

**As capas não são afetadas** — vêm de `_thumbnail_id`, que aponta para a biblioteca. 40.663
dos 41.318 posts têm uma. **52.434 imagens chegam sem texto alternativo**: mutirão
editorial, não bloqueio técnico.

### 7.6 O que o ensaio produz

```bash
WP_ARCHIVE_DUMP='…/127_0_0_1.sql' pnpm wp:import --source archive
```

```
read 41318 · skipped 41020 · failed 298 · categoriesAsTags 8613 · noDesk 298 · slugCollision 3
```

Três artefatos em `artifacts/migration/` (fora do git): `import-report.json` com as
contagens e o inventário por tipo, `unknown-blocks.ndjson` com amostras do que o parser não
soube representar, e `unmapped-categories.json`.

**Nada foi escrito em lugar nenhum.** Sem `--apply` o cliente do Kal El nem é construído —
não existe caminho de código de um ensaio até um POST.

### 7.7 Propriedades do importador

- **Idempotência** — `externalKey` mais uma idempotency key derivada da entidade de origem
  fazem a segunda execução _atualizar_, nunca duplicar. Provado executando o CLI real duas
  vezes como subprocesso: a segunda passada reporta `created: 0`.
- **Reconciliação** — a atualização manda todos os campos que a migração possui, então uma
  primeira execução defeituosa pode ser reparada rodando de novo.
- **Respeito editorial** — artigo editado no CMS depois de importado é deixado em paz. O
  state file guarda a versão que a importação escreveu; se o Kal El estiver em outra, a
  mudança não é nossa para sobrescrever. A execução termina com código 1 e nomeia o artigo.
- **Rede fechada** — na origem REST, assets só de hosts declarados, hostname resolvido a
  cada hop, endereço privado reprova, corpo lido incrementalmente e cancelado no limite. Na
  origem arquivo, **não há rede**.
- **Contabilidade honesta** — tudo que o parser não representa é contado com amostra do
  trecho. Uma migração que perde conteúdo em silêncio parece uma migração limpa.

---

## 8. URLs, redirects e SEO

### 8.1 O problema que o arquivo revelou

`permalink_structure` é `/%postname%/` e `no-category-base-wpml` estava ativo. Ou seja: os
41.318 artigos **e** os 8.619 arquivos de categoria estão indexados em `/{slug}`, num único
espaço de nomes na raiz. Todos caem em `/[categoria]`.

Escrever isso como tabela não funciona: uma entrada por artigo são **5,06 MB de JSON**
dentro do bundle do `middleware.ts`, que roda no edge a cada requisição — acima do limite
de tamanho e reparseado a cada cold start, para codificar uma regra sem exceções.

### 8.2 A solução

A regra virou **resolução**, em `lib/legacy-permalink.ts`: `/[categoria]` procura o segmento
desconhecido no CMS — artigo primeiro, tag depois — e responde **308** para o endereço
real. `cache()` do React garante uma consulta só, porque `generateMetadata` e a página
correm juntas. Todo destino passa por `safeInternalPath`, porque é montado com dois campos
vindos do CMS.

> 308 e não 301: o Next não tem 301, `permanentRedirect()` é 308. Para um buscador são
> equivalentes; a diferença é preservar o método da requisição, inerte num caminho que só
> responde GET. O status está fixado em teste.

A tabela continua existindo para o que é exceção de verdade — redirects cadastrados no Kal
El, o CSV do operador, e os posts cujo slug muda ao passar por `slugify`. Sobre o arquivo
real: **17 entradas**, contra 41.003 posts cobertos pela regra.

### 8.3 O resto do mapa legado

Regras no middleware, sem tabela: feeds (`/feed`, `/rss`, `/{x}/feed`), sitemaps antigos,
`/categoria/{x}` e `/category/{x}`, `/author/{x}`, `?p=`, permalinks com data. E **410** —
não 404 — para `/wp-json`, `/xmlrpc.php`, `/wp-admin`, `/wp-login.php`: são endpoints
removidos, não páginas que faltam.

### 8.4 SEO

Metadata por template, canonical em toda página (inclusive **página 2 apontando para si
mesma**, porque apontar para a página 1 é como um arquivo desaparece da busca), Open Graph,
JSON-LD com um `@graph` por página (`NewsArticle`, `BreadcrumbList`, `Organization`,
`WebSite`), sitemap **index que enumera todos os arquivos filhos**, news sitemap e RSS.

Do Yoast, o arquivo trouxe: `_yoast_wpseo_meta-robots-noindex` presente em 39.038 posts
**sempre com o valor `2`**, que no Yoast significa _index_ — nenhum post está noindexado, e
não há nada a carregar. **3.215 canonicals customizados** existem e são pendência de
migração.

---

## 9. Fidelidade visual

A auditoria faz duas coisas diferentes, e a distinção importa:

1. **Baseline visual** — 160 PNGs versionados. Provam que nada _regride_. Não provam
   fidelidade: uma baseline só concorda consigo mesma.
2. **Comparação humana lado a lado** — protótipo e rota abertos no mesmo viewport,
   percorridos elemento a elemento. É isso que prova fidelidade, e é isso que encontrou as
   oito divergências abaixo.

### 9.1 As oito divergências encontradas e corrigidas

1. **A home omitia três módulos inteiros** — faixa promocional full-bleed, feature
   assimétrico 700/520 e cauda densa com miniatura de 96px. Sem eles a home lia como
   wireframe: um jornal ganha ritmo do _contraste_, e substituir tudo por uma grade de três
   colunas achata exatamente isso.
2. **O herói da home tinha três desvios** de composição.
3. **O hub de franquia abria como artigo, não como lugar** — faltava a faixa full-bleed com
   abas irmãs e o painel 2×2 de números.
4. **A editoria não tinha o par de números do cabeçalho.**
5. **Os cinco templates de artigo estavam num arquivo só, e quatro nunca tinham sido
   olhados** — vídeo, lista, urgente e longform. O template de vídeo não tinha faixa de
   tinta; o de lista não tinha o índice "Nesta lista" nem os numerais.
6. **As quatro telas comerciais** — a de review **nunca renderizava a BuyBox**: as ofertas
   chegavam à página inteiras e eram descartadas, no único template cuja razão de existir é
   responder "compro ou não". O comparativo saía com o preço em vermelho sublinhado sobre
   verde (~2:1) porque a regra de link de prosa vence `.mn-cta` na especificidade —
   `:where()` não conta. O publieditorial não tinha o selo "Oferecido por". A landing abria
   com uma barra preta em vez da faixa de campanha.
7. **As capas eram gradientes** — corrigido com as 15 fotografias que os protótipos
   referenciam, baixadas do WordPress do próprio operador.
8. **Dossiê e ao vivo dependem de modelo que o CMS não tem** — declarado, não simulado.

### 9.2 Divergências deliberadas, mantidas

`NetworkBar` (não existe nos protótipos, exigida pela rede), busca e tema no cabeçalho
(o protótipo tem só um ícone), corpo em 16px/1.78, e dois tons alterados por contraste
(§10).

### 9.3 O que ainda não foi percorrido

Os viewports **768 e 1024** fora da baseline, e o **contador regressivo** e a **grade de
ofertas** da landing sazonal. Os dois últimos exigem dado que o domínio não modela — uma
data de fim de campanha e um catálogo de produtos — e inventá-los poria um relógio falso e
preços falsos numa página comercial. Continuam cobertos por baseline e por axe, o que
garante que não regridem, não que sejam idênticos. É trabalho de revisão humana e está dito
aqui em vez de marcado como feito.

---

## 10. Acessibilidade

**axe-core em 18 superfícies × 2 temas: zero violações.** Home, editoria, os cinco
templates de artigo, especiais, comercial, ofertas, autor, tag, busca, newsletter, sobre,
privacidade, publicidade e 404.

Correções que a auditoria forçou, todas de contraste real:

- `--mn-fg2` escurecido de `#7C818A` para `#6B7078`. A especificação afirmava que o tom
  original passava AA para 16px+; **não passa** — é 3,91:1 sobre branco. O axe reprovava
  todas as páginas.
- Avatar âmbar de `#C77800` para `#8A5B00`: iniciais brancas em 11px bold davam 3,43:1.
- `--brand-solid` criado porque `--brand-ink` é o vermelho **como tipo** e vira vermelho
  claro no tema escuro — usá-lo como fundo produzia vermelho sobre vermelho, invisível e só
  no escuro.
- Escurecimento do scrim do hub de 60% para 84%: texto branco sobre capa clara dava ~1,4:1.
  **O axe não pega isso** — ele reporta texto sobre imagem como _incomplete_, nunca como
  violação.
- `aria-hidden` **não** isenta texto de contraste. Foi uma suposição minha, errada, que o
  axe derrubou com 12 violações.

Mais: piso de 11px de tipo, alvos de toque, foco visível, `prefers-reduced-motion`, skip
link como primeira parada do teclado, e um `<h1>` visualmente oculto na home porque o
protótipo usa o logo como cabeça de página — que é imagem, não título.

---

## 11. Segurança

| Superfície           | Postura                                                                                                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Token do Kal El      | Só no servidor. Teste estático prova que nenhum módulo de cliente alcança o repositório; teste de browser prova que nenhuma página o vaza                                                                     |
| Webhook              | HMAC obrigatório, comparação em tempo constante, **claim atômico de nonce** contra replay, janela derivada do `publishedAt` assinado                                                                          |
| Preview              | Token assinado, redimido contra o CMS, e um grant em cookie `HttpOnly` que **nomeia o slug autorizado** — `draftMode()` sozinho é um interruptor global e abriria qualquer rascunho adivinhado                |
| Proxy de mídia       | Só ids conhecidos, nunca URL arbitrária. Credencial jamais alcança o cabeçalho de resposta                                                                                                                    |
| Redirects            | `safeInternalPath` na construção **e** no request. `//host`, esquema, barra invertida e caractere de controle recusados                                                                                       |
| Importador (REST)    | Allowlist de host, resolução de nome a cada hop, endereço privado reprova, `redirect: 'manual'`, corpo lido incrementalmente e cancelado no limite, tipo derivado dos **magic bytes** e não do `Content-Type` |
| Importador (arquivo) | **Nenhuma rede.** Path traversal recusado por `path.resolve` mais checagem de prefixo                                                                                                                         |
| Ambiente             | Boot falha de forma legível se faltar variável em produção **ou staging**, inclusive `TRUST_PROXY`, que precisa ser respondida explicitamente                                                                 |
| CSP                  | Estrita onde dá, com a limitação declarada em `DECISIONS §5.1` em vez de escondida                                                                                                                            |
| CI                   | Job dedicado que recusa caminho proibido e token de serviço hard-coded                                                                                                                                        |

### Guarda de ensaio local

`--allow-private-assets` existe para um ensaio inteiramente local e **só é aceito quando
todos os endpoints são loopback** — as duas URLs base e cada entrada de `WP_ASSET_HOSTS`.
Loopback, não meramente "privado": um Kal El em 10.0.0.5 é um CMS real numa rede interna, e
deixar a flag passar ali desligaria a guarda exatamente onde ela protege algo.

---

## 12. Performance

| Métrica                                          |     Medido | Orçamento |
| ------------------------------------------------ | ---------: | --------: |
| JS de primeira carga (compartilhado, comprimido) | **109 KB** |    120 KB |
| CSS (comprimido)                                 |  **18 KB** |     25 KB |

Medido sobre o bundle produzido, não por Lighthouse: tamanho de bundle é determinístico e é
o número que regride em silêncio. Lighthouse contra staging continua no checklist de
pré-lançamento, onde um LCP real pode ser medido.

Embeds atrás de fachada de clique — um iframe do YouTube custa ~1 MB e um embed do X
executa script de terceiro; nenhum roda na primeira pintura, e nenhum cookie de terceiro é
posto antes do consentimento. Todo slot de anúncio reserva espaço com `min-height`
obrigatório. Imagens com dimensão declarada.

---

## 13. Testes e gates — resultados reais

| Gate              | Comando                           | Resultado                                      |
| ----------------- | --------------------------------- | ---------------------------------------------- |
| Formatação        | `pnpm format:check`               | ✅ _All matched files use Prettier code style_ |
| Lint              | `pnpm lint`                       | ✅ 0 problemas                                 |
| Tipos             | `pnpm typecheck`                  | ✅ 0 erros                                     |
| Unit              | `pnpm test:unit`                  | ✅ **140**                                     |
| Contrato          | `pnpm test:contract`              | ✅ **56**                                      |
| Integração        | `pnpm test:integration`           | ✅ **82**                                      |
| Segurança         | `pnpm test:security`              | ✅ **42**                                      |
| Entrega Kal El    | `pnpm test:kalel`                 | ✅ **29**                                      |
| Playwright        | `npx playwright test`             | ✅ **485**, 3 pulados                          |
| Build             | `pnpm build`                      | ✅ compila                                     |
| Performance       | `pnpm test:performance`           | ✅ 109 KB / 18 KB                              |
| Arquivo WordPress | `pnpm wp:import --source archive` | ✅ 41.318 posts, nada escrito                  |

**Total: 320 no Node + 485 de browser fixture + 29 de browser Kal El = 834 verificações.**

Os 485 do Playwright, por spec: 220 de comportamento de superfície, 172 visuais, 96 de
acessibilidade — em **4 viewports** (390, 768, 1024, 1440) × 2 temas.

**CI em 5 jobs:** estático e Node; browser em matriz (e2e, a11y, visual); build e
orçamento; `--help` das três ferramentas de migração; e o job que recusa caminho proibido e
segredo hard-coded.

Nenhum teste foi desabilitado, nenhuma regra de lint silenciada e nenhum `any` introduzido
para passar gate.

---

## 14. O ciclo de revisão independente

O `CLAUDE.md` exige que cada wave passe por um revisor independente antes do commit. Sete
rodadas:

| Rodada | Resultado                                              |
| ------ | ------------------------------------------------------ |
| 1      | 9 achados, 5 altos                                     |
| 2      | auto-revisão, 12 problemas                             |
| 3      | 7 achados bloqueantes                                  |
| 4      | 5 achados bloqueantes                                  |
| 5      | 2 achados bloqueantes                                  |
| 6      | **"SEM ACHADO BLOQUEANTE"**, textualmente              |
| 7      | **Codex indisponível** — revisão substituta, 3 achados |

Achados do revisor que eu não teria encontrado sozinho, e que valem citar:

- **`--allow-private-assets` aceitava 10.x**, e depois vazava por `WP_ASSET_HOSTS`. Duas
  vezes, no mesmo lugar, com a correção errada da primeira vez.
- **O scrim do hub em 60%** deixava texto em ~1,4:1 sobre capas claras — o axe não pega.
- **Os números do hub contavam uma janela do CMS**, não o total.
- **"Hoje" contava só a página atual**, lia `updatedAt` e usava o fuso do servidor.
- **Branco sobre `#E30613` é 4,0:1**, não 4,5:1.

Na rodada 7 a CLI do Codex está instalada e autenticada, mas a conta resolve para
`gpt-6-astra`, que a API recusa na versão instalada (`requires a newer version of Codex`);
quatro modelos alternativos respondem `not supported when using Codex with a ChatGPT
account`. O `CLAUDE.md` cobre o caso — não instalar, não interromper, registrar e fazer a
auditoria equivalente. Ela está em `artifacts/codex-reviews/wave-3-arquivo-inicial.md`,
com o log do erro ao lado e **identificada como não independente**. Três achados, todos
corrigidos:

- **ALTO** — o destino do 301 era montado com dois campos vindos do CMS e ia direto para
  `permanentRedirect`, sem `safeInternalPath`. Um slug começando com `/` produziria
  `//host`: redirecionador aberto com o Kal El como ponto de injeção.
- **MÉDIO** — o escudo de `<pre>` no `wpautop` casava sem `\b`, então `<prefix>` engoliria
  tudo até o próximo `</pre>`.
- **BAIXO** — `DESK_PRECEDENCE` podia divergir de `DESK_SLUGS` sem que nada reclamasse.

> Nenhuma rodada foi simulada. Onde o revisor não pôde rodar, isso está dito.

### O padrão que se repetiu

Quase todo achado grave desta migração é da mesma família: **uma afirmação verdadeira sobre
o desenho e falsa sobre o código.** O runbook prometia proteção de edição editorial que o
`If-Match` não dava. Um comentário prometia um `--wxr` que nunca existiu. A baseline
"provava" fidelidade concordando só consigo mesma. Eu supus que `aria-hidden` isentava
contraste. Nenhuma dessas foi encontrada raciocinando — todas apareceram **executando**:
rodando o importador, renderizando contra a forma real do CMS, abrindo protótipo e app lado
a lado.

---

## 15. Decisões registradas

29 escolhas feitas sem consulta, cada uma com o quê, o porquê e como reverter, em
[DECISIONS.md](./DECISIONS.md). As que mais mudam o resultado:

| #    | Decisão                                                                                                                              |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1.1  | `APP_ENV` separado de `NODE_ENV` — sem isso é impossível gerar o build em modo fixture de que a auditoria visual depende             |
| 1.3  | CSS à mão em vez de Tailwind — torna "nenhum hex de marca em UI compartilhada" mecanicamente verificável: há um arquivo para auditar |
| 3.2  | O que **não** foi mudado no Kal El, e a consequência declarada                                                                       |
| 4.4  | Artigo sem editoria não tem URL pública — por isso os 298 falham                                                                     |
| 4.5  | O permalink legado, confirmado, e por que a tabela não serve                                                                         |
| 4.6  | Duas origens: a REST e o arquivo SQL                                                                                                 |
| 4.8  | Uma categoria do WordPress é uma editoria ou é uma tag                                                                               |
| 4.9  | Colchetes no meio do texto não são shortcodes                                                                                        |
| 4.10 | Imagem de terceiro não vira imagem nossa                                                                                             |
| 5.1  | CSP estrita onde dá, e honesta onde não dá                                                                                           |

---

## 16. Pendências externas

Nenhuma é contornável por código.

|   # | Pendência                               | O que bloqueia                                    | Como resolver                                                                                                 |
| --: | --------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
|   1 | Amostra de URLs de maior tráfego        | o critério **zero 404**, bloqueante de lançamento | exportar do Search Console para `data/import/top-urls.txt` e rodar `pnpm urls:verify`                         |
|   2 | Editoria dos 298 posts sem uma          | esses artigos não têm URL pública                 | preencher `unmapped-categories.json` (222 são `noticias`) e passar em `--category-map`                        |
|   3 | Destino das 44.304 imagens de terceiros | ilustração do corpo dos artigos                   | decisão de licenciamento                                                                                      |
|   4 | `wp-content/uploads` extraído           | transferir os bytes das mídias                    | extrair o `tar.gz` de 101 GB (19 partes, verificado que os uploads estão lá) e apontar `--uploads`            |
|   5 | Credenciais do Kal El                   | rodar contra o CMS real                           | `KAL_EL_BASE_URL`, `KAL_EL_SITE_ID`, `KAL_EL_SERVICE_TOKEN`, `KAL_EL_WEBHOOK_SECRET`, `KAL_EL_PREVIEW_SECRET` |
|   6 | Modelo comercial no Kal El              | BuyBox e nota de review com conteúdo do CMS       | aceitar a proposta em `KAL-EL-DISCOVERY.md`                                                                   |
|   7 | Endpoint interno do Cinerie             | "Onde assistir" com dado real                     | `CINERIE_INTERNAL_URL`, `CINERIE_SERVICE_TOKEN`                                                               |
|   8 | Provedor de newsletter                  | inscrição real (hoje responde 501)                | `NEWSLETTER_PROVIDER_URL`                                                                                     |
|   9 | Network code do GAM                     | anúncios reais                                    | reserva de espaço já implementada                                                                             |
|  10 | CMP LGPD                                | se um CMP for exigido                             | o banner próprio atende enquanto não houver                                                                   |

**Resolvida nesta wave:** o padrão real de permalink do WordPress, que era pendência 2 e
bloqueava o dimensionamento do mapa de redirects.

---

## 17. Limitações declaradas

Coisas que **não** estão feitas, ditas aqui em vez de escondidas atrás de um gate verde:

- **Nenhuma execução contra o Kal El de produção.** Sem credenciais. O gate de entrega roda
  contra um CMS de contrato, que é forte, e não é a mesma coisa.
- **Nenhuma mídia transferida.** Os uploads estão num `tar.gz` de 101 GB ainda não
  extraído, e a transferência exige as credenciais de qualquer forma.
- **Nenhum deploy, DNS ou escrita em produção.**
- **Zero 404 não é verificável** sem a amostra de URLs de tráfego.
- **Viewports 768 e 1024 não foram percorridos** item a item fora da baseline.
- **Contador regressivo e grade de ofertas** da landing sazonal não existem, porque o
  domínio não modela os dados que eles exigem.
- **BuyBox, selo comercial e nota de review não renderizam** com o provider Kal El, porque o
  CMS não tem modelo comercial.
- **O store de nonce do webhook é em processo.** Com N instâncias, o pior caso é uma
  revalidação redundante — nunca um efeito duplicado. A troca por Redis é um método.
- **A revisão da última wave não foi independente.**

---

## 18. Como operar

```bash
git checkout chore/maquina-nerd-kalel-migration
pnpm install
cp .env.example .env.local
pnpm dev
```

Sem nenhuma credencial o site sobe em **modo fixture**. Para apontar ao CMS real, preencha
`KAL_EL_*` e defina `CONTENT_SOURCE=kalel`.

```bash
# ensaio da migração, sem escrever nada
WP_ARCHIVE_DUMP='…/127_0_0_1.sql' pnpm wp:import --source archive

# mapa de redirects
pnpm redirects:build --source archive

# gates completos
.\migration-orchestration\scripts\Run-Quality-Gates.ps1
```

Procedimentos de virada, rollback, observação e alerta estão no
[RUNBOOK.md](./RUNBOOK.md).

---

## 19. Histórico

15 commits na branch.

| Commit    | Escopo                                                               |
| --------- | -------------------------------------------------------------------- |
| `371f92f` | Portal em Next.js sobre o Kal El (waves 0–2)                         |
| `4bff2ef` | Migração WordPress, CI e operação (waves 3–5)                        |
| `98f5ff3` | 7 achados bloqueantes da revisão                                     |
| `0347d66` | Falhas de importação que não falhavam                                |
| `dd89d06` | Relatório de execução                                                |
| `b7a57e4` | Staging serve leitores, e era tratado como se não servisse           |
| `9949027` | Gate de entrega contra um Kal El de contrato                         |
| `ebfed32` | Rodar o importador de verdade, e consertar o que revelou             |
| `de44caa` | A home como o Claude Design a desenhou                               |
| `e160da6` | O hub de franquia e a editoria como o design os abre                 |
| `b1c8d14` | A pílula de editoria e o painel de mais lidas                        |
| `4a4e38e` | Verificação final com o estado das quatro waves                      |
| `41ec6ef` | Os cinco templates de artigo, comparados um a um                     |
| `6d50c4c` | As quatro telas comerciais, comparadas uma a uma                     |
| `c81572e` | Ler o arquivo de verdade, e consertar o que 41.318 artigos revelaram |

---

## 20. Documentos

| Documento                                        | Para quê                                            |
| ------------------------------------------------ | --------------------------------------------------- |
| [RELATORIO-EXECUCAO.md](./RELATORIO-EXECUCAO.md) | a entrega original, com custo de execução em tokens |
| [FINAL-VERIFICATION.md](./FINAL-VERIFICATION.md) | resultados dos gates e o histórico das waves        |
| [DECISIONS.md](./DECISIONS.md)                   | as 29 decisões, com porquê e reversão               |
| [KAL-EL-DISCOVERY.md](./KAL-EL-DISCOVERY.md)     | contrato real do CMS, lacunas e a mudança aplicada  |
| [VISUAL-AUDIT.md](./VISUAL-AUDIT.md)             | cada protótipo ligado à rota e ao screenshot        |
| [RUNBOOK.md](./RUNBOOK.md)                       | operação, migração, virada e rollback               |
| [INPUT-INVENTORY.md](./INPUT-INVENTORY.md)       | hashes dos insumos originais                        |
