import type { Metadata } from "next";
import { EditoriaView } from "@/components/sections/EditoriaView";
import { getEditoria } from "@/lib/content";
import { assuntoBySlug, getEditoria as editoriaDef } from "@/lib/content/editorias";
import { assuntoParams, editoriaMetadata, loadEditoria } from "@/lib/content/editoria-route";

type Props = { params: Promise<{ editoria: string; assunto: string; n: string }> };

export async function generateStaticParams() {
  const all = await Promise.all(
    assuntoParams().map(async ({ editoria, assunto }) => {
      const ed = editoriaDef(editoria)!;
      const data = await getEditoria(ed.slug, 1, assuntoBySlug(ed, assunto));
      const total = data?.feed.totalPaginas ?? 1;
      return Array.from({ length: Math.max(0, total - 1) }, (_, i) => ({
        editoria,
        assunto,
        n: String(i + 2),
      }));
    }),
  );
  const params = all.flat();
  return params.length ? params : [{ ...assuntoParams()[0]!, n: "2" }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { editoria, assunto, n } = await params;
  return editoriaMetadata(editoria, n, assunto);
}

export default async function AssuntoPaginado({ params }: Props) {
  const { editoria, assunto, n } = await params;
  const data = await loadEditoria(editoria, n, assunto);
  return <EditoriaView data={data} assuntoSlug={assunto} />;
}
