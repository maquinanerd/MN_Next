'use client';

import { useEffect } from 'react';

/**
 * Root layout error boundary. `error.tsx` sits inside the root layout and cannot catch a
 * failure of the layout itself, so this replaces the whole document — which is why it has
 * its own `<html>` and inline styles: neither the layout nor the stylesheet can be assumed
 * to have loaded. The brand values are written literally for that reason, and only here.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[mn] root error', error.digest ?? 'no-digest');
  }, [error]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: 24,
          background: '#ffffff',
          color: '#111214',
          fontFamily: "Montserrat, 'Helvetica Neue', Arial, sans-serif",
        }}
      >
        <main style={{ maxWidth: 520 }}>
          <p style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 700, color: '#6b6b6b' }}>Máquina Nerd</p>
          <h1
            style={{ margin: '0 0 12px', fontSize: 28, lineHeight: 1.12, fontWeight: 800, letterSpacing: '-0.035em' }}
          >
            O site está fora do ar
          </h1>
          <p style={{ margin: '0 0 24px', fontSize: 15, lineHeight: 1.5, color: '#5f5f5f' }}>
            Houve uma falha grave ao montar a página. Tente novamente em alguns instantes.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              minHeight: 44,
              padding: '0 20px',
              border: '1px solid #e30613',
              background: '#e30613',
              color: '#ffffff',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Tentar novamente
          </button>
          {error.digest ? (
            <p style={{ marginTop: 24, fontSize: 12, color: '#6b6b6b' }}>
              Referência: <code>{error.digest}</code>
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
