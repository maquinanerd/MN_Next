import type { Imagem } from "../types";

// Fotos dos protótipos que ainda existem no acervo do site atual (as outras dez respondem
// 404). Servem só à demonstração; as chaves sem foto própria reaproveitam uma destas, e o
// `alt` descreve sempre a foto que de fato aparece.
const M = "https://www.maquinanerd.com.br/media/";
const DEPP = { url: `${M}9a65b433-d139-47f1-88f0-0835a0d14c65`, alt: "Johnny Depp como Jack Sparrow" };
const SHOOTER = { url: `${M}1745c2ef-fa67-453f-a7df-a6385b3bbe7e`, alt: "Mark Wahlberg como Bob Lee Swagger em Atirador" };
const MBC = { url: `${M}827f403c-68bd-45b0-953e-325182a79817`, alt: "Planta de My Brilliant Career com o logo da Netflix" };
const ADULT = { url: `${M}969378fb-621d-4f84-9869-6b7bfbd01c0c`, alt: "Logo do Adult Swim" };
const BOOSH = { url: `${M}f4302636-3505-4b1a-a195-6c5b241b4769`, alt: "Noel Fielding e Julian Barratt em The Mighty Boosh" };

export const IMG = {
  re: SHOOTER,
  lego: ADULT,
  bbt: BOOSH,
  kid: MBC,
  scar: { ...DEPP, credito: "Crédito da imagem: divulgação" },
  depp: DEPP,
  ahs: SHOOTER,
  taboo: BOOSH,
  shooter: SHOOTER,
  spock: ADULT,
  bad: MBC,
  mbc: MBC,
  adult: ADULT,
  boosh: BOOSH,
  lant: DEPP,
  hq: { url: "/demo/quadrinhos.webp", alt: "Ilustração em estilo de quadrinhos", largura: 1100, altura: 1162 },
  produtoDemo: {
    url: "/demo/produto-16x9.svg",
    alt: "Imagem ilustrativa do produto (demonstração)",
    largura: 800,
    altura: 450,
  },
} satisfies Record<string, Imagem>;

export type ImgKey = keyof typeof IMG;
