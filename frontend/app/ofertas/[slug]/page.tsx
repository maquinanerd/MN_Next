import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MateriaOferta } from "@/components/article/MateriaViews";
import { getOferta, listMaterias } from "@/lib/content";
import { materiaMetadata } from "@/lib/content/materia-meta";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const todas = await listMaterias();
  const ofertas = todas.filter((m) => m.layout === "oferta").map((m) => ({ slug: m.slug }));
  return ofertas.length ? ofertas : [{ slug: "__nenhuma__" }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const m = await getOferta(slug);
  return m ? materiaMetadata(m, `/ofertas/${slug}`) : {};
}

/** Matéria de oferta/afiliados (protótipo Notícias Publi). */
export default async function OfertaPage({ params }: Props) {
  const { slug } = await params;
  const m = await getOferta(slug);
  if (!m) notFound();
  return <MateriaOferta m={m} path={`/ofertas/${slug}`} />;
}
