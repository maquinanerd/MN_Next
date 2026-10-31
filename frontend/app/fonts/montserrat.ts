import localFont from "next/font/local";

import "./montserrat-fallback.css";

/**
 * Montserrat, a família do logo (kit docs/01), servida dos arquivos desta pasta: nem o build
 * nem o navegador do leitor pedem a fonte ao Google Fonts. O portal da raiz fez o mesmo
 * (app/fonts, DECISIONS §7.28): o download do `next/font/google` no build falhava de vez em
 * quando e derrubava o build inteiro.
 *
 * Os `.woff2` são os que o Google servia (v31, byte a byte): um arquivo variável por escrita,
 * cada um limitado aos seus caracteres por um `unicode-range`. O `next/font/local` aceita um
 * `unicode-range` por chamada, então cada escrita é uma chamada, com a sua variável CSS.
 *
 * Diferença deliberada da raiz: aqui as faces não são renomeadas para `Montserrat` por
 * `declarations`. Com Turbopack (Next 16) a classe e a variável continuam apontando para o
 * nome que o `next/font` gera (o da constante), e a página caía inteira na fonte de fallback.
 * Cada escrita fica com a família gerada, e o `globals.css` empilha as cinco em `--font-sans`
 * com a latin primeiro: o navegador escolhe a fonte caractere a caractere, na ordem da pilha,
 * e só baixa o arquivo de uma escrita quando a página usa um caractere dela. Só a latin é
 * pré-carregada, como antes.
 *
 * O peso é uma faixa (300 a 800) porque os arquivos são variáveis.
 *
 * `Montserrat Fallback` é a Arial ajustada que aparece até os arquivos chegarem. Fica em
 * `montserrat-fallback.css`, com as medidas que o `next/font/google` usava, e não no
 * `adjustFontFallback`: ele mede a instância padrão do arquivo variável, que é a Thin, e daria
 * uma Arial mais estreita que a Regular.
 *
 * Licença: SIL Open Font License 1.1 (`OFL.txt`).
 */

const latin = localFont({
  src: "./montserrat-latin.woff2",
  weight: "300 800",
  style: "normal",
  display: "swap",
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
    },
  ],
  adjustFontFallback: false,
  variable: "--font-mn-latin",
});

const latinExt = localFont({
  src: "./montserrat-latin-ext.woff2",
  weight: "300 800",
  style: "normal",
  display: "swap",
  preload: false,
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF",
    },
  ],
  adjustFontFallback: false,
  variable: "--font-mn-latin-ext",
});

const vietnamese = localFont({
  src: "./montserrat-vietnamese.woff2",
  weight: "300 800",
  style: "normal",
  display: "swap",
  preload: false,
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB",
    },
  ],
  adjustFontFallback: false,
  variable: "--font-mn-vietnamese",
});

const cyrillic = localFont({
  src: "./montserrat-cyrillic.woff2",
  weight: "300 800",
  style: "normal",
  display: "swap",
  preload: false,
  declarations: [{ prop: "unicode-range", value: "U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116" }],
  adjustFontFallback: false,
  variable: "--font-mn-cyrillic",
});

const cyrillicExt = localFont({
  src: "./montserrat-cyrillic-ext.woff2",
  weight: "300 800",
  style: "normal",
  display: "swap",
  preload: false,
  declarations: [
    {
      prop: "unicode-range",
      value: "U+0460-052F, U+1C80-1C8A, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F",
    },
  ],
  adjustFontFallback: false,
  variable: "--font-mn-cyrillic-ext",
});

/** As classes do `<html>`: cada uma define a variável de uma escrita e traz o seu `@font-face`. */
export const montserratVariable = [latin, latinExt, vietnamese, cyrillic, cyrillicExt]
  .map((font) => font.variable)
  .join(" ");
