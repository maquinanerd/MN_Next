import type { Metadata } from "next";
import { EditoriaView } from "@/components/sections/EditoriaView";
import { getEditoria } from "@/lib/content";
import { EDITORIA_SLUGS } from "@/lib/content/editorias";
import { editoriaMetadata, loadEditoria } from "@/lib/content/editoria-route";

type Props = { params: Promise<{ editoria: string; n: string }> };

export async function generateStaticParams() {
  const all = await Promise.all(
    EDITORIA_SLUGS.map(async (editoria) => {
      const data = await getEditoria(editoria, 1);
      const total = data?.feed.totalPaginas ?? 1;
      return Array.from({ length: Math.max(0, total - 1) }, (_, i) => ({ editoria, n: String(i + 2) }));
    }),
  );
  const params = all.flat();
  // Cache Components exige ao menos um parâmetro na build.
  return params.length ? params : [{ editoria: EDITORIA_SLUGS[0], n: "2" }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { editoria, n } = await params;
  return editoriaMetadata(editoria, n);
}

export default async function EditoriaPaginada({ params }: Props) {
  const { editoria, n } = await params;
  const data = await loadEditoria(editoria, n);
  return <EditoriaView data={data} />;
}
