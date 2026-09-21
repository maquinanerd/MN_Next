import Link from 'next/link';

import { Header } from './Chrome';

/**
 * An address a story no longer answers at, sent on to the one it does.
 *
 * Not `permanentRedirect()`: the article pages are cached, and a redirect thrown from a
 * cached page comes back from Next's cache as a `308` with no `Location` — a redirect to
 * nowhere for a crawler. An instant `refresh`, which Google reads as a permanent redirect,
 * survives the cache; the page's canonical, which is the article's own address, already
 * names the destination; and a reader without either still has the link.
 *
 * `to` is an internal path that went through `safeInternalPath`.
 */
export function Moved({ to }: { to: string }) {
  return (
    <>
      <meta httpEquiv="refresh" content={`0;url=${to}`} />
      <Header />
      <main id="conteudo" className="wrap py-48 tab:py-80">
        <h1 className="m-0 text-25 leading-[1.12] font-extrabold tracking-[-0.035em] tab:text-34">
          Esta matéria mudou de endereço
        </h1>
        <p className="mt-16 mb-0 max-w-[60ch] text-15 leading-[1.5] text-ink-3">
          <Link href={to} className="font-bold underline">
            Continue lendo no endereço novo
          </Link>
          .
        </p>
      </main>
    </>
  );
}
