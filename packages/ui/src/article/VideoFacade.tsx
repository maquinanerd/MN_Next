'use client';

import { useState } from 'react';

/**
 * Video behind a click-to-load facade.
 *
 * A YouTube iframe costs about a megabyte and sets third-party cookies; neither may happen
 * on first paint or before the reader asks for it. The facade reserves 16:9 so loading the
 * player shifts nothing, and the frame is only created after a deliberate click. Only the
 * two players the CSP allows (`youtube-nocookie`, Vimeo) are ever framed.
 */
export function VideoFacade({ provedor, id, titulo }: { provedor: 'youtube' | 'vimeo'; id: string; titulo: string }) {
  const [active, setActive] = useState(false);
  const src =
    provedor === 'youtube'
      ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1`
      : `https://player.vimeo.com/video/${encodeURIComponent(id)}?autoplay=1`;
  const service = provedor === 'youtube' ? 'YouTube' : 'Vimeo';

  if (active) {
    return (
      <div className="relative aspect-video overflow-hidden rounded-mn bg-ink">
        <iframe
          src={src}
          title={titulo}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 size-full border-0"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setActive(true)}
      className="relative flex aspect-video w-full cursor-pointer flex-col items-center justify-center gap-12 overflow-hidden rounded-mn border-0 bg-ink p-20 text-center text-white"
    >
      <span aria-hidden="true" className="flex size-48 items-center justify-center rounded-full bg-white/30">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" focusable="false">
          <path d="M8 5l12 7-12 7z" />
        </svg>
      </span>
      <span className="text-14 font-bold">Assistir: {titulo}</span>
      <span className="text-11 text-white/70">
        O vídeo é carregado do {service} e pode registrar dados de navegação.
      </span>
    </button>
  );
}
