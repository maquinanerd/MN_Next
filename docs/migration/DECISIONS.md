# Decisões e premissas

Registro das escolhas feitas sem consulta, conforme a carta de execução: onde a
informação não existia, o padrão mais seguro foi adotado e anotado aqui. Cada entrada diz
**o que** foi decidido, **por quê**, e **como reverter** se a premissa for negada.

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

### 3.3 Convenções por tag reservada

`longform` e `ao-vivo` selecionam template; `patrocinado`, `afiliado`, `review-amostra` e
`campanha` marcam conteúdo comercial; `morte`, `acidente`, `tragedia`, `processo-judicial`
e `violencia` suprimem publicidade no servidor. São convenções editoriais, não campos —
mudá-las é mudar `RESERVED_TAGS` em um arquivo.

### 3.4 Proteção de replay sem timestamp assinado

O Kal El não envia timestamp. A defesa é o nonce de idempotência com _claim atômico_ mais
a janela derivada do `publishedAt` assinado. O store é em processo; em múltiplas instâncias
o pior caso é uma revalidação redundante, nunca um efeito duplicado.

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

### 4.5 Permalink legado ainda não confirmado

`docs/04` marca isso como aberto e bloqueante da fase de redirects. O middleware trata as
formas comuns (`/{ano}/{mes}/{slug}`, `?p=`, feeds, `wp-json`, `categoria/`, `author/`); a
tabela real vem de `pnpm redirects:build` sobre o inventário. **Não é possível declarar
"zero 404" sem a amostra de URLs de tráfego** — está registrado como pendência externa.

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
alcançada por omissão, então a validação de ambiente exige a escolha.

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
