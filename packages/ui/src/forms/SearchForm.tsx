'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';

import { SearchIcon } from '../primitives/misc';

/**
 * Search box.
 *
 * A real form that pushes `?q=`, so the result is a shareable, bookmarkable URL and the
 * back button works. Debounced type-ahead is deliberately absent: the search route is
 * `no-store` and every keystroke would be an uncached round trip to the CMS.
 */
export function SearchForm() {
  const router = useRouter();
  const params = useSearchParams();
  const fieldId = useId();
  const [value, setValue] = useState(params.get('q') ?? '');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = value.trim();
    router.push(query ? `/busca?q=${encodeURIComponent(query)}` : '/busca');
  }

  return (
    <form className="mn-searchform" onSubmit={submit} role="search">
      <div className="mn-field">
        <label htmlFor={fieldId}>Buscar no Máquina Nerd</label>
        <input
          id={fieldId}
          name="q"
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Filmes, séries, quadrinhos…"
          maxLength={120}
        />
      </div>
      <button className="mn-button mn-button--primary" type="submit">
        <SearchIcon />
        Buscar
      </button>
    </form>
  );
}
