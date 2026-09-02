'use client';

import { useEffect } from 'react';

/**
 * Root layout error boundary.
 *
 * `error.tsx` sits *inside* the root layout, so it cannot catch a failure of the layout
 * itself — a bad font load, a provider that throws, a token module that fails to
 * evaluate. Without this file that case falls through to Next's built-in error page:
 * unstyled, in English, with no reference number for whoever is on call.
 *
 * It replaces the whole document, which is why it carries its own `<html>` and inlines
 * its styles: at this point neither the layout nor the stylesheet can be assumed to have
 * loaded. The palette is the brand's, written literally here for that reason and nowhere
 * else — this is the one file that cannot depend on the token layer existing.
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
          color: '#16181d',
          fontFamily: 'Figtree, system-ui, -apple-system, "Segoe UI", sans-serif',
        }}
      >
        <main style={{ maxWidth: 520, textAlign: 'center' }}>
          <p
            style={{
              display: 'inline-block',
              margin: '0 0 16px',
              padding: '4px 10px',
              borderRadius: 4,
              background: '#e30613',
              color: '#ffffff',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            Máquina Nerd
          </p>
          <h1 style={{ margin: '0 0 12px', fontSize: 24, lineHeight: 1.25 }}>O site está fora do ar</h1>
          <p style={{ margin: '0 0 24px', fontSize: 16, lineHeight: 1.6, color: '#5f646c' }}>
            Houve uma falha grave ao montar a página. A equipe já foi avisada — tente novamente em alguns instantes.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              minHeight: 44,
              padding: '0 20px',
              border: '1px solid #b00710',
              borderRadius: 4,
              background: '#e30613',
              color: '#ffffff',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Tentar novamente
          </button>
          {error.digest ? (
            <p style={{ marginTop: 24, fontSize: 13, color: '#5f646c' }}>
              Referência: <code>{error.digest}</code>
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
