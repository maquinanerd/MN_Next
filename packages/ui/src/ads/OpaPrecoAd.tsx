import { cx } from '../lib/cx';
import {
  OPAPRECO_SITE_KEY,
  opaPrecoEnabled,
  opaPrecoEndpoint,
  type ContextoDoAnuncio,
  type OpaPrecoSlot,
} from './opapreco';

/**
 * One OpaPreço Ads slot: an `<op-slot>` the OpaPreço script fills.
 *
 * The script does the rest and the portal must not redo any of it: it reserves the
 * slot's height (from OpaPreço's stylesheet, so the space is there in the server HTML and
 * nothing shifts), asks for the ad, draws it with its "Link de afiliado" disclosure,
 * collapses the slot when there is none, and counts views and clicks by beacon. The
 * click goes straight to the Shopee: no redirect of ours, no link around the slot.
 *
 * The script reads the page's canonical URL and `og:title` itself, from `<head>`; the
 * slot adds the category, the tags and the article id. Nothing about the reader.
 *
 * `key` is the article and the slot. The element reads its attributes once, when it
 * connects, so a client-side navigation to another article has to bring a new element
 * for the new article to get its own ad.
 *
 * The wrapper carries the spacing around the ad, and gives it back when the slot
 * collapses (`.mn-op` in globals.css), so an empty slot leaves no hole.
 *
 * Renders nothing when `NEXT_PUBLIC_OPAPRECO_ADS_ENABLED=false`.
 */
export function OpaPrecoAd({
  slot,
  contexto,
  className,
}: {
  slot: OpaPrecoSlot;
  contexto?: ContextoDoAnuncio;
  className?: string;
}) {
  if (!opaPrecoEnabled()) return null;
  const tags = (contexto?.tags ?? []).filter(Boolean).join(',');

  return (
    <div className={cx('mn-op', className)}>
      <op-slot
        key={`${contexto?.conteudo ?? 'pagina'}:${slot}`}
        slot-key={slot}
        site-key={OPAPRECO_SITE_KEY}
        endpoint={opaPrecoEndpoint()}
        {...(contexto?.secao ? { section: contexto.secao } : {})}
        {...(tags ? { tags } : {})}
        {...(contexto?.conteudo ? { 'content-id': contexto.conteudo } : {})}
      />
    </div>
  );
}
