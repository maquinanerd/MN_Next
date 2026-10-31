import type { Metadata } from "next";
import { EditoriaView } from "@/components/sections/EditoriaView";
import { editoriaMetadata, editoriaParams, loadEditoria } from "@/lib/content/editoria-route";

type Props = { params: Promise<{ editoria: string }> };

export const generateStaticParams = editoriaParams;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { editoria } = await params;
  return editoriaMetadata(editoria);
}

export default async function EditoriaPage({ params }: Props) {
  const { editoria } = await params;
  const data = await loadEditoria(editoria);
  return <EditoriaView data={data} />;
}
