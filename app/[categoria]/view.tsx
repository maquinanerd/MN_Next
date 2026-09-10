import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isContentError } from '@mn/content';
import { EmptyState } from '@mn/ui';
import { JsonLd, absolute, breadcrumbNode, buildGraph, collectionNode, listingMetadata } from '@mn/seo';

import { Header } from '../../components/Chrome';
import { FeedSection } from '../../components/Feed';
import { Opening } from '../../components/Opening';
import { agora, editoriaView, type EditoriaView } from '../../lib/content';
import { seoContext } from '../../lib/seo-context';

/**
 * Shared implementation of `/{editoria}` and `/{editoria}/page/{n}`
 * (Máquina Nerd Categorias.dc.html). Both are real, indexable URLs with their own
 * canonical — page 2 pointing at page 1 is how an archive disappears from search.
 */

export async function loadEditoria(slug: string, page: number): Promise<EditoriaView> {
  try {
    const view = await editoriaView(slug, page);
    // A page past the end is a 404, not an empty archive page competing in search.
    if (page > 1 && view.lista.length === 0) notFound();
    return view;
  } catch (err) {
    if (isContentError(err) && err.kind === 'not_found') notFound();
    throw err;
  }
}

export async function editoriaMetadata(slug: string, page: number): Promise<Metadata> {
  try {
    const view = await editoriaView(slug, page);
    return listingMetadata(seoContext(), {
      title: `${view.editoria.nome} — notícias`,
      description: view.category.description || `Tudo sobre ${view.editoria.nome} no Máquina Nerd.`,
      path: `/${view.category.slug}`,
      page,
      image: view.itens[0]?.cover ?? null,
    });
  } catch {
    return { title: 'Editoria não encontrada', robots: { index: false, follow: true } };
  }
}

export function EditoriaPage({ view, page }: { view: EditoriaView; page: number }) {
  const ctx = seoContext();
  const now = agora();
  const { editoria, category } = view;
  const url = absolute(ctx, page > 1 ? `/${category.slug}/page/${page}` : `/${category.slug}`);
  const graph = buildGraph(ctx, [
    collectionNode(ctx, { name: editoria.nome, description: category.description, url, items: view.itens }),
    breadcrumbNode(ctx, [{ label: 'Home', href: '/' }, { label: editoria.nome }]),
  ]);
  const on = editoria.textoSobreCor === 'light' ? 'var(--color-white)' : 'var(--color-ink)';

  return (
    <>
      <JsonLd graph={graph} />
      <Header ativo={editoria.nome} />
      <main id="conteudo" className="wrap pt-20 tab:pt-32">
        <div className="mb-28 flex flex-wrap items-end justify-between gap-24 border-b border-line pb-20">
          {/* The title takes the editoria's text variant: the full colour is under 3:1 on
              white for Games, Animes, Vídeos and Quadrinhos (kit docs/01, "Rótulo em texto
              usa sempre a variante de texto"). */}
          <h1
            className="m-0 text-34 leading-none font-extrabold tracking-[-0.03em]"
            style={{ color: editoria.corTexto }}
          >
            {editoria.nome}
          </h1>
          {view.filtros.length > 1 ? (
            <nav aria-label={`Assuntos de ${editoria.nome}`} className="flex flex-wrap gap-6">
              {view.filtros.map((f) => (
                <Link
                  key={f.href}
                  href={f.href}
                  aria-current={f.ativo ? 'page' : undefined}
                  className="border px-14 py-7 text-12 font-semibold"
                  style={
                    f.ativo
                      ? { background: editoria.corFundoTexto, borderColor: editoria.corFundoTexto, color: on }
                      : { borderColor: 'var(--color-control)', color: 'var(--color-ink)' }
                  }
                >
                  {f.rotulo}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>

        {view.abertura ? <Opening {...view.abertura} now={now} modo="editoria" /> : null}

        <FeedSection
          titulo={{ forte: 'Todas', fraco: `as notícias de ${editoria.nome}` }}
          tituloMb="mb-8"
          itens={view.lista}
          paginacao={view.paginacao}
          hrefPara={(n) => (n === 1 ? `/${category.slug}` : `/${category.slug}/page/${n}`)}
          cor={editoria.corFundoTexto}
          textoSobreCor={editoria.textoSobreCor}
          now={now}
          vazio={
            view.abertura?.manchete ? null : (
              <EmptyState
                titulo={`Ainda não há matérias em ${editoria.nome}`}
                descricao="Assim que a redação publicar aqui, esta página é atualizada automaticamente."
                acao={{ rotulo: 'Ver a home', href: '/' }}
              />
            )
          }
        />
      </main>
    </>
  );
}
