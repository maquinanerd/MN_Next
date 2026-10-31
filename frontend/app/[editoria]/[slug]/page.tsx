import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MateriaOverlay, MateriaPadrao } from "@/components/article/MateriaViews";
import { getMateria, listMaterias } from "@/lib/content";
import { materiaMetadata } from "@/lib/content/materia-meta";

type Props = { params: Promise<{ editoria: string; slug: string }> };

export async function generateStaticParams() {
  const todas = await listMaterias();
  return todas.filter((m) => m.layout !== "oferta").map((m) => ({ editoria: m.editoria, slug: m.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { editoria, slug } = await params;
  const m = await getMateria(editoria, slug);
  return m ? materiaMetadata(m, `/${editoria}/${slug}`) : {};
}

/** Matéria padrão ou overlay: o layout é escolha editorial por matéria. */
export default async function MateriaPage({ params }: Props) {
  const { editoria, slug } = await params;
  const m = await getMateria(editoria, slug);
  if (!m) notFound();
  const path = `/${editoria}/${slug}`;
  return m.layout === "overlay" ? <MateriaOverlay m={m} path={path} /> : <MateriaPadrao m={m} path={path} />;
}
