import type { Metadata } from "next";
import { EditoriaView } from "@/components/sections/EditoriaView";
import { assuntoParams, editoriaMetadata, loadEditoria } from "@/lib/content/editoria-route";

type Props = { params: Promise<{ editoria: string; assunto: string }> };

export const generateStaticParams = assuntoParams;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { editoria, assunto } = await params;
  return editoriaMetadata(editoria, undefined, assunto);
}

export default async function AssuntoPage({ params }: Props) {
  const { editoria, assunto } = await params;
  const data = await loadEditoria(editoria, undefined, assunto);
  return <EditoriaView data={data} assuntoSlug={assunto} />;
}
