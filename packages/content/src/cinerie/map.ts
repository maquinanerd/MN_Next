import { z } from 'zod';

import type { CinerieOfferType, CinerieRef, CinerieTitle, Image } from '../domain/types';
import { parseCinerieUrl } from './refs';

/**
 * The part of Cinerie's `cinerie-editorial-context-v1` answer the portal reads
 * (`POST /api/internal/editorial-context`, Cinerie `docs/operations/editorial-context.md`).
 *
 * Lenient on purpose: fields the portal does not use are ignored, so Cinerie can grow the
 * contract without a portal deploy. What the portal relies on is required, and a missing
 * required field fails the parse — the ficha is then left out, the article is not.
 */

const OFFER_TYPES = ['flatrate', 'free', 'ads', 'rent', 'buy'] as const;

const personSchema = z.object({
  name: z.string(),
  role: z.string().optional(),
  character: z.string().optional(),
});

const entitySchema = z.object({
  entityKind: z.enum(['movie', 'tv']),
  entityId: z.string(),
  title: z.string(),
  originalTitle: z.string().optional(),
  canonicalUrl: z.string().optional(),
  overview: z.string().optional(),
  releaseDate: z.string().optional(),
  runtimeMinutes: z.number().int().positive().optional(),
  genres: z.array(z.string()).default([]),
  seasonCount: z.number().int().min(0).optional(),
  ended: z.boolean().optional(),
  cast: z.array(personSchema).default([]),
  crew: z.array(personSchema).default([]),
});

const mediaSchema = z.object({
  mediaId: z.string().optional(),
  kind: z.string(),
  entityKind: z.string().optional(),
  role: z.string().optional(),
  entityId: z.string().optional(),
  url: z.string(),
  embedUrl: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  alt: z.string().optional(),
  credit: z.string().optional(),
  caption: z.string().optional(),
  licenseStatus: z.string(),
  allowedForEditorial: z.boolean(),
});

const availabilitySchema = z.object({
  entityKind: z.string().optional(),
  entityId: z.string(),
  providerName: z.string(),
  offerType: z.string(),
  url: z.string().optional(),
  attributionText: z.string().optional(),
});

export const cinerieContextResponseSchema = z.object({
  context: z.object({
    contractVersion: z.literal('cinerie-editorial-context-v1'),
    entities: z.array(entitySchema).default([]),
    media: z.array(mediaSchema).default([]),
    availability: z.array(availabilitySchema).default([]),
  }),
  resolutions: z.array(z.object({ index: z.number().int().min(0), entityId: z.string().nullable() })).default([]),
});

export type CinerieContextResponse = z.infer<typeof cinerieContextResponseSchema>;

/** Poster art is served through `next/image` from this host only (next.config.ts). */
export const CINERIE_IMAGE_HOST = 'image.tmdb.org';
/** The one poster size the optimiser serves (next.config.ts `remotePatterns`). */
export const CINERIE_POSTER_PATH = '/t/p/w780/';
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const CAST_SHOWN = 6;

/**
 * Is this piece THIS work's? Film and series ids come from separate sequences, so
 * `movie:12` and `tv:12` are different works and the kind has to match too. Without
 * `entityKind` (an older Cinerie), the `mediaId` carries it: `cinerie:<kind>:<id>:...`.
 */
function ownedBy(
  item: { entityKind?: string | undefined; entityId?: string | undefined; mediaId?: string | undefined },
  kind: string,
  entityId: string,
): boolean {
  const fromId = item.mediaId?.startsWith('cinerie:') ? item.mediaId.split(':')[1] : undefined;
  const itemKind = item.entityKind ?? fromId;
  if (itemKind !== undefined && itemKind !== kind) return false;
  return (item.entityId ?? entityId) === entityId;
}

function usable(media: z.infer<typeof mediaSchema>): boolean {
  // The contract's own rule (`isMediaUsableForEditorial`): approved, and explicitly allowed.
  return media.licenseStatus === 'approved' && media.allowedForEditorial === true;
}

function posterImage(media: z.infer<typeof mediaSchema> | undefined, title: string): Image | undefined {
  if (!media) return undefined;
  let url: URL;
  try {
    url = new URL(media.url);
  } catch {
    return undefined;
  }
  if (
    url.protocol !== 'https:' ||
    url.hostname !== CINERIE_IMAGE_HOST ||
    !url.pathname.startsWith(CINERIE_POSTER_PATH)
  ) {
    return undefined;
  }
  return {
    url: url.toString(),
    width: media.width ?? 780,
    height: media.height ?? 1170,
    alt: media.alt ?? `Pôster de ${title}`,
    ...(media.credit ? { credit: media.credit } : {}),
  };
}

/** The YouTube id of a trailer, from the player or the watch address — nothing else plays. */
export function youtubeIdOf(raw: string | undefined): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, '');
  let id: string | null = null;
  if (host === 'youtube-nocookie.com' || host === 'youtube.com') {
    if (url.pathname.startsWith('/embed/')) id = url.pathname.slice('/embed/'.length).split('/')[0] ?? null;
    else if (url.pathname === '/watch') id = url.searchParams.get('v');
  } else if (host === 'youtu.be') {
    id = url.pathname.slice(1).split('/')[0] ?? null;
  }
  return id && YOUTUBE_ID.test(id) ? id : null;
}

function offerType(value: string): CinerieOfferType | null {
  return (OFFER_TYPES as readonly string[]).includes(value) ? (value as CinerieOfferType) : null;
}

function httpsUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The fichas, in the order of the refs that asked for them. A ref Cinerie could not
 * resolve is skipped; two refs that resolve to the same work yield one ficha.
 */
export function mapCinerieTitles(response: CinerieContextResponse, refs: CinerieRef[]): CinerieTitle[] {
  const { entities, media, availability } = response.context;
  const byId = new Map(entities.map((e) => [`${e.entityKind}:${e.entityId}`, e]));

  const order: string[] = [];
  refs.forEach((ref, index) => {
    const resolved = response.resolutions.find((r) => r.index === index)?.entityId ?? ref.entityId ?? null;
    if (!resolved) return;
    const key = `${ref.kind}:${resolved}`;
    if (byId.has(key) && !order.includes(key)) order.push(key);
  });

  return order.flatMap((key) => {
    const entity = byId.get(key);
    if (!entity) return [];
    const own = media.filter((m) => ownedBy(m, entity.entityKind, entity.entityId) && usable(m));
    const trailerMedia = own.find((m) => m.role === 'trailer' || m.kind === 'trailer');
    const youtubeId = youtubeIdOf(trailerMedia?.embedUrl) ?? youtubeIdOf(trailerMedia?.url);
    const offers = availability.filter((a) => ownedBy(a, entity.entityKind, entity.entityId));
    const poster = posterImage(
      own.find((m) => m.role === 'poster'),
      entity.title,
    );
    const page = entity.canonicalUrl ? parseCinerieUrl(entity.canonicalUrl) : null;
    const offersCredit = offers.find((o) => o.attributionText)?.attributionText;

    const title: CinerieTitle = {
      kind: entity.entityKind,
      entityId: entity.entityId,
      title: entity.title,
      ...(entity.originalTitle && entity.originalTitle !== entity.title ? { originalTitle: entity.originalTitle } : {}),
      url: page?.url ?? 'https://cinerie.com/',
      ...(entity.releaseDate && /^\d{4}-\d{2}-\d{2}$/.test(entity.releaseDate)
        ? { releaseDate: entity.releaseDate }
        : {}),
      ...(entity.runtimeMinutes ? { runtimeMinutes: entity.runtimeMinutes } : {}),
      genres: entity.genres.slice(0, 4),
      ...(entity.overview ? { synopsis: entity.overview } : {}),
      directors: entity.crew.filter((p) => p.role === 'direção').map((p) => p.name),
      cast: entity.cast
        .slice(0, CAST_SHOWN)
        .map((p) => ({ name: p.name, ...(p.character ? { character: p.character } : {}) })),
      ...(entity.seasonCount !== undefined ? { seasonCount: entity.seasonCount } : {}),
      ...(entity.ended !== undefined ? { ended: entity.ended } : {}),
      ...(poster ? { poster } : {}),
      ...(youtubeId ? { trailer: { youtubeId, title: trailerMedia?.caption ?? `Trailer de ${entity.title}` } } : {}),
      offers: offers.flatMap((o) => {
        const type = offerType(o.offerType);
        if (!type) return [];
        const url = httpsUrl(o.url);
        return [{ provider: o.providerName, type, ...(url ? { url } : {}) }];
      }),
      ...(offersCredit ? { offersCredit } : {}),
    };
    return [title];
  });
}
