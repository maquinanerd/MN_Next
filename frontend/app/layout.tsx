import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import { DemoBanner } from "@/components/layout/DemoBanner";
import { isDemo } from "@/lib/mode";
import { SITE } from "@/lib/site";
import "./globals.css";

// Fonte variável: um arquivo cobre de 300 (parte leve dos títulos de seção) a 800.
const montserrat = Montserrat({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-montserrat",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${SITE.name} — cinema, séries, games, quadrinhos e animes`, template: `%s | ${SITE.name}` },
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
    <html lang="pt-BR" className={montserrat.variable}>
      <body>
        <DemoBanner />
        {children}
      </body>
    </html>
  );
}
