import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { articlePath, safeSlugParam } from '@mn/content';
import { ArticleBody, Lead } from '@mn/ui';

import { Header } from '../../../components/Chrome';
import { repo, toBlocos } from '../../../lib/content';
import { previewAllows } from '../../../lib/preview';

/**
 * Preview of an article that has no editoria yet, so it has no public address. Once it
 * has one, the reader is sent there, to see the real template in its real shell.
 *
 * Dynamic, never indexable, and a 404 outside a preview grant that names this slug.
 */
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Pré-visualização', robots: { index: false, follow: false, nocache: true } };
}

export default async function PreviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = safeSlugParam((await params).slug);
  if (!slug) notFound();
  if (!(await previewAllows(slug))) notFound();

  const article = await repo().getArticleBySlug(slug, { preview: true });
  if (!article) notFound();
  const path = articlePath(article);
  if (path) redirect(path);

  return (
    <>
      <div role="note" className="bg-mn-red-text text-white">
        <div className="wrap flex min-h-36 flex-wrap items-center gap-x-12 py-8 text-12">
          <strong className="font-bold">Pré-visualização.</strong>
          <span>Versão não publicada, ainda sem editoria.</span>
          <form method="post" action="/api/preview/disable">
            <button
              type="submit"
              className="cursor-pointer border-0 bg-transparent p-0 text-12 text-white underline underline-offset-3"
            >
              Sair da pré-visualização
            </button>
          </form>
        </div>
      </div>
      <Header />
      <main id="conteudo" className="wrap pt-20 pb-64 tab:pt-32">
        <article className="max-w-760">
          <h1 className="m-0 text-25 leading-[1.12] font-extrabold tracking-[-0.035em] tab:text-28">{article.title}</h1>
          <Lead>{article.subtitle ?? article.excerpt}</Lead>
          <ArticleBody blocos={toBlocos(article.body, article.title)} cor="var(--color-mn-red)" />
        </article>
      </main>
    </>
  );
}
