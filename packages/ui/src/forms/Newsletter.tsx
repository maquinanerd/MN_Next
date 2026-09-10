'use client';

import { useId, useRef, useState } from 'react';

/**
 * Newsletter sign-up: a visible label (not a placeholder), the error bound with
 * `aria-describedby`, focus returned to the field on an invalid submit. The server
 * validates again and is the only side trusted. It is never an interstitial.
 *
 * It promises nothing about frequency or contents: the kit forbids inventing either.
 */
export function NewsletterForm({ endpoint }: { endpoint: string }) {
  const fieldId = useId();
  const errorId = `${fieldId}-erro`;
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
      const res = await fetch(endpoint, {
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
      <p role="status" className="m-0 text-14 leading-[1.5]">
        Inscrição registrada. Confira sua caixa de entrada para confirmar o e-mail.
      </p>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-8">
      <label htmlFor={fieldId} className="text-12 font-semibold">
        E-mail
      </label>
      <div className="flex flex-col gap-8 tab:flex-row">
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
          className="h-44 min-w-0 flex-1 border border-control bg-white px-14 text-14 text-ink placeholder:text-muted"
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-44 cursor-pointer items-center justify-center border border-mn-red bg-mn-red px-20 text-13 font-bold text-white disabled:opacity-70"
        >
          {pending ? 'Enviando…' : 'Inscrever-se'}
        </button>
      </div>
      {error ? (
        <p id={errorId} className="m-0 text-12 text-mn-red-text">
          {error}
        </p>
      ) : null}
    </form>
  );
}
