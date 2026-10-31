import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Google Analytics is environment plus consent: the build decides whether there is a
 * property to send to, the reader decides whether anything is sent. These tests pin the id
 * validation, the CSP that would otherwise silently drop every page view, and the promise
 * the consent bar makes — no request to Google before "Aceitar todos", nothing sent after a
 * refusal, nothing ever from a preview page.
 */

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function analytics() {
  return await import('../../lib/analytics');
}

describe('id de medição', () => {
  it('sem id, nada é medido — o caso do desenvolvimento', async () => {
    vi.stubEnv('NEXT_PUBLIC_GA_MEASUREMENT_ID', '');
    const { gaMeasurementId } = await analytics();
    expect(gaMeasurementId()).toBeNull();
  });

  it('aceita o id do fluxo da Web e recusa o que não tem a forma dele', async () => {
    const { gaMeasurementId } = await analytics();
    vi.stubEnv('NEXT_PUBLIC_GA_MEASUREMENT_ID', 'G-CQ0S5G3DY9');
    expect(gaMeasurementId()).toBe('G-CQ0S5G3DY9');
    vi.stubEnv('NEXT_PUBLIC_GA_MEASUREMENT_ID', '  G-CQ0S5G3DY9  ');
    expect(gaMeasurementId()).toBe('G-CQ0S5G3DY9');
    for (const bad of ['UA-12345678-1', 'G-', 'g-cq0s5g3dy9', 'GTM-ABC1234', 'G-ABC"><script>']) {
      vi.stubEnv('NEXT_PUBLIC_GA_MEASUREMENT_ID', bad);
      expect(gaMeasurementId(), bad).toBeNull();
    }
  });
});

describe('Content-Security-Policy', () => {
  async function policy(id: string, ads = '') {
    vi.stubEnv('NEXT_PUBLIC_GA_MEASUREMENT_ID', id);
    vi.stubEnv('NEXT_PUBLIC_OPAPRECO_ADS_ENABLED', ads);
    vi.resetModules();
    const config = (await import('../../next.config')).default;
    const headers = await config.headers!();
    return headers.flatMap((h) => h.headers).find((h) => h.key === 'Content-Security-Policy')!.value;
  }

  it('não cita o Analytics num build sem id', async () => {
    const csp = await policy('');
    expect(csp).not.toContain('googletagmanager');
    expect(csp).not.toContain('google-analytics');
  });

  it('libera o script e a coleta do GA4 quando há id', async () => {
    const csp = await policy('G-CQ0S5G3DY9');
    expect(csp).toMatch(/script-src[^;]*https:\/\/www\.googletagmanager\.com/);
    expect(csp).toMatch(/connect-src[^;]*https:\/\/\*\.google-analytics\.com/);
    expect(csp).toMatch(/connect-src[^;]*https:\/\/\*\.analytics\.google\.com/);
    expect(csp).toMatch(/img-src[^;]*https:\/\/\*\.google-analytics\.com/);
    // O script continua vindo de um host só, e nada além disso foi afrouxado.
    expect(csp).not.toMatch(/script-src[^;]*\*/);
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("default-src 'self'");
  });

  it('soma o OpaPreço e o GA4 na política de produção, que tem os dois', async () => {
    const csp = await policy('G-CQ0S5G3DY9');
    expect(csp).toMatch(/script-src[^;]*https:\/\/opapreco\.com\.br[^;]*https:\/\/www\.googletagmanager\.com/);
    expect(csp).toMatch(/connect-src[^;]*https:\/\/opapreco\.com\.br[^;]*https:\/\/\*\.google-analytics\.com/);
    expect(csp).not.toMatch(/script-src[^;]*\*/);
  });
});

describe('consentimento', () => {
  type FakeWindow = EventTarget & {
    location: { pathname: string };
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    [optOut: `ga-disable-${string}`]: boolean | undefined;
  };

  function fakeBrowser(pathname = '/') {
    const appended: { src: string; async: boolean }[] = [];
    const win = Object.assign(new EventTarget(), { location: { pathname } }) as FakeWindow;
    vi.stubGlobal('window', win);
    vi.stubGlobal('document', {
      createElement: () => ({ src: '', async: false }),
      head: { appendChild: (node: { src: string; async: boolean }) => appended.push(node) },
    });
    const calls = () => (win.dataLayer ?? []).map((entry) => Array.from(entry as ArrayLike<unknown>));
    return { win, appended, calls };
  }

  it('sem aceite, não define o gtag nem baixa nada do Google', async () => {
    const browser = fakeBrowser();
    const { applyAnalyticsConsent } = await analytics();
    applyAnalyticsConsent('G-CQ0S5G3DY9', false);
    expect(browser.win.gtag).toBeUndefined();
    expect(browser.win.dataLayer).toBeUndefined();
    expect(browser.appended).toHaveLength(0);
  });

  it('o aceite carrega o gtag uma vez, já com consentimento, e mede o fluxo configurado', async () => {
    const browser = fakeBrowser();
    const { applyAnalyticsConsent } = await analytics();
    applyAnalyticsConsent('G-CQ0S5G3DY9', true);

    expect(browser.appended).toHaveLength(1);
    expect(browser.appended[0]!.async).toBe(true);
    expect(browser.appended[0]!.src).toBe('https://www.googletagmanager.com/gtag/js?id=G-CQ0S5G3DY9');

    const [consent, js, config] = browser.calls();
    expect(consent).toEqual([
      'consent',
      'default',
      // Só a medição: os sinais de anúncio ficam negados mesmo com o aceite.
      { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' },
    ]);
    expect(js![0]).toBe('js');
    expect(config).toEqual(['config', 'G-CQ0S5G3DY9']);
  });

  it('mudar de ideia na mesma visita atualiza o consentimento sem baixar o script de novo', async () => {
    const browser = fakeBrowser();
    const { applyAnalyticsConsent } = await analytics();
    applyAnalyticsConsent('G-CQ0S5G3DY9', true);
    applyAnalyticsConsent('G-CQ0S5G3DY9', false);
    expect(browser.calls().at(-1)).toEqual([
      'consent',
      'update',
      { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' },
    ]);
    applyAnalyticsConsent('G-CQ0S5G3DY9', true);
    expect(browser.calls().at(-1)![2]).toMatchObject({ analytics_storage: 'granted' });
    expect(browser.appended).toHaveLength(1);
  });

  // `consent update` sozinho só para os cookies: o gtag já carregado seguiria mandando pings
  // sem cookie, o modo "avançado" que a barra não oferece.
  it('a recusa depois do aceite liga o opt-out do gtag, e um novo aceite o desliga', async () => {
    const browser = fakeBrowser();
    const { applyAnalyticsConsent } = await analytics();
    applyAnalyticsConsent('G-CQ0S5G3DY9', true);
    expect(browser.win['ga-disable-G-CQ0S5G3DY9']).toBe(false);
    applyAnalyticsConsent('G-CQ0S5G3DY9', false);
    expect(browser.win['ga-disable-G-CQ0S5G3DY9']).toBe(true);
    applyAnalyticsConsent('G-CQ0S5G3DY9', true);
    expect(browser.win['ga-disable-G-CQ0S5G3DY9']).toBe(false);
  });
});

describe('o que a barra de privacidade decide', () => {
  type FakeWindow = EventTarget & { location: { pathname: string }; gtag?: unknown };

  function fakeBrowser(pathname = '/') {
    const appended: unknown[] = [];
    const win = Object.assign(new EventTarget(), { location: { pathname } }) as FakeWindow;
    vi.stubGlobal('window', win);
    vi.stubGlobal('document', {
      createElement: () => ({ src: '', async: false }),
      head: { appendChild: (node: unknown) => appended.push(node) },
    });
    const answer = (value: 'accepted' | 'rejected') =>
      win.dispatchEvent(new CustomEvent('mn:consent', { detail: value }));
    return { win, appended, answer };
  }

  it('leitor que ainda não respondeu: nada carrega', async () => {
    const browser = fakeBrowser();
    const { watchAnalyticsConsent } = await analytics();
    watchAnalyticsConsent('G-CQ0S5G3DY9', () => null);
    expect(browser.win.gtag).toBeUndefined();
    expect(browser.appended).toHaveLength(0);
  });

  it('leitor que recusou: nada carrega', async () => {
    const browser = fakeBrowser();
    const { watchAnalyticsConsent } = await analytics();
    watchAnalyticsConsent('G-CQ0S5G3DY9', () => 'rejected');
    expect(browser.appended).toHaveLength(0);
  });

  it('leitor que já tinha aceitado: carrega na hora', async () => {
    const browser = fakeBrowser();
    const { watchAnalyticsConsent } = await analytics();
    watchAnalyticsConsent('G-CQ0S5G3DY9', () => 'accepted');
    expect(browser.appended).toHaveLength(1);
  });

  it('aceitar no meio da visita liga a medição sem recarregar, e só até o unsubscribe', async () => {
    const browser = fakeBrowser();
    const { watchAnalyticsConsent } = await analytics();
    const stop = watchAnalyticsConsent('G-CQ0S5G3DY9', () => null);
    browser.answer('rejected');
    expect(browser.appended).toHaveLength(0);
    browser.answer('accepted');
    expect(browser.appended).toHaveLength(1);
    stop();
    browser.win.gtag = undefined;
    browser.answer('accepted');
    expect(browser.appended).toHaveLength(1);
  });

  it('a pré-visualização da redação nunca é medida, nem com aceite', async () => {
    const browser = fakeBrowser('/preview/manchete-ainda-nao-publicada');
    const { watchAnalyticsConsent } = await analytics();
    watchAnalyticsConsent('G-CQ0S5G3DY9', () => 'accepted');
    browser.answer('accepted');
    expect(browser.win.gtag).toBeUndefined();
    expect(browser.appended).toHaveLength(0);
  });
});
