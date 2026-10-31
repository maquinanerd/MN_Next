# Máquina Nerd — front-end com OpaPreço Ads

Front-end do portal Máquina Nerd construído a partir do kit `maquina-nerd-kit` (protótipos `*.dc.html`, docs 01–06 e a spec do OpaPreço Ads). Next.js 16 (App Router, Cache Components), TypeScript estrito e Tailwind 4. A monetização em página é feita só pelos componentes do OpaPreço Ads; não há AdSense.

Este projeto é independente do portal em produção que fica na raiz do repositório: tem `package.json`, lockfile, lint e build próprios.

## Como rodar

Requer Node 20.9 ou mais novo.

```bash
npm install
npm run dev
```

O site abre em http://localhost:3000. Outros comandos:

| Comando | O que faz |
|---|---|
| `npm run build` | build de produção (gera as páginas estáticas) |
| `npm start` | serve o build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript sem emitir |
| `npm test` | Vitest: regras de preço do OpaPreço e posição dos anúncios no texto |

## Modo demonstração e variáveis

Sem configuração nenhuma, conteúdo e ofertas vêm das fixtures de demonstração. Nesse modo a página mostra a faixa "Demonstração" no topo, todas as páginas saem com `noindex` e o `robots.txt` bloqueia tudo.

| Variável | Efeito |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | URL canônica (padrão `https://www.maquinanerd.com.br`) |
| `OPAPRECO_AD_SERVER_URL` | liga o ad server real (`GET {url}/v1/ad`); sem ela, o servidor de demonstração |
| `OPAPRECO_PUBLISHER` | id do publisher na requisição (padrão `maquinanerd`) |
| `OPAPRECO_MODE=off` | nenhum slot é montado (todas as posições colapsam) |
| `MN_CONTENT_SOURCE=cms` | usa o adaptador do CMS (`lib/content/cms.ts`, ainda não implementado: falha de forma visível) |

## Rotas

| Rota | Página |
|---|---|
| `/` | home |
| `/page/[n]` | "Mais do Máquina Nerd", páginas 2+ |
| `/[editoria]` | editoria: `cinema`, `series-e-tv`, `games`, `quadrinhos`, `animes`, `videos`, `especiais` |
| `/[editoria]/page/[n]` | lista paginada da editoria |
| `/[editoria]/assunto/[assunto]` (+ `/page/[n]`) | filtro de assunto |
| `/[editoria]/[slug]` | matéria padrão ou overlay (o layout vem da matéria) |
| `/ofertas` e `/ofertas/[slug]` | índice e matéria de oferta |
| `/busca?q=` | busca (dinâmica, fora do índice) |
| `/sobre`, `/newsletter`, `/anuncie`, `/politica-de-afiliados`, `/politica-de-privacidade`, `/termos-de-uso`, `/cookies`, `/acessibilidade`, `/mais` | institucionais |
| `/dev/componentes`, `/dev/opapreco` | vitrines internas dos primitivos e dos seis componentes OpaPreço (fora do índice) |
| `/sitemap.xml`, `/robots.txt`, `/opengraph-image`, `/icon.svg` | SEO |

## Estrutura

```
app/                 rotas (App Router)
components/
  layout/            SiteHeader, EditoriaNav, Menu (gaveta), SiteFooter, DemoBanner, Institutional, NewsletterForm
  cards/             HeroCard, OverlayCard, BigCard, StackCard, SideList, RowCard
  sections/          Abertura, Feed, Section, EditoriaView, VideoRail
  article/           ArticleHeader, AuthorRail, WideFigure, ArticleBody, RelatedInline, FullBleedCover (MateriaViews), ShareButtons
  commerce/          ProductCard multi-loja, FloatRelated, SponsoredGrid, AffiliateNotice, LeiaTambem
  ui/                SectionTitle, Pagination, EditoriaLabel, Meta, FitSidebar, Foto, JsonLd
  opapreco/          OpaSlot, ProductCardV1, ProductHeroV1, ProductGridV1, PriceDropV1,
                     ContextualRecommendationV1, ProductCompactV1, OfferLink, SlotView, Skeletons, tokens.css
lib/
  content/           tipos, editorias, adaptador (interface), fixtures, leitura em cache
  ads/               contratos (zod), regras de preço, slots, posição no texto, cliente do ad server, fixtures
  format/            datas
  seo/               JSON-LD
```

## Trocar as fixtures pelo real

- **Conteúdo:** implementar `ContentAdapter` (`lib/content/adapter.ts`) em `lib/content/cms.ts`, validando a resposta e mapeando para os tipos de `lib/content/types.ts`. Nenhum componente muda.
- **Anúncios:** apontar `OPAPRECO_AD_SERVER_URL` para o ad server. A resposta passa pelo contrato (`lib/ads/types.ts`) e pelas regras (`lib/ads/rules.ts`) antes de chegar aos componentes; erro, timeout de 1,5 s ou 204 colapsam o slot.
