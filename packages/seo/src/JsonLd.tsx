import { escapeJsonLd } from '@mn/content';

/**
 * Emits exactly one JSON-LD block per page.
 *
 * The payload is built on the server from typed domain objects - never from a string
 * template - and `<`, `>` and `&` are escaped, so a headline containing `</script>`
 * cannot close its own tag and become markup. That escape is the reason this is one of
 * only two files allowed to use `dangerouslySetInnerHTML`.
 */
export function JsonLd({ graph }: { graph: Record<string, unknown> }) {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: escapeJsonLd(JSON.stringify(graph)) }} />
  );
}
