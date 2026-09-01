'use client';

import { useId, useRef, useState } from 'react';

/**
 * Newsletter sign-up.
 *
 * A visible `<label>` (not a placeholder), the error bound with `aria-describedby`, and
 * focus moved to the field on an invalid submit - the three things the a11y doc names
 * for this form. Validation runs client-side for speed and again on the server, which is
 * the only side that is trusted.
 *
 * Never rendered as an interstitial over the article: Discover treats that as an
 * intrusive interstitial (docs/06).
 */
export function NewsletterForm({ variant = 'dark' }: { variant?: 'dark' | 'light' }) {
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = inputRef.current?.value.trim() ?? '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
      setError('Informe um e-mail válido, como nome@exemplo.com.');
      inputRef.current?.focus();
      return;
    }
    setError('');
    setPending(true);
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: value }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setDone(true);
    } catch {
      setError('Não foi possível concluir a inscrição agora. Tente novamente em alguns minutos.');
      inputRef.current?.focus();
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <p role="status" className="mn-state__text">
        Inscrição registrada. Confira sua caixa de entrada para confirmar o e-mail.
      </p>
    );
  }

  return (
    <form className="mn-newsletter__form" onSubmit={submit} noValidate>
      <div className="mn-field">
        <label htmlFor={fieldId}>E-mail</label>
        <input
          ref={inputRef}
          id={fieldId}
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="nome@exemplo.com"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          style={variant === 'light' ? { background: 'var(--mn-bg)', borderColor: 'var(--mn-line)' } : undefined}
        />
        {error ? (
          <p className="mn-field__error" id={errorId}>
            {error}
          </p>
        ) : null}
      </div>
      <button type="submit" className="mn-button mn-button--primary" disabled={pending}>
        {pending ? 'Enviando…' : 'Assinar'}
      </button>
    </form>
  );
}
