import { z } from 'zod';

/**
 * Runtime schemas for the Kal El Editorial API, transcribed from the real source of
 * truth at `packages/contracts/src/*` in the Kal El repository (verified against
 * `apps/api/src/routes/site.ts`), not from an aspirational spec.
 *
 * Deliberately permissive where the CMS is permissive and strict where the frontend
 * would otherwise render nonsense: unknown *extra* fields are ignored (the CMS may add
 * them), but a missing required field is a contract failure, surfaced as a
 * `ContentError('contract')` and alerted on rather than papered over with a default.
 *
 * Everything here stops at the mapper. No route imports this file.
 */

export const uuid = z.string().uuid();
export const timestamp = z.string().datetime({ offset: true });

export const kalelEnvelope = <T extends z.ZodTypeAny>(data: T) => z.object({ data });

export const kalelErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
    requestId: z.string().optional(),
  }),
});

export const kalelArticleTypeSchema = z.enum(['article', 'review', 'list', 'video', 'audio']);
export const kalelArticleStatusSchema = z.enum(['draft', 'in_review', 'scheduled', 'published', 'blocked', 'archived']);

export const kalelMarkSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('bold') }),
  z.object({ type: z.literal('italic') }),
  z.object({ type: z.literal('code') }),
  z.object({ type: z.literal('underline') }),
  z.object({ type: z.literal('strike') }),
  z.object({
    type: z.literal('link'),
    attrs: z.object({
      href: z.string(),
      title: z.string().optional(),
      internal: z.boolean().optional(),
    }),
  }),
]);

export const kalelInlineNodeSchema = z.union([
  z.object({ type: z.literal('text'), text: z.string(), marks: z.array(kalelMarkSchema).default([]) }),
  z.object({ type: z.literal('hardBreak') }),
]);

export const kalelInlineContentSchema = z.array(kalelInlineNodeSchema);

const imageNode = z.object({
  type: z.literal('image'),
  attrs: z.object({
    mediaId: uuid,
    caption: z.string().optional(),
    credit: z.string().optional(),
    altText: z.string().optional(),
  }),
});

const galleryNode = z.object({
  type: z.literal('gallery'),
  attrs: z.object({ mediaIds: z.array(uuid) }),
});

const embedNode = z.object({
  type: z.literal('embed'),
  attrs: z.object({ url: z.string(), provider: z.string(), id: z.string().optional() }),
});

const sourceNode = z.object({
  type: z.literal('source'),
  attrs: z.object({ label: z.string(), url: z.string(), kind: z.string().optional() }),
});

export const kalelDocumentV2NodeSchema = z.union([
  z.object({
    type: z.literal('paragraph'),
    attrs: z.record(z.string(), z.unknown()).default({}),
    content: kalelInlineContentSchema,
  }),
  z.object({
    type: z.literal('heading'),
    attrs: z.object({ level: z.number().int().min(2).max(4) }),
    content: kalelInlineContentSchema,
  }),
  z.object({
    type: z.literal('quote'),
    attrs: z.record(z.string(), z.unknown()).default({}),
    content: kalelInlineContentSchema,
  }),
  z.object({
    type: z.literal('list'),
    attrs: z.object({ ordered: z.boolean().default(false) }),
    content: z.array(kalelInlineContentSchema),
  }),
  z.object({
    type: z.literal('table'),
    attrs: z.object({ headers: z.array(z.string()).default([]) }),
    content: z.array(z.array(kalelInlineContentSchema)),
  }),
  imageNode,
  galleryNode,
  embedNode,
  sourceNode,
]);

export const kalelDocumentSchema = z.object({
  version: z.literal(2),
  nodes: z.array(kalelDocumentV2NodeSchema),
});

export const kalelSeoSchema = z.object({
  seoTitle: z.string().nullable().default(null),
  metaDescription: z.string().nullable().default(null),
  canonicalUrl: z.string().nullable().default(null),
  robotsIndex: z.enum(['index', 'noindex']).default('index'),
  robotsFollow: z.enum(['follow', 'nofollow']).default('follow'),
  socialTitle: z.string().nullable().default(null),
  socialDescription: z.string().nullable().default(null),
  socialImageMediaId: uuid.nullable().optional(),
  primaryCategoryId: uuid.nullable().optional(),
});

export const kalelProvenanceSchema = z
  .object({
    system: z.string(),
    sources: z.array(
      z.object({
        provider: z.string(),
        externalId: z.string(),
        externalUrl: z.string().nullable().optional(),
      }),
    ),
    createdAt: z.string().optional(),
  })
  .nullable();

export const kalelArticleSummarySchema = z.object({
  id: uuid,
  siteId: uuid,
  type: kalelArticleTypeSchema,
  status: kalelArticleStatusSchema,
  title: z.string(),
  dek: z.string().nullable(),
  slug: z.string().nullable(),
  excerpt: z.string().nullable(),
  version: z.number().int().nonnegative(),
  externalKey: z.string().nullable(),
  featuredMediaId: uuid.nullable(),
  authors: z.array(uuid),
  categories: z.array(uuid),
  tags: z.array(uuid),
  entities: z.array(uuid),
  publishedAt: timestamp.nullable(),
  scheduledAt: timestamp.nullable(),
  updatedAt: timestamp,
  createdAt: timestamp,
  qualityFlags: z.array(z.string()).default([]),
});

export const kalelArticleSchema = kalelArticleSummarySchema.extend({
  document: kalelDocumentSchema,
  seo: kalelSeoSchema,
  provenance: kalelProvenanceSchema.optional().default(null),
  workflowNote: z
    .object({
      action: z.string(),
      note: z.string(),
      actorLabel: z.string().nullable(),
      createdAt: timestamp,
    })
    .nullable()
    .default(null),
});

export const kalelArticleListSchema = z.object({
  items: z.array(kalelArticleSummarySchema),
  nextCursor: z.string().nullable(),
  total: z.number().int().nonnegative().optional(),
});

export const kalelCategorySchema = z.object({
  id: uuid,
  siteId: uuid,
  parentId: uuid.nullable(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

export const kalelTagSchema = z.object({
  id: uuid,
  siteId: uuid,
  name: z.string(),
  slug: z.string(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

export const kalelAuthorSchema = z.object({
  id: uuid,
  siteId: uuid,
  name: z.string(),
  slug: z.string(),
  bio: z.string().nullable(),
  email: z.string().nullable(),
  userId: uuid.nullable().optional(),
  avatarMediaId: uuid.nullable().optional(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

export const kalelEntitySchema = z.object({
  id: uuid,
  siteId: uuid,
  name: z.string(),
  type: z.string(),
  description: z.string().nullable(),
  externalRefs: z.array(z.object({ provider: z.string(), type: z.string(), externalId: z.string() })).default([]),
  createdAt: timestamp,
  updatedAt: timestamp,
});

export const kalelMediaSchema = z.object({
  id: uuid,
  siteId: uuid,
  filename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  altText: z.string().nullable(),
  caption: z.string().nullable(),
  credit: z.string().nullable(),
  focalX: z.number().nullable(),
  focalY: z.number().nullable(),
  storageKey: z.string(),
  provider: z.string(),
  createdBy: uuid.nullable(),
  externalKey: z.string().nullable(),
  /**
   * Absolute URL on the CMS origin. Deliberately unused: fetching it needs the
   * `media.read` scope, so bytes are re-served through `/media/[id]` instead.
   */
  url: z.string().optional(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

/**
 * Media list.
 *
 * Kal El pages media by `limit`/`offset` and returns a `total` — there is no cursor
 * here, unlike the article list. Getting this wrong silently truncates the media index
 * to its first page, which makes older cover images disappear from cards.
 */
export const kalelMediaListSchema = z.object({
  items: z.array(kalelMediaSchema),
  total: z.number().int().nonnegative().default(0),
});

export const kalelRedirectSchema = z.object({
  id: uuid,
  siteId: uuid,
  sourcePath: z.string(),
  targetPath: z.string(),
  kind: z.enum(['301', '302']),
});

/**
 * Webhook envelope.
 *
 * The worker signs `JSON.stringify(event.payload)` and sends exactly those bytes, so the
 * body is the payload itself with no wrapper. Event type arrives in `x-kal-el-event`.
 */
export const kalelArticlePublishedPayloadSchema = z.object({
  articleId: uuid,
  slug: z.string().nullable(),
  publishedAt: z.string(),
  version: z.number().int().nonnegative(),
});

export const KALEL_WEBHOOK_EVENTS = ['article.published', 'article.scheduled', 'article.updated'] as const;
export type KalElWebhookEvent = (typeof KALEL_WEBHOOK_EVENTS)[number];

/** Preview envelope from `GET /v1/preview/:token`. */
export const kalelPreviewSchema = z.object({
  article: z.object({
    id: uuid,
    title: z.string(),
    dek: z.string().nullable(),
    slug: z.string().nullable(),
    status: kalelArticleStatusSchema,
    document: kalelDocumentSchema,
    seo: kalelSeoSchema.nullable(),
    featuredMediaId: uuid.nullable(),
    publishedAt: z.string().nullable(),
  }),
  site: z.object({ slug: z.string(), name: z.string() }).nullable(),
});

export type KalElArticle = z.infer<typeof kalelArticleSchema>;
export type KalElArticleSummary = z.infer<typeof kalelArticleSummarySchema>;
export type KalElDocument = z.infer<typeof kalelDocumentSchema>;
export type KalElDocumentNode = z.infer<typeof kalelDocumentV2NodeSchema>;
export type KalElCategory = z.infer<typeof kalelCategorySchema>;
export type KalElTag = z.infer<typeof kalelTagSchema>;
export type KalElAuthor = z.infer<typeof kalelAuthorSchema>;
export type KalElEntity = z.infer<typeof kalelEntitySchema>;
export type KalElMedia = z.infer<typeof kalelMediaSchema>;
export type KalElRedirect = z.infer<typeof kalelRedirectSchema>;
export type KalElSeo = z.infer<typeof kalelSeoSchema>;
export type KalElPreview = z.infer<typeof kalelPreviewSchema>;
export type KalElArticlePublishedPayload = z.infer<typeof kalelArticlePublishedPayloadSchema>;
