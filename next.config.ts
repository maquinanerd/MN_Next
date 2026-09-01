import type { NextConfig } from 'next';

/**
 * Remote image hosts come from MEDIA_ALLOWED_HOSTS only. There is deliberately no
 * wildcard fallback: an open `next/image` loader is an open image proxy, and the
 * charter forbids one. An empty allowlist means "no remote images", which degrades
 * to the local media proxy (`/media/[id]`) rather than to an unbounded loader.
 */
function allowedImageHosts(): string[] {
  return (process.env.MEDIA_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean);
}

/**
 * Content-Security-Policy.
 *
 * `script-src` allows `'unsafe-inline'`, and that is a deliberate, bounded choice rather
 * than an oversight. Next emits several inline bootstrap scripts per page (the flight
 * payload), each with a different hash on every page, so a hash list cannot cover them.
 * The alternative — a per-request nonce — forces every route to render dynamically and
 * throws away the ISR the entire delivery strategy rests on (docs/08).
 *
 * What this policy still buys, and what it does not:
 *
 *  - **Does** block script from any other origin, so a compromised or injected
 *    `<script src>` cannot load. That is the realistic vector for a news site running
 *    third-party ad and embed code.
 *  - **Does** block plugins, framing by others, `<base>` hijacking, off-site form posts,
 *    and every fetch destination except this origin.
 *  - **Does not** block injected inline script. That vector is closed structurally
 *    instead: no untrusted HTML is ever inserted. Article text is rendered as React
 *    elements from typed nodes, and the only two places that serialise a string —
 *    `<JsonLd>` and the theme script — escape or are constant. See
 *    `packages/content/src/sanitize.ts`.
 *
 * When GAM is wired up its origins are added to `script-src` and `frame-src` explicitly,
 * never by relaxing the policy further.
 *
 * `style-src` allows inline because React writes the `style` attributes this design uses
 * for aspect ratios and ad reservations, and attribute styles have no hash equivalent.
 */
function contentSecurityPolicy(): string {
  const imageHosts = allowedImageHosts().map((h) => `https://${h}`);

  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${imageHosts.join(' ')}`.trim(),
    "font-src 'self'",
    // The RUM beacon and the newsletter post go to this origin only.
    "connect-src 'self'",
    // Only the two players the embed facade can actually open.
    'frame-src https://www.youtube-nocookie.com https://player.vimeo.com',
    "frame-ancestors 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    'upgrade-insecure-requests',
  ].join('; ');
}

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy() },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@mn/ui', '@mn/content', '@mn/seo', '@mn/tokens'],
  // Lint is its own gate (`pnpm lint`); running it twice only slows the build.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: allowedImageHosts().map((hostname) => ({
      protocol: 'https' as const,
      hostname,
    })),
    // A story cover must be >= 1200px wide for Discover; keep the ladder wide enough.
    deviceSizes: [390, 640, 768, 1024, 1200, 1440, 1920],
    imageSizes: [96, 128, 192, 256, 288, 343, 384, 576],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
