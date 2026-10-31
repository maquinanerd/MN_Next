import { describe, expect, it } from 'vitest';

import { fixtureArticles, toSummary, type Article } from '@mn/content';
import type { Bloco, Chamada } from '@mn/ui';

import {
  adContext,
  editoriaRef,
  toBlocos,
  toChamada,
  toMateria,
  videoId,
  withAds,
  withRelatedInline,
} from '../../lib/content/map';

/**
 * The adapter from the domain to the kit's view model (`lib/content/map.ts`).
 *
 * These are the composition rules the kit writes down (docs/03 and docs/05) and a
 * component can no longer get wrong, because it never makes the decision.
 */

const p = (text: string): Bloco => ({ tipo: 'paragrafo', conteudo: [{ tipo: 'texto', texto: text }] });
const h = (text: string): Bloco => ({ tipo: 'subtitulo', texto: text, id: text, nivel: 2 });
const img: Bloco = { tipo: 'imagem', imagem: { url: '/x.jpg', alt: 'x' }, largura: 'larga' };

function byTitle(fragment: string): Article {
  const article = fixtureArticles.find((a) => a.title.includes(fragment));
  if (!article) throw new Error(`fixture ${fragment} missing`);
  return article;
}

describe('withAds — the two OpaPreço slots inside the text', () => {
  const body: Bloco[] = [p('1'), p('2'), p('3'), h('s'), p('4'), p('5'), img, p('6'), p('7'), p('8'), p('9')];
  const out = withAds(body, true);
  const ads = out.map((b, i) => ({ b, i })).filter((x) => x.b.tipo === 'anuncio');
  const slots = (blocos: Bloco[]) => blocos.flatMap((b) => (b.tipo === 'anuncio' ? [b.slot] : []));
  /** Paragraphs strictly before block `i`. */
  const paragraphsBefore = (blocos: Bloco[], i: number) =>
    blocos.slice(0, i).filter((b) => b.tipo === 'paragrafo').length;

  it('places inline-01, then inline-02, once each', () => {
    expect(slots(out)).toEqual(['article-inline-01', 'article-inline-02']);
  });

  it('puts inline-01 after the second paragraph', () => {
    expect(paragraphsBefore(out, ads[0]?.i ?? -1)).toBe(2);
  });

  it('keeps at least three paragraphs between inline-01 and inline-02', () => {
    const [first, second] = ads;
    expect(paragraphsBefore(out, second?.i ?? -1) - paragraphsBefore(out, first?.i ?? -1)).toBeGreaterThanOrEqual(3);
  });

  it('puts every slot between two paragraphs when the text allows', () => {
    for (const { i } of ads) {
      expect(out[i - 1]?.tipo).toBe('paragrafo');
      expect(out[i + 1]?.tipo).toBe('paragrafo');
    }
  });

  it('moves inline-01 after the third paragraph when the second runs into an image', () => {
    const moved = withAds([p('1'), p('2'), img, p('3'), p('4')], true);
    expect(moved.map((b) => b.tipo)).toEqual(['paragrafo', 'paragrafo', 'imagem', 'paragrafo', 'anuncio', 'paragrafo']);
  });

  it('places inline-02 only with three paragraphs in between and text after it', () => {
    expect(slots(withAds([p('1'), p('2'), p('3'), p('4'), p('5')], true))).toEqual(['article-inline-01']);
    const six = withAds([p('1'), p('2'), p('3'), p('4'), p('5'), p('6')], true);
    expect(six.map((b) => (b.tipo === 'anuncio' ? b.slot : b.tipo))).toEqual([
      'paragrafo',
      'paragrafo',
      'article-inline-01',
      'paragrafo',
      'paragrafo',
      'paragrafo',
      'article-inline-02',
      'paragrafo',
    ]);
  });

  it('never opens or closes the text with an ad', () => {
    expect(slots(withAds([p('1'), p('2')], true))).toEqual([]);
    expect(withAds([p('1'), p('2'), p('3')], true).at(-1)?.tipo).toBe('paragrafo');
  });

  it('places none on an article the brand-safety rule excludes', () => {
    expect(withAds(body, false).some((b) => b.tipo === 'anuncio')).toBe(false);
  });
});

describe('adContext — what the slots tell OpaPreço about the article', () => {
  const article: Article = {
    ...byTitle('Resident Evil'),
    tags: [
      { id: 't1', slug: 'playstation', name: 'PlayStation' },
      { id: 't2', slug: 'longform', name: 'longform' },
      { id: 't3', slug: 'ssd', name: 'SSD' },
    ],
  };

  it('sends the category, the topic tags and the id — never a reserved tag', () => {
    expect(adContext(article, true)).toEqual({
      ...(article.category ? { secao: article.category.slug } : {}),
      tags: ['playstation', 'ssd'],
      conteudo: article.id,
    });
  });

  it('is null when brand safety keeps ads off the article', () => {
    expect(adContext(article, false)).toBeNull();
  });
});

describe('withRelatedInline — "Mais como este" after the first paragraph', () => {
  const items = fixtureArticles
    .slice(0, 3)
    .map((a) => toChamada(toSummary(a)))
    .filter((c): c is Chamada => c !== null);

  it('goes after the first paragraph', () => {
    const out = withRelatedInline([p('1'), p('2'), p('3')], items);
    expect(out.map((b) => b.tipo)).toEqual(['paragrafo', 'relacionadas-inline', 'paragrafo', 'paragrafo']);
  });

  it('needs text on both sides and two stories to offer', () => {
    expect(withRelatedInline([p('1')], items).some((b) => b.tipo === 'relacionadas-inline')).toBe(false);
    expect(withRelatedInline([p('1'), p('2')], items.slice(0, 1)).some((b) => b.tipo === 'relacionadas-inline')).toBe(
      false,
    );
  });
});

describe('toChamada', () => {
  it('links an offer page under /ofertas, whatever its editoria', () => {
    const offer = toChamada(toSummary(byTitle('Controle Xbox')));
    expect(offer?.href).toBe('/ofertas/controle-xbox-edicao-especial-tem-queda-de-preco-na-amazon');
    expect(offer?.formato).toBe('oferta');
  });

  it('labels a card with its subject, never with a reserved layout tag', () => {
    const overlay = toChamada(toSummary(byTitle('Como Scarlett Johansson virou')));
    expect(overlay?.assunto).toBe('Marvel');
  });

  it('returns nothing for an article with no public address', () => {
    const summary = { ...toSummary(byTitle('Pirates')), category: null };
    expect(toChamada(summary)).toBeNull();
  });
});

describe('editoriaRef', () => {
  it('gives Cinema a darker fill wherever text sits on it', () => {
    // #A248FC fails 4.5:1 with white and with ink; its text variant does not.
    const ref = editoriaRef({ id: 'c', slug: 'cinema', name: 'Cinema', description: '' });
    expect(ref.cor).toBe('var(--color-ed-cinema)');
    expect(ref.corFundoTexto).toBe('var(--color-ed-cinema-text)');
  });

  it('puts ink, not white, on the light fills', () => {
    for (const slug of ['series-e-tv', 'games', 'quadrinhos', 'animes', 'videos']) {
      expect(editoriaRef({ id: slug, slug, name: slug, description: '' }).textoSobreCor, slug).toBe('dark');
    }
  });

  it('renders a CMS category outside the seven in Notícias colours, under its own name', () => {
    const ref = editoriaRef({ id: 'x', slug: 'podcast', name: 'Podcast', description: '' });
    expect(ref.nome).toBe('Podcast');
    expect(ref.cor).toBe('var(--color-ed-noticias)');
  });
});

describe('toBlocos', () => {
  it('turns a YouTube embed into a click-to-load video, with the id from any URL shape', () => {
    expect(videoId('youtube', 'https://www.youtube.com/embed/abc123')).toBe('abc123');
    expect(videoId('youtube', 'https://www.youtube.com/watch?v=xyz')).toBe('xyz');
    const blocos = toBlocos([{ type: 'embed', provider: 'youtube', url: 'https://youtu.be/q1' }], 'Título');
    expect(blocos[0]).toMatchObject({ tipo: 'video', provedor: 'youtube', id: 'q1' });
  });

  it('keeps an embed it cannot frame as a link out, never as a script', () => {
    const blocos = toBlocos([{ type: 'embed', provider: 'x', url: 'https://x.com/a/status/1' }], 'Título');
    expect(blocos[0]).toMatchObject({ tipo: 'incorporado', provedor: 'X' });
  });

  it('marks an internal link as internal', () => {
    const blocos = toBlocos(
      [{ type: 'paragraph', content: [{ type: 'text', text: 'veja', marks: [{ type: 'link', href: '/cinema' }] }] }],
      'Título',
    );
    const first = blocos[0];
    if (first?.tipo !== 'paragrafo') throw new Error('expected a paragraph');
    expect(first.conteudo[0]).toMatchObject({ link: { href: '/cinema', externo: false } });
  });
});

describe('toMateria', () => {
  const ctx = { siteUrl: 'https://www.maquinanerd.test', adsPermitidos: true, maisComoEste: [], relacionadas: [] };

  it('shows "Atualizado em" only for a real edit', () => {
    const edited = toMateria(byTitle('estrela "perdida"'), ctx);
    const untouched = toMateria(byTitle('Pirates'), ctx);
    expect(edited?.atualizadoEm).toBeDefined();
    expect(untouched?.atualizadoEm).toBeUndefined();
  });

  it('builds the absolute share URL from the canonical path', () => {
    expect(toMateria(byTitle('Pirates'), ctx)?.url).toBe(
      'https://www.maquinanerd.test/cinema/pirates-of-the-caribbean-avanca-com-negociacoes-para-johnny-depp',
    );
  });

  it('marks an offer page as carrying affiliate links', () => {
    expect(toMateria(byTitle('Controle Xbox'), ctx)?.afiliados).toBe(true);
    expect(toMateria(byTitle('Controle Xbox'), ctx)?.layout).toBe('oferta');
    expect(toMateria(byTitle('Controle Xbox'), ctx)?.comercial).toBe(true);
    // The affiliate notice covers it; no second disclosure at the top.
    expect(toMateria(byTitle('Controle Xbox'), ctx)?.divulgacao).toBeUndefined();
  });

  it('discloses sponsored content above the text and marks its links sponsored, in any layout', () => {
    const sponsored: Article = {
      ...byTitle('Pirates'),
      commercialKind: 'branded-content',
      commercial: { kind: 'branded-content', brandName: 'Parceiro', disclosure: 'Conteúdo produzido em parceria.' },
    };
    const materia = toMateria(sponsored, ctx);
    expect(materia?.layout).toBe('padrao');
    expect(materia?.comercial).toBe(true);
    expect(materia?.divulgacao).toEqual({ rotulo: 'Conteúdo patrocinado', texto: 'Conteúdo produzido em parceria.' });
    expect(toMateria(byTitle('Pirates'), ctx)?.comercial).toBe(false);
    expect(toMateria(byTitle('Pirates'), ctx)?.divulgacao).toBeUndefined();
  });
});
