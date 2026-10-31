import { createElement, type ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OpaPrecoAd } from '../../packages/ui/src/ads/OpaPrecoAd';
import { opaPrecoEnabled, opaPrecoEndpoint } from '../../packages/ui/src/ads/opapreco';

/**
 * OpaPreço Ads on the portal: the slot markup OpaPreço's script reads, the switch that
 * turns it off without a code change, and the two things that would silently cost the
 * ads — a Content-Security-Policy that blocks them, and an endpoint a typo could send
 * somewhere else.
 */

const ENV_KEYS = [
  'NEXT_PUBLIC_OPAPRECO_ADS_ENABLED',
  'NEXT_PUBLIC_OPAPRECO_ADS_ENDPOINT',
  // Zerado também: com o id do GA4 no ambiente, a CSP ganharia os curingas de coleta dele, e
  // o "sem curinga" abaixo passaria a depender do shell de quem roda o teste.
  'NEXT_PUBLIC_GA_MEASUREMENT_ID',
] as const;

function withEnv(values: Partial<Record<(typeof ENV_KEYS)[number], string>>) {
  for (const key of ENV_KEYS) vi.stubEnv(key, values[key] ?? '');
}

afterEach(() => {
  vi.unstubAllEnvs();
});

// Both read the environment when called, so a stub applies without reloading the module.
function render(props: ComponentProps<typeof OpaPrecoAd>) {
  return renderToStaticMarkup(createElement(OpaPrecoAd, props));
}

describe('configuração do OpaPreço Ads', () => {
  it('liga sem variável nenhuma, e só a palavra false desliga', () => {
    withEnv({});
    expect(opaPrecoEnabled()).toBe(true);
    for (const off of ['false', 'FALSE', ' false ']) {
      withEnv({ NEXT_PUBLIC_OPAPRECO_ADS_ENABLED: off });
      expect(opaPrecoEnabled(), off).toBe(false);
    }
    for (const on of ['true', '1', 'sim']) {
      withEnv({ NEXT_PUBLIC_OPAPRECO_ADS_ENABLED: on });
      expect(opaPrecoEnabled(), on).toBe(true);
    }
  });

  it('pede os anúncios a https://opapreco.com.br, a menos que outra origem https seja dada', () => {
    withEnv({});
    expect(opaPrecoEndpoint()).toBe('https://opapreco.com.br');
    withEnv({ NEXT_PUBLIC_OPAPRECO_ADS_ENDPOINT: 'https://staging.opapreco.com.br/qualquer/caminho' });
    expect(opaPrecoEndpoint()).toBe('https://staging.opapreco.com.br');
  });

  it('aceita http só no loopback, e um valor torto volta ao padrão', () => {
    withEnv({ NEXT_PUBLIC_OPAPRECO_ADS_ENDPOINT: 'http://127.0.0.1:4100' });
    expect(opaPrecoEndpoint()).toBe('http://127.0.0.1:4100');
    for (const bad of ['http://opapreco.com.br', 'javascript:alert(1)', 'opapreco.com.br', 'ftp://x']) {
      withEnv({ NEXT_PUBLIC_OPAPRECO_ADS_ENDPOINT: bad });
      expect(opaPrecoEndpoint(), bad).toBe('https://opapreco.com.br');
    }
  });
});

describe('OpaPrecoAd', () => {
  it('desenha o <op-slot> com a chave do site, o slot e o contexto da matéria', () => {
    withEnv({});
    const html = render({
      slot: 'article-inline-01',
      contexto: { secao: 'games', tags: ['ps5', 'ssd'], conteudo: 'post-48213' },
      className: 'my-32',
    });
    expect(html).toBe(
      '<div class="mn-op my-32"><op-slot slot-key="article-inline-01" site-key="maquina-nerd" ' +
        'endpoint="https://opapreco.com.br" section="games" tags="ps5,ssd" content-id="post-48213"></op-slot></div>',
    );
  });

  it('não escreve atributo vazio quando a página não tem contexto', () => {
    withEnv({});
    const html = render({ slot: 'sidebar', contexto: { tags: [] } });
    expect(html).toBe(
      '<div class="mn-op"><op-slot slot-key="sidebar" site-key="maquina-nerd" endpoint="https://opapreco.com.br"></op-slot></div>',
    );
  });

  it('não envolve o slot em link, nem leva nada do leitor', () => {
    withEnv({});
    const html = render({ slot: 'article-top', contexto: { secao: 'cinema', conteudo: '1' } });
    expect(html).not.toMatch(/<a\b|href=|cookie|mode=/i);
  });

  it('não desenha nada com NEXT_PUBLIC_OPAPRECO_ADS_ENABLED=false', () => {
    withEnv({ NEXT_PUBLIC_OPAPRECO_ADS_ENABLED: 'false' });
    expect(render({ slot: 'article-top' })).toBe('');
  });
});

describe('Content-Security-Policy', () => {
  async function policy(values: Partial<Record<(typeof ENV_KEYS)[number], string>>) {
    withEnv(values);
    vi.resetModules();
    const nextConfig = (await import('../../next.config')).default;
    const headers = await nextConfig.headers!();
    return headers.flatMap((h) => h.headers).find((h) => h.key === 'Content-Security-Policy')!.value;
  }

  const directive = (csp: string, name: string) => csp.split('; ').find((d) => d.startsWith(`${name} `)) ?? '';

  it('libera o OpaPreço onde o anúncio precisa: script, estilo, pedido e beacons, imagens', async () => {
    const csp = await policy({});
    for (const name of ['script-src', 'style-src', 'connect-src', 'img-src']) {
      expect(directive(csp, name), name).toContain('https://opapreco.com.br');
    }
    // A foto do produto pode vir do CDN da Shopee, e só a foto.
    expect(directive(csp, 'img-src')).toContain('https://cf.shopee.com.br');
    for (const name of ['script-src', 'style-src', 'connect-src']) {
      expect(directive(csp, name), name).not.toContain('shopee');
    }
    // Nada além disso: nem frame, nem curinga, e o resto da política continua de pé.
    expect(directive(csp, 'frame-src')).not.toContain('opapreco');
    expect(csp).not.toContain('*');
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("default-src 'self'");
  });

  it('não cita o OpaPreço num build com os anúncios desligados', async () => {
    const csp = await policy({ NEXT_PUBLIC_OPAPRECO_ADS_ENABLED: 'false' });
    expect(csp).not.toContain('opapreco');
    expect(csp).not.toContain('shopee');
    expect(directive(csp, 'style-src')).toBe("style-src 'self' 'unsafe-inline'");
  });
});
