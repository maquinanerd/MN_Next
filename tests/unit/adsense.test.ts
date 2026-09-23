import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Advertising is environment, not code: the same build renders a grey reservation, a test
 * creative or a paying unit depending on what the deployment set. These tests pin the
 * three states, the validation that keeps a typo out of the DOM, and the two things that
 * would silently cost money — a Content-Security-Policy that blocks the ad stack, and an
 * ads.txt that names the wrong seller.
 */

const ENV_KEYS = [
  'NEXT_PUBLIC_ADSENSE_CLIENT',
  'NEXT_PUBLIC_ADSENSE_TEST',
  'NEXT_PUBLIC_ADSENSE_SLOT_728X90',
  'NEXT_PUBLIC_ADSENSE_SLOT_300X250',
  'NEXT_PUBLIC_ADSENSE_SLOT_300X600',
  'NEXT_PUBLIC_ADSENSE_SLOT_970X250',
] as const;

function withEnv(values: Partial<Record<(typeof ENV_KEYS)[number], string>>) {
  for (const key of ENV_KEYS) vi.stubEnv(key, values[key] ?? '');
}

afterEach(() => {
  vi.unstubAllEnvs();
});

async function adsense() {
  return await import('../../packages/ui/src/ads/adsense');
}

describe('configuração do AdSense', () => {
  it('sem publisher id, nada de anúncio — o caso do desenvolvimento', async () => {
    withEnv({});
    const { adsenseClient, adsenseSlot } = await adsense();
    expect(adsenseClient()).toBeNull();
    expect(adsenseSlot('728x90')).toBeNull();
  });

  it('aceita o id do publisher e recusa o que não tem a forma dele', async () => {
    const { adsenseClient } = await adsense();
    withEnv({ NEXT_PUBLIC_ADSENSE_CLIENT: 'ca-pub-9994816010226342' });
    expect(adsenseClient()).toBe('ca-pub-9994816010226342');
    withEnv({ NEXT_PUBLIC_ADSENSE_CLIENT: '  ca-pub-9994816010226342  ' });
    expect(adsenseClient()).toBe('ca-pub-9994816010226342');
    for (const bad of ['pub-9994816010226342', 'ca-pub-abc', 'ca-pub-', '<script>']) {
      withEnv({ NEXT_PUBLIC_ADSENSE_CLIENT: bad });
      expect(adsenseClient(), bad).toBeNull();
    }
  });

  it('liga um formato de cada vez, e só com id numérico', async () => {
    const { adsenseSlot } = await adsense();
    withEnv({ NEXT_PUBLIC_ADSENSE_SLOT_728X90: '1234567890', NEXT_PUBLIC_ADSENSE_SLOT_300X250: 'nao-numerico' });
    expect(adsenseSlot('728x90')).toBe('1234567890');
    expect(adsenseSlot('300x250')).toBeNull();
    expect(adsenseSlot('300x600')).toBeNull();
    expect(adsenseSlot('970x250')).toBeNull();
  });

  it('o modo de teste é explícito: só a palavra true liga', async () => {
    const { adsenseTest } = await adsense();
    withEnv({ NEXT_PUBLIC_ADSENSE_TEST: 'true' });
    expect(adsenseTest()).toBe(true);
    for (const off of ['', 'false', '1', 'sim']) {
      withEnv({ NEXT_PUBLIC_ADSENSE_TEST: off });
      expect(adsenseTest(), off).toBe(false);
    }
  });
});

describe('Content-Security-Policy', () => {
  async function policy(client: string) {
    withEnv(client ? { NEXT_PUBLIC_ADSENSE_CLIENT: client } : {});
    vi.resetModules();
    const config = (await import('../../next.config')).default;
    const headers = await config.headers!();
    const all = headers.flatMap((h) => h.headers);
    return all.find((h) => h.key === 'Content-Security-Policy')!.value;
  }

  it('não cita o Google quando o portal não serve anúncio', async () => {
    const csp = await policy('');
    expect(csp).not.toContain('googlesyndication');
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
  });

  it('libera host a host o que o AdSense precisa, sem curinga', async () => {
    const csp = await policy('ca-pub-9994816010226342');
    expect(csp).toContain('script-src');
    expect(csp).toMatch(/script-src[^;]*https:\/\/pagead2\.googlesyndication\.com/);
    expect(csp).toMatch(/img-src[^;]*https:\/\/tpc\.googlesyndication\.com/);
    expect(csp).toMatch(/frame-src[^;]*https:\/\/googleads\.g\.doubleclick\.net/);
    expect(csp).toMatch(/connect-src[^;]*https:\/\/pagead2\.googlesyndication\.com/);
    // O que a política já barrava continua barrado.
    expect(csp).not.toContain('*');
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("default-src 'self'");
  });
});

describe('ads.txt', () => {
  async function body(client: string) {
    withEnv(client ? { NEXT_PUBLIC_ADSENSE_CLIENT: client } : {});
    vi.resetModules();
    const { GET } = await import('../../app/ads.txt/route');
    return GET();
  }

  it('declara o Google como vendedor autorizado da conta configurada', async () => {
    const res = await body('ca-pub-9994816010226342');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/plain');
    expect(await res.text()).toBe('google.com, pub-9994816010226342, DIRECT, f08c47fec0942fa0\n');
  });

  it('não inventa vendedor num deploy sem anúncio', async () => {
    const res = await body('');
    expect(res.status).toBe(404);
  });
});
