import Image from "next/image";
import Link from "next/link";
import type { Chamada, Patrocinado, Produto } from "@/lib/content/types";
import { Foto } from "@/components/ui/Foto";

/**
 * Card de produto próprio da matéria de oferta (multi-loja), separado do OpaPreço:
 * imagem 1/1 de 200px (contain sobre #F7F7F7), rótulo de afiliado, nome, descrição,
 * preço, "preço de demonstração" quando for o caso e um botão por loja,
 * todos `rel="sponsored nofollow"`.
 */
export function ProductCard({ produto }: { produto: Produto }) {
  const principal = produto.ofertas[0];
  return (
    <div className="mt-7 grid grid-cols-[200px_minmax(0,1fr)] items-center gap-6 border border-mn-line p-5 mob:grid-cols-1">
      <a
        href={principal?.url}
        target="_blank"
        rel="sponsored nofollow noopener"
        tabIndex={-1}
        aria-hidden="true"
        className="relative block aspect-square overflow-hidden bg-[#F7F7F7]"
      >
        <Image
          src={produto.imagem.url}
          alt=""
          fill
          sizes="(max-width: 760px) 100vw, 200px"
          className="object-contain"
          unoptimized={produto.imagem.url.endsWith(".svg")}
        />
      </a>
      <div className="flex min-w-0 flex-col gap-2.5">
        {/* Disclosure em 11px (o protótipo usa 10px): nenhum aviso de afiliado abaixo de 11px. */}
        <span className="text-[11px] font-bold tracking-[.04em] text-mn-ink-3 uppercase">
          Oferta · link de afiliado
        </span>
        <p className="m-0 text-[17px] leading-[1.25] font-extrabold tracking-[-.02em] text-mn-ink">
          {produto.nome}
        </p>
        <p className="m-0 text-[13px] leading-normal text-[#555]">{produto.descricao}</p>
        {produto.precoAtual && (
          <div className="mt-1 flex flex-wrap items-baseline gap-2.5">
            <span className="text-[22px] font-extrabold tracking-[-.02em] text-mn-red-text">
              {produto.precoAtual}
            </span>
            {produto.precoAnterior && (
              <s className="text-xs text-mn-ink-3" aria-label={`Preço anterior ${produto.precoAnterior}`}>
                {produto.precoAnterior}
              </s>
            )}
            {produto.demonstracao && <span className="text-[10px] text-mn-muted">preço de demonstração</span>}
          </div>
        )}
        <div className="mt-1.5 flex flex-wrap gap-2">
          {produto.ofertas.map((o, i) => (
            <a
              key={o.loja}
              href={o.url}
              target="_blank"
              rel="sponsored nofollow noopener"
              aria-label={`Ver na ${o.loja}${o.preco ? ` por ${o.preco}` : ""} (link de afiliado)`}
              className={`inline-flex h-10 items-center gap-2 border px-5 text-[13px] font-bold ${
                i === 0
                  ? "border-mn-red bg-mn-red text-white hover:text-white"
                  : "border-mn-line-3 bg-white text-mn-ink"
              }`}
            >
              <span>{o.loja}</span>
              {/* Sem a opacidade de 85% do protótipo: branco translúcido sobre o vermelho dava 3,75:1. */}
              {o.preco && <span className="font-semibold">{o.preco}</span>}
              <span aria-hidden="true">↗</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Caixa "Relacionado" de 220px flutuando à direita do texto (largura total no mobile). */
export function FloatRelated({ item }: { item: Chamada }) {
  return (
    <aside
      aria-label="Relacionado"
      className="float-right mb-4 ml-7 box-border flex w-[220px] flex-col gap-2.5 border border-mn-line p-3.5 mob:float-none mob:m-0 mob:mb-5 mob:w-full"
    >
      <span className="text-[13px] font-extrabold tracking-[-.02em]">Relacionado</span>
      <Link
        href={item.href}
        tabIndex={-1}
        aria-hidden="true"
        className="relative block aspect-video overflow-hidden bg-mn-media"
      >
        <Foto imagem={item.imagem} sizes="(max-width: 760px) 100vw, 220px" />
      </Link>
      <Link href={item.href} className="text-xs leading-[1.35] font-bold">
        {item.titulo} <span aria-hidden="true">↗</span>
      </Link>
    </aside>
  );
}

/** "Leia também:" com link sublinhado. */
export function LeiaTambem({ item, className = "" }: { item: Chamada; className?: string }) {
  return (
    <div className={`flex flex-wrap items-baseline gap-2 text-[13px] ${className}`}>
      <strong className="font-extrabold">Leia também:</strong>
      <Link href={item.href} className="font-semibold underline underline-offset-3">
        {item.titulo} <span aria-hidden="true">↗</span>
      </Link>
    </div>
  );
}

/** Aviso de afiliados acima do rodapé da matéria de oferta. */
export function AffiliateNotice() {
  return (
    <div className="text-xs leading-[1.6] text-[#444]">
      <p className="m-0">
        *Comprando pelos links acima, o Máquina Nerd pode receber uma comissão, sem custo adicional para você.
        Ofertas podem estar disponíveis em uma ou mais lojas parceiras. Saiba mais na{" "}
        <Link href="/politica-de-afiliados" className="underline underline-offset-3">
          política de afiliados
        </Link>
        .
      </p>
      <p className="mt-2 mb-0">
        Os preços e as ofertas mencionados valem no momento da publicação e podem mudar sem aviso.
      </p>
    </div>
  );
}

/** Grade "Conteúdo patrocinado": quatro cards 16/9 de parceiros. */
export function SponsoredGrid({ itens }: { itens: Patrocinado[] }) {
  if (!itens.length) return null;
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs font-bold text-mn-ink-3">Conteúdo patrocinado</span>
        <span className="text-[11px] text-mn-muted">Publicidade</span>
      </div>
      <ul className="m-0 grid list-none grid-cols-2 gap-5 p-0">
        {itens.map((p) => (
          <li key={p.id} className="min-w-0">
            <a href={p.href} target="_blank" rel="sponsored noopener" className="flex min-w-0 flex-col gap-2">
              <span className="relative block aspect-video overflow-hidden bg-mn-media">
                <Foto imagem={p.imagem} sizes="(max-width: 760px) 50vw, 240px" />
              </span>
              <span className="text-sm leading-[1.3] font-bold tracking-[-.01em]">{p.titulo}</span>
              <span className="flex items-center justify-between gap-2 text-[11px] text-mn-muted">
                <span>{p.parceiro}</span>
                <span className="border border-mn-line-3 px-2.5 py-[3px] font-bold text-mn-ink">
                  Saiba mais
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
