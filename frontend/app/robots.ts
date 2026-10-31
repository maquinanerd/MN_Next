import type { MetadataRoute } from "next";
import { isDemo } from "@/lib/mode";
import { absoluteUrl } from "@/lib/site";

/** Em demonstração nada é rastreado; com CMS e ad server ligados, só as rotas internas ficam de fora. */
export default function robots(): MetadataRoute.Robots {
  if (isDemo()) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/dev/", "/busca"] }],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
