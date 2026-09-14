import { Header } from './Chrome';

/**
 * Institutional pages have no prototype (kit docs/03). They are composed from what the
 * system already has and nothing new: the editoria page's header (34px/800 title over a
 * rule), and the article's reading column — 17px/1.6 text, 22px/800 section headings.
 */
export function InstitutionalPage({
  titulo,
  intro,
  children,
}: {
  titulo: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main id="conteudo" className="wrap pt-20 pb-64 tab:pt-32">
        <div className="mb-28 border-b border-line pb-20">
          <h1 className="m-0 text-25 leading-none font-extrabold tracking-[-0.03em] tab:text-34">{titulo}</h1>
          {intro ? <p className="mt-16 mb-0 max-w-[68ch] text-15 leading-[1.5] text-ink-3">{intro}</p> : null}
        </div>
        <div className="mn-prose max-w-760">{children}</div>
      </main>
    </>
  );
}
