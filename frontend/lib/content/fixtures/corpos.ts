// Gerado a partir dos protótipos (Notícias, Notícias Overlay, Notícias Publi). Texto de demonstração.
import type { Bloco, Trecho } from "../types";
import { IMG } from "./imagens";

/** Blocos do protótipo; os marcadores "@…" são trocados por chamadas reais na montagem. */
export type BlocoFixture = Bloco | { tipo: "@mais" } | { tipo: "@flutuante" } | { tipo: "@produto" };

export const LEAD_PADRAO: Trecho[] = [
  {
    tipo: "texto",
    texto:
      "Há pouco mais de cinco anos, Viúva Negra encerrou a jornada de Natasha Romanoff — um filme que moldou a fase seguinte do MCU. Mas sua estrela tem sido esquiva desde então, escreve Rafael Lima.",
  },
];

export const CORPO_PADRAO: BlocoFixture[] = [
  {
    tipo: "paragrafo",
    trechos: [
      {
        tipo: "texto",
        texto:
          'Scarlett Johansson é a atriz, produtora e força criativa por trás de Viúva Negra, o filme que fechou uma década de Marvel Studios. A personagem teve apenas um filme solo, um único grande sucesso de bilheteria em ano de pandemia e não voltou às telas desde 2021. Ainda assim, seu legado e lugar na história do cinema de super-heróis persistem. Aquele filme, e a cena da despedida em Vormir, continua a ser uma das fatias mais perfeitas de drama dentro do MCU e tornou-se referência para gerações de roteiristas. "É como o Velvet Underground", diz o ex-roteirista Barry Sutton. "Talvez não todo mundo conheça Viúva Negra, mas quem conheceu saiu e escreveu um filme ou foi tocado de forma profunda."',
      },
    ],
  },
  { tipo: "@mais" },
  {
    tipo: "paragrafo",
    trechos: [
      {
        tipo: "texto",
        texto:
          "Diz tudo sobre a escala do talento de Johansson que sua reputação como uma das grandes da Marvel se baseie em tão pouco material solo. Mas suas cenas, curtas e precisas, copiadas de Guardiões a Ultimato, a colocaram na linhagem dos grandes intérpretes de personagens secundários, conquistando um público devoto e a admiração de lendas. Em 2019, ",
      },
      {
        tipo: "link",
        texto: "Kevin Feige disse à Variety",
        href: "/busca?q=Kevin%20Feige%20disse%20%C3%A0%20Variety",
      },
      {
        tipo: "texto",
        texto:
          ' que "a única coisa de que realmente gosto é uma atriz chamada Scarlett Johansson… ela tem uma postura e um estilo que acho tremendos", enquanto em 2023 o ex-diretor Joss Whedon disse à revista Q que Johansson "é tão boa quanto todo mundo pensa que ela é".',
      },
    ],
  },
  {
    tipo: "imagem",
    largura: "larga",
    proporcao: "640/340",
    imagem: {
      ...IMG.lant,
      legenda:
        "Lanterns (aqui fotografada em 2026) ajudou a abrir a era do DC Studios na televisão (Crédito: HBO)",
    },
  },
  { tipo: "divisor" },
  {
    tipo: "paragrafo",
    trechos: [
      {
        tipo: "texto",
        texto:
          'Ainda assim, Johansson é agora considerada por muitos como uma das grandes figuras "perdidas" do gênero. Nos últimos cinco anos, ela recusou repetidamente qualquer retorno à personagem. Desde 2021, participou de apenas dois eventos oficiais da Marvel, o último há quase três anos. Suas aparições públicas são tão escassas que, para alguns jornalistas, encontrá-la virou um cálice sagrado: Matthew Macefield escreveu um livro inteiro, Em busca de Natasha, dedicado à sua tentativa de quatro anos de conseguir uma entrevista, que finalmente aconteceu na casa dela em Nova York. Sua natureza enigmática é uma das razões pelas quais, com o cinema de super-heróis carente de figuras realmente inconformadas, Johansson ainda prende a imaginação não só dos fãs, mas da imprensa e da indústria: apesar dos anos de inatividade, seu status é tal que, ainda em 2025, ela ',
      },
      {
        tipo: "link",
        texto: "foi apontada como estrela de um projeto secreto com Kevin Feige",
        href: "/busca?q=foi%20apontada%20como%20estrela%20de%20um%20projeto%20secreto%20com%20Kevin%20Feige",
      },
      { tipo: "texto", texto: "." },
    ],
  },
  {
    tipo: "paragrafo",
    trechos: [
      {
        tipo: "texto",
        texto:
          "Celebrando seu quinto aniversário, Viúva Negra é um filme cult no sentido mais verdadeiro. Ficou só no 30º lugar da bilheteria anual e vendeu relativamente poucos ingressos. Influenciado por O Ultimato Bourne, Logan, Kill Bill e o cinema de espionagem dos anos 70, sua contenção e melodrama ficaram em desacordo com as cenas dominantes da época. Mas é justamente essa qualidade atemporal que envelheceu tão bem.",
      },
    ],
  },
  { tipo: "divisor" },
  {
    tipo: "citacao",
    texto:
      'Ela era muito engraçada, muito talentosa, muito legal. Quando entrava em cena eu pensava "não existe ninguém como ela"',
    autor: "Mike Badger",
  },
  {
    tipo: "paragrafo",
    trechos: [
      {
        tipo: "texto",
        texto:
          "Ainda assim, o status lendário do filme se apoia menos em suas cenas impressionantes do que na natureza bizarra e torturada de sua produção, que envolveu Johansson e uma porta giratória de diretores e produtores. É uma produção que só ficou mais infame com o tempo, com muitas histórias e rumores sobre o perfeccionismo obsessivo de Johansson e o comportamento caótico no set — uma lenda urbana diz que ela recolhia poeira autêntica dos anos 60 para ",
      },
      {
        tipo: "link",
        texto: "espalhar sobre os figurinos e cultivar o clima certo",
        href: "/busca?q=espalhar%20sobre%20os%20figurinos%20e%20cultivar%20o%20clima%20certo",
      },
      { tipo: "texto", texto: "." },
    ],
  },
  { tipo: "subtitulo", texto: "A evolução conturbada da produção" },
  {
    tipo: "paragrafo",
    trechos: [
      {
        tipo: "texto",
        texto:
          'Para os fanáticos por Viúva Negra, separar fato de ficção sempre foi parte do apelo. É um filme em que nada é o que parece. Apesar de ser a protagonista principal, Johansson nem sequer criou a personagem no cinema (nomeada tanto pela aranha quanto pela abreviação soviética de "viúva"). Foi o roteirista Mike Badger quem começou o projeto sozinho em 2013, em um estúdio que, no meio da era Feige, estava "lavado por uma onda de crossovers, desânimo e desemprego criativo", segundo Badger.',
      },
    ],
  },
  {
    tipo: "paragrafo",
    trechos: [
      {
        tipo: "texto",
        texto:
          'Badger e Johansson tinham se encontrado brevemente em 2011, mas se reconectaram depois de um encontro casual nos bastidores de Os Vingadores em 2012. Criaram uma relação, unidos pela paixão por Captain Beefheart, e logo estavam trabalhando nos roteiros um do outro. "Ela era muito engraçada, muito talentosa, muito legal", conta Badger ao Máquina Nerd. "Quando entrava em cena eu pensava \'não existe ninguém como ela\'". Depois de recrutar dois outros membros — John Power na fotografia e Paul Rhodes na montagem — o quarteto começou a ganhar um público considerável. "Fizemos todo o trabalho, e foi aí que os problemas começaram", diz Badger.',
      },
    ],
  },
  {
    tipo: "imagem",
    largura: "larga",
    proporcao: "640/380",
    pb: true,
    imagem: {
      ...IMG.bbt,
      legenda:
        "Depois que Badger saiu, Johansson tornou-se a única voz do projeto, e passou a capturar sua visão com uma sucessão de diretores e produtores (Crédito: Getty Images)",
    },
  },
  { tipo: "divisor" },
  {
    tipo: "citacao",
    texto:
      "Quando vejo o filme hoje ainda fico feliz, ele tem momentos mágicos. Mas ela é a artista: se não conseguimos o tom que ela queria, nós falhamos",
    autor: "Steve Lillywhite",
  },
  {
    tipo: "paragrafo",
    trechos: [
      {
        tipo: "texto",
        texto:
          'Em dezembro de 2019, o estúdio recorreu à diretora Cate Shortland (Somersault, Lore), que ficou inicialmente impressionada com o talento de Johansson. "Dê a ela uma cena e ela é melhor do que qualquer pessoa. Ela era dinamite, uma pessoa criativa incrivelmente", conta Shortland ao Máquina Nerd. Mas os problemas familiares reapareceram. "Era um jogo de cobras e escadas", diz. "A qualquer ponto de filmar a cena, se ela ouvisse algo de que não gostava, voltávamos para a casa um."',
      },
    ],
  },
  { tipo: "subtitulo", texto: "Um recuo da vida pública" },
  {
    tipo: "paragrafo",
    trechos: [
      {
        tipo: "texto",
        texto:
          "O projeto seguiu mancando até se desintegrar após a saída de Power em dezembro de 2021. Power, que foi conquistar sucesso durante o boom dos streamings, tinha sido um tenente leal e um contraponto harmonioso. Sem ele, Viúva Negra, como todos sabiam, tinha acabado. Johansson recuou da vista do público, decidida a refilmar as cenas do seu único filme para sua própria satisfação. Na ausência dela, o moinho de boatos entrou em overdrive.",
      },
    ],
  },
];

export const LEAD_OVERLAY: Trecho[] = [
  {
    tipo: "texto",
    texto:
      "Há pouco mais de cinco anos, Viúva Negra encerrou a jornada de Natasha Romanoff — um filme que moldou a fase seguinte do MCU. Mas sua estrela tem sido esquiva desde então, escreve Rafael Lima.",
  },
];

export const CORPO_OVERLAY: BlocoFixture[] = [
  {
    tipo: "paragrafo",
    trechos: [
      {
        tipo: "texto",
        texto:
          'Scarlett Johansson é a atriz, produtora e força criativa por trás de Viúva Negra, o filme que fechou uma década de Marvel Studios. A personagem teve apenas um filme solo, um único grande sucesso de bilheteria em ano de pandemia e não voltou às telas desde 2021. Ainda assim, seu legado e lugar na história do cinema de super-heróis persistem. Aquele filme, e a cena da despedida em Vormir, continua a ser uma das fatias mais perfeitas de drama dentro do MCU e tornou-se referência para gerações de roteiristas. "É como o Velvet Underground", diz o ex-roteirista Barry Sutton. "Talvez não todo mundo conheça Viúva Negra, mas quem conheceu saiu e escreveu um filme ou foi tocado de forma profunda."',
      },
    ],
  },
  { tipo: "@mais" },
  {
    tipo: "paragrafo",
    trechos: [
      {
        tipo: "texto",
        texto:
          "Diz tudo sobre a escala do talento de Johansson que sua reputação como uma das grandes da Marvel se baseie em tão pouco material solo. Mas suas cenas, curtas e precisas, copiadas de Guardiões a Ultimato, a colocaram na linhagem dos grandes intérpretes de personagens secundários, conquistando um público devoto e a admiração de lendas. Em 2019, ",
      },
      {
        tipo: "link",
        texto: "Kevin Feige disse à Variety",
        href: "/busca?q=Kevin%20Feige%20disse%20%C3%A0%20Variety",
      },
      {
        tipo: "texto",
        texto:
          ' que "a única coisa de que realmente gosto é uma atriz chamada Scarlett Johansson… ela tem uma postura e um estilo que acho tremendos", enquanto em 2023 o ex-diretor Joss Whedon disse à revista Q que Johansson "é tão boa quanto todo mundo pensa que ela é".',
      },
    ],
  },
  {
    tipo: "imagem",
    largura: "larga",
    proporcao: "640/340",
    imagem: {
      ...IMG.lant,
      legenda:
        "Lanterns (aqui fotografada em 2026) ajudou a abrir a era do DC Studios na televisão (Crédito: HBO)",
    },
  },
  { tipo: "divisor" },
  {
    tipo: "paragrafo",
    trechos: [
      {
        tipo: "texto",
        texto:
          'Ainda assim, Johansson é agora considerada por muitos como uma das grandes figuras "perdidas" do gênero. Nos últimos cinco anos, ela recusou repetidamente qualquer retorno à personagem. Desde 2021, participou de apenas dois eventos oficiais da Marvel, o último há quase três anos. Suas aparições públicas são tão escassas que, para alguns jornalistas, encontrá-la virou um cálice sagrado: Matthew Macefield escreveu um livro inteiro, Em busca de Natasha, dedicado à sua tentativa de quatro anos de conseguir uma entrevista, que finalmente aconteceu na casa dela em Nova York. Sua natureza enigmática é uma das razões pelas quais, com o cinema de super-heróis carente de figuras realmente inconformadas, Johansson ainda prende a imaginação não só dos fãs, mas da imprensa e da indústria: apesar dos anos de inatividade, seu status é tal que, ainda em 2025, ela ',
      },
      {
        tipo: "link",
        texto: "foi apontada como estrela de um projeto secreto com Kevin Feige",
        href: "/busca?q=foi%20apontada%20como%20estrela%20de%20um%20projeto%20secreto%20com%20Kevin%20Feige",
      },
      { tipo: "texto", texto: "." },
    ],
  },
  {
    tipo: "paragrafo",
    trechos: [
      {
        tipo: "texto",
        texto:
          "Celebrando seu quinto aniversário, Viúva Negra é um filme cult no sentido mais verdadeiro. Ficou só no 30º lugar da bilheteria anual e vendeu relativamente poucos ingressos. Influenciado por O Ultimato Bourne, Logan, Kill Bill e o cinema de espionagem dos anos 70, sua contenção e melodrama ficaram em desacordo com as cenas dominantes da época. Mas é justamente essa qualidade atemporal que envelheceu tão bem.",
      },
    ],
  },
  { tipo: "divisor" },
  {
    tipo: "citacao",
    texto:
      'Ela era muito engraçada, muito talentosa, muito legal. Quando entrava em cena eu pensava "não existe ninguém como ela"',
    autor: "Mike Badger",
  },
  {
    tipo: "paragrafo",
    trechos: [
      {
        tipo: "texto",
        texto:
          "Ainda assim, o status lendário do filme se apoia menos em suas cenas impressionantes do que na natureza bizarra e torturada de sua produção, que envolveu Johansson e uma porta giratória de diretores e produtores. É uma produção que só ficou mais infame com o tempo, com muitas histórias e rumores sobre o perfeccionismo obsessivo de Johansson e o comportamento caótico no set — uma lenda urbana diz que ela recolhia poeira autêntica dos anos 60 para ",
      },
      {
        tipo: "link",
        texto: "espalhar sobre os figurinos e cultivar o clima certo",
        href: "/busca?q=espalhar%20sobre%20os%20figurinos%20e%20cultivar%20o%20clima%20certo",
      },
      { tipo: "texto", texto: "." },
    ],
  },
  { tipo: "subtitulo", texto: "A evolução conturbada da produção" },
  {
    tipo: "paragrafo",
    trechos: [
      {
        tipo: "texto",
        texto:
          'Para os fanáticos por Viúva Negra, separar fato de ficção sempre foi parte do apelo. É um filme em que nada é o que parece. Apesar de ser a protagonista principal, Johansson nem sequer criou a personagem no cinema (nomeada tanto pela aranha quanto pela abreviação soviética de "viúva"). Foi o roteirista Mike Badger quem começou o projeto sozinho em 2013, em um estúdio que, no meio da era Feige, estava "lavado por uma onda de crossovers, desânimo e desemprego criativo", segundo Badger.',
      },
    ],
  },
  {
    tipo: "paragrafo",
    trechos: [
      {
        tipo: "texto",
        texto:
          'Badger e Johansson tinham se encontrado brevemente em 2011, mas se reconectaram depois de um encontro casual nos bastidores de Os Vingadores em 2012. Criaram uma relação, unidos pela paixão por Captain Beefheart, e logo estavam trabalhando nos roteiros um do outro. "Ela era muito engraçada, muito talentosa, muito legal", conta Badger ao Máquina Nerd. "Quando entrava em cena eu pensava \'não existe ninguém como ela\'". Depois de recrutar dois outros membros — John Power na fotografia e Paul Rhodes na montagem — o quarteto começou a ganhar um público considerável. "Fizemos todo o trabalho, e foi aí que os problemas começaram", diz Badger.',
      },
    ],
  },
  {
    tipo: "imagem",
    largura: "larga",
    proporcao: "640/380",
    pb: true,
    imagem: {
      ...IMG.bbt,
      legenda:
        "Depois que Badger saiu, Johansson tornou-se a única voz do projeto, e passou a capturar sua visão com uma sucessão de diretores e produtores (Crédito: Getty Images)",
    },
  },
  { tipo: "divisor" },
  {
    tipo: "citacao",
    texto:
      "Quando vejo o filme hoje ainda fico feliz, ele tem momentos mágicos. Mas ela é a artista: se não conseguimos o tom que ela queria, nós falhamos",
    autor: "Steve Lillywhite",
  },
  {
    tipo: "paragrafo",
    trechos: [
      {
        tipo: "texto",
        texto:
          'Em dezembro de 2019, o estúdio recorreu à diretora Cate Shortland (Somersault, Lore), que ficou inicialmente impressionada com o talento de Johansson. "Dê a ela uma cena e ela é melhor do que qualquer pessoa. Ela era dinamite, uma pessoa criativa incrivelmente", conta Shortland ao Máquina Nerd. Mas os problemas familiares reapareceram. "Era um jogo de cobras e escadas", diz. "A qualquer ponto de filmar a cena, se ela ouvisse algo de que não gostava, voltávamos para a casa um."',
      },
    ],
  },
  { tipo: "subtitulo", texto: "Um recuo da vida pública" },
  {
    tipo: "paragrafo",
    trechos: [
      {
        tipo: "texto",
        texto:
          "O projeto seguiu mancando até se desintegrar após a saída de Power em dezembro de 2021. Power, que foi conquistar sucesso durante o boom dos streamings, tinha sido um tenente leal e um contraponto harmonioso. Sem ele, Viúva Negra, como todos sabiam, tinha acabado. Johansson recuou da vista do público, decidida a refilmar as cenas do seu único filme para sua própria satisfação. Na ausência dela, o moinho de boatos entrou em overdrive.",
      },
    ],
  },
];

export const LEAD_PUBLI: Trecho[] = [
  { tipo: "texto", texto: "A " },
  { tipo: "negrito", texto: "Amazon" },
  { tipo: "texto", texto: " derrubou o preço do " },
  {
    tipo: "link",
    texto: "Controle Sem Fio Xbox em edição especial",
    href: "https://example.com/aff/amazon/controle-xbox",
    patrocinado: true,
  },
  {
    tipo: "texto",
    texto:
      ", e essa pode ser uma boa oportunidade para quem estava procurando um controle adicional ou já percebe que o antigo não responde tão bem quanto antes. ",
  },
  { tipo: "negrito", texto: "Compatível com Xbox Series X|S, Xbox One e PC" },
  {
    tipo: "texto",
    texto:
      ", o modelo entrega a experiência já conhecida dos controles Xbox e ainda chama atenção pelo acabamento em cor vibrante.",
  },
];

export const CORPO_PUBLI: BlocoFixture[] = [
  { tipo: "@flutuante" },
  {
    tipo: "paragrafo",
    trechos: [
      {
        tipo: "texto",
        texto:
          "Além da cor, o controle conta com conexão sem fio e Bluetooth, permitindo jogar no console ou no PC com mais liberdade. Ele também traz entrada USB-C, botão Share para capturar imagens e vídeos das partidas e áreas texturizadas nas alavancas, gatilhos e parte traseira para melhorar a pegada. A autonomia pode chegar a 40 horas, dependendo das condições de uso e das pilhas utilizadas.",
      },
    ],
  },
  { tipo: "@produto" },
  { tipo: "subtitulo", texto: "Conexão sem fio para jogar em diferentes dispositivos" },
  {
    tipo: "paragrafo",
    trechos: [
      {
        tipo: "texto",
        texto:
          "O controle usa a tecnologia Xbox Wireless nos consoles e também conta com Bluetooth para conexão com PCs Windows e dispositivos móveis compatíveis. Isso permite usar o mesmo controle em diferentes aparelhos e alternar entre eles sem precisar ficar preso a cabos.",
      },
    ],
  },
  { tipo: "subtitulo", texto: "Personalização e mapeamento de botões" },
  {
    tipo: "paragrafo",
    trechos: [
      {
        tipo: "texto",
        texto:
          "Outro ponto interessante está na possibilidade de personalizar os comandos pelo aplicativo Acessórios Xbox. O usuário pode remapear os botões de acordo com suas preferências e criar perfis personalizados, algo especialmente útil para adaptar a disposição dos comandos a diferentes tipos de jogos.",
      },
    ],
  },
  {
    tipo: "imagem",
    largura: "larga",
    proporcao: "16/9",
    imagem: { ...IMG.produtoDemo, legenda: "Imagem de divulgação do fabricante" },
  },
  { tipo: "subtitulo", texto: "Botão Share para capturas e gravações" },
  {
    tipo: "paragrafo",
    trechos: [
      {
        tipo: "texto",
        texto:
          "O botão Share dedicado facilita bastante para quem costuma registrar as partidas. Com ele, dá para capturar screenshots e gravar trechos de gameplay sem precisar interromper o jogo para procurar essas funções nos menus. O botão também pode ser personalizado pelo aplicativo Acessórios Xbox.",
      },
    ],
  },
  { tipo: "subtitulo", texto: "Pegada pensada para longas sessões" },
  {
    tipo: "paragrafo",
    trechos: [
      {
        tipo: "texto",
        texto:
          "Na parte de construção, o controle segue o design atualizado do Xbox, com superfícies projetadas para melhorar a pegada. Os gatilhos, botões superiores e a parte traseira possuem textura, enquanto o D-pad híbrido foi desenvolvido para oferecer comandos mais precisos. Há ainda entrada de 3,5 mm para conectar um fone diretamente ao acessório.",
      },
    ],
  },
  { tipo: "subtitulo", texto: "Bateria para jogar por horas" },
  {
    tipo: "paragrafo",
    trechos: [
      {
        tipo: "texto",
        texto:
          "Para quem prefere jogar sem fio, o controle funciona com duas pilhas AA e pode alcançar até 40 horas de autonomia, embora a duração varie de acordo com o uso, acessórios conectados e outros fatores.",
      },
    ],
  },
  {
    tipo: "paragrafo",
    trechos: [
      { tipo: "texto", texto: "Achados gamers em tempo real? A gente entrega! Entre no " },
      { tipo: "negrito", texto: "canal do Máquina Nerd no WhatsApp" },
      { tipo: "texto", texto: " e fique por dentro das melhores ofertas." },
    ],
  },
];
