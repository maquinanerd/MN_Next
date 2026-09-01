import { describe, expect, it } from 'vitest';

import type { Image } from '@mn/content';
import { emptyReport, htmlToBlocks } from '../../scripts/wp/transform';
import { assetUrlAllowed, isPrivateAddress, WordPressSource } from '../../scripts/wp/source';

/**
 * Regressions from the final review.
 *
 * Every case here reproduces a defect that would have produced a *quiet* wrong result —
 * an import that exits 0 having lost the desk on every article, a shortcode that
 * disappears between two paragraphs, a fetch aimed at an internal address. Those are the
 * ones worth a permanent test.
 */

const IMAGE: Image = { url: '/media/abc', width: 1600, height: 900, alt: '' };

function convert(html: string, resolveImage: (src: string) => Image | null = () => IMAGE) {
  const report = emptyReport();
  const blocks = htmlToBlocks(html, { postId: 1, resolveImage, report });
  return { blocks, report };
}

describe('shortcodes are converted, not lost between blocks', () => {
  it('turns [caption] into a figure with its caption', () => {
    const { blocks } = convert(
      '<p>antes</p>[caption id="a" width="300"]<img src="https://x.test/a.jpg" /> Uma legenda[/caption]<p>depois</p>',
    );
    const image = blocks.find((b) => b.type === 'image');
    if (image?.type !== 'image') throw new Error('expected an image block');
    expect(image.image.caption).toBe('Uma legenda');
    expect(blocks.filter((b) => b.type === 'paragraph')).toHaveLength(2);
  });

  it('turns [gallery ids] into one image per id', () => {
    const resolved: Record<string, Image> = {
      '/wp-media-id/12': { ...IMAGE, url: '/media/doze' },
      '/wp-media-id/34': { ...IMAGE, url: '/media/trinta' },
    };
    const { blocks } = convert('<p>a</p>[gallery ids="12,34"]<p>b</p>', (src) => resolved[src] ?? null);
    const urls = blocks.filter((b) => b.type === 'image').map((b) => (b.type === 'image' ? b.image.url : ''));
    expect(urls).toEqual(['/media/doze', '/media/trinta']);
  });

  it('turns [embed] into the embed the URL names', () => {
    const { blocks } = convert('<p>a</p>[embed]https://www.youtube.com/watch?v=abc[/embed]');
    const embed = blocks.find((b) => b.type === 'embed');
    if (embed?.type !== 'embed') throw new Error('expected an embed');
    expect(embed.provider).toBe('youtube');
  });

  it('reports a shortcode that survived, instead of leaving it as text', () => {
    // The exact failure: a recognised-but-unconvertible shortcode sitting between two
    // paragraphs used to vanish without a trace, because the block parser only reads tags.
    const { blocks, report } = convert('<p>antes</p>[caption]sem imagem[/caption]<p>depois</p>');
    expect(JSON.stringify(blocks)).not.toContain('caption]');
    expect(report.unknown['shortcode:caption:no-image']).toBe(1);
  });

  it('counts a gallery with no ids rather than dropping it', () => {
    const { report } = convert('<p>a</p>[gallery columns="3"]');
    expect(report.unknown['shortcode:gallery:no-ids']).toBe(1);
  });

  it('never leaves shortcode-shaped text in the body unreported', () => {
    const { report } = convert('<p>texto com [algo_estranho attr="1"] no meio</p>');
    const keys = Object.keys(report.unknown).join(' ');
    expect(keys).toContain('algo_estranho');
  });
});

describe('asset fetching cannot be aimed at an internal address', () => {
  const allowed = new Set(['old.example.com']);

  it('accepts an asset from the source origin', () => {
    expect(assetUrlAllowed('https://old.example.com/wp-content/a.jpg', allowed).ok).toBe(true);
  });

  it.each([
    ['https://169.254.169.254/latest/meta-data/', 'cloud metadata'],
    ['http://127.0.0.1:8080/admin', 'loopback'],
    ['http://10.0.0.5/internal', 'private range'],
    ['http://localhost/x', 'localhost'],
    ['https://outro-host.test/a.jpg', 'host outside the allowlist'],
    ['file:///etc/passwd', 'non-http scheme'],
    ['https://user:pass@old.example.com/a.jpg', 'credentials in the URL'],
    ['https://old.example.com:2375/a.jpg', 'unusual port'],
  ])('refuses %s (%s)', (url) => {
    expect(assetUrlAllowed(url, allowed).ok).toBe(false);
  });

  it('recognises the private ranges', () => {
    for (const host of [
      '10.1.2.3',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.1.1',
      '169.254.1.1',
      '127.0.0.1',
      '100.64.0.1',
    ]) {
      expect(isPrivateAddress(host), host).toBe(true);
    }
    for (const host of ['8.8.8.8', '172.32.0.1', '192.169.1.1', 'old.example.com']) {
      expect(isPrivateAddress(host), host).toBe(false);
    }
  });

  it('re-checks every redirect hop rather than trusting the first URL', async () => {
    const seen: string[] = [];
    const source = new WordPressSource({
      baseUrl: 'https://old.example.com',
      requestsPerSecond: 0,
      fetchImpl: (async (input: string) => {
        seen.push(String(input));
        // The source-controlled response tries to bounce the fetch inside the network.
        return new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest/' } });
      }) as unknown as typeof fetch,
    });

    const result = await source.fetchAsset('https://old.example.com/wp-content/a.jpg', 1024 * 1024);
    expect(result).toBeNull();
    // The first URL was fetched; the redirect target never was.
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain('old.example.com');
  });

  it('refuses an asset larger than the limit even when the header lies', async () => {
    const big = Buffer.alloc(2048, 1);
    const source = new WordPressSource({
      baseUrl: 'https://old.example.com',
      requestsPerSecond: 0,
      fetchImpl: (async () =>
        new Response(new Uint8Array(big), {
          status: 200,
          headers: { 'content-type': 'image/jpeg', 'content-length': '10' },
        })) as unknown as typeof fetch,
    });
    expect(await source.fetchAsset('https://old.example.com/a.jpg', 1024)).toBeNull();
  });

  it('allows an explicitly permitted CDN host', async () => {
    const source = new WordPressSource({
      baseUrl: 'https://old.example.com',
      assetHosts: ['cdn.example.net'],
      requestsPerSecond: 0,
      fetchImpl: (async () =>
        new Response(new Uint8Array(Buffer.from([0xff, 0xd8, 0xff])), {
          status: 200,
          headers: { 'content-type': 'image/jpeg' },
        })) as unknown as typeof fetch,
    });
    const result = await source.fetchAsset('https://cdn.example.net/a.jpg', 1024);
    expect(result?.mimeType).toBe('image/jpeg');
  });
});
