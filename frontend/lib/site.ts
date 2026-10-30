/** Dados fixos do portal. URLs de redes e contato são as do site atual. */
export const SITE = {
  name: "Máquina Nerd",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.maquinanerd.com.br").replace(/\/$/, ""),
  description:
    "Notícias, críticas e reportagens de cinema, séries e TV, games, quadrinhos e animes. Da mesma rede do Cinerie.",
  locale: "pt_BR",
  contactEmail: "contato@maquinanerd.com.br",
  social: {
    facebook: "https://www.facebook.com/maquinanerd",
    instagram: "https://www.instagram.com/maquinanerd",
    x: "https://x.com/maquinanerd",
  },
  cinerie: "https://cinerie.com/",
} as const;

export function absoluteUrl(path: string): string {
  return new URL(path, SITE.url).toString();
}
