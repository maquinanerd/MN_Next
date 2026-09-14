'use client';

import { useState } from 'react';

/**
 * "‹ Compartilhar": the system share sheet where the browser has one, otherwise the link
 * is copied and the result is announced to screen readers.
 */
export function ShareChip({ titulo, url }: { titulo: string; url: string }) {
  const [status, setStatus] = useState('');

  async function share() {
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: titulo, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setStatus('Link copiado');
    } catch {
      // The reader closed the share sheet, or the clipboard was refused: nothing to report.
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={share}
        className="flex h-22 cursor-pointer items-center gap-6 border border-control bg-transparent px-10 text-10 text-muted"
      >
        ‹ Compartilhar
      </button>
      <span role="status" aria-live="polite" className="text-10 text-muted">
        {status}
      </span>
    </>
  );
}
