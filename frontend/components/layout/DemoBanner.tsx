import { adsSource, contentSource } from "@/lib/mode";

/**
 * Marca a página como demonstração na apresentação, não no conteúdo (docs/04-dados.md).
 * Some sozinha quando CMS e ad server estiverem ligados.
 */
export function DemoBanner() {
  const content = contentSource() === "fixtures";
  const ads = adsSource() === "fixtures";
  if (!content && !ads) return null;
  const what =
    content && ads ? "conteúdo e ofertas fictícios" : content ? "conteúdo fictício" : "ofertas fictícias";
  const until = content && ads ? "o CMS e o OpaPreço" : content ? "o CMS" : "o OpaPreço";
  return (
    <div role="note" className="bg-[#111] text-white">
      <p className="mn-wrap m-0 py-1.5 text-[11px] leading-4">
        <strong className="font-bold">Demonstração:</strong> {what} até a integração com {until}.
      </p>
    </div>
  );
}
