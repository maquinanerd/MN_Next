'use client';

import { useState } from 'react';
import type { EmbedProvider } from '@mn/content';

import { PlayIcon } from '../primitives/misc';

/**
 * Social and video embeds behind a click-to-load facade.
 *
 * A YouTube iframe costs roughly a megabyte and an X embed executes third-party script;
 * neither may run on first paint (docs/08). The facade reserves 16:9, so activating it
 * shifts nothing, and the third-party frame is only created after a deliberate click -
 * which also means no third-party cookie is set before consent.
 */

const LABEL: Record<EmbedProvider, string> = {
  youtube: 'vídeo do YouTube',
  vimeo: 'vídeo do Vimeo',
  x: 'publicação no X',
  instagram: 'publicação no Instagram',
  tiktok: 'vídeo do TikTok',
  spotify: 'áudio do Spotify',
};

function frameSrc(provider: EmbedProvider, url: string, embedId?: string): string | null {
  try {
    const parsed = new URL(url);
    switch (provider) {
      case 'youtube': {
        const id = embedId ?? parsed.searchParams.get('v') ?? parsed.pathname.replace(/^\//, '');
        return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1` : null;
      }
      case 'vimeo': {
        const id = embedId ?? parsed.pathname.split('/').filter(Boolean).pop();
        return id ? `https://player.vimeo.com/video/${encodeURIComponent(id)}?autoplay=1` : null;
      }
      default:
        // X, Instagram, TikTok and Spotify require their own scripts. Rather than load a
        // third-party bundle, the facade links out - honest and cheap.
        return null;
    }
  } catch {
    return null;
  }
}

export function EmbedBlock({ provider, url, embedId }: { provider: EmbedProvider; url: string; embedId?: string }) {
  const [active, setActive] = useState(false);
  const src = frameSrc(provider, url, embedId);
  const label = LABEL[provider] ?? 'conteúdo incorporado';

  if (active && src) {
    return (
      <div className="mn-embed">
        <iframe
          src={src}
          title={`Reprodutor de ${label}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div className="mn-embed">
      {src ? (
        <button type="button" className="mn-embed__facade" onClick={() => setActive(true)}>
          <span className="mn-embed__play" aria-hidden="true">
            <PlayIcon size={26} />
          </span>
          <span>Carregar {label}</span>
          <span className="mn-embed__hint">
            O conteúdo é carregado de um serviço externo e pode registrar dados de navegação.
          </span>
        </button>
      ) : (
        <div className="mn-embed__facade">
          <span>Conteúdo publicado no {provider}</span>
          <a className="mn-button" href={url} rel="noopener noreferrer nofollow" target="_blank">
            Abrir {label}
          </a>
          <span className="mn-embed__hint">Abre em uma nova aba, fora do Máquina Nerd.</span>
        </div>
      )}
    </div>
  );
}
