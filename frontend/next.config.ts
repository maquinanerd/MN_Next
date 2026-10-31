import path from "node:path";
import type { NextConfig } from "next";

const root = path.resolve(__dirname);

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Sem Partial Prefetching a primeira visita a uma matéria ainda não gerada espera a
  // renderização completa (equivale ao `fallback: 'blocking'`): o leitor e o robô recebem a
  // página inteira e um slug inexistente responde 404 de verdade, não 200 com o esqueleto.
  partialPrefetching: false,
  poweredByHeader: false,
  // O repositório tem outro lockfile na raiz (o portal em produção); este projeto é independente.
  outputFileTracingRoot: root,
  turbopack: {
    root,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    qualities: [75],
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      // Fotos de demonstração dos protótipos: vêm do acervo público do site atual.
      { protocol: "https", hostname: "www.maquinanerd.com.br", pathname: "/media/**" },
    ],
  },
};

export default nextConfig;
