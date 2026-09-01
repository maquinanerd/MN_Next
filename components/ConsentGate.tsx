'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

/**
 * LGPD consent gate.
 *
 * Editorial content never waits on this: the banner is rendered after hydration, below
 * everything else, and nothing about the article depends on the answer. What *does*
 * depend on it is analytics, ad personalisation, non-essential RUM and third-party
 * embeds - all of which stay off until an explicit accept.
 *
 * The default is refusal. A banner whose "reject" costs more clicks than its "accept"
 * is not consent, so both buttons are one click and equally prominent.
 */

export const CONSENT_KEY = 'mn-consent';
export type ConsentValue = 'accepted' | 'rejected';

export function readConsent(): ConsentValue | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)mn-consent=(accepted|rejected)/);
  return (match?.[1] as ConsentValue | undefined) ?? null;
}

function writeConsent(value: ConsentValue): void {
  // Secure wherever the page itself is secure: a consent choice is not a credential,
  // but there is no reason to let it travel in the clear on an https origin.
  const secure = location.protocol === 'https:' ? '; secure' : '';
  document.cookie = `${CONSENT_KEY}=${value}; path=/; max-age=15552000; samesite=lax${secure}`;
  window.dispatchEvent(new CustomEvent('mn:consent', { detail: value }));
}

export function ConsentGate() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (readConsent() === null) setVisible(true);
  }, []);

  if (!visible) return null;

  function decide(value: ConsentValue) {
    writeConsent(value);
    setVisible(false);
  }

  return (
    <div className="mn-consent" role="dialog" aria-label="Preferências de privacidade" aria-live="polite">
      <p className="mn-consent__text">
        Usamos cookies essenciais para o funcionamento do site. Com a sua autorização, também medimos audiência e
        exibimos publicidade personalizada. Você pode mudar de ideia a qualquer momento na{' '}
        <Link href="/politica-de-privacidade">política de privacidade</Link>.
      </p>
      <div className="mn-consent__actions">
        <button type="button" className="mn-button" onClick={() => decide('rejected')}>
          Apenas essenciais
        </button>
        <button type="button" className="mn-button mn-button--primary" onClick={() => decide('accepted')}>
          Aceitar todos
        </button>
      </div>
    </div>
  );
}
