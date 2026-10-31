import { jsonLdScript } from "@/lib/seo/jsonld";

export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(data)} />;
}
