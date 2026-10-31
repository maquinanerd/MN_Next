# Front-end Máquina Nerd + OpaPreço Ads — relatório final

30/10/2026 · branch `claude/maquina-nerd-frontend-470851`

Construí o front-end completo descrito em `maquina-nerd-kit/PROMPT-FRONTEND.md`: as 10 etapas, de ponta a ponta, em Next.js 16 (App Router), TypeScript e Tailwind 4. A monetização em página é só OpaPreço Ads; não há AdSense em lugar nenhum. Conteúdo e ofertas são de demonstração, atrás de adaptadores que se trocam sem mexer em componente.

## Onde está e como rodar

O projeto fica em **`frontend/`**, não na raiz. A raiz deste repositório é o portal em produção (Next.js + Kal El); criar outro projeto por cima o destruiria. `frontend/` tem `package.json`, lockfile, lint e build próprios, e a raiz ignora a pasta no lint, no TypeScript, no Prettier e na imagem Docker — o deploy do portal não muda.

```bash
cd frontend
npm install
npm run dev
```

Abre em http://localhost:3000. `npm run build`, `npm run lint`, `npm run typecheck` e `npm test` também estão disponíveis. Variáveis e estrutura: `frontend/README.md`.

### Rotas

| Rota                                                                                                                                                | Página                                                            | Protótipo                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------- |
| `/`                                                                                                                                                 | home                                                              | Template                    |
| `/page/[n]`                                                                                                                                         | "Mais do Máquina Nerd", páginas 2+                                | Template                    |
| `/[editoria]`                                                                                                                                       | cinema, series-e-tv, games, quadrinhos, animes, videos, especiais | Categorias                  |
| `/[editoria]/page/[n]`                                                                                                                              | lista paginada                                                    | Categorias                  |
| `/[editoria]/assunto/[assunto]` (+ `/page/[n]`)                                                                                                     | filtro de assunto                                                 | Categorias                  |
| `/[editoria]/[slug]`                                                                                                                                | matéria padrão ou overlay (o layout vem da matéria)               | Notícias / Notícias Overlay |
| `/ofertas/[slug]`                                                                                                                                   | matéria de oferta                                                 | Notícias Publi              |
| `/ofertas`                                                                                                                                          | índice das matérias de oferta                                     | —                           |
| `/busca?q=`                                                                                                                                         | busca                                                             | —                           |
| `/sobre`, `/newsletter`, `/anuncie`, `/politica-de-afiliados`, `/politica-de-privacidade`, `/termos-de-uso`, `/cookies`, `/acessibilidade`, `/mais` | institucionais                                                    | —                           |
| `/dev/componentes`, `/dev/opapreco`                                                                                                                 | vitrines internas (fora do índice)                                | Design System, `*_v1`       |
| `/sitemap.xml`, `/robots.txt`, `/opengraph-image`, `/icon.svg`                                                                                      | SEO                                                               | —                           |

Páginas para abrir primeiro: `/`, `/cinema`, `/cinema/o-misterio-de-scarlett-johansson` (padrão), `/cinema/como-scarlett-johansson-virou-o-centro-de-um-mito` (overlay), `/ofertas/controle-xbox-edicao-especial-queda-de-preco` (oferta) e `/dev/opapreco` (os seis componentes em todos os estados).

## Arquivos principais

| Área                 | Arquivos                                                                                                                                                                                                                                                                                |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tokens e breakpoints | `frontend/app/globals.css` (tema Tailwind, variantes `mob`/`le900`/`le1100`/`le1180`/`le1240`/`lt1024`, coluna da matéria alinhada ao menu), `components/opapreco/tokens.css` (cópia de `opapreco/tokens.css`)                                                                          |
| Layout               | `components/layout/SiteHeader.tsx` (nav com filete), `Menu.tsx` (gaveta), `SiteFooter.tsx`, `DemoBanner.tsx`, `Institutional.tsx`, `NewsletterForm.tsx`                                                                                                                                 |
| Primitivos           | `components/cards/*` (HeroCard, OverlayCard, BigCard, StackCard, SideList, RowCard), `components/ui/*` (SectionTitle, Pagination, EditoriaLabel, Meta, FitSidebar)                                                                                                                      |
| Seções               | `components/sections/Abertura.tsx`, `Feed.tsx`, `EditoriaView.tsx`, `VideoRail.tsx`                                                                                                                                                                                                     |
| Matéria              | `components/article/MateriaViews.tsx` (padrão, overlay e oferta), `ArticleBody.tsx`, `ArticleParts.tsx`, `AuthorRail.tsx`, `ShareButtons.tsx`                                                                                                                                           |
| Comercial            | `components/commerce/Commerce.tsx` (ProductCard multi-loja, FloatRelated, SponsoredGrid, AffiliateNotice, LeiaTambem)                                                                                                                                                                   |
| OpaPreço             | `components/opapreco/` (OpaSlot, os seis `*V1`, OfferLink, SlotView, Skeletons, opapreco.css); `lib/ads/rules.ts` (regras de preço), `types.ts` (contratos em zod), `slots.ts` (mapa de posições), `placement.ts` (posição no texto), `opapreco.ts` (cliente do ad server), `fixtures/` |
| Conteúdo             | `lib/content/adapter.ts` (interface), `index.ts` (leitura com cache por tag), `fixtures/` (chamadas, corpos extraídos dos protótipos, imagens), `cms.ts` (ponto de ligação do CMS)                                                                                                      |
| SEO                  | `app/sitemap.ts`, `app/robots.ts`, `app/opengraph-image.tsx`, `lib/seo/jsonld.ts`, `app/not-found.tsx`, `app/error.tsx`                                                                                                                                                                 |
| Testes               | `lib/ads/rules.test.ts` (30), `lib/ads/placement.test.ts` (4), `lib/seo/jsonld.test.ts` (2)                                                                                                                                                                                             |

## O que cada etapa entregou

1. **Fundação.** Tokens, Montserrat variável (300–800), cabeçalho (logo · nav centralizada · busca e menu; no mobile, hambúrguer · logo · busca em 56px), nav de 9 itens com filete de 4px que preenche no hover, gaveta (48px por item, Esc fecha), rodapé (uma coluna e links em duas abaixo de 900px).
2. **Primitivos.** Todos os da lista, mais a `FitSidebar`: a lateral estica até a altura da linha e a chamada que não cabe inteira quebra para uma segunda coluna invisível — corte feito pelo CSS já na primeira pintura, sem salto; o efeito cliente (ResizeObserver + `document.fonts.ready`) só a tira da tabulação. Card da lateral some abaixo de 1180px.
3. **OpaPreço.** Os seis componentes conforme a spec §5 (estados §7, imagem `contain` §8, truncamento §9, a11y §10, disclosure §11, microcopy §12). Regras de preço §4 com testes sobre `fixtures-offers.json` (25 na etapa, 30 depois da revisão): `mustNotRender` dá 204, `mustHideDiscount` mostra só o preço atual, verificação acima de 6 h não é servida, queda sem prova não renderiza. `OpaSlot` valida a resposta (zod), renderiza no servidor, tem esqueleto com a mesma geometria e colapsa sem caixa em 204, erro ou timeout de 1,5 s. Grade com `repeat(auto-fit, minmax(min(100%,140px),1fr))` e o `gap` do publisher.
4. **Home.** Ordem e slots do protótipo: abertura com card de games na lateral; Notícias de cinema → grade cinema; Games → grade games; Séries e TV com "Últimas de Quadrinhos" → grade séries; Animes | Especiais → grade animes; Vídeo em destaque → grade quadrinhos; Mais do Máquina Nerd com card a cada 3 itens, paginação e 2 cards fixos.
5. **Editoria.** Uma implementação para as 7: título, filtros de assunto, abertura, grade da própria editoria, lista com card a cada 3, "Carregar mais", paginação e 2 cards fixos.
6. **Matéria padrão.** Coluna do autor, texto alinhado ao menu, capa larga, linha fina → `product_hero_v1` (card no mobile), contextual após o 2º parágrafo, cards e queda de preço sempre entre dois blocos de texto, "Mais como este", grade antes das relacionadas.
7. **Matéria overlay.** Capa em tela cheia com o cabeçalho branco sobre a foto; mesmos slots.
8. **Matéria de oferta.** Sem coluna do autor; card multi-loja próprio (`rel="sponsored nofollow"`), caixa "Relacionado", subtítulos em vermelho, aviso de afiliados, conteúdo patrocinado com card fixo ao lado.
9. **Busca e institucional.** Busca dinâmica fora do índice; institucionais com os textos reais do portal atual, adaptados (sem AdSense e sem Analytics, que este front não tem); newsletter com estados de erro e confirmação e o aviso de que é simulação.
10. **Fechamento.** Metadata e Open Graph, `sitemap.ts`, `robots.ts`, JSON-LD (`NewsArticle`, `BreadcrumbList`, `NewsMediaOrganization`, `WebSite`), 404 e 500, Lighthouse, auditoria de contraste e de rolagem horizontal.

Cada etapa terminou com `npm run build` e `npm run lint` limpos e um commit próprio.

## O que foi conferido em cada largura

Tudo aberto no navegador (servidor de desenvolvimento e build de produção) e comparado lado a lado com os protótipos, servidos localmente.

| Verificação                                              | 390                                | 768                                                         | 1024                                       | 1440                                            |
| -------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------- |
| Rolagem horizontal (28 rotas, medida em cada largura)    | nenhuma                            | nenhuma                                                     | nenhuma                                    | nenhuma                                         |
| Lateral da abertura × coluna principal (home e editoria) | lateral empilha, todas as chamadas | 504 = 504px                                                 | 612 = 612px                                | 730 = 730px                                     |
| Card OpaPreço da lateral da abertura                     | não existe                         | oculto (< 1180)                                             | oculto (< 1180)                            | visível                                         |
| Grade OpaPreço × colunas de notícia                      | 2 colunas, gap 16                  | 2 colunas, cada uma sobre 2 colunas de notícia (68 e 397px) | 4 colunas sobre as 4 (68, 296, 525, 753px) | 4 colunas sobre as 4 (68, 400, 733, 1065px)     |
| Cards fixos da lista (sidebar)                           | não existem                        | não existem (< 1024)                                        | 2 cards                                    | 2 cards                                         |
| Coluna de texto da matéria × menu                        | 100%                               | 100%                                                        | sob o menu                                 | 351–1149px, igual ao menu (protótipo: 352–1150) |
| Cabeçalho                                                | hambúrguer · logo · busca          | nav rolando                                                 | nav rolando, 12px                          | nav centralizada                                |

A lateral nunca passa da altura da coluna principal: na abertura isso é garantido pelo corte da `FitSidebar`; na lista, os cards fixos são limitados pelo número de notícias da página (com menos de 3 notícias, um card; com uma, nenhum).

### Lighthouse (build de produção, depois das correções da revisão)

| Página                             | Slots                              | Perf     | A11y      | BP        | CLS   | LCP         |
| ---------------------------------- | ---------------------------------- | -------- | --------- | --------- | ----- | ----------- |
| Home mobile                        | ativos                             | 96       | 100       | 100       | 0     | 2,8 s       |
| Home desktop                       | ativos                             | 100      | 100       | 100       | 0,005 | 0,7 s       |
| Editoria (Cinema) desktop          | ativos                             | 100      | 100       | 100       | 0     | 0,6 s       |
| Editoria (Games) desktop           | ativos                             | 100      | 100       | 100       | 0,005 | 0,4 s       |
| Matéria padrão mobile              | ativos                             | 94       | 100       | 100       | 0     | 2,8 s       |
| Matéria padrão desktop             | ativos                             | 100      | 100       | 100       | 0     | 0,6 s       |
| Matéria de oferta mobile / desktop | ativos                             | 91 / 100 | 100 / 100 | 100 / 100 | 0 / 0 | 3,1 / 0,6 s |
| Busca mobile                       | —                                  | 96       | 100       | 100       | 0     | 2,6 s       |
| Home mobile / desktop              | todos vazios (`OPAPRECO_MODE=off`) | 94 / 100 | 100 / 100 | 100 / 100 | 0 / 0 | 3,0 / 0,7 s |
| Matéria mobile / desktop           | todos vazios                       | 95 / 100 | 100 / 100 | 100 / 100 | 0 / 0 | 2,9 / 0,6 s |

Os slots chegam renderizados no HTML; vazios, nenhum invólucro sobra na página. Os 0,005 vêm do card da lateral da abertura, que se move alguns pixels depois do carregamento — muito abaixo do limite de 0,1. As linhas "todos vazios" foram medidas antes das correções da revisão; o caminho de colapso não mudou depois delas. A matéria overlay foi medida antes da revisão (desempenho 96, acessibilidade 100, CLS 0).

SEO fica em 61 porque, em demonstração, todas as páginas saem com `noindex` de propósito; o outro aviso é o texto genérico do item "Mais" da nav (que o protótipo define). A página 404 não é medida pelo Lighthouse, que recusa respostas 404; foi conferida no navegador.

## Divergências do protótipo ou da spec, e por quê

**Por contraste (≥ 4,5:1 é inviolável)**

- Texto sobre a cor cheia de Cinema, Séries e TV e Quadrinhos é preto (#000), não branco como no doc 01: branco dava 4,3:1, 4,0:1 e 2,5:1. Vale para a nav ativa e no hover, filtros, paginação e selo da próxima leitura. Com #111 o roxo ainda dava 4,37:1; por isso #000.
- O título da editoria usa a variante de texto (#7A21DB etc.); o protótipo usa a cor cheia, e o amarelo de Games dá 1,5:1.
- Links dentro do texto são sublinhados (o protótipo só muda a cor): a cor da editoria contra o corpo #333 fica abaixo de 3:1 (WCAG 1.4.1).
- Nos cards com título sobre a foto, o título continua branco no hover; no protótipo ele herdaria o vermelho do hover global, ilegível sobre foto escura.
- O preço dentro do botão vermelho da loja não tem a opacidade de 85% (3,75:1).

**Pela spec do OpaPreço, que vence nos componentes**

- `product_card_v1` vertical usa imagem de 180px (spec), não 160px (protótipo).
- Os cards laterais só existem a partir de 1024px (spec §6); o protótipo os mostrava até 761px. Abaixo de 1024 a lista ocupa a largura toda.
- Disclosure nunca abaixo de 11px: o rótulo "Oferta · link de afiliado" do card multi-loja e o "Parceiro · Patrocinado"/"Publicidade" do conteúdo patrocinado subiram de 10px para 11px.
- Imagem de produto do card multi-loja em `contain` sobre #F7F7F7 (o protótipo usa `cover`; a regra do kit proíbe).
- A spec fala em no máximo 4 slots ativos por matéria; o protótipo e o PROMPT pedem 6 posições (hero, contextual, 2 cards, queda, grade). Segui o protótipo; o ad server pode responder 204 para limitar.
- O nome acessível de cada oferta segue a spec ("{título} por {preço} na Shopee. Link de afiliado.") e termina com o texto do botão, para quem usa comando de voz. O Lighthouse ainda aponta "rótulo diferente do texto visível" (regra experimental do axe); manter o rótulo curto da spec foi a escolha.

**Por alinhamento e pela regra da lateral**

- A grade OpaPreço do site usa 4 colunas, ou 2 quando não cabem 4 de 140px. Com `auto-fit` puro, a 768px cairiam 3 colunas desalinhadas das de notícia. O componente mantém `auto-fit` como padrão fora do site (matéria).
- A lateral da abertura volta ao fluxo normal só no mobile (≤ 760px), não em 900px como diz o doc: entre 761 e 900px a grade ainda tem 4 colunas, e em fluxo normal a lateral passaria da altura da coluna principal.
- Na matéria de oferta, os cards ficam depois de parágrafos (regra "nunca logo após imagem"); o protótipo põe um deles logo após a figura.

**Por honestidade de dados**

- Das 15 fotos dos protótipos, só 5 ainda existem no site atual (as outras dão 404). As fixtures reaproveitam essas 5 e a ilustração de quadrinhos do kit, e o `alt` descreve a foto que de fato aparece — por isso a capa da matéria sobre Scarlett Johansson mostra o Jack Sparrow.
- Autores sem avatar: são fictícios e o doc 04 proíbe retrato falso ou círculo com inicial.
- Rodapé sem "Podcast" (não há página de destino); "Reviews" leva a Especiais › Crítica; "Mais" leva a `/mais`, o mapa do site.
- A aba "Mais vistos" do vídeo em destaque só aparece com dado de audiência; as fixtures não têm.
- Parágrafos chegam como trechos tipados (texto, negrito, link), não como `html` cru como no doc 04: nada do CMS é injetado sem mapeamento.

**Outros ajustes**

- Na matéria padrão, abaixo de 900px aparece a linha de autoria (nome e datas); o protótipo esconde a coluna do autor sem substituto.
- Texto do corpo sem hifenização (o protótipo pede `hyphens: auto`), como já decidido no portal ("texto justificado, sem hifenização").
- 20px entre parágrafos seguidos (o protótipo não tem dois parágrafos colados).
- A Montserrat 300 é carregada de fato: o protótipo pede peso 300 na parte leve dos títulos, mas não carrega esse peso e o navegador desenhava 400.
- Botões de compartilhar: "G" envia por e-mail (o protótipo não define); o nome acessível começa pelo glifo visível.
- Coluna do autor com 10px entre os assuntos (8px no protótipo), para os alvos de toque terem 24px de passo.
- Faixa "Demonstração" de 28px no topo enquanto houver fixtures (doc 04: marcar a página, não o conteúdo).
- A capa da overlay ocupa `100svh` (o protótipo usa `100vh`; o doc 02 fala em `clamp(360px, 62vh, 640px)` — vale o protótipo).

## Revisão independente

Ao fim, um subagente revisou o código sem o meu raciocínio, só com o projeto, a spec e o PROMPT. Dos 14 achados, todos conferiam com o código e foram corrigidos (commit `f8d7ee6`), com testes onde cabia:

1. **XSS no JSON-LD (grave).** O escape de `<` tinha ficado sem efeito: um título vindo do CMS com `</script>` executaria script. Agora `<`, `>`, `&`, U+2028 e U+2029 viram escapes Unicode; teste novo.
2. **Selo sem prova.** "Menor preço recente" e "Boa oportunidade" vindos do servidor só aparecem com a prova (menor preço de 30 dias; desconto comprovado de 10% ou mais); senão, "Oferta verificada".
3. **Percentual não conferido.** Desconto e queda agora são recalculados pelos preços (tolerância de 1 ponto): "−40%" sobre uma queda real de 3% não aparece.
4. **URLs do ad server.** Link afiliado, imagem e URL de impressão só em https; lista opcional de hosts em `OPAPRECO_ALLOWED_HOSTS`.
5. **"Verificado há X min" congelado no cache.** O rótulo é recalculado no navegador a cada minuto, com duas linhas reservadas onde ele pode quebrar; a resposta do ad server expira em 15 min.
6. **CTA vazando do card lateral entre 1024 e ~1200px** (a coluna lateral tem 188px ali). O texto do botão quebra em vez de vazar; conferido em 1024 e 1180px.
7. **Mais de uma queda de preço por página.** `price_drop_v1` só na posição `article-drop`; nas outras, vira card.
8. **Desconto fora do nome acessível.** O nome do link agora diz "por R$ 549,90 (de R$ 699,90, 21% de desconto)"; saíram os `aria-label` internos, que não eram lidos.
9. **Busca em cache.** Saiu do cache (é dinâmica).
10. **Grade com 3 ofertas ou derrubada por uma oferta inválida.** Cada oferta é validada sozinha, e a grade mostra 2 ou 4.
11. **URL do ad server mal configurada derrubava a página.** Agora os slots colapsam e o erro vai para o log.
12. **`/page/02` como segunda URL da página 2.** Responde 404.
13. **Contextual no fim do texto.** Só entra com texto depois dele.
14. **Região "Ofertas" vazia para leitor de tela.** A coluna dos cards fixos virou layout puro. As rotas `/dev/*` passaram a existir só em demonstração.

Corrigir o item 5 trouxe uma regressão que o Lighthouse pegou: com `stale` abaixo de 5 minutos, o Next 16 tira o slot do HTML estático e o troca depois, deslocando o layout (CLS 0,023). O `stale` voltou a 5 minutos e o CLS voltou a 0.

## Pendências que dependem de você

1. **Ad server do OpaPreço.** Definir `OPAPRECO_AD_SERVER_URL` (https), `OPAPRECO_PUBLISHER` se não for `maquinanerd` e, de preferência, `OPAPRECO_ALLOWED_HOSTS` com os domínios dos links afiliados (Shopee e o redirecionador do OpaPreço). A integração já está pronta e validada contra os schemas do kit; falta confirmar com o OpaPreço:
   - que o `GET /v1/ad` aceita, além do `slot` (os 5 do schema), o parâmetro `placement` com as 20 posições do Máquina Nerd (`home-grid-cinema`, `article-drop`…) e `editoria`/`tags`, que o front envia;
   - a URL de contagem de impressão (`tracking.impressionUrl`, disparada com ≥ 50% visível por 1 s) e o `expiresAt`;
   - o domínio das imagens de produto (o front as usa sem otimização, então qualquer domínio funciona).
2. **CMS.** Implementar `ContentAdapter` em `frontend/lib/content/cms.ts` e ligar `MN_CONTENT_SOURCE=cms`. Você citou o WordPress; o portal em produção já lê o Kal El (o WordPress virou só fonte de importação), e o adaptador funciona com qualquer um dos dois. O CMS precisa fornecer: curadoria da home (manchete e destaques), layout por matéria (padrão, overlay ou oferta), corpo em blocos tipados, autores com retrato e redes reais, crédito das fotos e, se quiser a aba "Mais vistos", audiência.
3. **Ofertas reais.** Links de afiliado da Shopee com imagem de produto e horário de verificação (pelo ad server) e, para as matérias de oferta, os links e preços das lojas do card multi-loja (Amazon, Mercado Livre…) e os parceiros do "Conteúdo patrocinado".
4. **Outros.** Provedor da newsletter; revisão jurídica de privacidade e termos (os textos descrevem só o que o site faz); decidir como este front substitui ou se integra ao portal em produção — nada foi publicado nem implantado.

## Limitações conhecidas

- As 5 fotos de demonstração vêm de `www.maquinanerd.com.br/media/…`; se mudarem no site atual, somem também aqui.
- O loop "Claude implementa, Codex revisa" do `CLAUDE.md` vale para a migração do portal; o Codex CLI está sem login desde hoje (401), então a revisão independente deste front foi feita por um subagente.
- Cada etapa teve build, lint e conferência no navegador; os 36 testes cobrem regras de preço, posição dos anúncios e o escape do JSON-LD, não há testes de ponta a ponta (Playwright) neste projeto.
