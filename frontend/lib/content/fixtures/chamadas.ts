// Chamadas de demonstração. Títulos e resumos vêm dos protótipos; nada aqui foi apurado.
import type { Autor, EditoriaSlug, Formato } from "../types";
import type { ImgKey } from "./imagens";

export const AUTORES: Record<string, Autor> = {
  "rafael-lima": { slug: "rafael-lima", nome: "Rafael Lima" },
  "juliana-prado": { slug: "juliana-prado", nome: "Juliana Prado" },
  "bruno-nunes": { slug: "bruno-nunes", nome: "Bruno Nunes" },
  "carla-menezes": { slug: "carla-menezes", nome: "Carla Menezes" },
  "rebeca-pinho": { slug: "rebeca-pinho", nome: "Rebeca Pinho" },
};

export interface ChamadaRow {
  slug: string;
  ed: EditoriaSlug;
  assunto?: string;
  titulo: string;
  resumo?: string;
  img: ImgKey;
  /** Minutos antes do instante da leitura (as datas acompanham o relógio). */
  min: number;
  autores: (keyof typeof AUTORES)[];
  formato?: Formato;
}

const H = 60;
const D = 24 * H;

export const ROWS: ChamadaRow[] = [
  // ---------- Cinema ----------
  { slug: "o-misterio-de-scarlett-johansson", ed: "cinema", assunto: "Marvel", titulo: "O mistério de Scarlett Johansson, a estrela “perdida” da Marvel", resumo: "Há pouco mais de cinco anos, Viúva Negra encerrou a jornada de Natasha Romanoff. Mas sua estrela tem sido esquiva desde então.", img: "scar", min: 3 * D + 5 * H, autores: ["rafael-lima"], formato: "reportagem" },
  { slug: "como-scarlett-johansson-virou-o-centro-de-um-mito", ed: "cinema", assunto: "Marvel", titulo: "Como Scarlett Johansson virou o centro de um mito da Marvel", resumo: "Cinco anos depois de Viúva Negra, a atriz volta a ser assunto nos corredores do estúdio. Rafael Lima revisita as muitas versões dela na cultura pop.", img: "scar", min: 1 * H, autores: ["rafael-lima"], formato: "reportagem" },
  { slug: "pirates-of-the-caribbean-negociacoes-johnny-depp", ed: "cinema", assunto: "Disney", titulo: "Pirates of the Caribbean avança com negociações para Johnny Depp", resumo: "Jerry Bruckheimer confirma conversas para o retorno do Capitão Jack Sparrow.", img: "depp", min: 1 * H + 4, autores: ["juliana-prado"] },
  { slug: "cameron-diaz-estrela-bad-day", ed: "cinema", assunto: "Netflix", titulo: "Cameron Diaz estrela Bad Day, nova comédia de ação da Netflix", resumo: "A atriz volta às telas ao lado de Jamie Foxx em produção que estreia em dezembro.", img: "bad", min: 20, autores: ["juliana-prado"] },
  { slug: "hlin-johannsdottir-alief-just-a-kid", ed: "cinema", assunto: "Cinema de arte", titulo: "Hlín Jóhannsdóttir fecha parceria com Alief para Just a Kid", resumo: "A diretora islandesa leva o drama de estreia ao mercado europeu.", img: "kid", min: 6 * H, autores: ["bruno-nunes"] },
  { slug: "scarlett-johansson-volta-ao-mcu", ed: "cinema", assunto: "Marvel", titulo: "Scarlett Johansson volta ao MCU em projeto secreto do Marvel Studios", resumo: "Atriz de Viúva Negra foi vista em reunião com Kevin Feige; estúdio não comenta.", img: "scar", min: 1 * D + 2 * H, autores: ["rafael-lima"] },
  { slug: "colombiana-destaque-streaming-zoe-saldana", ed: "cinema", assunto: "Streaming", titulo: "Colombiana ganha destaque no streaming com Zoe Saldaña", resumo: "Filme de 2011 entra no Top 10 após chegar ao catálogo.", img: "shooter", min: 10 * H, autores: ["carla-menezes"] },
  { slug: "resident-evil-2026-monstro-classico", ed: "cinema", assunto: "Terror", titulo: "Resident Evil de 2026 revela mudança em monstro clássico", resumo: "Novo material do reboot mostra criatura mutante com tentáculos. O estúdio confirma que ela aparece no terceiro ato.", img: "re", min: 24, autores: ["rafael-lima"] },
  { slug: "resident-evil-filme-de-terror-para-adolescentes", ed: "cinema", assunto: "Terror", titulo: "Resident Evil: o real significado de um filme de terror “para adolescentes”", resumo: "Quando saiu em 2002, o primeiro filme foi descartado pela crítica. Duas décadas depois, o reboot tenta corrigir a rota.", img: "re", min: 3 * D, autores: ["bruno-nunes"], formato: "reportagem" },
  { slug: "oito-dos-melhores-filmes-de-2026", ed: "cinema", assunto: "Trailers", titulo: "Oito dos melhores filmes de 2026 até agora", resumo: "Os críticos do Máquina Nerd escolhem os destaques do ano até aqui, de Just a Kid ao novo Resident Evil.", img: "kid", min: 4 * D, autores: ["rafael-lima", "carla-menezes"], formato: "lista" },
  { slug: "transformacoes-mais-extremas-astros-marvel", ed: "cinema", assunto: "Marvel", titulo: "As transformações mais extremas dos astros da Marvel", resumo: "Da preparação física às próteses: o que os atores fizeram para entrar no universo.", img: "scar", min: 5 * D, autores: ["juliana-prado"], formato: "lista" },
  { slug: "o-misterio-de-jack-sparrow", ed: "cinema", assunto: "Disney", titulo: "O mistério de Jack Sparrow: por que Depp volta agora", resumo: "Os bastidores da negociação que ninguém achava possível.", img: "depp", min: 6 * D, autores: ["rafael-lima"] },
  { slug: "dez-filmes-para-ver-em-setembro", ed: "cinema", assunto: "Trailers", titulo: "Dez filmes para ver em setembro", resumo: "Do circuito de arte aos blockbusters, o que estreia no mês.", img: "shooter", min: 7 * D, autores: ["carla-menezes"], formato: "lista" },
  { slug: "cameron-diaz-retorno-dez-anos", ed: "cinema", assunto: "Netflix", titulo: "Cameron Diaz fala sobre o retorno após dez anos longe das telas", resumo: "A atriz de Bad Day diz que aceitou o projeto pela parceria com Jamie Foxx.", img: "bad", min: 1 * H + 30, autores: ["juliana-prado"] },
  { slug: "just-a-kid-cinema-islandes-no-brasil", ed: "cinema", assunto: "Cinema de arte", titulo: "Just a Kid e o cinema islandês que chega ao Brasil", resumo: "Distribuidora anuncia circuito de arte em outubro.", img: "kid", min: 4 * H, autores: ["bruno-nunes"] },
  { slug: "star-wars-novo-filme-filmagens", ed: "cinema", assunto: "Star Wars", titulo: "Novo filme de Star Wars encerra filmagens em Londres", resumo: "A Lucasfilm confirma a pós-produção e mantém a estreia para 2027.", img: "ahs", min: 2 * D, autores: ["bruno-nunes"] },
  { slug: "dc-studios-calendario-2027", ed: "cinema", assunto: "DC", titulo: "DC Studios apresenta calendário de estreias para 2027", resumo: "Três filmes e duas séries entram na lista divulgada pelo estúdio.", img: "lant", min: 2 * D + 6 * H, autores: ["rafael-lima"] },

  // ---------- Séries e TV ----------
  { slug: "lanterns-9-milhoes-estreia-hbo", ed: "series-e-tv", assunto: "HBO", titulo: "Lanterns atinge 9,3 milhões de espectadores na estreia na HBO", resumo: "Série de Hal Jordan e John Stewart tem a maior abertura do DC Studios na TV.", img: "lant", min: 2 * H, autores: ["rafael-lima"] },
  { slug: "billy-bob-thornton-texas-taylor-sheridan", ed: "series-e-tv", assunto: "Streaming", titulo: "Billy Bob Thornton revela como o Texas acolheu Taylor Sheridan", resumo: "O ator de Landman fala sobre a parceria com o criador de Yellowstone.", img: "bbt", min: 6 * H + 10, autores: ["juliana-prado"] },
  { slug: "taboo-tom-hardy-sherlock-holmes", ed: "series-e-tv", assunto: "Cult", titulo: "Taboo traz Tom Hardy em papel inspirado por Sherlock Holmes", resumo: "Segunda temporada da série da BBC chega ao Brasil em setembro.", img: "taboo", min: 6 * H + 20, autores: ["bruno-nunes"] },
  { slug: "star-trek-bonecos-strange-new-worlds", ed: "series-e-tv", assunto: "Streaming", titulo: "Star Trek usa bonecos há 60 anos antes de Strange New Worlds", resumo: "Da série original ao episódio-marionete: o recurso acompanha a franquia.", img: "spock", min: 5 * D, autores: ["bruno-nunes"] },
  { slug: "identidade-pelas-series-que-acompanhamos", ed: "series-e-tv", assunto: "Cult", titulo: "Por que definimos nossa identidade pelas séries que acompanhamos", resumo: "O hábito de se apresentar pelo que assiste pode ser mais revelador do que parece.", img: "bbt", min: 4 * D + 2 * H, autores: ["carla-menezes"], formato: "reportagem" },
  { slug: "my-brilliant-career-top-10-netflix", ed: "series-e-tv", assunto: "Netflix", titulo: "My Brilliant Career estreia no Top 10 da Netflix", resumo: "A minissérie australiana surpreende e lidera o ranking em 14 países.", img: "mbc", min: 1 * D + 3 * H, autores: ["juliana-prado"] },
  { slug: "mighty-boosh-comedia-surrealista", ed: "series-e-tv", assunto: "Cult", titulo: "The Mighty Boosh redefine a comédia surrealista na televisão", resumo: "Vinte anos depois, a série britânica ganha nova geração de fãs.", img: "boosh", min: 4 * D + 6 * H, autores: ["bruno-nunes"] },
  { slug: "lanterns-segunda-temporada-aprovada", ed: "series-e-tv", assunto: "HBO", titulo: "Lanterns: a HBO aprova a produção da segunda temporada", resumo: "O DC Studios anunciou um plano para expandir o universo de Hal Jordan com mais dez episódios a partir de 2027.", img: "lant", min: 5 * H, autores: ["rafael-lima"] },
  { slug: "strange-new-worlds-episodio-com-bonecos", ed: "series-e-tv", assunto: "Streaming", titulo: "Strange New Worlds terá episódio inteiro com bonecos", resumo: "Paramount+ confirma o formato para o meio da temporada.", img: "spock", min: 2 * H + 15, autores: ["bruno-nunes"] },
  { slug: "cinco-licoes-segunda-temporada-taboo", ed: "series-e-tv", assunto: "Cult", titulo: "Cinco lições da segunda temporada de Taboo", resumo: "Tom Hardy volta ao papel que definiu a série da BBC e da FX.", img: "taboo", min: 1 * D + 5 * H, autores: ["bruno-nunes"], formato: "lista" },
  { slug: "my-brilliant-career-dificuldade-de-ser-misteriosa", ed: "series-e-tv", assunto: "Netflix", titulo: "My Brilliant Career e a dificuldade de ser misteriosa no streaming", resumo: "A minissérie sempre cultivou uma imagem enigmática, mas isso foi corroído por controvérsias recentes. É apenas um sinal dos tempos, pergunta Carla Menezes.", img: "mbc", min: 9 * D, autores: ["carla-menezes"], formato: "critica" },
  { slug: "oito-series-para-acompanhar-em-setembro", ed: "series-e-tv", assunto: "Streaming", titulo: "Oito séries para acompanhar em setembro", resumo: "As estreias e as voltas de temporada que a redação vai acompanhar no mês.", img: "taboo", min: 8 * D, autores: ["juliana-prado", "carla-menezes"], formato: "lista" },
  { slug: "landman-novo-faroeste-taylor-sheridan", ed: "series-e-tv", assunto: "Streaming", titulo: "Duas estrelas para o novo faroeste de Taylor Sheridan", resumo: "Landman é uma mistura instável de drama familiar e thriller de petróleo.", img: "bbt", min: 6 * D, autores: ["carla-menezes"], formato: "critica" },

  // ---------- Games ----------
  { slug: "resident-evil-requiem-demo-gratuita", ed: "games", assunto: "PS5", titulo: "Resident Evil Requiem recebe demo gratuita na PS Store", resumo: "Capcom libera o primeiro capítulo para PS5 e Xbox Series.", img: "re", min: 2 * H, autores: ["bruno-nunes"] },
  { slug: "lego-one-piece-jogo-cooperativo-2027", ed: "games", assunto: "PC", titulo: "LEGO One Piece terá jogo cooperativo em 2027", resumo: "TT Games confirma título para consoles e PC no evento da Netflix.", img: "lego", min: 3 * H, autores: ["carla-menezes"] },
  { slug: "star-trek-infinite-dlc-strange-new-worlds", ed: "games", assunto: "PC", titulo: "Star Trek: Infinite ganha DLC com a era de Strange New Worlds", resumo: "Expansão adiciona a Enterprise de Pike e novas facções.", img: "spock", min: 5 * D + 3 * H, autores: ["bruno-nunes"] },
  { slug: "bad-day-tie-in-mobile", ed: "games", assunto: "Mobile", titulo: "Bad Day terá tie-in mobile lançado junto com o filme", resumo: "Netflix Games publica o jogo para assinantes em dezembro.", img: "bad", min: 52, autores: ["juliana-prado"] },
  { slug: "coloquei-aqueles-oculos-e-me-apaixonei", ed: "games", assunto: "PC", titulo: "Eu coloquei aqueles óculos e simplesmente me apaixonei", resumo: "A primeira vez que testou o headset, o diretor de Just a Kid decidiu filmar em realidade virtual.", img: "kid", min: 13 * H, autores: ["carla-menezes"], formato: "reportagem" },
  { slug: "xbox-controle-edicao-especial-fim-de-ano", ed: "games", assunto: "Xbox", titulo: "Xbox confirma controle em edição especial para o fim do ano", resumo: "Acessório chega com acabamento texturizado e compatibilidade com PC.", img: "bad", min: 7 * H, autores: ["rebeca-pinho"] },
  { slug: "nintendo-direct-jogos-independentes", ed: "games", assunto: "Nintendo", titulo: "Nintendo anuncia Direct dedicado a jogos independentes", resumo: "Apresentação de 30 minutos mostra títulos que chegam ao console até março.", img: "kid", min: 9 * H, autores: ["bruno-nunes"] },
  { slug: "demo-resident-evil-requiem-2-milhoes", ed: "games", assunto: "PS5", titulo: "Demo de Resident Evil Requiem passa de 2 milhões de downloads", resumo: "Capcom comemora a marca e promete mais conteúdo antes do lançamento.", img: "re", min: 1 * D + 1 * H, autores: ["bruno-nunes"] },
  { slug: "lego-one-piece-requisitos-pc", ed: "games", assunto: "PC", titulo: "Os requisitos de LEGO One Piece para rodar no PC", resumo: "TT Games divulga configurações mínima e recomendada.", img: "lego", min: 2 * D + 2 * H, autores: ["carla-menezes"] },
  { slug: "spider-man-2-modo-foto-trajes", ed: "games", assunto: "PS5", titulo: "Marvel's Spider-Man 2 ganha modo foto com trajes clássicos", resumo: "Atualização gratuita chega ao PS5 com novos filtros e poses.", img: "scar", min: 3 * D + 1 * H, autores: ["rebeca-pinho"] },

  // ---------- Quadrinhos ----------
  { slug: "absolute-batman-1-milhao-de-copias", ed: "quadrinhos", assunto: "DC Comics", titulo: "Absolute Batman passa a marca de 1 milhão de cópias", resumo: "O selo da DC mantém a série no topo das vendas pelo quinto mês.", img: "hq", min: 22, autores: ["rebeca-pinho"] },
  { slug: "ultimate-spider-man-arco-final", ed: "quadrinhos", assunto: "Marvel Comics", titulo: "Ultimate Spider-Man terá arco final em dezembro", resumo: "O roteirista encerra a fase com uma edição dupla.", img: "hq", min: 52, autores: ["rebeca-pinho"] },
  { slug: "one-piece-capitulo-1200", ed: "quadrinhos", assunto: "Mangá", titulo: "One Piece chega ao capítulo 1.200 com edição especial", resumo: "O capítulo sai com páginas coloridas e pôster.", img: "lego", min: 20, autores: ["carla-menezes"] },
  { slug: "antologia-brasileira-quadrinhos-de-terror", ed: "quadrinhos", assunto: "Independentes", titulo: "Editora brasileira lança antologia de quadrinhos de terror", resumo: "Coletânea reúne doze autores nacionais em edição de luxo.", img: "hq", min: 3 * H, autores: ["bruno-nunes"] },
  { slug: "absolute-batman-ultimate-spider-man-one-piece-1200", ed: "quadrinhos", assunto: "DC Comics", titulo: "Absolute Batman, Ultimate Spider-Man, One Piece 1.200: o que sabemos", resumo: "Um terceiro selo entra na disputa em meio à retomada das vendas.", img: "scar", min: 3 * H + 20, autores: ["rebeca-pinho"] },
  { slug: "a-grande-super-heroina-perdida", ed: "quadrinhos", assunto: "DC Comics", titulo: "A grande super-heroína “perdida” dos quadrinhos", resumo: "Ela foi a primeira de sua editora a ter série própria — e desapareceu por trinta anos.", img: "hq", min: 7 * D, autores: ["bruno-nunes"], formato: "reportagem" },
  { slug: "sandman-edicao-definitiva-capa-dura", ed: "quadrinhos", assunto: "DC Comics", titulo: "Sandman ganha nova edição definitiva em capa dura", resumo: "O primeiro volume reúne as edições 1 a 20 com material extra.", img: "hq", min: 3 * D + 4 * H, autores: ["rebeca-pinho"] },
  { slug: "o-longo-dia-das-bruxas-encadernado", ed: "quadrinhos", assunto: "DC Comics", titulo: "O Longo Dia das Bruxas volta às livrarias em encadernado", resumo: "A história de Jeph Loeb e Tim Sale ganha nova tiragem.", img: "hq", min: 4 * D + 1 * H, autores: ["rebeca-pinho"] },
  { slug: "mangas-lideram-vendas-2026", ed: "quadrinhos", assunto: "Mangá", titulo: "Mangás lideram vendas de quadrinhos no Brasil em 2026", resumo: "Levantamento das editoras mostra o formato à frente dos super-heróis.", img: "lego", min: 5 * D + 4 * H, autores: ["carla-menezes"] },

  // ---------- Animes ----------
  { slug: "netflix-trailer-lego-one-piece", ed: "animes", assunto: "Lançamentos", titulo: "Netflix revela trailer de LEGO One Piece com aventura inédita", resumo: "O especial em duas partes adapta o arco de East Blue com humor e peças de montar.", img: "lego", min: 6 * H + 5, autores: ["carla-menezes"] },
  { slug: "lego-one-piece-tudo-o-que-sabemos", ed: "animes", assunto: "Lançamentos", titulo: "LEGO One Piece: tudo o que sabemos sobre o especial", resumo: "Elenco de dublagem, data e o que muda em relação ao mangá.", img: "lego", min: 3 * D + 2 * H, autores: ["carla-menezes"], formato: "lista" },
  { slug: "president-curtis-segunda-temporada", ed: "animes", assunto: "Animação", titulo: "President Curtis ganha segunda temporada no Adult Swim", resumo: "A sátira política animada renova antes da estreia da primeira.", img: "adult", min: 4 * D + 3 * H, autores: ["bruno-nunes"] },
  { slug: "erramos-sobre-as-adaptacoes-em-lego", ed: "animes", assunto: "Animação", titulo: "Erramos sobre as adaptações em LEGO?", resumo: "Os especiais em peças de montar deixaram de ser produto de catálogo.", img: "lego", min: 6 * D + 2 * H, autores: ["carla-menezes"], formato: "critica" },
  { slug: "dublagem-brasileira-lego-one-piece", ed: "animes", assunto: "Lançamentos", titulo: "Dublagem brasileira de LEGO One Piece mantém elenco da série", resumo: "As vozes de Luffy e Zoro estão confirmadas no especial.", img: "lego", min: 1 * D + 6 * H, autores: ["juliana-prado"] },
  { slug: "shonens-mais-aguardados-2026", ed: "animes", assunto: "Shonen", titulo: "Os shonens mais aguardados para o resto de 2026", resumo: "Continuações e estreias que a redação está acompanhando.", img: "adult", min: 2 * D + 3 * H, autores: ["carla-menezes"], formato: "lista" },
  { slug: "adult-swim-bloco-de-animes", ed: "animes", assunto: "Animação", titulo: "Adult Swim amplia bloco de animes na programação", resumo: "O canal adiciona duas noites dedicadas a séries japonesas.", img: "adult", min: 8 * H, autores: ["bruno-nunes"] },
  { slug: "filme-de-anime-recorde-bilheteria", ed: "animes", assunto: "Filmes", titulo: "Filme de anime bate recorde de bilheteria no Brasil", resumo: "A estreia supera a maior abertura de uma animação japonesa no país.", img: "lego", min: 11 * H, autores: ["juliana-prado"] },

  // ---------- Vídeos ----------
  { slug: "ahsoka-trailer-segunda-temporada-thrawn", ed: "videos", assunto: "Trailers", titulo: "Ahsoka: o que o trailer da 2ª temporada revela sobre Thrawn", resumo: "A redação analisa quadro a quadro o retorno do Grande Almirante.", img: "ahs", min: 2 * H + 40, autores: ["bruno-nunes"], formato: "video" },
  { slug: "trailer-lego-one-piece-especial-netflix", ed: "videos", assunto: "Trailers", titulo: "Trailer: LEGO One Piece, o especial da Netflix", img: "lego", min: 5 * D, autores: ["carla-menezes"], formato: "video" },
  { slug: "trailer-ahsoka-segunda-temporada", ed: "videos", assunto: "Trailers", titulo: "Trailer: Ahsoka, 2ª temporada", img: "ahs", min: 4 * D + 5 * H, autores: ["bruno-nunes"], formato: "video" },
  { slug: "teaser-resident-evil-2026", ed: "videos", assunto: "Trailers", titulo: "Teaser: Resident Evil (2026)", img: "re", min: 6 * D + 1 * H, autores: ["rafael-lima"], formato: "video" },
  { slug: "entrevista-jerry-bruckheimer-piratas-do-caribe", ed: "videos", assunto: "Entrevistas", titulo: "Entrevista: Jerry Bruckheimer sobre Piratas do Caribe", img: "depp", min: 8 * D, autores: ["juliana-prado"], formato: "video" },
  { slug: "strange-new-worlds-recriou-bonecos", ed: "videos", assunto: "Clipes", titulo: "Como Strange New Worlds recriou bonecos dos anos 60", img: "spock", min: 5 * H + 10, autores: ["bruno-nunes"], formato: "video" },
  { slug: "tom-hardy-explica-o-novo-taboo", ed: "videos", assunto: "Entrevistas", titulo: "Tom Hardy explica o novo Taboo", resumo: "O ator fala sobre o personagem inspirado em Sherlock Holmes.", img: "taboo", min: 22 + 6, autores: ["bruno-nunes"], formato: "video" },
  { slug: "colombiana-por-que-voltou-ao-top-10", ed: "videos", assunto: "Clipes", titulo: "Colombiana: por que o filme voltou ao Top 10", img: "shooter", min: 8 * H + 20, autores: ["carla-menezes"], formato: "video" },
  { slug: "bad-day-bastidores-cameron-diaz", ed: "videos", assunto: "Clipes", titulo: "Bad Day: bastidores com Cameron Diaz", img: "bad", min: 10 * H, autores: ["juliana-prado"], formato: "video" },

  // ---------- Especiais ----------
  { slug: "terror-para-adolescentes-mal-compreendido", ed: "especiais", assunto: "Reportagem", titulo: "Como um filme de terror “para adolescentes” foi mal compreendido", resumo: "A crítica descartou o primeiro Resident Evil; o público, não.", img: "re", min: 9 * D + 2 * H, autores: ["bruno-nunes"], formato: "reportagem" },
  { slug: "just-a-kid-pistas-de-uma-geracao", ed: "especiais", assunto: "Crítica", titulo: "Just a Kid: pistas de uma geração numa janela islandesa", resumo: "O drama de estreia de Hlín Jóhannsdóttir observa a infância pela fresta.", img: "kid", min: 10 * D, autores: ["rafael-lima"], formato: "critica" },
  { slug: "reviravolta-mais-absurda-do-cinema-2026", ed: "especiais", assunto: "Reportagem", titulo: "A reviravolta mais absurda do cinema em 2026?", resumo: "Bad Day transformou uma comédia de escritório num filme de ação.", img: "bad", min: 11 * D, autores: ["juliana-prado"], formato: "reportagem" },
  { slug: "falsos-vingadores-america-do-sul", ed: "especiais", assunto: "Reportagem", titulo: "Os falsos Vingadores que enganaram a América do Sul", resumo: "A turnê de sósias que lotou ginásios em três países.", img: "scar", min: 12 * D, autores: ["rafael-lima"], formato: "reportagem" },
  { slug: "imagens-que-fizeram-de-lanterns-um-icone", ed: "especiais", assunto: "Lista", titulo: "As imagens que fizeram de Lanterns um ícone", resumo: "Dez quadros da primeira temporada escolhidos pela redação.", img: "lant", min: 8 * D + 3 * H, autores: ["rafael-lima"], formato: "lista" },
  { slug: "o-falso-mito-de-jack-sparrow", ed: "especiais", assunto: "Reportagem", titulo: "O falso mito de Jack Sparrow", resumo: "O que é lenda e o que é bastidor na história do personagem.", img: "depp", min: 9 * D + 6 * H, autores: ["juliana-prado"], formato: "reportagem" },
  { slug: "series-que-moldaram-o-humor-absurdo", ed: "especiais", assunto: "Lista", titulo: "As séries que moldaram o humor absurdo dos anos 2000", resumo: "De Mighty Boosh a Flight of the Conchords.", img: "boosh", min: 5 * D + 2 * H, autores: ["bruno-nunes"], formato: "lista" },
  { slug: "a-mitologia-esperta-de-mighty-boosh", ed: "especiais", assunto: "Crítica", titulo: "A mitologia esperta de Mighty Boosh", resumo: "Por que a série britânica envelheceu melhor do que parecia.", img: "boosh", min: 13 * D, autores: ["bruno-nunes"], formato: "critica" },
  { slug: "reviravolta-mais-absurda-da-tv", ed: "especiais", assunto: "Reportagem", titulo: "A reviravolta mais absurda da TV este ano", resumo: "O episódio de Taboo que mudou o rumo da segunda temporada.", img: "taboo", min: 14 * D, autores: ["juliana-prado"], formato: "reportagem" },

  // ---------- Ofertas (matérias de afiliados) ----------
  { slug: "controle-xbox-edicao-especial-queda-de-preco", ed: "games", assunto: "Descontos", titulo: "Controle Xbox edição especial tem queda de preço na Amazon", resumo: "O modelo é compatível com Xbox Series X|S, Xbox One e PC.", img: "bad", min: 3 * D + 3 * H, autores: ["rebeca-pinho"], formato: "oferta" },
  { slug: "monitores-gamer-em-promocao", ed: "games", assunto: "Descontos", titulo: "Monitores gamer em promoção: o que vale a pena nesta semana", resumo: "Modelos de 144 Hz e 165 Hz para quem joga no PC.", img: "re", min: 1 * D + 4 * H, autores: ["rebeca-pinho"], formato: "oferta" },
  { slug: "smartwatch-oferta-especial-mercado-livre", ed: "games", assunto: "Descontos", titulo: "Smartwatch chega com oferta especial no Mercado Livre", resumo: "O relógio tem monitoramento de sono e bateria para uma semana.", img: "kid", min: 2 * D + 1 * H, autores: ["rebeca-pinho"], formato: "oferta" },
  { slug: "headsets-xbox-pc-desconto-setembro", ed: "games", assunto: "Descontos", titulo: "Headsets para Xbox e PC ganham desconto em campanha de setembro", resumo: "Modelos com fio e sem fio entram na campanha.", img: "lant", min: 4 * D + 2 * H, autores: ["rebeca-pinho"], formato: "oferta" },
];
