'use client';

import { useEffect } from 'react';
import { Editorial, ErrorState } from '@mn/ui';

/**
 * Segment error boundary.
 *
 * A Kal El outage degrades to this page - a real error state with a retry and a
 * reference an operator can search for - rather than to a blank 200, which is what the
 * charter forbids. `digest` is the server-side correlation Next already computed; the
 * underlying message never reaches the browser.
 */
export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Reported through the browser console only; the server already logged the cause
    // with its own correlation id. Nothing from `error.message` is sent anywhere.
    console.error('[mn] render error', error.digest ?? 'no-digest');
  }, [error]);

  return (
    <Editorial>
      <div style={{ paddingBlock: 64 }}>
        <ErrorState
          title="Não foi possível carregar esta página"
          description="Houve uma falha ao buscar o conteúdo. A redação já foi avisada — tente novamente em alguns instantes."
          {...(error.digest ? { correlationId: error.digest } : {})}
          retry={
            <button type="button" className="mn-button mn-button--primary" onClick={reset}>
              Tentar novamente
            </button>
          }
        />
      </div>
    </Editorial>
  );
}
