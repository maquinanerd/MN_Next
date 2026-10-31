import type { Metadata, Viewport } from "next";
import { DemoBanner } from "@/components/layout/DemoBanner";
import { isDemo } from "@/lib/mode";
import { SITE } from "@/lib/site";
// Fonte variável do repositório (app/fonts): cobre de 300 (parte leve dos títulos de seção) a 800.
import { montserratVariable } from "./fonts/montserrat";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — cinema, séries, games, quadrinhos e animes`,
    template: `%s | ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  openGraph: { siteName: SITE.name, locale: SITE.locale, type: "website" },
  twitter: { card: "summary_large_image", site: "@maquinanerd" },
  // Enquanto conteúdo ou ofertas forem de demonstração, nada é indexado.
  robots: isDemo() ? { index: false, follow: false } : { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={montserratVariable}>
      <body>
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold"
        >
          Ir para o conteúdo
        </a>
        <DemoBanner />
        {children}
      </body>
    </html>
  );
}
