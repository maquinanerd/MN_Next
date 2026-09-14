'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

/**
 * LGPD consent gate.
 *
 * Editorial content never waits on this: the bar appears after hydration, at the bottom,
 * and nothing about the article depends on the answer. What does depend on it is
 * analytics, ad personalisation and third-party embeds — all off until an explicit accept.
 *
 * The default is refusal, and the two answers cost the same: one click, same weight, same
 * size. A "reject" that is harder to find than "accept" is not consent.
 */

export const CONSENT_KEY = 'mn-consent';
export type ConsentValue = 'accepted' | 'rejected';

export function readConsent(): ConsentValue | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)mn-consent=(accepted|rejected)/);
  return (match?.[1] as ConsentValue | undefined) ?? null;
}

function writeConsent(value: ConsentValue): void {
  const secure = location.protocol === 'https:' ? '; secure' : '';
  document.cookie = `${CONSENT_KEY}=${value}; path=/; max-age=15552000; samesite=lax${secure}`;
  window.dispatchEvent(new CustomEvent('mn:consent', { detail: value }));
}

const button =
  'inline-flex h-44 flex-none cursor-pointer items-center justify-center border border-ink bg-white px-20 text-13 font-bold text-ink';

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
    <div
      role="dialog"
      aria-label="Preferências de privacidade"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-white"
    >
      <div className="wrap flex flex-col gap-12 py-16 tab:flex-row tab:items-center tab:justify-between">
        <p className="m-0 max-w-[80ch] text-12 leading-[1.5] text-note">
          Usamos cookies essenciais para o funcionamento do site. Com a sua autorização, também medimos audiência e
          exibimos publicidade personalizada. Você pode mudar de ideia a qualquer momento na{' '}
          <Link href="/politica-de-privacidade" className="underline underline-offset-3">
            política de privacidade
          </Link>
          .
        </p>
        <div className="flex gap-8">
          <button type="button" className={button} onClick={() => decide('rejected')}>
            Apenas essenciais
          </button>
          <button type="button" className={button} onClick={() => decide('accepted')}>
            Aceitar todos
          </button>
        </div>
      </div>
    </div>
  );
}
