import { authorColorVar, initialsOf } from '@mn/tokens';

import type {
  Article,
  ArticleSummary,
  Author,
  Category,
  ContentBlock,
  Image,
  LiveEvent,
  Poll,
  RichText,
  Tag,
  WatchTitle,
} from '../domain/types';
import { readingMinutes } from '../slug';

/**
 * Fixture corpus.
 *
 * Exists so every route, template variant and state can be rendered and asserted without
 * a CMS - which is what makes the visual audit reproducible in CI. It is loadable only
 * under `CONTENT_SOURCE=fixture`, and `env.ts` refuses that combination in production.
 *
 * The imagery is generated locally (`pnpm fixtures:media`): neutral gradients, no
 * third-party assets. The prototype `uploads/` folder is reference material and is never
 * a runtime dependency.
 */

const IMG = (name: string, width = 1600, height = 900, alt = ''): Image => ({
  url: `/fixtures/${name}.jpg`,
  width,
  height,
  alt,
});

export const fixtureCategories: Category[] = [
  {
    id: 'cat-filmes',
    slug: 'filmes',
    name: 'Filmes',
    description: 'Estreias, bilheteria, bastidores e trailers do cinema.',
  },
  {
    id: 'cat-series',
    slug: 'series',
    name: 'Séries de TV',
    description: 'Audiência, renovações e o que vale assistir nos streamings.',
  },
  {
    id: 'cat-quadrinhos',
    slug: 'quadrinhos',
    name: 'Quadrinhos',
    description: 'Marvel, DC, mangá, independentes e encadernados.',
  },
  {
    id: 'cat-games',
    slug: 'games',
    name: 'Games',
    description: 'Lançamentos, adaptações e a indústria por trás dos jogos.',
  },
  {
    id: 'cat-animes',
    slug: 'animes',
    name: 'Animes',
    description: 'Temporadas, adaptações e o mercado de animação japonesa.',
  },
  {
    id: 'cat-reviews',
    slug: 'reviews',
    name: 'Reviews',
    description: 'Análises de produtos, box e edições de colecionador.',
  },
  {
    id: 'cat-especiais',
    slug: 'especiais',
    name: 'Especiais',
    description: 'Dossiês, coberturas e mergulhos de franquia.',
  },
  {
    id: 'cat-star-wars',
    slug: 'star-wars',
    name: 'Star Wars',
    description: 'Tudo sobre a galáxia muito, muito distante.',
    parentId: 'cat-especiais',
  },
  {
    id: 'cat-marvel',
    slug: 'marvel',
    name: 'Marvel',
    description: 'O Universo Cinematográfico Marvel, fase a fase.',
    parentId: 'cat-especiais',
  },
];

export const fixtureTags: Tag[] = [
  { id: 'tag-resident-evil', slug: 'resident-evil', name: 'Resident Evil' },
  { id: 'tag-terror', slug: 'terror', name: 'Terror' },
  { id: 'tag-netflix', slug: 'netflix', name: 'Netflix' },
  { id: 'tag-hbo', slug: 'hbo-max', name: 'HBO Max' },
  { id: 'tag-longform', slug: 'longform', name: 'Longform' },
  { id: 'tag-ao-vivo', slug: 'ao-vivo', name: 'Ao vivo' },
  { id: 'tag-afiliado', slug: 'afiliado', name: 'Afiliado' },
  { id: 'tag-patrocinado', slug: 'patrocinado', name: 'Patrocinado' },
  { id: 'tag-campanha', slug: 'campanha', name: 'Campanha' },
  { id: 'tag-star-wars', slug: 'star-wars', name: 'Star Wars' },
  { id: 'tag-marvel', slug: 'marvel', name: 'Marvel' },
  { id: 'tag-dc', slug: 'dc', name: 'DC' },
];

function author(id: string, name: string, slug: string, bio: string, role: string): Author {
  return { id, name, slug, initials: initialsOf(name), avatarColor: authorColorVar(id), bio, role };
}

export const fixtureAuthors: Author[] = [
  author(
    'aut-rafael',
    'Rafael Lima',
    'rafael-lima',
    'Cobre cinema e terror no Máquina Nerd desde 2021. Escreve sobre produção, bilheteria e o que acontece antes do trailer chegar.',
    'Repórter de cinema',
  ),
  author(
    'aut-carla',
    'Carla Menezes',
    'carla-menezes',
    'Editora de séries. Escreve sobre televisão, streaming e a economia por trás das temporadas.',
    'Editora de séries',
  ),
  author(
    'aut-bruno',
    'Bruno Nascimento',
    'bruno-nascimento',
    'Cobre audiência, streaming e dados de mercado.',
    'Repórter',
  ),
  author('aut-juliana', 'Juliana Paes', 'juliana-paes', 'Escreve sobre animes, mangás e animação.', 'Repórter'),
  author('aut-redacao', 'Redação', 'redacao', 'A redação do Máquina Nerd.', 'Redação'),
];

const t = (text: string): RichText => [{ type: 'text', text, marks: [] }];

const tLink = (before: string, linkText: string, href: string, after: string): RichText => [
  { type: 'text', text: before, marks: [] },
  { type: 'text', text: linkText, marks: [{ type: 'link', href }] },
  { type: 'text', text: after, marks: [] },
];

const standardBody: ContentBlock[] = [
  {
    type: 'paragraph',
    content: [
      { type: 'text', text: 'Novo material promocional do reboot de ', marks: [] },
      { type: 'text', text: 'Resident Evil', marks: [{ type: 'bold' }] },
      {
        type: 'text',
        text: ' mostra uma criatura mutante com tentáculos, indicando uma abordagem diferente para o horror biológico da franquia. A imagem circulou primeiro em materiais de imprensa e foi confirmada pelo estúdio na tarde desta quarta.',
        marks: [],
      },
    ],
  },
  {
    type: 'paragraph',
    content: t(
      'A mudança sugere que a produção quer se afastar do design mais mecânico visto nos filmes anteriores. Segundo pessoas envolvidas na produção, a criatura aparece no terceiro ato e foi construída com uma base prática ampliada digitalmente.',
    ),
  },
  {
    type: 'quote',
    content: t('A ideia nunca foi refazer o jogo plano por plano. Era encontrar o que assusta hoje.'),
    attribution: 'Fonte ligada à produção',
  },
  {
    type: 'paragraph',
    content: t(
      'O elenco gravou as cenas sem efeito digital de referência, o que explica parte da reação física registrada no trailer. A escolha lembra o processo usado em produções recentes de terror que priorizam animatrônicos.',
    ),
  },
  { type: 'heading', level: 2, text: 'O que muda em relação aos jogos', id: 'o-que-muda-em-relacao-aos-jogos' },
  {
    type: 'paragraph',
    content: t(
      'A criatura mantém a silhueta reconhecível pelos fãs, mas troca a carapaça por uma estrutura de tentáculos. Nos jogos, o mesmo inimigo aparece em três variações; o filme aparentemente condensa as três em uma só.',
    ),
  },
  {
    type: 'list',
    style: 'bullet',
    items: [
      t('Design prático ampliado digitalmente, sem captura de movimento'),
      t('Aparição única no terceiro ato, sem repetição de encontros'),
      t('Trilha assinada pelo mesmo compositor da série de 2022'),
    ],
  },
  { type: 'image', image: IMG('still-01', 1600, 900, 'Cena do reboot de Resident Evil'), size: 'wide' },
  {
    type: 'paragraph',
    content: tLink(
      'A estreia segue marcada para 2026, sem data exata divulgada. O estúdio deve liberar o trailer completo no ',
      'próximo mês',
      '/series',
      ', segundo o cronograma de divulgação enviado à imprensa.',
    ),
  },
];

const longformBody: ContentBlock[] = [
  {
    type: 'paragraph',
    dropcap: true,
    content: t(
      'A nova temporada de Ahsoka expande o conflito galáctico com o retorno de Thrawn, batalhas espaciais épicas e mistérios sobre o poder ancestral de Mortis. O material divulgado nesta quinta é o primeiro a mostrar a frota reunida sob o comando do Grande Almirante.',
    ),
  },
  {
    type: 'paragraph',
    content: t(
      'A escolha não é acidental. Desde 2023, a divisão de televisão da Lucasfilm reorganizou seu calendário em torno de três pilares, e Ahsoka é o único deles que atravessa todas as fases anunciadas até 2028.',
    ),
  },
  { type: 'heading', level: 2, text: 'O plano que começou em Rebels', id: 'o-plano-que-comecou-em-rebels' },
  {
    type: 'paragraph',
    content: t(
      'Personagens introduzidos em animação carregam agora o peso de sustentar produções de orçamento alto. É uma aposta que a Disney já testou com O Mandaloriano e que agora tenta repetir em escala maior.',
    ),
  },
  { type: 'image', image: IMG('still-02', 1600, 900, 'Frota reunida sob o comando do Grande Almirante'), size: 'full' },
  {
    type: 'quote',
    content: t('Não existe mais franquia de televisão barata. Existe franquia que sustenta um serviço de streaming.'),
    attribution: 'Executivo de streaming, sob anonimato',
  },
  { type: 'heading', level: 2, text: 'Mortis, o curinga', id: 'mortis-o-curinga' },
  {
    type: 'paragraph',
    content: t(
      'O poder ancestral de Mortis é o elemento que permite à série mexer em regras estabelecidas sem contradizer os filmes. É também o ponto onde parte do público mais fiel costuma reclamar.',
    ),
  },
  {
    type: 'callout',
    tone: 'neutral',
    title: 'Contexto',
    content: t('Mortis apareceu pela primeira vez na terceira temporada de The Clone Wars, em 2011.'),
  },
];

const urgentBody: ContentBlock[] = [
  {
    type: 'paragraph',
    content: t(
      'A HBO confirmou o número oficial de audiência da estreia de Lanterns: 9,3 milhões de espectadores nas primeiras 72 horas, somando linear e streaming.',
    ),
  },
  { type: 'heading', level: 2, text: 'HBO confirma número oficial de audiência', id: 'hbo-confirma-numero-oficial' },
  {
    type: 'paragraph',
    content: t('O comunicado saiu às 16h04 e cita medição própria somada a dados da Nielsen para o mercado americano.'),
  },
  { type: 'heading', level: 2, text: 'Elenco comenta repercussão nas redes', id: 'elenco-comenta-repercussao' },
  {
    type: 'paragraph',
    content: t('Aaron Pierre e Kyle Chandler publicaram agradecimentos poucos minutos após o anúncio.'),
  },
  { type: 'heading', level: 2, text: 'Medidores independentes apontam pico no domingo', id: 'medidores-independentes' },
  {
    type: 'paragraph',
    content: t('Serviços de terceiros registraram o pico de audiência na noite de domingo, no horário nobre.'),
  },
];

const listBody: ContentBlock[] = [
  {
    type: 'paragraph',
    content: t(
      'O trailer completo de Ahsoka T2 tem dois minutos e vinte segundos. Estes são os cinco detalhes que passam batido.',
    ),
  },
  { type: 'heading', level: 2, text: 'A frota reunida aparece por três segundos', id: 'a-frota-reunida' },
  { type: 'paragraph', content: t('No segundo 47, ao fundo, a formação completa aparece em plano aberto.') },
  { type: 'heading', level: 2, text: 'Mortis volta como lugar, não como flashback', id: 'mortis-volta-como-lugar' },
  { type: 'paragraph', content: t('A geometria do cenário é a mesma da animação, não uma citação visual.') },
  { type: 'heading', level: 2, text: 'A trilha reaproveita um tema de 2008', id: 'a-trilha-reaproveita' },
  { type: 'paragraph', content: t('Os primeiros compassos citam a abertura de The Clone Wars.') },
];

const videoBody: ContentBlock[] = [
  {
    type: 'paragraph',
    content: t(
      'O especial em duas partes traz uma nova perspectiva sobre a jornada dos Piratas do Chapéu de Palha, utilizando a estética de blocos para adaptar momentos icônicos da obra de Eiichiro Oda.',
    ),
  },
  { type: 'embed', provider: 'youtube', url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', embedId: 'aqz-KE-bpKQ' },
  {
    type: 'paragraph',
    content: t('A estreia acontece em duas levas, com a segunda parte três semanas depois da primeira.'),
  },
  { type: 'gallery', images: [IMG('still-03'), IMG('still-04'), IMG('still-05')] },
];

const commercialBody: ContentBlock[] = [
  {
    type: 'paragraph',
    content: t(
      'A Edição Definitiva de Sandman reúne os 75 números da série regular em quatro volumes de capa dura, com tradução revisada e papel pólen.',
    ),
  },
  { type: 'heading', level: 2, text: 'Acabamento e leitura', id: 'acabamento-e-leitura' },
  {
    type: 'paragraph',
    content: t('A costura aguenta abertura total sem marcar a lombada, o que importa em um box que será relido.'),
  },
  {
    type: 'buyBox',
    disclosure:
      'Preço verificado em 27/08/2026. O Máquina Nerd pode receber comissão por compras feitas por este link, sem alteração no valor final.',
    offers: [
      {
        retailer: 'Amazon.com.br',
        price: 289,
        listPrice: 399,
        currency: 'BRL',
        url: 'https://www.amazon.com.br/dp/EXEMPLO',
        inStock: true,
        verifiedAt: '2026-08-27T12:00:00-03:00',
      },
    ],
  },
  {
    type: 'specTable',
    rows: [
      { label: 'Páginas', value: '2.000' },
      { label: 'Formato', value: '17 × 26 cm' },
      { label: 'Acabamento', value: 'Capa dura, costurado' },
      { label: 'Editora', value: 'Panini' },
    ],
  },
];

const comparisonBody: ContentBlock[] = [
  {
    type: 'paragraph',
    content: t('Dez box para quem quer começar uma coleção sem se perder em edição esgotada e preço de sebo.'),
  },
  {
    type: 'comparison',
    items: [
      {
        rank: 1,
        name: 'Sandman — Edição Definitiva',
        score: 9.2,
        highlight: 'Melhor escolha geral',
        image: IMG('product-01', 1200, 1200, 'Box Sandman Edição Definitiva'),
        specs: [
          { label: 'Volumes', value: '4' },
          { label: 'Páginas', value: '2.000' },
        ],
        offer: {
          retailer: 'Amazon.com.br',
          price: 289,
          currency: 'BRL',
          url: 'https://www.amazon.com.br/dp/EXEMPLO1',
          inStock: true,
          verifiedAt: '2026-08-27T12:00:00-03:00',
        },
      },
      {
        rank: 2,
        name: 'Watchmen — Deluxe',
        score: 8.8,
        highlight: 'Melhor custo-benefício',
        image: IMG('product-02', 1200, 1200, 'Watchmen Deluxe'),
        specs: [
          { label: 'Volumes', value: '1' },
          { label: 'Páginas', value: '448' },
        ],
        offer: {
          retailer: 'Amazon.com.br',
          price: 149,
          currency: 'BRL',
          url: 'https://www.amazon.com.br/dp/EXEMPLO2',
          inStock: true,
          verifiedAt: '2026-08-27T12:00:00-03:00',
        },
      },
    ],
  },
];

interface FixtureArticleSeed {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  excerpt: string;
  template: Article['template'];
  categoryId: string;
  tagIds: string[];
  authorIds: string[];
  cover: string;
  publishedAt: string;
  updatedAt: string;
  body: ContentBlock[];
  schemaType: Article['seo']['schemaType'];
  commercial?: Article['commercial'];
  review?: Article['review'];
  videoId?: string;
}

const seeds: FixtureArticleSeed[] = [
  {
    id: 'art-resident-evil',
    slug: 'resident-evil-2026-revela-mudanca-em-monstro-classico',
    title: 'Resident Evil de 2026 revela mudança em monstro clássico',
    subtitle:
      'Novo material promocional do reboot mostra criatura mutante com tentáculos, indicando uma abordagem diferente para o horror biológico.',
    excerpt:
      'Novo material promocional do reboot de Resident Evil mostra criatura mutante com tentáculos, indicando uma abordagem diferente para o horror biológico.',
    template: 'standard',
    categoryId: 'cat-series',
    tagIds: ['tag-resident-evil', 'tag-terror', 'tag-netflix'],
    authorIds: ['aut-rafael'],
    cover: 'cover-01',
    publishedAt: '2026-08-27T14:32:00-03:00',
    updatedAt: '2026-08-27T16:05:00-03:00',
    body: standardBody,
    schemaType: 'NewsArticle',
  },
  {
    id: 'art-ahsoka-longform',
    slug: 'como-ahsoka-virou-o-centro-do-plano-galactico-da-disney',
    title: 'Como Ahsoka virou o centro do plano galáctico da Disney',
    subtitle:
      'O trailer da segunda temporada entrega Thrawn, batalhas espaciais e Mortis. Por trás disso, uma reorganização de cronograma que começou há três anos.',
    excerpt:
      'O trailer da segunda temporada entrega Thrawn, batalhas espaciais e Mortis. Por trás disso, uma reorganização de cronograma que começou há três anos.',
    template: 'longform',
    categoryId: 'cat-series',
    tagIds: ['tag-longform', 'tag-star-wars'],
    authorIds: ['aut-carla'],
    cover: 'cover-02',
    publishedAt: '2026-08-27T09:00:00-03:00',
    updatedAt: '2026-08-27T09:00:00-03:00',
    body: longformBody,
    schemaType: 'Article',
  },
  {
    id: 'art-lanterns-urgente',
    slug: 'lanterns-atinge-93-milhoes-de-espectadores-na-estreia-na-hbo',
    title: 'Lanterns atinge 9,3 milhões de espectadores na estreia na HBO',
    excerpt: 'Produção do DC Studios supera expectativas de audiência na estreia.',
    template: 'urgent',
    categoryId: 'cat-series',
    tagIds: ['tag-ao-vivo', 'tag-hbo', 'tag-dc'],
    authorIds: ['aut-bruno'],
    cover: 'cover-03',
    publishedAt: '2026-08-27T11:00:00-03:00',
    updatedAt: '2026-08-27T16:04:00-03:00',
    body: urgentBody,
    schemaType: 'LiveBlogPosting',
  },
  {
    id: 'art-lego-one-piece',
    slug: 'netflix-revela-trailer-de-lego-one-piece-com-aventura-inedita',
    title: 'Netflix revela trailer de LEGO One Piece com aventura inédita',
    excerpt: 'O especial em duas partes adapta momentos icônicos da obra de Eiichiro Oda.',
    template: 'video',
    categoryId: 'cat-animes',
    tagIds: ['tag-netflix'],
    authorIds: ['aut-juliana'],
    cover: 'cover-04',
    publishedAt: '2026-08-27T10:15:00-03:00',
    updatedAt: '2026-08-27T10:15:00-03:00',
    body: videoBody,
    schemaType: 'NewsArticle',
    videoId: 'aqz-KE-bpKQ',
  },
  {
    id: 'art-cinco-coisas',
    slug: '5-coisas-que-o-trailer-de-ahsoka-t2-esconde-sobre-thrawn',
    title: '5 coisas que o trailer de Ahsoka T2 esconde sobre Thrawn',
    excerpt: 'Do plano de três segundos à trilha reaproveitada: os detalhes que passam batido.',
    template: 'list',
    categoryId: 'cat-series',
    tagIds: ['tag-star-wars'],
    authorIds: ['aut-carla'],
    cover: 'cover-05',
    publishedAt: '2026-08-26T18:20:00-03:00',
    updatedAt: '2026-08-26T18:20:00-03:00',
    body: listBody,
    schemaType: 'ItemList',
  },
  {
    id: 'art-sandman-review',
    slug: 'box-sandman-edicao-definitiva-vale-os-r-289',
    title: 'Box Sandman Edição Definitiva: vale os R$ 289?',
    excerpt: 'Acabamento, tradução e preço: o que a Edição Definitiva entrega em quatro volumes.',
    template: 'standard',
    categoryId: 'cat-reviews',
    tagIds: ['tag-afiliado'],
    authorIds: ['aut-redacao'],
    cover: 'cover-06',
    publishedAt: '2026-08-25T09:00:00-03:00',
    updatedAt: '2026-08-27T12:00:00-03:00',
    body: commercialBody,
    schemaType: 'Review',
    commercial: {
      kind: 'affiliate',
      brandName: 'Panini',
      disclosure:
        'Este conteúdo contém links de afiliados. O Máquina Nerd pode receber comissão por compras feitas por estes links, sem alteração no valor final.',
      offers: [
        {
          retailer: 'Amazon.com.br',
          price: 289,
          listPrice: 399,
          currency: 'BRL',
          url: 'https://www.amazon.com.br/dp/EXEMPLO',
          inStock: true,
          verifiedAt: '2026-08-27T12:00:00-03:00',
        },
      ],
    },
    review: {
      articleId: 'art-sandman-review',
      product: {
        name: 'Box Sandman — Edição Definitiva',
        brand: 'Panini',
        image: IMG('product-01', 1200, 1200, 'Box Sandman'),
      },
      score: 8.4,
      breakdown: [
        { label: 'Roteiro', value: 9 },
        { label: 'Acabamento', value: 8 },
        { label: 'Extras', value: 7 },
      ],
      pros: ['Acabamento do box', 'Tradução revisada'],
      cons: ['Preço alto', 'Sem extras inéditos'],
      verdict: 'A melhor forma de ler Sandman em português hoje, se o orçamento permitir.',
    },
  },
  {
    id: 'art-melhores-box',
    slug: 'os-10-melhores-box-de-quadrinhos-para-comecar-uma-colecao',
    title: 'Os 10 melhores box de quadrinhos para começar uma coleção',
    excerpt: 'Dez edições que cabem na estante e não dependem de sebo para completar.',
    template: 'list',
    categoryId: 'cat-quadrinhos',
    tagIds: ['tag-afiliado'],
    authorIds: ['aut-redacao'],
    cover: 'cover-07',
    publishedAt: '2026-08-24T09:00:00-03:00',
    updatedAt: '2026-08-27T12:00:00-03:00',
    body: comparisonBody,
    schemaType: 'ItemList',
    commercial: {
      kind: 'affiliate',
      brandName: 'Diversas editoras',
      disclosure:
        'Este conteúdo contém links de afiliados. O Máquina Nerd pode receber comissão por compras feitas por estes links, sem alteração no valor final.',
    },
  },
  {
    id: 'art-estante-publieditorial',
    slug: 'como-montar-uma-estante-de-colecionador-sem-gastar-o-mes-inteiro',
    title: 'Como montar uma estante de colecionador sem gastar o mês inteiro',
    excerpt: 'Iluminação, ordem e vidro UV: o básico para expor uma coleção sem estragá-la.',
    template: 'standard',
    categoryId: 'cat-quadrinhos',
    tagIds: ['tag-patrocinado'],
    authorIds: ['aut-redacao'],
    cover: 'cover-08',
    publishedAt: '2026-08-23T09:00:00-03:00',
    updatedAt: '2026-08-23T09:00:00-03:00',
    body: [
      { type: 'heading', level: 2, text: '1. Luz fria mata o plástico', id: '1-luz-fria-mata-o-plastico' },
      {
        type: 'paragraph',
        content: t(
          'LED frio acelera o amarelamento do plástico das action figures. Prefira temperatura acima de 3000K.',
        ),
      },
      { type: 'heading', level: 2, text: '2. Ordem cronológica é mais legível', id: '2-ordem-cronologica' },
      {
        type: 'paragraph',
        content: t('Ordenar por data de publicação torna a estante navegável para quem chega de fora.'),
      },
    ],
    schemaType: 'Article',
    commercial: {
      kind: 'branded-content',
      brandName: 'Linha Modular',
      disclosure:
        'Conteúdo produzido em parceria comercial. A redação do Máquina Nerd não participou da elaboração deste material.',
    },
  },
  {
    id: 'art-semana-nerd',
    slug: 'semana-nerd-2026',
    title: 'Semana Nerd 2026: as ofertas que valem a pena',
    excerpt: 'A campanha de descontos do ano, filtrada pela redação.',
    template: 'standard',
    categoryId: 'cat-reviews',
    tagIds: ['tag-campanha'],
    authorIds: ['aut-redacao'],
    cover: 'cover-09',
    publishedAt: '2026-08-22T09:00:00-03:00',
    updatedAt: '2026-08-27T12:00:00-03:00',
    body: commercialBody,
    schemaType: 'ItemList',
    commercial: {
      kind: 'campaign',
      brandName: 'Semana Nerd',
      campaignId: 'semana-nerd-2026',
      disclosure: 'Campanha publicitária. O conteúdo desta página foi definido pelo anunciante.',
    },
  },
  {
    id: 'art-pirates',
    slug: 'pirates-of-the-caribbean-avanca-com-negociacoes-para-johnny-depp',
    title: 'Pirates of the Caribbean avança com negociações para Johnny Depp',
    excerpt: 'Jerry Bruckheimer confirma conversas ativas para o retorno do Capitão Jack Sparrow.',
    template: 'standard',
    categoryId: 'cat-filmes',
    tagIds: [],
    authorIds: ['aut-rafael'],
    cover: 'cover-10',
    publishedAt: '2026-08-27T08:00:00-03:00',
    updatedAt: '2026-08-27T08:00:00-03:00',
    body: standardBody,
    schemaType: 'NewsArticle',
  },
  {
    id: 'art-star-trek',
    slug: 'star-trek-usa-bonecos-ha-60-anos-antes-de-strange-new-worlds',
    title: 'Star Trek usa bonecos há 60 anos antes de Strange New Worlds',
    excerpt: 'Marionetes resgatam uma tradição de 60 anos da franquia.',
    template: 'standard',
    categoryId: 'cat-series',
    tagIds: [],
    authorIds: ['aut-bruno'],
    cover: 'cover-11',
    publishedAt: '2026-08-26T08:00:00-03:00',
    updatedAt: '2026-08-26T08:00:00-03:00',
    body: standardBody,
    schemaType: 'NewsArticle',
  },
  {
    id: 'art-bad-day',
    slug: 'cameron-diaz-estrela-bad-day-nova-comedia-de-acao-da-netflix',
    title: 'Cameron Diaz estrela Bad Day, nova comédia de ação da Netflix',
    excerpt: 'Estreia confirmada para 11 de dezembro marca o retorno da atriz ao gênero.',
    template: 'standard',
    categoryId: 'cat-filmes',
    tagIds: ['tag-netflix'],
    authorIds: ['aut-carla'],
    cover: 'cover-12',
    publishedAt: '2026-08-25T08:00:00-03:00',
    updatedAt: '2026-08-25T08:00:00-03:00',
    body: standardBody,
    schemaType: 'NewsArticle',
  },
  {
    id: 'art-marvel-dossie',
    slug: 'a-decada-que-a-marvel-apostou-tudo',
    title: 'A década que a Marvel apostou tudo',
    subtitle: 'Da Fase 1 ao pós-crédito que ninguém entendeu.',
    excerpt: 'Um dossiê sobre como a Marvel transformou dez anos de filmes em um único arco narrativo.',
    template: 'longform',
    categoryId: 'cat-marvel',
    tagIds: ['tag-longform', 'tag-marvel'],
    authorIds: ['aut-carla'],
    cover: 'cover-13',
    publishedAt: '2026-08-20T08:00:00-03:00',
    updatedAt: '2026-08-20T08:00:00-03:00',
    body: longformBody,
    schemaType: 'Article',
  },
  {
    id: 'art-comic-con',
    slug: 'cobertura-comic-con-2026',
    title: 'Cobertura Comic-Con 2026',
    excerpt: 'Minuto a minuto do maior evento de cultura pop do ano.',
    template: 'urgent',
    categoryId: 'cat-especiais',
    tagIds: ['tag-ao-vivo'],
    authorIds: ['aut-redacao'],
    cover: 'cover-14',
    publishedAt: '2026-08-19T09:00:00-03:00',
    updatedAt: '2026-08-19T18:00:00-03:00',
    body: urgentBody,
    schemaType: 'LiveBlogPosting',
  },
  {
    id: 'art-taboo',
    slug: 'taboo-traz-tom-hardy-em-papel-inspirado-por-sherlock-holmes',
    title: 'Taboo traz Tom Hardy em papel inspirado por Sherlock Holmes',
    excerpt: 'Minissérie explora a mente de um anti-herói estrategista.',
    template: 'standard',
    categoryId: 'cat-series',
    tagIds: [],
    authorIds: ['aut-carla'],
    cover: 'cover-15',
    publishedAt: '2026-08-18T08:00:00-03:00',
    updatedAt: '2026-08-18T08:00:00-03:00',
    body: standardBody,
    schemaType: 'NewsArticle',
  },
  {
    id: 'art-hq-mangas',
    slug: 'mercado-de-manga-cresce-e-muda-a-prateleira-das-livrarias',
    title: 'Mercado de mangá cresce e muda a prateleira das livrarias',
    excerpt: 'A expansão do mangá reorganizou o espaço físico das grandes redes.',
    template: 'standard',
    categoryId: 'cat-quadrinhos',
    tagIds: [],
    authorIds: ['aut-juliana'],
    cover: 'cover-16',
    publishedAt: '2026-08-17T08:00:00-03:00',
    updatedAt: '2026-08-17T08:00:00-03:00',
    body: standardBody,
    schemaType: 'NewsArticle',
  },
  {
    id: 'art-games-adaptacao',
    slug: 'adaptacoes-de-games-dominam-a-agenda-dos-estudios-em-2027',
    title: 'Adaptações de games dominam a agenda dos estúdios em 2027',
    excerpt: 'Dez produções em desenvolvimento colocam o game no centro do calendário.',
    template: 'standard',
    categoryId: 'cat-games',
    tagIds: [],
    authorIds: ['aut-rafael'],
    cover: 'cover-17',
    publishedAt: '2026-08-16T08:00:00-03:00',
    updatedAt: '2026-08-16T08:00:00-03:00',
    body: standardBody,
    schemaType: 'NewsArticle',
  },
  {
    id: 'art-anime-temporada',
    slug: 'temporada-de-outono-tem-12-estreias-e-duas-continuacoes',
    title: 'Temporada de outono tem 12 estreias e duas continuações',
    excerpt: 'O calendário de outono chega cheio, com duas continuações muito aguardadas.',
    template: 'list',
    categoryId: 'cat-animes',
    tagIds: [],
    authorIds: ['aut-juliana'],
    cover: 'cover-18',
    publishedAt: '2026-08-15T08:00:00-03:00',
    updatedAt: '2026-08-15T08:00:00-03:00',
    body: listBody,
    schemaType: 'ItemList',
  },
];

function buildArticle(seed: FixtureArticleSeed): Article {
  const category = fixtureCategories.find((c) => c.id === seed.categoryId) ?? null;
  const tags = seed.tagIds.map((id) => fixtureTags.find((t2) => t2.id === id)).filter((t2): t2 is Tag => Boolean(t2));
  const authors = seed.authorIds
    .map((id) => fixtureAuthors.find((a) => a.id === id))
    .filter((a): a is Author => Boolean(a));
  const cover = IMG(seed.cover, 1600, 900, seed.title);
  const words = seed.body.reduce((acc, block) => {
    if (block.type === 'paragraph' || block.type === 'quote') {
      return (
        acc +
        block.content
          .map((n) => (n.type === 'text' ? n.text : ''))
          .join(' ')
          .split(/\s+/).length
      );
    }
    if (block.type === 'heading') return acc + block.text.split(/\s+/).length;
    return acc;
  }, 0);

  return {
    id: seed.id,
    brand: 'mn',
    slug: seed.slug,
    template: seed.template,
    title: seed.title,
    ...(seed.subtitle ? { subtitle: seed.subtitle } : {}),
    excerpt: seed.excerpt,
    ...(category ? { kicker: category.name } : {}),
    cover,
    authors,
    category,
    tags,
    publishedAt: seed.publishedAt,
    updatedAt: seed.updatedAt,
    status: 'published',
    readingMinutes: readingMinutes(words),
    ...(seed.commercial ? { commercialKind: seed.commercial.kind, commercial: seed.commercial } : {}),
    ...(seed.review ? { review: seed.review } : {}),
    ...(seed.videoId ? { videoId: seed.videoId } : {}),
    body: seed.body,
    seo: {
      title: seed.title,
      description: seed.excerpt,
      ogImage: cover,
      noindex: false,
      nofollow: false,
      schemaType: seed.schemaType,
    },
  };
}

export const fixtureArticles: Article[] = seeds.map(buildArticle);

export function toSummary(article: Article): ArticleSummary {
  const { body: _body, seo: _seo, commercial: _commercial, review: _review, ...summary } = article;
  return summary;
}

export const fixtureWatchTitles: WatchTitle[] = [
  {
    id: 'wt-ahsoka',
    cinerieSlug: 'ahsoka',
    title: 'Ahsoka — 2ª temporada',
    poster: IMG('poster-01', 800, 1200, 'Pôster de Ahsoka'),
    still: IMG('still-01', 1600, 900, ''),
    kind: 'series',
    availability: [{ platform: 'Disney+', type: 'stream', note: 'Estreia 12 dez' }],
    updatedAt: '2026-08-27T08:00:00-03:00',
    url: 'https://cinerie.com/series/ahsoka',
  },
  {
    id: 'wt-lanterns',
    cinerieSlug: 'lanterns',
    title: 'Lanterns',
    poster: IMG('poster-02', 800, 1200, 'Pôster de Lanterns'),
    still: IMG('still-02', 1600, 900, ''),
    kind: 'series',
    availability: [{ platform: 'HBO Max', type: 'stream', note: 'Episódios semanais' }],
    updatedAt: '2026-08-27T08:00:00-03:00',
    url: 'https://cinerie.com/series/lanterns',
  },
  {
    id: 'wt-lego-one-piece',
    cinerieSlug: 'lego-one-piece',
    title: 'LEGO One Piece',
    poster: IMG('poster-03', 800, 1200, 'Pôster de LEGO One Piece'),
    still: IMG('still-03', 1600, 900, ''),
    kind: 'movie',
    availability: [{ platform: 'Netflix', type: 'stream', note: 'Especial em 2 partes' }],
    updatedAt: '2026-08-27T08:00:00-03:00',
    url: 'https://cinerie.com/filmes/lego-one-piece',
  },
  {
    id: 'wt-bad-day',
    cinerieSlug: 'bad-day',
    title: 'Bad Day',
    poster: IMG('poster-04', 800, 1200, 'Pôster de Bad Day'),
    still: IMG('still-04', 1600, 900, ''),
    kind: 'movie',
    availability: [{ platform: 'Netflix', type: 'stream', note: 'Estreia 11 dez' }],
    updatedAt: '2026-08-27T08:00:00-03:00',
    url: 'https://cinerie.com/filmes/bad-day',
  },
];

export const fixturePoll: Poll = {
  id: 'poll-dc-marvel',
  question: 'Quem domina 2026 no streaming: DC Studios ou Marvel?',
  status: 'open',
  options: [
    { id: 'opt-dc', label: 'DC Studios', image: IMG('cover-03', 1600, 900, ''), votes: 5_400 },
    { id: 'opt-marvel', label: 'Marvel', image: IMG('cover-13', 1600, 900, ''), votes: 4_600 },
  ],
  totalVotes: 10_000,
  source: 'cinerie',
};

export const fixtureLiveEvent: LiveEvent = {
  id: 'live-comic-con',
  slug: 'comic-con-2026',
  title: 'Cobertura Comic-Con 2026',
  status: 'live',
  startedAt: '2026-08-19T09:00:00-03:00',
  entries: [
    {
      id: 'live-1',
      time: '2026-08-19T16:04:00-03:00',
      title: 'Ahsoka T2 ganha trailer completo no painel da Lucasfilm',
      text: 'O painel encerrou com o trailer completo da segunda temporada, exibido duas vezes a pedido do público.',
      important: true,
    },
    {
      id: 'live-2',
      time: '2026-08-19T14:30:00-03:00',
      title: 'Bruckheimer confirma no palco as conversas com Johnny Depp',
      text: 'O produtor foi direto ao ser questionado e confirmou negociações em andamento.',
    },
    {
      id: 'live-3',
      time: '2026-08-19T11:10:00-03:00',
      title: 'DC Studios celebra os 9,3 milhões de Lanterns e provoca anúncio',
      text: 'A apresentação abriu com os números da estreia e terminou com um teaser de dez segundos.',
    },
    {
      id: 'live-4',
      time: '2026-08-19T09:05:00-03:00',
      title: 'Portões abertos: o que esperar do primeiro dia',
      text: 'A fila começou a se formar às 5h; o primeiro painel é às 10h30.',
    },
  ],
};

export const fixtureRedirects = [
  {
    from: '/2026/08/resident-evil-2026-revela-mudanca-em-monstro-classico',
    to: '/series/resident-evil-2026-revela-mudanca-em-monstro-classico',
    status: 301 as const,
  },
  { from: '/feed', to: '/feed.xml', status: 301 as const },
  { from: '/comments/feed', to: '/feed.xml', status: 301 as const },
  { from: '/categoria/series', to: '/series', status: 301 as const },
  { from: '/tag/antigo-removido', to: '/', status: 410 as const },
];
