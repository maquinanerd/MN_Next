import type {
  Article,
  ArticleLayout,
  ArticleSummary,
  ArticleTemplate,
  Author,
  Category,
  ContentBlock,
  Image,
  Product,
  RichText,
  SchemaType,
  Tag,
} from '../domain/types';
import { resolveLayout } from '../paths';
import { readingMinutes } from '../slug';

/**
 * Fixture corpus — **demonstration only**.
 *
 * Every headline, byline and price here is the approved prototypes' own demo copy
 * (`maquina-nerd-kit/prototypes/*.dc.html`) or written in the same register; none of it is
 * news. The page says so: fixture mode renders the "Demonstração" banner, and the
 * provider refuses to start in staging or production (`env.ts`, `provider.ts`).
 *
 * It exists so every route, layout and state renders deterministically without a CMS —
 * which is what makes the visual audit reproducible. The imagery is generated locally
 * (`pnpm fixtures:media`): neutral gradients, no third-party assets.
 */

const IMG = (name: string, alt: string, width = 1600, height = 900): Image => ({
  url: `/fixtures/${name}.jpg`,
  width,
  height,
  alt,
});

const cat = (slug: string, name: string, description: string): Category => ({
  id: `cat-${slug}`,
  slug,
  name,
  description,
});

export const fixtureCategories: Category[] = [
  cat('cinema', 'Cinema', 'Estreias, bilheteria, bastidores e trailers do cinema.'),
  cat('series-e-tv', 'Séries e TV', 'Audiência, renovações e o que vale assistir nos streamings.'),
  cat('games', 'Games', 'Lançamentos, consoles e a indústria por trás dos jogos.'),
  cat('quadrinhos', 'Quadrinhos', 'Marvel, DC, mangá, independentes e encadernados.'),
  cat('animes', 'Animes', 'Temporadas, adaptações e o mercado de animação japonesa.'),
  cat('videos', 'Vídeos', 'Trailers, entrevistas e clipes.'),
  cat('especiais', 'Especiais', 'Reportagens, críticas e listas.'),
];

const tag = (slug: string, name: string): Tag => ({ id: `tag-${slug}`, slug, name });

export const fixtureTags: Tag[] = [
  tag('marvel', 'Marvel'),
  tag('dc', 'DC'),
  tag('star-wars', 'Star Wars'),
  tag('terror', 'Terror'),
  tag('trailers', 'Trailers'),
  tag('streaming', 'Streaming'),
  tag('hbo', 'HBO'),
  tag('netflix', 'Netflix'),
  tag('cult', 'Cult'),
  tag('ps5', 'PS5'),
  tag('xbox', 'Xbox'),
  tag('nintendo', 'Nintendo'),
  tag('pc', 'PC'),
  tag('dc-comics', 'DC Comics'),
  tag('marvel-comics', 'Marvel Comics'),
  tag('manga', 'Mangá'),
  tag('independentes', 'Independentes'),
  tag('lancamentos', 'Lançamentos'),
  tag('animacao', 'Animação'),
  tag('entrevistas', 'Entrevistas'),
  tag('clipes', 'Clipes'),
  tag('reportagem', 'Reportagem'),
  tag('critica', 'Crítica'),
  tag('lista', 'Lista'),
  tag('reviews', 'Reviews'),
  tag('descontos', 'Descontos'),
  // Reserved: presentation switches, never shown as topics.
  tag('oferta', 'Oferta'),
  tag('capa-em-tela-cheia', 'Capa em tela cheia'),
];

const author = (slug: string, name: string, role: string): Author => ({ id: `aut-${slug}`, slug, name, role });

export const fixtureAuthors: Author[] = [
  author('rafael-lima', 'Rafael Lima', 'Repórter de cinema'),
  author('juliana-prado', 'Juliana Prado', 'Repórter'),
  author('bruno-nunes', 'Bruno Nunes', 'Repórter'),
  author('carla-menezes', 'Carla Menezes', 'Editora de séries'),
  author('rebeca-pinho', 'Rebeca Pinho', 'Repórter de ofertas'),
];

const t = (text: string): RichText => [{ type: 'text', text, marks: [] }];
const p = (text: string): ContentBlock => ({ type: 'paragraph', content: t(text) });

const withLink = (before: string, linkText: string, href: string, after: string): ContentBlock => ({
  type: 'paragraph',
  content: [
    { type: 'text', text: before, marks: [] },
    { type: 'text', text: linkText, marks: [{ type: 'link', href }] },
    { type: 'text', text: after, marks: [] },
  ],
});

/** The prototype article, block for block (Máquina Nerd Notícias.dc.html). */
const featureBody: ContentBlock[] = [
  p(
    'Scarlett Johansson é a atriz, produtora e força criativa por trás de Viúva Negra, o filme que fechou uma década de Marvel Studios. A personagem teve apenas um filme solo, um único grande sucesso de bilheteria em ano de pandemia e não voltou às telas desde 2021. Ainda assim, seu legado e lugar na história do cinema de super-heróis persistem.',
  ),
  withLink(
    'Diz tudo sobre a escala do talento de Johansson que sua reputação como uma das grandes da Marvel se baseie em tão pouco material solo. Em 2019, ',
    'Kevin Feige falou à imprensa',
    '/cinema',
    ' sobre a postura e o estilo da atriz, e a admiração de colegas se repete a cada nova entrevista.',
  ),
  { type: 'image', image: IMG('still-02', 'Cena de bastidores em um set de filmagem', 1600, 850), size: 'wide' },
  p(
    'Ainda assim, Johansson é agora considerada por muitos uma das grandes figuras "perdidas" do gênero. Nos últimos cinco anos, ela recusou repetidamente qualquer retorno à personagem, e suas aparições públicas se tornaram escassas.',
  ),
  p(
    'Celebrando seu quinto aniversário, Viúva Negra é um filme cult no sentido mais verdadeiro. Sua contenção e melodrama ficaram em desacordo com as cenas dominantes da época — e é justamente essa qualidade atemporal que envelheceu tão bem.',
  ),
  p(
    'O filme se apoia menos em suas cenas de ação do que na produção conturbada que o cercou, com uma porta giratória de diretores e produtores e muitas histórias sobre o perfeccionismo da protagonista.',
  ),
  {
    type: 'quote',
    content: t(
      'Ela era muito engraçada, muito talentosa, muito legal. Quando entrava em cena eu pensava "não existe ninguém como ela"',
    ),
    attribution: 'Mike Badger',
  },
  p(
    'Para os fanáticos por Viúva Negra, separar fato de ficção sempre foi parte do apelo. É um filme em que nada é o que parece, e a própria origem do roteiro virou tema de debate entre fãs.',
  ),
  { type: 'heading', level: 2, text: 'A evolução conturbada da produção', id: 'a-evolucao-conturbada-da-producao' },
  p(
    'O projeto começou em 2013, em um estúdio que, no meio da era Feige, estava tomado por uma onda de crossovers. Os roteiristas se revezaram, e cada versão do texto trazia uma Natasha diferente.',
  ),
  p(
    'Depois de recrutar um fotógrafo e um montador de confiança, o grupo começou a ganhar força dentro do estúdio. "Fizemos todo o trabalho, e foi aí que os problemas começaram", disse um dos envolvidos.',
  ),
  { type: 'image', image: IMG('still-03', 'Equipe reunida durante uma filmagem noturna', 1600, 950), size: 'wide' },
  {
    type: 'quote',
    content: t('Quando vejo o filme hoje ainda fico feliz, ele tem momentos mágicos. Mas ela é a artista'),
    attribution: 'Steve Lillywhite',
  },
  p(
    'Em dezembro de 2019, o estúdio recorreu à diretora Cate Shortland, que ficou inicialmente impressionada com o talento de Johansson. Mas os problemas reapareceram, e a produção seguiu aos trancos.',
  ),
  { type: 'heading', level: 2, text: 'Um recuo da vida pública', id: 'um-recuo-da-vida-publica' },
  p(
    'Sem os parceiros de origem, o projeto chegou ao fim. Johansson recuou da vista do público, decidida a revisitar as cenas do seu único filme para a própria satisfação. Na ausência dela, o moinho de boatos entrou em ação.',
  ),
];

const shortBody = (topic: string): ContentBlock[] => [
  p(
    `Esta é uma matéria de demonstração sobre ${topic}. O texto existe para mostrar a tipografia, o espaçamento e os blocos do template; nenhuma informação aqui é notícia real.`,
  ),
  p(
    'O corpo do artigo usa parágrafos de 17px com entrelinha 1.6, justificados no desktop e alinhados à esquerda no celular, com largura de leitura alinhada ao menu do cabeçalho.',
  ),
  p(
    'Os anúncios entram sempre entre dois parágrafos, nunca logo depois de uma imagem, e o espaço reservado mantém as dimensões mesmo quando o anúncio não carrega.',
  ),
  { type: 'heading', level: 2, text: 'Como o template se comporta', id: 'como-o-template-se-comporta' },
  p(
    'Subtítulos de 22px dividem o texto em seções. Citações recebem um filete de 3px na cor da editoria, e figuras largas extravasam a coluna de texto em telas acima de 1240px.',
  ),
  p(
    'No celular, a coluna do autor dá lugar a uma faixa na cor da editoria, e a lista de assuntos continua acessível por um menu que abre sem depender de JavaScript.',
  ),
  p('No fim do texto, o leitor encontra a próxima matéria, as relacionadas e o rodapé com as editorias do portal.'),
];

const controlProduct: Product = {
  name: 'Controle Sem Fio Xbox — edição especial',
  image: IMG('product-01', 'Controle sem fio de videogame em cor vibrante', 1200, 1200),
  description:
    'Superfícies esculpidas, botão direcional híbrido e aderência texturizada nos gatilhos. Compatível com Xbox Series X|S, Xbox One e PC.',
  price: 'R$ 349,90',
  listPrice: 'R$ 499,90',
  demo: true,
  offers: [
    { retailer: 'Amazon', url: 'https://www.amazon.com.br/', price: 'R$ 349,90' },
    { retailer: 'Mercado Livre', url: 'https://www.mercadolivre.com.br/', price: 'R$ 359,00' },
  ],
};

const offerBody: ContentBlock[] = [
  p(
    'Além da cor, o controle conta com conexão sem fio e Bluetooth, permitindo jogar no console ou no PC com mais liberdade. Ele também traz entrada USB-C, botão Share e áreas texturizadas nas alavancas e gatilhos.',
  ),
  { type: 'product', product: controlProduct },
  { type: 'heading', level: 2, text: 'Conexão sem fio para jogar em diferentes dispositivos', id: 'conexao-sem-fio' },
  p(
    'O controle usa a tecnologia sem fio do console e também conta com Bluetooth para conexão com PCs e dispositivos móveis compatíveis, sem precisar ficar preso a cabos.',
  ),
  { type: 'heading', level: 2, text: 'Personalização e mapeamento de botões', id: 'personalizacao' },
  p(
    'Pelo aplicativo do fabricante, é possível remapear os botões e criar perfis personalizados — útil para adaptar os comandos a diferentes tipos de jogos.',
  ),
  { type: 'image', image: IMG('product-02', 'Controle de videogame fotografado de lado', 1600, 900), size: 'wide' },
  { type: 'heading', level: 2, text: 'Botão Share para capturas e gravações', id: 'botao-share' },
  p(
    'O botão Share dedicado facilita registrar as partidas: dá para capturar telas e gravar trechos sem interromper o jogo.',
  ),
  { type: 'heading', level: 2, text: 'Pegada pensada para longas sessões', id: 'pegada' },
  p(
    'Gatilhos, botões superiores e a parte traseira têm textura, e o direcional híbrido foi desenhado para comandos mais precisos.',
  ),
  { type: 'heading', level: 2, text: 'Bateria para jogar por horas', id: 'bateria' },
  p('O controle funciona com duas pilhas AA, e a autonomia varia de acordo com o uso e os acessórios conectados.'),
];

interface Seed {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  subject?: string;
  tags?: string[];
  author: string;
  cover: string;
  alt: string;
  /** Hours before FIXTURE_NOW. */
  hours: number;
  template?: ArticleTemplate;
  schemaType?: SchemaType;
  body?: ContentBlock[];
  lead?: string;
  editedHoursAfter?: number;
}

/** The fixed "now" fixtures are dated against, so relative times never drift in a screenshot. */
export const FIXTURE_NOW_ISO = '2026-09-10T12:00:00-03:00';

const seeds: Seed[] = [
  // --- Cinema
  {
    slug: 'o-misterio-de-scarlett-johansson-a-estrela-perdida-da-marvel',
    title: 'O mistério de Scarlett Johansson, a estrela "perdida" da Marvel',
    excerpt:
      'Há pouco mais de cinco anos, Viúva Negra encerrou a jornada de Natasha Romanoff. Mas sua estrela tem sido esquiva desde então.',
    lead: 'Há pouco mais de cinco anos, Viúva Negra encerrou a jornada de Natasha Romanoff — um filme que moldou a fase seguinte do MCU. Mas sua estrela tem sido esquiva desde então, escreve Rafael Lima.',
    category: 'cinema',
    subject: 'Marvel',
    tags: ['marvel'],
    author: 'rafael-lima',
    cover: 'cover-01',
    alt: 'Atriz em um tapete vermelho',
    hours: 1,
    body: featureBody,
    editedHoursAfter: 21,
    schemaType: 'Article',
  },
  {
    slug: 'o-misterio-de-scarlett-johansson-edicao-capa',
    title: 'Como Scarlett Johansson virou o centro de um mito da Marvel',
    excerpt: 'Cinco anos depois de Viúva Negra, a atriz volta a ser assunto nos corredores do estúdio.',
    category: 'cinema',
    subject: 'Marvel',
    tags: ['marvel', 'capa-em-tela-cheia'],
    author: 'rafael-lima',
    cover: 'cover-02',
    alt: 'Retrato de uma atriz sob luz dramática',
    hours: 2,
    body: featureBody,
    schemaType: 'Article',
  },
  {
    slug: 'pirates-of-the-caribbean-avanca-com-negociacoes-para-johnny-depp',
    title: 'Pirates of the Caribbean avança com negociações para Johnny Depp',
    excerpt: 'Produtor confirma conversas para o retorno do Capitão Jack Sparrow.',
    category: 'cinema',
    subject: 'Disney',
    author: 'juliana-prado',
    cover: 'cover-03',
    alt: 'Pirata em um navio',
    hours: 3,
  },
  {
    slug: 'resident-evil-de-2026-revela-mudanca-em-monstro-classico',
    title: 'Resident Evil de 2026 revela mudança em monstro clássico',
    excerpt:
      'Novo material do reboot mostra criatura mutante com tentáculos. O estúdio confirma que ela aparece no terceiro ato.',
    category: 'cinema',
    subject: 'Terror',
    tags: ['terror'],
    author: 'rafael-lima',
    cover: 'cover-04',
    alt: 'Cena escura de um filme de terror',
    hours: 4,
  },
  {
    slug: 'cameron-diaz-estrela-bad-day-nova-comedia-de-acao-da-netflix',
    title: 'Cameron Diaz estrela Bad Day, nova comédia de ação da Netflix',
    excerpt: 'A atriz fala sobre o retorno após dez anos longe das telas.',
    category: 'cinema',
    subject: 'Netflix',
    tags: ['netflix'],
    author: 'juliana-prado',
    cover: 'cover-05',
    alt: 'Atriz em cena de ação',
    hours: 5,
  },
  {
    slug: 'hlin-johannsdottir-fecha-parceria-para-just-a-kid',
    title: 'Hlín Jóhannsdóttir fecha parceria com Alief para Just a Kid',
    excerpt: 'A diretora islandesa leva o drama de estreia ao mercado europeu.',
    category: 'cinema',
    subject: 'Cinema de arte',
    author: 'bruno-nunes',
    cover: 'cover-06',
    alt: 'Criança olhando por uma janela',
    hours: 6,
  },
  {
    slug: 'colombiana-ganha-destaque-no-streaming-com-zoe-saldana',
    title: 'Colombiana ganha destaque no streaming com Zoe Saldaña',
    excerpt: 'Filme de 2011 entra no Top 10 após chegar ao catálogo.',
    category: 'cinema',
    subject: 'Streaming',
    tags: ['streaming'],
    author: 'carla-menezes',
    cover: 'cover-07',
    alt: 'Atriz em cena noturna',
    hours: 10,
  },
  {
    slug: 'scarlett-johansson-volta-ao-mcu-em-projeto-secreto',
    title: 'Scarlett Johansson volta ao MCU em projeto secreto do Marvel Studios',
    excerpt: 'Atriz de Viúva Negra foi vista em reunião no estúdio; a Marvel não comenta.',
    category: 'cinema',
    subject: 'Marvel',
    tags: ['marvel'],
    author: 'rafael-lima',
    cover: 'cover-08',
    alt: 'Atriz sorrindo em evento',
    hours: 24,
  },
  {
    slug: 'oito-dos-melhores-filmes-de-2026-ate-agora',
    title: 'Oito dos melhores filmes de 2026 até agora',
    excerpt: 'Os críticos do Máquina Nerd escolhem os destaques do ano até aqui.',
    category: 'cinema',
    subject: 'Lista',
    tags: ['lista'],
    author: 'carla-menezes',
    cover: 'cover-09',
    alt: 'Sala de cinema vazia',
    hours: 30,
    template: 'list',
    schemaType: 'ItemList',
  },
  {
    slug: 'dez-filmes-para-ver-em-setembro',
    title: 'Dez filmes para ver em setembro',
    excerpt: 'Do circuito de arte aos blockbusters, o que estreia no mês.',
    category: 'cinema',
    subject: 'Lista',
    tags: ['lista'],
    author: 'carla-menezes',
    cover: 'cover-10',
    alt: 'Cartazes de filmes em uma parede',
    hours: 50,
  },
  // --- Séries e TV
  {
    slug: 'lanterns-atinge-93-milhoes-de-espectadores-na-estreia',
    title: 'Lanterns atinge 9,3 milhões de espectadores na estreia na HBO',
    excerpt: 'Série de Hal Jordan e John Stewart tem a maior abertura do DC Studios na TV.',
    category: 'series-e-tv',
    subject: 'HBO',
    tags: ['hbo', 'dc'],
    author: 'bruno-nunes',
    cover: 'cover-11',
    alt: 'Dois atores em cena de série',
    hours: 0.4,
  },
  {
    slug: 'billy-bob-thornton-revela-como-o-texas-acolheu-taylor-sheridan',
    title: 'Billy Bob Thornton revela como o Texas acolheu Taylor Sheridan',
    excerpt: 'O ator de Landman fala sobre a parceria com o criador de Yellowstone.',
    category: 'series-e-tv',
    subject: 'Streaming',
    tags: ['streaming'],
    author: 'carla-menezes',
    cover: 'cover-12',
    alt: 'Ator de chapéu em paisagem desértica',
    hours: 6,
  },
  {
    slug: 'por-que-definimos-nossa-identidade-pelas-series-que-acompanhamos',
    title: 'Por que definimos nossa identidade pelas séries que acompanhamos',
    excerpt: 'O hábito de se apresentar pelo que assiste pode ser mais revelador do que parece.',
    category: 'series-e-tv',
    subject: 'Cult',
    tags: ['cult'],
    author: 'carla-menezes',
    cover: 'cover-13',
    alt: 'Pessoa assistindo televisão no escuro',
    hours: 7,
  },
  {
    slug: 'my-brilliant-career-estreia-no-top-10-da-netflix',
    title: 'My Brilliant Career estreia no Top 10 da Netflix',
    excerpt: 'A minissérie australiana surpreende e lidera o ranking em 14 países.',
    category: 'series-e-tv',
    subject: 'Netflix',
    tags: ['netflix'],
    author: 'juliana-prado',
    cover: 'cover-14',
    alt: 'Planta diante de uma janela',
    hours: 8,
  },
  {
    slug: 'the-mighty-boosh-redefine-a-comedia-surrealista',
    title: 'The Mighty Boosh redefine a comédia surrealista na televisão',
    excerpt: 'Vinte anos depois, a série britânica ganha nova geração de fãs.',
    category: 'series-e-tv',
    subject: 'Cult',
    tags: ['cult'],
    author: 'bruno-nunes',
    cover: 'cover-15',
    alt: 'Dois comediantes em figurino excêntrico',
    hours: 9,
  },
  {
    slug: 'taboo-traz-tom-hardy-em-papel-inspirado-por-sherlock-holmes',
    title: 'Taboo traz Tom Hardy em papel inspirado por Sherlock Holmes',
    excerpt: 'Segunda temporada da série chega ao Brasil em setembro.',
    category: 'series-e-tv',
    subject: 'Streaming',
    tags: ['streaming'],
    author: 'bruno-nunes',
    cover: 'cover-16',
    alt: 'Ator de cartola em rua antiga',
    hours: 11,
  },
  {
    slug: 'star-trek-usa-bonecos-ha-60-anos',
    title: 'Star Trek usa bonecos há 60 anos antes de Strange New Worlds',
    excerpt: 'Da série original ao episódio-marionete: o recurso acompanha a franquia.',
    category: 'series-e-tv',
    subject: 'Streaming',
    author: 'bruno-nunes',
    cover: 'cover-17',
    alt: 'Bonecos de ficção científica',
    hours: 26,
  },
  {
    slug: 'cinco-licoes-da-segunda-temporada-de-taboo',
    title: 'Cinco lições da segunda temporada de Taboo',
    excerpt: 'Tom Hardy volta ao papel que definiu a série.',
    category: 'series-e-tv',
    subject: 'Streaming',
    author: 'bruno-nunes',
    cover: 'cover-18',
    alt: 'Ator em cena sombria',
    hours: 29,
  },
  // --- Games
  {
    slug: 'resident-evil-requiem-recebe-demo-gratuita',
    title: 'Resident Evil Requiem recebe demo gratuita na PS Store',
    excerpt: 'Capcom libera o primeiro capítulo para PS5 e Xbox Series.',
    category: 'games',
    subject: 'PS5',
    tags: ['ps5'],
    author: 'juliana-prado',
    cover: 'cover-04',
    alt: 'Personagem em corredor escuro',
    hours: 2,
  },
  {
    slug: 'lego-one-piece-tera-jogo-cooperativo-em-2027',
    title: 'LEGO One Piece terá jogo cooperativo em 2027',
    excerpt: 'Estúdio confirma título para consoles e PC.',
    category: 'games',
    subject: 'PC',
    tags: ['pc'],
    author: 'bruno-nunes',
    cover: 'cover-05',
    alt: 'Peças de montar coloridas',
    hours: 3,
  },
  {
    slug: 'star-trek-infinite-ganha-dlc',
    title: 'Star Trek: Infinite ganha DLC com a era de Strange New Worlds',
    excerpt: 'Expansão adiciona uma nova nave e novas facções.',
    category: 'games',
    subject: 'PC',
    tags: ['pc'],
    author: 'bruno-nunes',
    cover: 'cover-17',
    alt: 'Nave espacial em órbita',
    hours: 27,
  },
  {
    slug: 'bad-day-tera-tie-in-mobile',
    title: 'Bad Day terá tie-in mobile lançado junto com o filme',
    excerpt: 'O jogo chega para assinantes em dezembro.',
    category: 'games',
    subject: 'Mobile',
    author: 'juliana-prado',
    cover: 'cover-06',
    alt: 'Celular com jogo na tela',
    hours: 1.2,
  },
  {
    slug: 'eu-coloquei-aqueles-oculos-e-simplesmente-me-apaixonei',
    title: 'Eu coloquei aqueles óculos e simplesmente me apaixonei',
    excerpt: 'A primeira vez que testou o headset, o diretor decidiu filmar em realidade virtual.',
    category: 'games',
    subject: 'PC',
    author: 'carla-menezes',
    cover: 'cover-07',
    alt: 'Pessoa usando óculos de realidade virtual',
    hours: 13,
  },
  // --- Ofertas (layout de oferta, editoria Games)
  {
    slug: 'controle-xbox-edicao-especial-tem-queda-de-preco-na-amazon',
    title: 'Controle Xbox edição especial tem queda de preço na Amazon',
    excerpt: 'A Amazon derrubou o preço do controle em edição especial.',
    lead: 'A Amazon derrubou o preço do controle sem fio em edição especial, e essa pode ser uma boa oportunidade para quem procurava um controle adicional. Compatível com Xbox Series X|S, Xbox One e PC, o modelo chama atenção pelo acabamento em cor vibrante.',
    category: 'games',
    subject: 'Descontos',
    tags: ['oferta', 'descontos', 'xbox'],
    author: 'rebeca-pinho',
    cover: 'product-01',
    alt: 'Controle sem fio de videogame',
    hours: 4,
    body: offerBody,
  },
  {
    slug: 'monitores-gamer-em-promocao-o-que-vale-a-pena',
    title: 'Monitores gamer em promoção: o que vale a pena nesta semana',
    excerpt: 'Uma seleção de modelos com preço de demonstração.',
    category: 'games',
    subject: 'Descontos',
    tags: ['oferta', 'descontos'],
    author: 'rebeca-pinho',
    cover: 'cover-09',
    alt: 'Monitor em uma mesa',
    hours: 20,
    body: shortBody('monitores'),
  },
  {
    slug: 'headsets-para-xbox-e-pc-ganham-desconto',
    title: 'Headsets para Xbox e PC ganham desconto em campanha de setembro',
    excerpt: 'Modelos com e sem fio entram na campanha.',
    category: 'games',
    subject: 'Descontos',
    tags: ['oferta', 'descontos'],
    author: 'rebeca-pinho',
    cover: 'cover-10',
    alt: 'Fone de ouvido sobre uma mesa',
    hours: 22,
    body: shortBody('headsets'),
  },
  {
    slug: 'smartwatch-chega-com-oferta-especial',
    title: 'Smartwatch chega com oferta especial no Mercado Livre',
    excerpt: 'Relógio inteligente entra em oferta de demonstração.',
    category: 'games',
    subject: 'Descontos',
    tags: ['oferta', 'descontos'],
    author: 'rebeca-pinho',
    cover: 'cover-11',
    alt: 'Relógio inteligente no pulso',
    hours: 23,
    body: shortBody('relógios inteligentes'),
  },
  // --- Quadrinhos
  {
    slug: 'absolute-batman-passa-a-marca-de-1-milhao-de-copias',
    title: 'Absolute Batman passa a marca de 1 milhão de cópias',
    excerpt: 'O título é o mais vendido do selo.',
    category: 'quadrinhos',
    subject: 'DC Comics',
    tags: ['dc-comics'],
    author: 'juliana-prado',
    cover: 'cover-12',
    alt: 'Pilha de revistas em quadrinhos',
    hours: 0.4,
  },
  {
    slug: 'ultimate-spider-man-tera-arco-final-em-dezembro',
    title: 'Ultimate Spider-Man terá arco final em dezembro',
    excerpt: 'A editora confirma o encerramento da fase.',
    category: 'quadrinhos',
    subject: 'Marvel Comics',
    tags: ['marvel-comics'],
    author: 'bruno-nunes',
    cover: 'cover-13',
    alt: 'Página de quadrinho colorida',
    hours: 0.9,
  },
  {
    slug: 'one-piece-chega-ao-capitulo-1200',
    title: 'One Piece chega ao capítulo 1.200 com edição especial',
    excerpt: 'Marco é celebrado com capa comemorativa.',
    category: 'quadrinhos',
    subject: 'Mangá',
    tags: ['manga'],
    author: 'juliana-prado',
    cover: 'cover-14',
    alt: 'Mangá aberto sobre uma mesa',
    hours: 0.3,
  },
  {
    slug: 'editora-brasileira-lanca-antologia-de-terror',
    title: 'Editora brasileira lança antologia de quadrinhos de terror',
    excerpt: 'Doze autores nacionais assinam as histórias.',
    category: 'quadrinhos',
    subject: 'Independentes',
    tags: ['independentes', 'terror'],
    author: 'carla-menezes',
    cover: 'cover-15',
    alt: 'Capa de antologia em preto e branco',
    hours: 3,
  },
  {
    slug: 'a-grande-super-heroina-perdida-dos-quadrinhos',
    title: 'A grande super-heroína "perdida" dos quadrinhos',
    excerpt: 'Uma personagem que sumiu das bancas e virou lenda.',
    category: 'quadrinhos',
    subject: 'DC Comics',
    tags: ['dc-comics'],
    author: 'bruno-nunes',
    cover: 'cover-16',
    alt: 'Ilustração de heroína em pose de ação',
    hours: 40,
  },
  // --- Animes
  {
    slug: 'netflix-revela-trailer-de-lego-one-piece',
    title: 'Netflix revela trailer de LEGO One Piece com aventura inédita',
    excerpt: 'O especial em duas partes adapta o arco de East Blue com humor e peças de montar.',
    category: 'animes',
    subject: 'Lançamentos',
    tags: ['lancamentos'],
    author: 'juliana-prado',
    cover: 'cover-05',
    alt: 'Personagens de montar em um navio',
    hours: 6,
  },
  {
    slug: 'lego-one-piece-tudo-o-que-sabemos',
    title: 'LEGO One Piece: tudo o que sabemos sobre o especial',
    excerpt: 'Elenco de dublagem, data e o que muda em relação ao mangá.',
    category: 'animes',
    subject: 'Lançamentos',
    tags: ['lancamentos'],
    author: 'juliana-prado',
    cover: 'cover-06',
    alt: 'Cena animada com piratas',
    hours: 45,
  },
  {
    slug: 'president-curtis-ganha-segunda-temporada',
    title: 'President Curtis ganha segunda temporada no Adult Swim',
    excerpt: 'A sátira política animada renova antes da estreia da primeira.',
    category: 'animes',
    subject: 'Animação',
    tags: ['animacao'],
    author: 'bruno-nunes',
    cover: 'cover-07',
    alt: 'Personagem animado em um palanque',
    hours: 60,
  },
  {
    slug: 'as-series-que-moldaram-o-humor-absurdo',
    title: 'As séries que moldaram o humor absurdo dos anos 2000',
    excerpt: 'De Mighty Boosh a Flight of the Conchords.',
    category: 'animes',
    subject: 'Animação',
    tags: ['animacao'],
    author: 'carla-menezes',
    cover: 'cover-08',
    alt: 'Colagem de personagens de TV',
    hours: 70,
  },
  // --- Vídeos
  {
    slug: 'ahsoka-o-que-o-trailer-da-2a-temporada-revela',
    title: 'Ahsoka: o que o trailer da 2ª temporada revela sobre Thrawn',
    excerpt: 'A redação analisa quadro a quadro o retorno do Grande Almirante.',
    category: 'videos',
    subject: 'Star Wars',
    tags: ['star-wars', 'trailers'],
    author: 'bruno-nunes',
    cover: 'still-01',
    alt: 'Personagem em armadura diante de uma nave',
    hours: 5,
    template: 'video',
  },
  {
    slug: 'como-strange-new-worlds-recriou-bonecos-dos-anos-60',
    title: 'Como Strange New Worlds recriou bonecos dos anos 60',
    excerpt: 'Os bastidores do episódio-marionete.',
    category: 'videos',
    subject: 'Clipes',
    tags: ['clipes'],
    author: 'bruno-nunes',
    cover: 'still-02',
    alt: 'Marionetes em um set',
    hours: 8,
    template: 'video',
  },
  {
    slug: 'tom-hardy-explica-o-novo-taboo',
    title: 'Tom Hardy explica o novo Taboo',
    excerpt: 'Entrevista sobre a segunda temporada.',
    category: 'videos',
    subject: 'Entrevistas',
    tags: ['entrevistas'],
    author: 'carla-menezes',
    cover: 'still-03',
    alt: 'Ator em entrevista',
    hours: 9,
    template: 'video',
  },
  {
    slug: 'colombiana-por-que-o-filme-voltou-ao-top-10',
    title: 'Colombiana: por que o filme voltou ao Top 10',
    excerpt: 'Análise em vídeo do fenômeno.',
    category: 'videos',
    subject: 'Clipes',
    tags: ['clipes'],
    author: 'juliana-prado',
    cover: 'still-04',
    alt: 'Cena de ação noturna',
    hours: 12,
    template: 'video',
  },
  {
    slug: 'bad-day-bastidores-com-cameron-diaz',
    title: 'Bad Day: bastidores com Cameron Diaz',
    excerpt: 'A atriz mostra o set da comédia de ação.',
    category: 'videos',
    subject: 'Entrevistas',
    tags: ['entrevistas'],
    author: 'juliana-prado',
    cover: 'still-05',
    alt: 'Set de filmagem com equipe',
    hours: 14,
    template: 'video',
  },
  // --- Especiais
  {
    slug: 'as-transformacoes-mais-extremas-dos-astros-da-marvel',
    title: 'As transformações mais extremas dos astros da Marvel',
    excerpt: 'Da preparação física às próteses: o que os atores fizeram para entrar no universo.',
    category: 'especiais',
    subject: 'Reportagem',
    tags: ['reportagem', 'marvel'],
    author: 'juliana-prado',
    cover: 'cover-01',
    alt: 'Ator em maquiagem de prótese',
    hours: 48,
  },
  {
    slug: 'duas-estrelas-para-o-novo-faroeste-de-taylor-sheridan',
    title: 'Duas estrelas para o novo faroeste de Taylor Sheridan',
    excerpt: 'Landman é uma mistura instável de drama familiar e thriller de petróleo.',
    category: 'especiais',
    subject: 'Crítica',
    tags: ['critica', 'reviews'],
    author: 'carla-menezes',
    cover: 'cover-02',
    alt: 'Campo de petróleo ao pôr do sol',
    hours: 72,
    schemaType: 'Review',
  },
  {
    slug: 'my-brilliant-career-e-a-dificuldade-de-ser-misteriosa',
    title: 'My Brilliant Career e a dificuldade de ser misteriosa no streaming',
    excerpt: 'A minissérie cultivou uma imagem enigmática, corroída por controvérsias recentes.',
    category: 'especiais',
    subject: 'Crítica',
    tags: ['critica'],
    author: 'carla-menezes',
    cover: 'cover-03',
    alt: 'Mulher olhando por uma janela',
    hours: 96,
  },
];

const NOW = Date.parse(FIXTURE_NOW_ISO);
const iso = (hoursBefore: number) => new Date(NOW - hoursBefore * 3_600_000).toISOString();

function wordsOf(blocks: ContentBlock[]): number {
  return blocks.reduce((acc, b) => {
    if (b.type === 'paragraph' || b.type === 'quote') {
      return (
        acc +
        b.content
          .map((n) => (n.type === 'text' ? n.text : ''))
          .join(' ')
          .split(/\s+/).length
      );
    }
    return b.type === 'heading' ? acc + b.text.split(/\s+/).length : acc;
  }, 0);
}

function build(seed: Seed): Article {
  const category = fixtureCategories.find((c) => c.slug === seed.category) ?? null;
  const tags = (seed.tags ?? [])
    .map((slug) => fixtureTags.find((x) => x.slug === slug))
    .filter((x): x is Tag => Boolean(x));
  const subjectTag = seed.subject ? fixtureTags.find((x) => x.name === seed.subject) : undefined;
  if (subjectTag && !tags.includes(subjectTag)) tags.unshift(subjectTag);
  const authors = fixtureAuthors.filter((a) => a.slug === seed.author);
  const cover = IMG(seed.cover, seed.alt);
  cover.credit = 'Imagem de demonstração';
  const body = seed.body ?? shortBody(seed.title.toLowerCase());
  const layout: ArticleLayout = resolveLayout(tags);
  const publishedAt = iso(seed.hours);
  const editedAt = seed.editedHoursAfter
    ? new Date(Date.parse(publishedAt) + seed.editedHoursAfter * 3_600_000).toISOString()
    : null;

  return {
    id: `art-${seed.slug.slice(0, 40)}`,
    brand: 'mn',
    slug: seed.slug,
    template: seed.template ?? 'standard',
    layout,
    title: seed.title,
    ...(seed.lead ? { subtitle: seed.lead } : {}),
    excerpt: seed.excerpt,
    cover,
    authors,
    category,
    tags,
    publishedAt,
    updatedAt: editedAt ?? publishedAt,
    status: 'published',
    readingMinutes: readingMinutes(wordsOf(body)),
    ...(layout === 'offer' ? { commercialKind: 'affiliate' as const } : {}),
    body,
    editedAt,
    seo: {
      title: seed.title,
      description: seed.excerpt,
      ogImage: cover,
      noindex: false,
      nofollow: false,
      schemaType: seed.schemaType ?? 'NewsArticle',
    },
    ...(layout === 'offer'
      ? {
          commercial: {
            kind: 'affiliate' as const,
            brandName: 'Lojas parceiras',
            disclosure:
              'Este conteúdo contém links de afiliados. O Máquina Nerd pode receber comissão por compras feitas por estes links, sem alteração no valor final.',
          },
        }
      : {}),
  };
}

export const fixtureArticles: Article[] = seeds.map(build);

/** A draft only the preview can open. */
export const fixtureDraft: Article = {
  ...build({
    slug: 'rascunho-de-demonstracao',
    title: 'Rascunho de demonstração',
    excerpt: 'Só a pré-visualização abre esta matéria.',
    category: 'cinema',
    author: 'rafael-lima',
    cover: 'cover-12',
    alt: 'Mesa de redação',
    hours: 0,
  }),
  status: 'draft',
  publishedAt: null,
};

export function toSummary(article: Article): ArticleSummary {
  const { body: _body, seo: _seo, commercial: _commercial, review: _review, editedAt: _editedAt, ...summary } = article;
  return summary;
}

export const fixtureRedirects = [
  {
    from: '/2026/08/resident-evil-de-2026-revela-mudanca-em-monstro-classico',
    to: '/cinema/resident-evil-de-2026-revela-mudanca-em-monstro-classico',
    status: 301 as const,
  },
  { from: '/feed', to: '/feed.xml', status: 301 as const },
  { from: '/tag/antigo-removido', to: '/', status: 410 as const },
];
