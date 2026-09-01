'use client';

import { useState } from 'react';

/**
 * Share controls.
 *
 * 44px targets around 17-20px glyphs (padding, not bigger icons), one `aria-label` per
 * channel, and the copy confirmation announced through `aria-live="polite"` - a visual
 * "copiado!" alone tells a screen-reader user nothing (docs/09).
 */

export type ShareChannel = 'facebook' | 'x' | 'whatsapp' | 'copy';

const ICONS: Record<
  Exclude<ShareChannel, 'copy'>,
  { label: string; href: (u: string, t: string) => string; path: string }
> = {
  facebook: {
    label: 'Compartilhar no Facebook',
    href: (u) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}`,
    path: 'M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5H16.6V4.4A19 19 0 0 0 14.4 4.3c-2.3 0-3.9 1.4-3.9 4v2.2H8v3h2.5V21z',
  },
  x: {
    label: 'Compartilhar no X',
    href: (u, t) => `https://x.com/intent/post?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}`,
    path: 'M17.6 3h3.2l-7 8 8.2 10h-6.4l-5-6.1L4.8 21H1.6l7.5-8.6L1.2 3h6.6l4.5 5.6zM16.5 19.2h1.8L7.6 4.7H5.7z',
  },
  whatsapp: {
    label: 'Compartilhar no WhatsApp',
    href: (u, t) => `https://api.whatsapp.com/send?text=${encodeURIComponent(`${t} ${u}`)}`,
    path: 'M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2zm5.1 14.1c-.2.6-1.2 1.2-1.7 1.2-.4 0-1 .1-3.1-.8-2.6-1.1-4.2-3.8-4.4-4-.1-.2-1-1.4-1-2.6s.6-1.8.9-2c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.3.5-.3.3c-.1.1-.2.3 0 .5.1.3.6 1.1 1.4 1.8 1 .9 1.8 1.1 2 1.2.2.1.4.1.5-.1l.7-.9c.2-.2.3-.2.5-.1l1.9.9c.2.1.4.2.4.3.1.1.1.6-.1 1.2z',
  },
};

export function ShareBar({
  url,
  title,
  channels = ['facebook', 'x', 'whatsapp', 'copy'],
}: {
  url: string;
  title: string;
  channels?: ShareChannel[];
}) {
  const [status, setStatus] = useState('');

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setStatus('Link copiado.');
    } catch {
      setStatus('Não foi possível copiar. Use o endereço da barra do navegador.');
    }
    window.setTimeout(() => setStatus(''), 4000);
  }

  return (
    <div className="mn-share">
      {channels.map((channel) => {
        if (channel === 'copy') {
          return (
            <button
              key="copy"
              type="button"
              className="mn-share__link"
              onClick={copy}
              aria-label="Copiar link da matéria"
            >
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <rect x="9" y="9" width="11" height="11" rx="2.4" />
                <path d="M5 15V6a2 2 0 0 1 2-2h9" />
              </svg>
            </button>
          );
        }
        const icon = ICONS[channel];
        return (
          <a
            key={channel}
            className="mn-share__link"
            href={icon.href(url, title)}
            aria-label={icon.label}
            rel="noopener noreferrer nofollow"
            target="_blank"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d={icon.path} />
            </svg>
          </a>
        );
      })}
      <span className="mn-share__status" aria-live="polite">
        {status}
      </span>
    </div>
  );
}
