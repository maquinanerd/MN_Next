import type { Article, CinerieOfferType, CinerieTitle } from '@mn/content';
import type { FichaObra } from '@mn/ui';

import { videoId } from './map';

/**
 * From a Cinerie title to the ficha the article page shows (`FichaObra`). Pure: no
 * network. The Cinerie read itself is `fetchCinerieTitles`, called from `materiaView`.
 */

const MODALIDADE: Readonly<Record<CinerieOfferType, string>> = {
  flatrate: 'Assinatura',
  free: 'Grátis',
  ads: 'Grátis com anúncios',
  rent: 'Aluguel',
  buy: 'Compra',
};

/** What is included first, what costs last — the order Cinerie's own panel uses. */
const ORDEM: readonly CinerieOfferType[] = ['flatrate', 'free', 'ads', 'rent', 'buy'];

/** "2h 46min", "58min". */
export function duracao(minutes: number | undefined): string | null {
  if (!minutes || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

function linhaFina(title: CinerieTitle): string {
  const parts: string[] = [title.kind === 'movie' ? 'Filme' : 'Série'];
  const year = title.releaseDate?.slice(0, 4);
  if (year) parts.push(year);
  if (title.kind === 'movie') {
    const d = duracao(title.runtimeMinutes);
    if (d) parts.push(d);
  } else {
    if (title.seasonCount && title.seasonCount > 0) {
      parts.push(title.seasonCount === 1 ? '1 temporada' : `${title.seasonCount} temporadas`);
    }
    if (title.ended === true) parts.push('encerrada');
  }
  return parts.join(' · ');
}

/** YouTube ids the article text already plays: the ficha does not play the same trailer twice. */
function embeddedVideos(article: Article): Set<string> {
  const ids = new Set<string>();
  for (const block of article.body) {
    if (block.type !== 'embed' || block.provider !== 'youtube') continue;
    const id = videoId('youtube', block.url, block.embedId);
    if (id) ids.add(id);
  }
  return ids;
}

export function toFicha(title: CinerieTitle, article: Article): FichaObra {
  const already = embeddedVideos(article);
  const grupos = ORDEM.flatMap((type) => {
    const plataformas = title.offers
      .filter((o) => o.type === type)
      .map((o) => ({ nome: o.provider, ...(o.url ? { url: o.url } : {}) }));
    return plataformas.length > 0 ? [{ modalidade: MODALIDADE[type], plataformas }] : [];
  });

  return {
    tipo: title.kind === 'movie' ? 'filme' : 'serie',
    titulo: title.title,
    ...(title.originalTitle ? { tituloOriginal: title.originalTitle } : {}),
    url: title.url,
    linhaFina: linhaFina(title),
    generos: title.genres,
    ...(title.synopsis ? { sinopse: title.synopsis } : {}),
    direcao: title.directors,
    elenco: title.cast.map((p) => ({ nome: p.name, ...(p.character ? { personagem: p.character } : {}) })),
    ...(title.poster
      ? {
          poster: {
            url: title.poster.url,
            alt: title.poster.alt,
            largura: title.poster.width,
            altura: title.poster.height,
            ...(title.poster.credit ? { credito: title.poster.credit } : {}),
          },
        }
      : {}),
    ...(title.trailer && !already.has(title.trailer.youtubeId)
      ? { trailer: { id: title.trailer.youtubeId, titulo: title.trailer.title } }
      : {}),
    ondeAssistir: grupos,
    ...(title.offersCredit && grupos.length > 0 ? { creditoOfertas: title.offersCredit } : {}),
  };
}
