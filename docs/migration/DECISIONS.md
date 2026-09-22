# Decisões e premissas

Registro das escolhas feitas sem consulta, conforme a carta de execução: onde a
informação não existia, o padrão mais seguro foi adotado e anotado aqui. Cada entrada diz
**o que** foi decidido, **por quê**, e **como reverter** se a premissa for negada.

> **2026-09-10 — o kit de front-end substituiu o design anterior.** A §7, no fim deste
> arquivo, registra a rodada que reconstruiu o front sobre `maquina-nerd-kit/`. Ela
> supera: §1.3 (agora é Tailwind), §2.1–§2.7 (paleta, Figtree e tema escuro saíram), §3.2 e
> §3.5 na parte de especiais/ao vivo/lista (esses templates não existem no kit), §4.2
> (`/reviews` virou `/tag/reviews`) e a precedência de editorias da §4.8. O resto continua
> valendo.

---

## 1. Ambiente e ferramentas

### 1.1 `APP_ENV` separado de `NODE_ENV`

`next build` sempre define `NODE_ENV=production`. Se as travas de produção — sobretudo a
que proíbe o provider de fixtures — dependessem de `NODE_ENV`, seria **impossível** gerar
o build em modo fixture de que a auditoria visual e o CI dependem.

`APP_ENV` nomeia o _deployment_ e cai para `NODE_ENV` quando ausente, então um deploy real
que nunca o define continua com todas as travas. Servir leitores a partir de fixtures
exige um rebaixamento explícito e visível.

**Reverter:** remover `APP_ENV` e aceitar que o gate visual só rode em desenvolvimento.

### 1.2 BOM UTF-8 nos scripts PowerShell da orquestração

`Inspect-Inputs.ps1` falhava com `MÃ¡quina Nerd template completo.zip`: o Windows
PowerShell 5.1 (o shell desta máquina) lê `.ps1` sem BOM como ANSI. Os três scripts
receberam um BOM UTF-8; **o conteúdo não mudou**.

### 1.3 CSS escrito à mão em vez de Tailwind

`docs/02` sugere Tailwind lendo os tokens. Optou-se por uma folha de estilo única sobre a
camada de tokens: o orçamento de CSS é 25 KB, os protótipos codificam um conjunto pequeno
e fechado de composições, e — o que mais pesou — a regra "nenhum hex de marca em UI
compartilhada" fica **mecanicamente verificável**: há exatamente um arquivo para auditar.

**Reverter:** adotar Tailwind lendo `packages/tokens`; nenhum componente muda de API.

---

## 2. Design

### 2.1 `--mn-fg2` escurecido de `#7C818A` para `#6B7078`

`docs/09` afirma que `#7C818A` passa AA para 16px+. **Não passa.** É 3,91:1 sobre branco e
3,66:1 sobre `--mn-surf`; texto de tamanho normal exige 4,5:1. O axe-core reprovava
**todas** as páginas. O novo tom dá 4,99:1 e 4,65:1 — a menor mudança que torna a paleta
aprovada efetivamente acessível.

Foi acrescentado `--mn-fg2-strong: #5F646C` para o caso de `--mn-surf2` (#ECECEF), onde
mesmo o tom novo fica em 4,23:1.

### 2.2 Avatar âmbar escurecido de `#C77800` para `#8A5B00`

A paleta de avatar reaproveita os acentos de editoria, mas um avatar carrega iniciais
brancas em 11px bold: `#C77800` com branco é 3,43:1. O acento de editoria em si **não
mudou** — ele só é usado como cor de rótulo sobre fundo claro, nunca atrás de texto branco.

### 2.6 As fixtures usam as fotografias dos protótipos

Os gradientes gerados por `pnpm fixtures:media` são um bom placeholder e uma apresentação
errada: uma home cujas capas são todas retângulos de duas cores lê como wireframe.

`pnpm fixtures:media:reference` baixa as quinze fotografias que os sete `*.dc.html`
referenciam — todas em `www.maquinanerd.com.br/wp-content/uploads/`, o WordPress do
próprio operador —, redimensiona para 1600px e grava em `public/fixtures/`. O host é
fixado no script; qualquer outro é recusado.

**Reverter:** `pnpm fixtures:media` regenera os gradientes e as baselines voltam com
`pnpm test:visual --update-snapshots`. Se o operador preferir não versionar fotografia de
divulgação neste repositório, é essa a saída — um comando.

### 2.7 `--brand-solid`, para o vermelho preenchido

`--brand-ink` é o vermelho **como tipo**, e `--brand-text` vira vermelho claro no tema
escuro para continuar legível como tipo. Uma pílula preenchida precisa do oposto: uma
superfície escura o bastante para o branco sentar em cima, nos dois temas.

Usar `--brand-text` como fundo produziu uma barra clara com tipo vermelho sobre vermelho —
invisível, e só no tema escuro. `--brand-solid` (com `--brand-solid-ink`) nomeia o caso,
e é 6,6:1 com branco.

### 2.3 Escopo de tokens para superfícies escuras

Faixas que se pintam de escuro enquanto o tema da página é claro (rodapé, faixa de vídeo,
newsletter, "Onde assistir", capas) **repontam os tokens neutros** em vez de reestilizar
cada componente aninhado. Corrigir `.mn-videoband .mn-card__title` um a um foi exatamente
como o rodapé acabou com texto em 1,04:1.

### 2.4 Rótulos do cabeçalho colapsam abaixo de 600px

Busca, tema e menu são três pílulas rotuladas; em 390px estouram o shell. Os rótulos viram
ícones e o nome acessível migra para `aria-label` — some o texto visível, não o nome.

### 2.5 `<h1>` invisível na home

O protótipo usa o logo como cabeça de página, o que é imagem e não título. A home recebeu
um `<h1>` visualmente oculto: o outline do documento e a busca exigem um, e o design
aprovado não muda.

---

## 3. Integração com o Kal El

### 3.1 Uma mudança mínima no CMS: filtro `?slug=`

Detalhada em [KAL-EL-DISCOVERY.md](./KAL-EL-DISCOVERY.md). Commit separado, branch própria
no repositório do Kal El (`feat/article-slug-filter`, `83ad1e8`), com teste próprio.

O adaptador **continua correto sem ela**: o resultado filtrado é sempre reconferido contra
o slug pedido, e uma divergência cai no índice completo.

### 3.2 O que não foi mudado no Kal El, e por quê

Comercial (oferta/preço/nota), especiais/dossiês e eventos ao vivo **não têm modelo** no
CMS. Poderiam ter sido acrescentados; não foram, porque cada um exige migração de banco e
decisão de produto — o oposto de "mudança mínima indispensável". O domínio do portal
suporta todos eles; o mapper preenche o que o CMS sabe expressar hoje e as propostas estão
registradas. **Consequência honesta:** BuyBox e nota de review não renderizam para conteúdo
autorado no Kal El até que a mudança seja aceita.

### 3.5 No template de lista, toda `h2` é uma entrada

Os numerais e o índice "Nesta lista" derivam das `h2` do documento, porque o modelo do Kal
El tem heading e nada mais estreito. Uma subseção editorial dentro de uma lista numerada
seria numerada junto.

Os dois lados leem o mesmo conjunto, então nunca discordam entre si — o que não conseguem
é discordar de uma intenção que o documento não sabe expressar. É a mesma classe de
convenção das tags reservadas: mudá-la é acrescentar um tipo de nó ao CMS, não ajustar
CSS.

### 3.3 Convenções por tag reservada

`longform` e `ao-vivo` selecionam template; `patrocinado`, `afiliado`, `review-amostra` e
`campanha` marcam conteúdo comercial; `morte`, `acidente`, `tragedia`, `processo-judicial`
e `violencia` suprimem publicidade no servidor. São convenções editoriais, não campos —
mudá-las é mudar `RESERVED_TAGS` em um arquivo.

### 3.4 Proteção de replay sem timestamp assinado

O Kal El não envia timestamp. A defesa é a assinatura HMAC do corpo mais o nonce de
idempotência com _claim atômico_. Houve também uma janela derivada do `publishedAt`
assinado; saiu na revisão do PR (§7.13), porque recusava as retentativas legítimas do
worker. O store é em processo; em múltiplas instâncias o pior caso é uma revalidação
redundante, nunca um efeito duplicado.

### 3.5 Preview: sessão presa a um artigo

`draftMode()` é um interruptor global. Sozinho, um token legítimo de um rascunho abriria
qualquer slug não publicado que alguém adivinhasse. Um grant assinado em cookie `HttpOnly`
nomeia o slug autorizado, e toda superfície de preview o confere.

---

## 4. Rotas e SEO

### 4.1 Sem `loading.tsx` na raiz

Um `loading.tsx` de rota abre um limite de Suspense **acima** do componente de página, e o
Next descarrega o shell — comprometendo o HTTP 200 — antes que `notFound()` ou `redirect()`
possam rodar. **Toda página inexistente virava um soft-404 com status 200**, e
`/{categoria}/page/1` renderizava em vez de redirecionar. Os estados de carregamento foram
movidos para dentro das páginas, abaixo do ponto onde o status é decidido.

### 4.2 `reviews` é editoria, não segmento reservado

Havia uma rota `/reviews/[slug]` que redirecionava para a URL canônica do artigo — que,
para um review, é `/reviews/{slug}`: um **loop**. `reviews` saiu de `RESERVED_SEGMENTS` e a
rota dedicada foi removida; `[categoria]/[slug]` a serve como qualquer outra editoria, e o
índice estático `/reviews` continua sombreando a listagem.

### 4.3 Sitemap paginado com nomes estáveis

O índice precisa nomear **todos** os arquivos filhos. Um cursor opaco não é enumerável, e
o header `Link: rel="next"` não é seguido por crawler de sitemap — só as primeiras 100 URLs
eram descobríveis. Agora o índice declara `articles-1.xml … articles-N.xml`, e `N` vem do
índice completo cacheado.

### 4.4 Artigo sem editoria não tem URL pública

O Kal El permite publicar sem categoria; este site não tem rota para isso — `/{slug}` seria
lido pelo catch-all como editoria. O repositório filtra esses artigos de toda listagem e
`articleHref` devolve `null` em vez de inventar um endereço.

### 4.6 Duas origens: a REST e o arquivo SQL

Durante toda a fase anterior existia só a REST, e a decisão registrada aqui era que um
leitor de arquivo escrito antes de o arquivo existir seria adivinhação — prefixo de
tabela, plugins e charset são fatos de um export específico.

**O arquivo chegou** (`127_0_0_1.sql`, 1,66 GB, phpMyAdmin, 2026-08-21), então a condição
que a decisão nomeava deixou de valer e `scripts/wp/archive.ts` foi escrito contra o dump
real: prefixo `wp_`, `utf8mb4`, permalinks `/%postname%/`, 41.318 posts publicados e
73.173 anexos. Ele implementa `WpReadSource` — a mesma superfície da REST, agora um tipo
que o compilador verifica — e nenhum consumidor sabe qual dos dois recebeu.

Três coisas que a REST fazia de graça e o leitor de arquivo precisou fazer:

| O que                | Por quê                                                                                                                                                                                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `wpautop`            | A API devolve conteúdo renderizado; o banco tem conteúdo cru. **45% do arquivo (18.786 posts) é do editor clássico e não tem um único `<p>`.** Sem isso, esses artigos importariam com as figuras e nenhuma palavra do texto — e o relatório diria sucesso. |
| Permalink calculado  | `post.link` sai de `permalink_structure`. A tabela de redirects depende dele.                                                                                                                                                                               |
| URL de mídia montada | De `home` + `_wp_attached_file`, **nunca de `guid`**: os guids deste arquivo ainda apontam para `http://13.48.147.139`, uma máquina que não serve o site há anos.                                                                                           |

O leitor **não faz nenhuma requisição de rede**. Os bytes dos anexos vêm de um diretório
de uploads extraído (`--uploads`), então uma importação de arquivo não pode ser apontada
para lugar nenhum e `--allow-private-assets` é recusado com ela.

A alternativa — restaurar o dump num WordPress local e usar a REST — continua válida e
documentada no [RUNBOOK §4.0](./RUNBOOK.md), mas não é viável aqui: as mídias estão dentro
de um `tar.gz` de 101 GB em 19 partes, e nem WSL nem Docker estão disponíveis nesta
máquina.

### 4.8 Uma categoria do WordPress é uma editoria ou é uma tag

O arquivo tem **8.619 categorias e 36.438 tags**; o portal tem seis editorias. Importar
categoria por categoria criaria 8.613 segmentos de rota — `/noticias`, `/netflix`,
`/robert-de-niro` — que nenhum template, nenhuma navegação e nenhum protótipo tem. A
arquitetura aprovada diz o contrário: _sub-editorias são tags, nunca segmentos de rota_.

Então: slug entre as seis → editoria; qualquer outro → **tag**. Nada é descartado —
`noticias`, em 32.781 posts, vira tag e continua em todos eles.

Medido no arquivo real: 41.020 dos 41.318 posts publicados (99,3%) têm exatamente uma
editoria, 190 têm duas e 298 não têm nenhuma.

- **Duas editorias** (190 posts, 0,46%): vence a precedência `reviews, animes,
quadrinhos, games, series, filmes` — mais específica primeiro, com `reviews` na frente
  porque é um _formato_ com template e índice próprios. As demais editorias do post são
  descartadas em vez de viram tags: uma tag "Filmes" ao lado da editoria `series` se lê
  como seção e não é uma.
- **Nenhuma editoria** (298 posts): **falha, não aviso.** O portal remove um artigo sem
  editoria de toda listagem e do sitemap, então importá-lo produz algo que existe e não
  pode ser encontrado. A execução escreve `unmapped-categories.json` com as categorias
  responsáveis e quantos posts cada uma resgataria; preenchido, vira `--category-map`.

`post.categories[0]` **não** serve para escolher: o WordPress ordena por term id, e neste
arquivo a primeira categoria é uma editoria em 8.459 posts e `noticias` na maioria dos
outros 32.858. O `build-redirects.ts` usava exatamente isso, e mandaria quatro de cada
cinco redirects para uma seção inexistente.

### 4.9 Colchetes no meio do texto não são shortcodes

O conversor apagava tudo que casasse com `[palavra ...]`. O WordPress não faz isso: ele
expande shortcodes _registrados_ e imprime o resto literalmente — e este site praticamente
não registra nenhum (o Powerkit, dono dos 40 `[powerkit_toc]`, nem está em
`active_plugins`).

O que estava sendo apagado era prosa:

> "Eu trocava ideias com **[a presidente da Lucasfilm]** Kathleen Kennedy"
> "eu era sincero ao pensar que era o fim **[risos]**"
> "…Sit Down With **[SPOILER]**"

Interpolação jornalística, marcador de transcrição e parte de um título. Agora só sai o
que é sintaxe de shortcode sem ambiguidade: fechamento `[/nome]`, nome com `_` ou `-`, ou
atributos `chave="valor"`. O resto fica e é contado como `bracket-text:*` — inclusive os
~1.400 marcadores de template que o pipeline de geração deixou por preencher
(`[Nome do Ator]`, `[INSERIR VÍDEO AQUI]`), que são exatamente o que o leitor vê hoje no
site publicado.

### 4.10 Imagem de terceiro não vira imagem nossa

Das 87.771 `<img>` no corpo dos artigos, **28.140 são da biblioteca de mídia do site** e
**44.304 são hotlink de outros veículos** — `static0.srcdn.com` (ScreenRant, 28.050),
`static0.thegamerimages.com`, `variety.com`, `www.hollywoodreporter.com`,
`comicbook.com`, entre 61 domínios. Outras **14.445** têm a URL corrompida na origem, com
espaços e quebras de linha dentro do host e do caminho
(`https://lumiere-a. akamaihd.\n\nnet/v1/images/image_49e88d01. jpeg. region=…`).

O importador **não baixa nenhuma delas**. Duas razões, e a segunda é a que decide:
tecnicamente uma imagem sem `mediaId` não vira nó de documento no Kal El; juridicamente,
baixá-las converteria _hotlink_ em _hospedagem_, que é uma exposição materialmente maior.
Essa é uma decisão do operador, não de engenharia — o relatório agora quebra o número por
domínio (`image:external:<host>`) em vez de somar tudo num `image:unresolved` opaco, que
misturava uma questão de licenciamento com um bug de mapeamento. O bug de mapeamento de
verdade são **466** imagens do próprio domínio que não casaram.

As URLs corrompidas não são recuperáveis: reverter "espaço depois do ponto" é ambíguo
porque o `?` da query também virou `. `. Adivinhar produziria URLs inventadas.

**As capas não são afetadas** — vêm de `_thumbnail_id`, que aponta para a biblioteca de
mídia. 40.663 dos 41.318 posts têm uma.

### 4.7 Reimportação não sobrescreve edição editorial

`If-Match` sozinho protege os milissegundos entre ler a versão e escrever — não diz nada
sobre um editor que melhorou o texto na semana passada. O runbook prometia que um artigo
editado depois da importação seria deixado intacto; o código não fazia isso.

O state file agora guarda a versão que a importação escreveu (`articleVersions`). Se o
Kal El estiver em outra versão, a mudança não é nossa para sobrescrever: o artigo é
pulado, a execução termina com código 1 e o relatório nomeia o artigo.

**Consequência aceita:** uma primeira execução defeituosa em um artigo que alguém depois
editou não pode ser reparada rodando de novo. A ferramenta reporta e uma pessoa decide —
que é melhor que apagar trabalho de redação em silêncio.

### 4.5 O permalink legado, confirmado — e por que a tabela não serve

`permalink_structure` é **`/%postname%/`**, e o plugin `no-category-base-wpml` estava
ativo. Ou seja: os 41.318 artigos **e** os 8.619 arquivos de categoria estão indexados em
`/{slug}`, num único espaço de nomes na raiz. Todos caem em `/[categoria]`.

Escrever isso como tabela não funciona. Uma entrada por artigo são ~5 MB de JSON dentro
do bundle do `middleware.ts`, que roda no edge a cada requisição — acima do limite de
tamanho, e reparseado a cada cold start, para codificar uma regra sem exceções: _o slug é
o mesmo, só a editoria é nova_. A versão anterior emitia cinco formas por post e chegava a
206.590 entradas.

Então a regra virou resolução, em `lib/legacy-permalink.ts`: `/[categoria]` procura o
segmento desconhecido no CMS — artigo primeiro, tag depois — e responde 308 para o
endereço real. `cache()` do React garante uma consulta só, porque `generateMetadata` e a
página correm juntas.

**308, não 301** — o Next não tem 301: `permanentRedirect()` é 308. Para um buscador os
dois são equivalentes; a diferença é que 308 preserva o método da requisição, o que é
inerte em um caminho que só responde GET. O status está fixado em teste, porque a
documentação afirma qual é.

A tabela continua existindo para o que é exceção de verdade: redirects que um editor
cadastrou no Kal El, o CSV do operador, e os posts cujo slug muda ao passar por
`slugify`. Sobre o arquivo real isso dá **17 entradas** — 41.003 posts cobertos pela
regra, 12 com slug acima de 120 caracteres e 5 com um caractere gujarati
percent-encoded que alguma ferramenta de edição deixou cair no meio do slug.

**Ainda não é possível declarar "zero 404"** sem a amostra de URLs de tráfego do Search
Console — continua como pendência externa.

---

## 5. Segurança

### 5.1 CSP: estrita onde dá, e honesta onde não dá

Tentou-se primeiro `script-src 'self' 'sha256-…'` com o hash do único script inline do
projeto, sem `'unsafe-inline'`. **Não funciona:** o Next emite vários scripts inline de
bootstrap por página (o payload de flight), com hash diferente a cada página. Medido no
browser:

```
Refused to execute inline script … Either the 'unsafe-inline' keyword, a hash
('sha256-OBTN3RiyCV4…'), or a nonce is required
```

A alternativa — nonce por request — força toda rota a renderizar dinamicamente e destrói o
ISR em que toda a estratégia de entrega se apoia.

A política final enforça tudo o que pode enforçar: `default-src 'self'`, `object-src 'none'`,
`base-uri`, `form-action`, `frame-ancestors`, `frame-src` com allowlist de dois players,
`connect-src 'self'` e `img-src` restrito à allowlist. `script-src` aceita `'unsafe-inline'`,
o que **ainda bloqueia script de outra origem** — o vetor realista para um portal que roda
código de anúncio e de embed. Não bloqueia script inline injetado; esse vetor está fechado
estruturalmente, porque nenhum HTML não confiável é inserido em lugar nenhum.

`style-src` aceita inline porque o React escreve os atributos `style` usados para
aspect-ratio e reserva de anúncio, e não há equivalente por hash para estilo em atributo.

### 5.2 `TRUST_PROXY` obrigatório em produção

O rate limit agrupa por endereço do cliente. Sem configuração explícita, as duas respostas
são ruins: confiar em `x-forwarded-for` deixa qualquer chamador forjar um balde privado por
request; ignorá-lo junta todos os visitantes em um balde só. Nenhuma das duas deve ser
alcançada por omissão, então a validação de ambiente exige a escolha. Qual entrada do
cabeçalho vale, e o Cloudflare na frente, em §7.14.

### 5.3 Proxy de mídia sem SSRF

A única entrada é um UUID; a URL de destino é construída a partir da base configurada e do
`siteId`. O tipo da resposta é fixado pelo MIME registrado no CMS e apenas formatos raster
são reemitidos — SVG seria conteúdo ativo na origem confiável.

---

## 6. Pendências que dependem do operador

| Pendência                               | Bloqueia                                   |
| --------------------------------------- | ------------------------------------------ |
| Padrão real de permalink do WordPress   | validação "zero 404" dos redirects         |
| Amostra das 1.000 URLs de maior tráfego | mesmo item                                 |
| Credenciais reais do Kal El             | execução contra CMS real                   |
| Endpoint interno do Cinerie             | módulo "Onde assistir" com dado real       |
| Provedor de newsletter                  | `/api/newsletter` responde 501 até existir |
| Network code do GAM                     | carregamento real de anúncios              |
| CMP de consentimento LGPD               | substituir o banner próprio, se exigido    |

> A linha do Cinerie saiu da lista em 2026-09-10: o módulo "Onde assistir" não existe no
> kit de front-end (§7.4).

---

## 7. Rodada do kit de front-end (2026-09-10)

O `Máquina Nerd template completo.zip` foi **substituído pelo operador** em 2026-09-10
18:51 (SHA-256 `d07c3014…87e157`, 209.191 bytes; o anterior era `1AF2D34A…99EEF8C`, 47,7
MB). O conteúdo novo é `maquina-nerd-kit/`: sete protótipos, seis documentos de
especificação e um prompt de implementação. Ele é a fonte visual canônica desta rodada. O
ZIP não foi alterado; cópia de trabalho em `.migration-reference/maquina-nerd-kit/`
(ignorada).

### 7.1 Onde o kit e o CLAUDE.md divergem

| Tema                 | Kit                           | CLAUDE.md                               | Adotado                                                                                                                                                                  |
| -------------------- | ----------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CMS do adaptador     | "WordPress REST"              | Kal El no runtime; WP só importação     | **Kal El.** O adaptador do kit (`lib/content/`) consome o repositório Kal El já testado.                                                                                 |
| Paradas para revisão | "pare ao fim de cada etapa"   | não parar para escolhas reversíveis     | Execução contínua, como o usuário pediu ("execute e construa tudo").                                                                                                     |
| Parágrafo            | `{ tipo: 'paragrafo', html }` | `ContentBlock[]` tipado, sem HTML bruto | **Trechos tipados** (`Trecho[]`). Nenhum `dangerouslySetInnerHTML` em artigo.                                                                                            |
| Tema escuro          | não existe nos protótipos     | "temas claro/escuro" por template       | **Só claro.** Um escuro seria um visual inventado; o kit proíbe improvisar. Tokens em CSS custom properties: um tema escuro desenhado entra sem mexer em componente.     |
| Fixtures             | `lib/content/fixtures/`       | —                                       | O corpus fica em `packages/content/src/fixture/` (domínio), para passar pelo mesmo mapeamento do Kal El; `lib/content/fixtures/` guarda o que só existe na apresentação. |

**Reverter o tema:** acrescentar um bloco `[data-theme='dark']` em `tokens.css` redefinindo
as variáveis `--color-*` — nenhum componente usa hex.

### 7.2 Tailwind v4, `@theme static`, `--spacing: 1px`

O kit pede Tailwind com os tokens. `packages/tokens/src/tokens.css` é o `@theme`; paleta,
raios e sombras padrão foram **zerados**, então não existe `shadow-*` nem `rounded-lg` para
alguém usar por engano. `--spacing: 1px` faz as medidas do protótipo virarem classes
literais (`px-68`, `gap-40`).

`static` porque as cores de editoria chegam por dado (`var(--color-ed-cinema)` inline) e o
Tailwind só emite variáveis que alguma classe usa: sem `static`, **todo filete, preenchimento
e rótulo de editoria sumiu** no primeiro build — visto no navegador, corrigido, e agora
coberto pelo teste de contraste, que lê os valores do próprio CSS.

### 7.3 Contraste: onde a tabela do próprio kit reprova a regra do kit

O kit exige todo texto ≥ 4,5:1 e, na mesma tabela, pinta texto branco sobre cores que não
passam. Medido (`tests/unit/tokens-contrast.test.ts`):

| Editoria              | Cheia     | Branco | Tinta #111 | Adotado quando há texto sobre a cor              |
| --------------------- | --------- | -----: | ---------: | ------------------------------------------------ |
| Cinema                | `#A248FC` |   4,31 |       4,38 | **nenhum passa** → fundo `#7A21DB` (branco 6,84) |
| Séries e TV           | `#5075FC` |   3,97 |       4,76 | tinta                                            |
| Quadrinhos            | `#EA8D49` |   2,50 |       7,56 | tinta                                            |
| Games, Animes, Vídeos | —         |  < 2,3 |        > 8 | tinta (como o kit já dizia)                      |

Os filetes de 4px, a regra da citação e todo preenchimento sem texto mantêm a cor cheia. O
título da editoria (34px) usa a variante de texto, como a regra 01 do kit manda ("rótulo
em texto usa sempre a variante de texto"): a cheia fica abaixo de 3:1 em Games, Animes,
Vídeos e Quadrinhos.

Dois ajustes que o axe exigiu:

- **Links no corpo sublinhados.** Só pela cor, o link fica a 1,4–1,8:1 do texto ao redor
  (WCAG 1.4.1 pede 3:1 ou outra marca). O sublinhado é o mesmo, discreto, que o protótipo
  usa em "Toda a Marvel".
- **Preço no botão da loja sem `opacity`.** Branco a 85% sobre `#E30613` dava 3,75:1.

"Mais" na nav é neutro: o hover preenche de cinza e o rótulo fica em tinta (branco sobre
`#B8B8B8` seria 1,98:1).

### 7.4 O que o kit não tem e saiu do site

Especiais/dossiês, ao vivo, reviews com nota, comparativo, landing de campanha, enquete,
"Onde assistir" (Cinerie), barra de rede, tema escuro e breadcrumb visível. As rotas
`/especiais/*`, `/ao-vivo/*`, `/reviews`, `/publicidade` e `/api/live` foram removidas;
`/especiais` agora é uma editoria comum. O JSON-LD `BreadcrumbList` continua em toda página.

### 7.5 Slugs de editoria do kit, e os antigos

`cinema, series-e-tv, games, quadrinhos, animes, videos, especiais` (kit docs/03). O
arquivo WordPress arquiva sob `filmes, series, quadrinhos, games, animes, reviews`:

- **Importador:** `filmes → cinema`, `series → series-e-tv`, `reviews → especiais` (e também
  a tag `reviews`, para o arquivo sobreviver em `/tag/reviews`). A editoria criada leva o
  nome do kit ("Cinema"), não o do WordPress ("Filmes"). Precedência:
  `especiais, animes, quadrinhos, games, videos, series-e-tv, cinema`.
- **URLs:** `/filmes → /cinema`, `/series → /series-e-tv`, `/noticias → /`,
  `/reviews → /tag/reviews`, `/publicidade → /anuncie`, com página e slug preservados, num
  salto só (tabela + regra no edge; teste garante que a regra do edge e `RENAMED_DESKS`
  concordam).

### 7.6 O layout da matéria é uma tag reservada

O kit escolhe a composição por matéria (`layout: padrao | overlay | oferta`). O Kal El não
tem esse campo. Convenção: tag `capa-em-tela-cheia` → overlay; tag `oferta` (ou `ofertas`,
ou `afiliado`) → oferta, que vive em `/ofertas/{slug}` qualquer que seja a editoria. O
endereço de oferta é decidido em **uma** função (`articlePath`), usada por link, canonical,
sitemap e redirect. Tags reservadas não aparecem como filtro nem têm arquivo público.
**Proposta ao Kal El:** um campo `presentation.layout` (KAL-EL-DISCOVERY).

### 7.7 A coluna de texto alinhada ao menu, sem medir em runtime

O protótipo mede o menu com `getBoundingClientRect` e reposiciona a coluna depois do
carregamento — o que é layout shift. Aqui é uma grade fixa com os números medidos no build
(`--mn-nav-w: 798.27px` a 13px, `670.41px` a 12px) e margens derivadas das caixas fixas do
cabeçalho. `tests/e2e/layout.spec.ts` remede a nav e reprova se coluna e menu divergirem
mais de 2px.

**Os dois lados são fixos.** A primeira versão fixava só a coluna e deixava o menu com a
largura do texto. A CI em Linux mostrou o problema: lá os rótulos saem mais estreitos e o
menu, centralizado, andou **19,4px** em relação à coluna — o leitor em Linux, Mac ou
Android veria o desalinhamento. Agora os nove itens preenchem uma caixa com exatamente essa
largura (`SiteHeader`), cada um crescendo um pouco (`flex-auto`, rótulo centralizado). No
Windows, onde os números foram medidos, a sobra é zero e nada muda; nos outros sistemas a
diferença se distribui entre os itens, e as bordas continuam onde a coluna espera.

### 7.8 Datas: "Atualizado em" só para edição de verdade

Um artigo importado é gravado no Kal El no dia da migração; `updatedAt` seria essa data em
41 mil artigos. `editedAt` = `updatedAt` apenas quando ele é mais de 10 minutos posterior
à publicação **e** à criação do registro. Horários relativos ("2 horas atrás") usam um
"agora" fixo em modo fixture, para screenshot não mudar a cada dia.

### 7.9 Ordem de publicação: uma segunda mudança no Kal El

O Kal El lista por `updatedAt`. Depois da importação, isso é a ordem em que o importador
escreveu — a home abriria com uma matéria de 2019. Mudança no CMS, branch própria
(`feat/delivery-published-order`, sobre `feat/article-slug-filter`), não enviada:

- `order=published` (padrão continua `updated`: nenhum cliente existente muda), com
  cursor próprio por ordem — um cursor de uma ordem é recusado na outra;
- `offset` com `total`, para paginação numerada `1 2 3 4 … 24` como no kit;
- tags e entidades na listagem (o porte do `bb24988`, que existia só noutra branch) — sem
  isso o portal não enxerga as tags de layout na listagem;
- filtros de autor/categoria/tag como subconsulta, em vez de carregar milhares de UUIDs
  para um `IN (…)`;
- índice `(site_id, status, published_at DESC, id DESC)`, migração `0006`.

O portal continua correto **sem** ela: pede `order`/`offset`, e se a resposta vier sem
`total`, percorre o cursor até cobrir a página e ordena localmente.

### 7.10 Anúncios e "Mais como este" postos por regra

Dois 728×90 por matéria, só entre dois parágrafos, com pelo menos dois parágrafos antes,
nunca a menos de três blocos um do outro, mirando 40% e 75% do texto (`withAds`). "Mais como
este" depois do primeiro parágrafo, quando há texto dos dois lados e duas matérias para
oferecer. Cada slot tem nome acessível único ("Anúncio 3, 728 por 90"). Um teste achou, e
a regra corrigiu, o anúncio caindo entre o 1º e o 2º parágrafo de um texto curto.

### 7.11 Desvios pequenos e deliberados do protótipo

| Protótipo                                            | Site                                        | Por quê                                              |
| ---------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------- |
| Ícone de play em todo card de Games                  | só em vídeo                                 | ícone sem função (regra do kit)                      |
| Abas "Recomendados / Mais vistos / Recentes"         | só "Recentes"                               | não há dado de audiência; não se inventa             |
| Setas ‹ › na faixa de vídeo                          | ausentes                                    | ícone sem função                                     |
| "Ver Especiais" na seção "Animes \| Especiais"       | "Ver Animes"                                | o botão levaria a outra editoria que não a dos cards |
| Glifo de menu na faixa de editoria (≤900px) sem ação | abre "Nesta editoria" (`<details>`, sem JS) | ícone sem função                                     |
| Sem assinatura no celular                            | linha de autor abaixo do título até 900px   | a assinatura sumiria no mobile                       |
| Capa overlay `100vh`                                 | `clamp(360px, 62vh, 640px)` (doc 02)        | retrato de tela inteira é vetado no mobile (doc 06)  |
| Podcast no rodapé                                    | ausente                                     | não existe página de podcast                         |
| "newsletter semanal" / periodicidade                 | sem periodicidade                           | dado não confirmado (regra do kit)                   |
| "G" de compartilhar sem destino                      | abre rascunho no Gmail                      | ícone sem função                                     |
| Dois 728×90 no corpo da oferta, um logo após a foto  | só entre dois parágrafos seguidos           | doc 05: "nunca imediatamente após uma imagem"        |

### 7.12 O que a revisão do diff do kit mudou

O Codex CLI desta máquina não roda (0.151.0 recusa o modelo da conta); a revisão foi feita
por um revisor independente somente leitura, e o registro está em
`artifacts/codex-reviews/kit-inicial.md` e `kit-final.md` (ignorados pelo git). Achados
aceitos e corrigidos:

- **Divulgação comercial fora da oferta.** Publieditorial, campanha e produto cedido
  ficavam sem rótulo e com links sem `sponsored`. Agora `Disclosure` abre o texto
  ("Conteúdo patrocinado", "Publicidade", "Produto cedido para análise") e todo link do
  corpo é `sponsored nofollow` quando o artigo é comercial, em qualquer layout.
- **Paginação profunda sem teto.** Numa instância do Kal El sem a mudança de ordem, a
  página 9999 percorria o acervo inteiro. O caminho por cursor para em 20 chamadas
  (2 000 matérias); além disso a página é 404. `?page=` em tag, autor e ofertas passa pela
  mesma validação da rota (`parsePageQuery`: inteiro de 1 a 9999).
- **Artigo em outra editoria.** `/games/{slug}` de uma matéria de Cinema dava 404; agora é
  308 para a URL canônica — importa para posts do WordPress com várias categorias.
- **Tags reservadas** saíram do sitemap e dos redirects legados (terminavam em 404).
- **`/ofertas`** lista os três sinônimos da tag de oferta, não só o primeiro encontrado.
- **Deploy.** Compose publica a porta só em `127.0.0.1` (com `TRUST_PROXY` ligado, uma
  porta aberta deixaria forjar `X-Forwarded-For`); o Dockerfile lê o segredo de build com
  `node --env-file`, sem expansão de shell.

Mantido: o token de entrega continua com escopos `taxonomy.*.manage`, porque o Kal El não
tem escopo de leitura de taxonomia (proposta em KAL-EL-DISCOVERY).

### 7.13 O que a revisão do PR mudou antes do merge

Revisão independente do [MN_Next#1](https://github.com/maquinanerd/MN_Next/pull/1), feita
antes de subir o staging no Coolify. Achados aceitos e corrigidos:

- **B1 — a imagem só construía com um `.env.production` na máquina.** O `Dockerfile` exigia
  o _secret_ `portal_env`, e o build pack "Docker Compose" do Coolify não monta _secret_ de
  BuildKit. Agora o _secret_ é opcional: com ele, `node --env-file`; sem ele, os argumentos
  de build. Os `ARG` são só declarados no estágio de build — `ENV X=${X}` definiria como
  vazio o que ninguém passou, e uma variável definida, mesmo vazia, vence a do arquivo — e o
  estágio que roda não recebe nenhum. `docker-compose.coolify.yml` segue o compose do Kal El:
  sem `ports`, domínio por `SERVICE_URL_PORTAL_3000`, segredos de assinatura gerados pelo
  Coolify, `TRUST_PROXY=true`, healthcheck na liveness. `public/fixtures` saiu da imagem.
  Como esta máquina não tem daemon Docker, um job de CI (`image`) constrói a imagem em modo
  fixture e sobe o container a cada PR.
  - `SERVICE_BASE64_64_*`, e não `SERVICE_HEX_64_*`: é o gerador que o `SESSION_SECRET` do
    Kal El já usa naquele servidor (64 alfanuméricos, dentro dos 16–128 que o Kal El aceita
    para segredo de webhook). Um nome mágico que o Coolify não reconhecesse viraria variável
    vazia, e o build pararia na validação de ambiente.
  - Custo aceito: no Coolify o token de entrega chega ao build como argumento, e o Coolify
    injeta um `ARG` para cada variável do recurso em **todas** as etapas do Dockerfile,
    inclusive a final (no log do primeiro deploy: "Added 44 ARG declarations … added to 4
    stages"). O valor fica nos metadados da imagem naquele servidor (`docker history`),
    legível por quem tem acesso ao Docker do host — o mesmo grupo que já lê o token no
    ambiente do container em execução. A imagem não sai do servidor. Eliminar isso exige que
    o build deixe de ler o CMS com o token, ou que o Coolify monte _secret_ de build.
- **B2 — readiness verde com o contrato quebrado.** `?ready=1` consultava o `/health` do
  Kal El, que responde sem token. Agora faz a leitura autenticada, com `offset=0`, e exige
  `total`: um Kal El sem a ordem por publicação (kal-el#7) fica `contract: degraded`, 503. O
  fake do Kal El implementa `offset`/`total` e cursores marcados por ordem, como o #7, e tem
  um modo legado; o gate `test:kalel` sobe uma segunda cópia do build contra ele.
- **H1 — redirects de preview absolutos.** Atrás do proxy o servidor standalone monta
  `request.url` com `0.0.0.0:3000`, e `/api/preview` e `/api/preview/disable` mandavam o
  editor para lá. O `Location` agora é relativo, escrito à mão (`NextResponse.redirect`
  recusa URL relativa); os cookies de draft mode e do grant continuam indo, porque o Next os
  mescla em qualquer `Response`.
- **H2 — a cota do token era de quem quisesse gastar.** O Kal El dá 600 requisições por
  minuto por token, para o site inteiro. `/busca` para na página 5 (depois, 404) e conta
  buscas por cliente com `RATE_LIMIT_MAX`; acima dele mostra um aviso sem consultar o CMS,
  porque um Server Component não responde 429. O transporte espera um `retry-after` de até
  2 s, uma vez, e registra `kalel.read.rate-limited` quando desiste.
- **M1 — `kalel.contract.violation` nunca era escrito.** `KalElTransport.fromEnv()` deixava
  `onLog` vazio. O logger foi para `@mn/content` e o transporte o usa por padrão.
- **M2 — a janela de frescor do webhook recusava retentativas legítimas.** Removida, com
  `REVALIDATE_MAX_SKEW_SECONDS` (§3.4 e KAL-EL-DISCOVERY).
- **M3 — `robots.txt` congelado no build.** Agora é dinâmico, e fora de produção o
  middleware põe `X-Robots-Tag: noindex, nofollow` em toda resposta.
- **Baixo.** `/api/revalidate` recusa pelo `content-length` declarado antes de ler o corpo.
  `clientKey` confia no primeiro endereço de `X-Forwarded-For` com `TRUST_PROXY=true`: certo
  atrás do Traefik no padrão, que descarta o cabeçalho vindo do cliente e escreve o endereço
  real; errado atrás de um proxy que acrescenta ao valor recebido (RUNBOOK §4.5).

**H3 — fora deste PR, obrigatório antes de importar o acervo do WordPress.** O `context()`
do repositório Kal El carrega categorias, tags, autores e entidades inteiros e **percorre a
biblioteca de mídia inteira por offset** (`fetchMediaIndex`), uma vez por janela de
revalidação. Com o site vazio de hoje são poucas chamadas; com o acervo são centenas por
janela, contra os 600 por minuto do token, e a mídia além de `MAX_MEDIA_PAGES` some das
páginas sem erro nenhum. Precisa de leitura por ids no Kal El (`…/media?ids=`, e o mesmo
para tags) e de o repositório pedir só o que a página vai mostrar.

### 7.14 A virada antes do acervo, com o Cloudflare na frente (2026-09-16)

Registro da execução em [FINAL-VERIFICATION §4.3](./FINAL-VERIFICATION.md).

- **Virar antes de importar.** O RUNBOOK §5 punha a importação e o "zero 404" antes do DNS.
  Na hora da virada o WordPress já estava fora do ar: o DNS apontava para este servidor, onde
  nada atendia esses nomes, e só a home saía, de um cache antigo do Cloudflare. Esperar a
  importação deixava o site fora do ar; virar troca isso por 404 nas URLs antigas até a
  importação. O owner escolheu virar. Com isso, não existe mais rollback para o WordPress.
- **Raiz para `www` no Cloudflare, não no Coolify.** O redirecionamento do Coolify vale para o
  recurso inteiro e mandaria também o `sslip.io` para o `www`. A regra do Cloudflare pega só
  `https://maquinanerd.com.br/*`: 301, mesma rota, mesma query string.
- **O `sslip.io` continua no recurso.** O webhook do Kal El chega por ele, direto na origem,
  sem cache de borda nem proteção de bots do Cloudflare no caminho de uma chamada entre
  servidores. As páginas dele levam `canonical` para o `www`.
- **"Sempre usar HTTPS" desligado.** http → https sai do Traefik, com 302. Ligar faria o
  Cloudflare responder 301 antes da origem, mas o Let's Encrypt renova os certificados da
  origem pelo desafio HTTP-01, e o Traefik do Coolify só o atende na entrada http. Com o
  modo SSL "Completo", uma renovação que falhe não derruba o site; com "Completo (estrito)",
  derrubaria. O estrito já funciona hoje, mas pede antes essa garantia.
- **A Cache Rule do plugin do WordPress ficou.** "[DO NOT EDIT] WP Super Page Cache Plugin
  rules" torna `www.maquinanerd.com.br*` elegível para cache de borda, exceto `.xml`, `.xsl`,
  `robots.txt` e caminhos e cookies do WordPress. Com o Next, isso vira cache de borda pelo
  `s-maxage` de cada página (60 s na home e na matéria), e o `stale-while-revalidate` de um
  ano que o Next também manda não faz o Cloudflare servir página velha: vencido o prazo, a
  requisição seguinte vai à origem (`EXPIRED`, medido). O que o portal marca `private` ou
  `no-store` (busca, APIs, preview) sai `BYPASS`. Custo: uma publicação leva até cerca de um
  minuto para chegar ao `www`. Uma regra própria faria o mesmo com outro nome; apagar esta
  tiraria o cache de borda. Se o preview do portal passar a ser usado pelo `www`, a regra
  precisa excluir o cookie `__prerender_bypass` — a chave do cache ignora cookies, e a borda
  serviria ao editor a versão pública.
- **A chave do rate limit atrás do Cloudflare.** `clientKey` usava a primeira entrada de
  `X-Forwarded-For`. Atrás só do Traefik, a primeira é a única, escrita por ele. Com o
  Cloudflare na frente, passou a ser o servidor de borda: medido, seis requisições seguidas da
  mesma máquina nunca bateram no limite de cinco, porque chegaram por servidores diferentes.
  Um abusador se espalhava por vários baldes, e com isso caía a proteção da cota do token do
  Kal El (H2, §7.13), enquanto leitores diferentes na mesma borda dividiam um balde. Agora:
  - vale a **última** entrada, a que o proxy escreveu. É a mesma coisa atrás do Traefik, e
    continua certa atrás de um proxy que acrescenta ao que recebeu;
  - quando essa entrada é do Cloudflare, vale o `CF-Connecting-IP`. O Cloudflare é
    reconhecido pelas faixas publicadas, não por variável de ambiente: o mesmo build serve com
    o registro no proxy ou em "somente DNS", e de qualquer outro endereço o cabeçalho é
    ignorado, porque a origem é alcançável por fora do Cloudflare. Uma faixa nova do
    Cloudflare só junta os leitores dela no balde da borda até a lista ser atualizada;
  - IPv6 conta por /64, porque uma linha recebe o prefixo inteiro;
  - quando nenhum endereço se lê, o balde é o compartilhado `anonymous`, como sem
    `TRUST_PROXY`: limita demais em vez de limitar de menos.

### 7.15 H3 e a sessão de importação (2026-09-16)

O H3 (§7.13) deixou de ser pendência. Resolvido nos dois lados, com o acervo em mente:
41.318 artigos, ~70 mil mídias e ~45 mil tags (8.613 categorias rebaixadas mais 36.438 tags).

- **No Kal El** ([kal-el#12](https://github.com/maquinanerd/kal-el/pull/12)):
  `GET /media?ids=` (1 a 200) devolve exatamente essas mídias do site; `GET /tags` aceita
  `ids`, `slug` exato e `limit`/`offset` em ordem de nome, e continua um array;
  `GET /media/storage` informa o espaço livre de onde ficam os bytes de mídia.
- **No portal**, o contexto do mapper passa a ser da página, não do site:
  - categorias, autores e entidades — poucos — continuam inteiros;
  - tags e mídias são pedidas pelos ids que os artigos da página apontam: capa, imagens e
    galerias do corpo, imagem de compartilhamento, retrato dos autores creditados. Os ids vão
    ordenados e em chamadas de 200, para que duas páginas com as mesmas matérias dividam a
    mesma resposta em cache;
  - uma instância sem o filtro continua funcionando: para tags, a resposta com tudo é um
    superconjunto e o resultado sai certo; para mídia, a resposta traz linhas que ninguém
    pediu, e só então a biblioteca é percorrida como antes, com `kalel.contract.degraded` no
    log;
  - `listTags()` saiu do contrato do repositório, trocado por `findTags(slugs)`: os filtros de
    assunto de uma editoria procuram só os slugs dos assuntos dela, e o assunto de uma matéria
    já está entre as tags da própria matéria. O redirecionamento de URL antiga de categoria
    procura a tag pelo slug, sem ler a primeira página dela;
  - sitemaps: cada arquivo de artigos é lido por `offset` (50 chamadas de 100, cinco por vez)
    em vez de percorrer o acervo inteiro por cursor a cada arquivo; a contagem de arquivos sai
    do `total` de uma chamada; o sitemap de tags pagina o vocabulário de mil em mil; e o
    caminho de cada artigo usa só as tags reservadas de layout, lidas pelo slug, porque são
    as únicas que mudam uma URL.

**A importação em produção roda como uma sessão** (`scripts/acervo-import.ps1` →
`pnpm wp:import-session`), porque o que cerca a importação não pode depender de memória:

- **os webhooks do site são pausados.** Cada artigo importado emite um evento de publicação;
  41 mil revalidações gastariam o token de entrega do portal (600 por minuto) com a
  importação em vez de com os leitores. Um assinante pausado não recebe nada, e o cache do
  portal se renova sozinho pelas janelas de ISR;
- **um token de importação é criado com validade de 48 horas** e só chega ao processo do
  importador, pelo ambiente — nunca por argumento, arquivo ou log;
- **o importador roda duas vezes**, e a segunda precisa reportar `created: 0` (RUNBOOK §4.2.1);
- **sempre, com sucesso ou falha, os webhooks voltam e o token é revogado.** O que foi pausado
  e criado fica num arquivo de sessão antes da importação começar, e `-Recover` desfaz tudo
  se a janela for fechada no meio. A única credencial que o operador digita é a senha do
  owner, sem eco.

**Decisões do owner para a importação:** as imagens de terceiros dentro dos textos são
baixadas e hospedadas (revoga §4.10, com o risco de direito autoral aceito), e os posts sem
editoria são classificados automaticamente; o que não tiver classificação segura fica de fora,
numa lista.

### 7.16 O importador diante do acervo real (2026-09-17)

O que mudou no importador para a importação de produção
([RUNBOOK §4.2.2](./RUNBOOK.md)), e por quê.

**Três defeitos que teriam quebrado a importação**, corrigidos:

- o `externalKey` das mídias ia num campo do formulário, e o Kal El o lê da query string —
  nenhum upload seria reconhecido numa segunda passada;
- o `Idempotency-Key` levava dois-pontos, que o Kal El recusa com 400 — todo upload falharia;
- o índice de mídias parava em 200 páginas (40 mil linhas, contra 73 mil anexos) e tratava
  uma página com erro como a última.

Um 429 agora pausa todas as faixas até o `Retry-After`, em vez de virar falha.

**Imagens de terceiros** (`--external-images`, decisão do owner em §7.15):

- um pré-passe roda a transformação real sobre as matérias que serão importadas e junta as
  imagens que ela não resolve fora do domínio do site. No acervo são 32.145 URLs únicas, em
  61 hosts;
- o download conecta só ao endereço verificado (fecha o DNS rebinding), revalida cada
  redirect, corta no limite de bytes e exige imagem raster; no máximo 8 downloads ao mesmo
  tempo, 2 por host;
- a chave é `wp:external:<32 hex do sha256 da URL>`, com a query string preservada;
- o crédito mostrado ao leitor é o do veículo, não o do CDN: `Imagem: Screen Rant` para
  `static0.srcdn.com`;
- falha do terceiro (404, página HTML, host de exemplo) conta por host e não muda o código
  de saída; falha de gravação no Kal El conta como `failed`;
- depois que as imagens estão hospedadas, um `--apply` sem a flag é recusado antes de
  escrever, porque as matérias atualizadas perderiam as imagens.

**Posts sem editoria** (`--auto-desk`): cada categoria, tag e o título contam uma vez por
editoria, 2 pontos por palavra forte e 1 por média. Um post só é arquivado com 2 pontos ou
mais e pelo menos o dobro do segundo colocado. Medido sobre os posts que a redação arquivou,
com a editoria escondida, a regra concorda com ela em 95,7% dos de cinema, 97,6% dos de games
e 82,2% dos de séries. No acervo: 296 considerados, 124 arquivados (cinema 41, séries e TV 52,
games 28, quadrinhos 2, animes 1) e 172 de fora, listados em `auto-desk.json` — 107 sem
evidência, 40 de demonstração do tema, 11 de teste, 9 empates, 5 fracos.

**Posts publicados duas vezes.** 236 posts têm título normalizado e corpo byte a byte iguais
aos de um post anterior. São 234 matérias republicadas por automação, com `-2` ou `-3` no
slug e ids quase sempre vizinhos (mediana de distância 1), além de duas cópias de um post de
teste. Entra só o de menor id; a cópia é contada em `duplicatesSkipped`, listada em
`duplicates.json`, e o endereço antigo dela vai para o endereço novo do original pela tabela
de `redirects:build`. Cópia cujo original não foi importado falha junto com ele, e duas
matérias diferentes com slugs em colisão continuam falhando.

**Arquivos ausentes de `--uploads`.** 73.128 dos 73.158 originais estão no backup extraído
(12,9 GB). Dos 30 ausentes, 26 são as `demo-image` de 2018 do tema e 4 são arquivos soltos, e
nenhuma matéria importada usa qualquer um deles. Um arquivo ausente que nenhuma matéria
importada usa é pulado (`mediaMissingUnused`); um que alguma usa continua sendo falha.

**Espaço e ritmo.** Antes do primeiro upload o importador lê `GET /media/storage` e recusa
começar se o espaço livre for menor que a estimativa × 1,25. No acervo são 31,3 GB: 12,9 GB
medidos e 18,4 GB estimados a 600 KB por imagem de terceiro. As faixas (`--concurrency`,
padrão 4) mantêm a ordem que importa: posts que disputam um slug rodam em sequência, e o
checkpoint é gravado inteiro.

**Ensaio completo, sem rede, com as flags de produção:** 41.318 lidos, 40.910 a importar,
172 de fora, 236 cópias, 30 arquivos ausentes e sem uso, 32.145 imagens de terceiros,
`failed: 0`, em 346 s.

**Pendência editorial:** o post "Teste com Categorias" (wp 95007) tem editoria válida e entra
como matéria; a redação pode despublicá-lo no CMS.

### 7.17 O upload que guardava na memória cada imagem enviada (2026-09-17)

A importação de produção criou as 45 mil categorias e tags e começou a subir as imagens no
ritmo esperado, mas a memória do processo crescia junto com o que já tinha sido enviado: 6,6
GB depois de 26.960 imagens e 11 GB depois de 51 mil, numa máquina de 32 GB — com as 32 mil
imagens de terceiros (18,4 GB estimados) ainda pela frente. Não era estrutura do importador:
era uma cópia de cada arquivo já enviado.

A causa está no corpo do upload. `FormData` + `Blob` é o caminho natural para multipart no
Node, e o `Blob` copia os bytes para uma área nativa que o V8 não contabiliza. Como o coletor
decide quando rodar pelo que contabiliza, um upload terminado não gera pressão nenhuma: o
invólucro em JS é minúsculo, sobrevive aos ciclos jovens, e a cópia nativa fica presa até que
outra coisa provoque uma coleta completa — que não acontece num laço que quase só espera rede.

Medido aqui, 2.000 envios de 200 KB (391 MB no total) contra um servidor local:

| Corpo do upload                   | RSS no início | RSS no fim |
| --------------------------------- | ------------- | ---------- |
| `FormData` + `Blob` (como estava) | 61 MB         | 524 MB     |
| Buffer multipart (como ficou)     | 61 MB         | 120 MB     |

`multipartFile()` monta o corpo num Buffer — um ArrayBuffer que o V8 conta — e o arquivo
passa a ser coletado como qualquer outra alocação. Os bytes na rede são os mesmos: o teste em
`tests/unit/wp-kalel-target.test.ts` compara byte a byte com o que o `FormData` do undici
serializa, inclusive o escape de aspas, quebra de linha e acento no nome do arquivo, porque
quem aceita ou recusa esse corpo é o parser multipart do Kal El, e ele não tem ensaio. O corpo
é montado uma vez por upload, então uma repetição por 429 reenvia os mesmos bytes em vez de
copiar o arquivo outra vez.

Uma importação interrompida no meio disso não perde o que subiu: retoma com `-Recover` e o
mesmo comando ([RUNBOOK §4.2.2](./RUNBOOK.md)), e o Kal El devolve pelo `externalKey` a mídia
que já tem em vez de duplicá-la.

### 7.18 A primeira sessão de produção, e a segunda (2026-09-21)

A primeira passada da sessão de 2026-09-17 terminou às 18:45: 41.318 posts lidos, **40.907
matérias criadas**, as 73.128 mídias do acervo no Kal El, 31.019 imagens de terceiros
hospedadas (21.108 baixadas nesta execução e 9.911 já presentes da execução interrompida em
§7.17), 1.126 imagens de terceiros que o host não entregou, 236 cópias puladas, 124 posts
arquivados pelo `--auto-desk` e 172 de fora. E **20 falhas**, todas `VALIDATION_ERROR` do Kal El:

- **17 tags com nome acima de 80 caracteres.** Listas de títulos que uma automação arquivou
  como tag ("Múltiplos títulos de filmes (incluindo Jaws, Blade Runner: The Final Cut,
  Alien: Romulus, …)"); três delas também com o slug acima de 100;
- **3 matérias (wp 113552, 114755 e 116292) com um único parágrafo de 11.802 a 15.018
  caracteres**, acima dos 10.000 de um nó de texto — texto de automação sem quebra de linha.

Como desenhado, a sessão não rodou a segunda passada (ela só roda depois de uma primeira sem
falhas), retomou os webhooks e revogou o token.

**Achado no site, não na contagem:** o WordPress guarda nomes de termo com o `&` escapado, e a
importação os gravou assim. 235 tags — 83 categorias rebaixadas a tag e 152 tags, entre elas
"Deadpool & Wolverine", "Lilo & Stitch" e "Dungeons & Dragons" — apareciam no título da página
como `Deadpool &amp; Wolverine`. Nos textos, o mesmo acontecia em 1 título, 3 resumos
(`ser&aacute;`) e 8 textos alternativos.

O que mudou para a segunda sessão:

- **nomes de termo** são decodificados e cabem nos limites do Kal El — tag 80/100, categoria e
  autor 120/140 — cortados numa palavra, com "…", e o slug num hífen. Nenhum slug gravado muda:
  só passam do limite os 17, que nunca foram criados. O endereço antigo das três listas com slug
  acima de 100 deixa de resolver; são listas de títulos de um post cada;
- **as 235 tags gravadas com o nome escapado são renomeadas** (`PATCH /tags/:id`, só o nome),
  apenas enquanto o nome guardado for exatamente o que a importação escreveu: um nome que a
  redação mudou é da redação;
- **um nó de texto acima de 10.000 caracteres vira vários**, com as mesmas marcas, e o leitor vê
  o mesmo parágrafo. Legenda, crédito e texto alternativo de imagem acima do limite (2.000, 500 e 500) são cortados, em vez de recusarem a matéria inteira;
- **`toPlainText` decodifica numa passada só**, referências numéricas e nomeadas. A cadeia de
  substituições anterior também decodificava duas vezes: `&amp;lt;` virava `<`;
- **matéria que a redação editou no CMS** desde a importação fica como está, conta em
  `editedInCms` e é listada em `edited-in-cms.json`, sem falhar a execução. O site é publicado
  do Kal El desde 2026-09-17 e a redação edita matérias importadas todos os dias; contada como
  falha, cada edição impediria a sessão de chegar à prova de idempotência;
- **uma listagem de termos que falha interrompe a execução.** Antes ela virava uma lista vazia,
  e cada termo existente seria um 409 na criação.

O Kal El de mentira dos testes passou a recusar o que o real recusa — os limites de termo, o nó
de texto de 10.000 e os campos de imagem — e aceita `PATCH /tags/:id`. O WordPress de mentira
ganhou a tag escapada, a lista longa e o parágrafo gigante: o ensaio de ponta a ponta agora
teria falhado como a produção falhou.

**Ensaio com as flags de produção (2026-09-21):** 41.318 lidos, 40.910 a importar,
`failed: 0`, 17 nomes encurtados. As 124 decisões do `--auto-desk` e os 236 pares de cópias
são os mesmos da produção, post a post: nenhuma matéria muda de editoria — e portanto de
endereço — quando a segunda sessão reenviar os campos. E os 40.910 documentos, montados como o
importador os envia, passam no `documentV2Schema` do próprio Kal El.

### 7.19 Os endereços antigos respondiam um redirecionamento sem destino (2026-09-21)

**O que o Google recebia desde a virada (2026-09-16).** O endereço antigo de cada matéria —
`/{slug}`, o permalink do WordPress — era resolvido dentro da página `/[categoria]`, que o Next
guarda em cache (ISR, 120 s). O Next 15.5 guarda no cache o redirecionamento lançado durante
essa renderização e depois o serve como `308 Permanent Redirect` **sem o cabeçalho
`Location`**: o navegador segue pelo código da página, o robô não tem para onde ir. E os
endereços pedidos antes de a importação chegar à matéria ficaram com um 404 em cache, servido
"velho" por até um ano (`stale-while-revalidate`). Numa amostra de 40 endereços antigos, em
2026-09-21, **nenhum** chegava à matéria: 34 respondiam 404 e 6 o 308 sem destino.

O teste de ponta a ponta existia e passava: pedia o endereço uma vez só, e a primeira resposta
— renderizada na hora — sai certa. O defeito é da segunda em diante, que vem do cache.

**Primeira tentativa, descartada:** chamar `connection()` antes do redirecionamento, para tirar
só essa resposta do cache. Numa rota ISR o Next responde 500 (`DYNAMIC_SERVER_USAGE`) — uma
rota decidida estática no build não pode virar dinâmica na hora. O teste local pegou antes de
ir para o ar.

**O que ficou:**

- o `middleware.ts` reconhece um trecho único que não é editoria nem rota do site e o reescreve
  — o endereço continua o antigo — para `/legado/[slug]`, renderizada sempre na hora
  (`force-dynamic`), que redireciona com destino (308) ou responde 404;
- a página 1 de uma listagem (`/page/1`, `/cinema/page/1`) é redirecionada no próprio
  middleware (308), sem passar pela página em cache;
- matéria pedida em outra editoria, e oferta pedida como matéria, respondem com `Moved`: um
  `refresh` instantâneo — que o Google lê como redirecionamento permanente — mais o canonical
  da matéria, que já aponta para o endereço certo. Essas páginas continuam em cache, e isso
  sobrevive ao cache;
- `/2026/08/19/`, arquivo de um dia no WordPress, deixou de ser lido como uma matéria de nome
  "19".

Os testes de ponta a ponta agora pedem cada endereço **três vezes** e exigem o destino em todas.

**Depois do deploy:** limpar o cache da Cloudflare, que guardou os 404 e os 308 sem destino.

Conferido depois: a Cloudflare não guardou nada disso. As páginas saem com `s-maxage=60` e os
redirecionamentos do `/legado` com `no-store` (`cf-cache-status: BYPASS`), então nada velho
sobrevive mais de um minuto na borda, e a limpeza manual do cache não foi necessária.

### 7.20 SEO P1 e o que a revisão dele mudou (2026-09-21)

O diagnóstico de SEO ([SEO-DIAGNOSTICO.md](./SEO-DIAGNOSTICO.md) §3.3) apontou T4 a T9. O PR #10
os corrige:

- **Capas.** Rota `/media/{id}/{variante}-v1.jpg`: recortes 16:9, 4:3 e 1:1 com 1200 px, em
  JPEG, pela região mais saliente (`sharp`, `attention`). O `NewsArticle` declara os três; o
  `og:image` é o 16:9. A imagem social escolhida pela redação sai como `social-v1.jpg`: JPEG nas
  proporções dela, sem corte, porque foi composta para o card.
- **Autor.** Matéria sem autor assina "Redação Máquina Nerd" na página e tem a organização
  como `author` no JSON-LD; autor com redes ganha `sameAs`.
- **Datas.** `dateModified`, `article:modified_time` e o `lastmod` do sitemap são a última
  edição, ou a publicação. A regravação da importação não conta.
- **Tags.** A página de tag com menos de 5 matérias é `noindex, follow`. O sitemap de tags
  lista só os hubs das editorias que passam desse limite, pela mesma conta
  (`lib/content/tags.ts`). Nenhuma URL é enviada e excluída ao mesmo tempo.
- **Sitemaps.** Sem `lastmod` no índice e nas taxonomias, porque nada registra quando mudaram.

A revisão independente do diff (o Codex não roda nesta máquina, §7.12) mudou, antes do merge:

- **A rota de recorte custa pouco por pedido e roda pouco de cada vez.**
  - Query string vira 301 para o endereço limpo: a Cloudflare usa a query na chave do cache,
    e cada `?x=n` seria um recorte novo.
  - No máximo 2 recortes simultâneos e 32 na fila; acima disso, 503 com `Retry-After`. Quem
    desiste enquanto espera sai da fila sem gastar leitura no CMS.
  - O download do original tem 10 s. Um CMS travado devolve o lugar na fila em vez de
    segurá-lo pelos ~100 s que a Cloudflare espera.
  - O original é lido até 25 MB e decodificado até 40 MP (`MAX_SOURCE_PIXELS`). O mesmo limite
    decide se a URL do recorte é publicada; acima dele, a página usa o original.
  - `failOn: 'none'`. A segunda revisão provou que `'truncated'` ainda recusa um JPEG que
    termina antes da hora, comum no acervo antigo e aberto por qualquer navegador. Quem protege
    o decodificador são os limites de bytes e pixels.
  - Nenhum ajuste global do sharp (`concurrency`, `cache`): ele vale para o processo inteiro e
    deixaria o `next/image` mais lento.
- **O sitemap de tags lê os hubs de 4 em 4.** Um hub que o CMS não responde fica de fora e vai
  para o log; o arquivo sai com cache de um minuto, em vez de um 500.
- **A versão está no nome do arquivo** (`-v1`). O recorte é imutável por um ano em todas as
  camadas; mudar tamanho, qualidade ou estratégia exige trocar `RENDITION_VERSION`.
- **As janelas de importação valem só para o acervo** (`externalKey` `wp:post:*`). Matéria
  publicada no Kal El mantém todas as edições, dentro de janela ou não. Para matéria importada,
  toda escrita dentro de uma janela é a importação, inclusive a de um post que o WordPress
  publicou no dia da primeira sessão.
- **A segunda janela fica aberta até 2026-10-31**, porque a segunda sessão ainda não rodou.
  Quando ela terminar, a janela deve ser estreitada para o horário real. Se a sessão rodar
  depois de 31/10, estender antes.
- **A fixture segue o mesmo contrato de `lastmod`** do repositório do Kal El.
- **A CI prova, dentro da imagem de produção (Alpine), o caso real**: decodificar um AVIF,
  recortar com `attention` e gravar JPEG.

### 7.21 A queda de 2026-09-21 e o endereço antigo em um salto

**A queda.** O site ficou fora do ar das 19:56 às 23:45 UTC. Não foi o código:

1. No deploy do PR #9 o build passou, mas o Docker travou ao remover o contêiner antigo
   ("removal ... already in progress"). O portal ficou sem contêiner.
2. O rollback do Coolify não reaproveita a imagem anterior: remonta a partir do commit. Esse
   build falhou pelo limite de requisições do Kal El (429, ainda com 500 matérias pré-renderizadas).
3. O novo Redeploy do mesmo commit (40 matérias pré-renderizadas) subiu normalmente.

O portal respondeu 503 o tempo todo, o código certo para uma indisponibilidade passageira.
Na primeira meia hora depois da volta, parte das requisições pela Cloudflare levou de 7 a 60 s,
com a origem respondendo em menos de 1 s quando chamada direto; normalizou sozinho.

Para a próxima vez:

- um deploy que falha **no build** não derruba nada, porque o contêiner antigo continua no ar;
- um deploy que trava **na troca de contêiner** derruba: conferir o site logo depois de cada
  deploy e, se cair, mandar Redeploy de novo em vez de rollback;
- rollback só serve para um commit cujo build passe hoje.

**O endereço antigo em um salto.** Todo permalink do WordPress terminava em `/`. O Next tirava a
barra com um redirecionamento próprio e só depois o middleware mandava para a matéria: dois
saltos. Com `skipTrailingSlashRedirect`, o próprio middleware tira a barra antes de decidir
(tabela, página 1, permalink antigo); para os demais endereços com barra, responde 308 para a
versão sem ela, como o Next fazia.

As URLs de destino são montadas com `URL`, não com `request.nextUrl.clone()`. O clone lembra que o
pedido terminava em barra e a recoloca: `/filmes/` iria para `/cinema/`, mais um salto.
