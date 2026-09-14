import { SearchIcon } from '../primitives/icons';

/**
 * Search box: a plain GET form, so it works without JavaScript and every result is a
 * shareable URL. No type-ahead — search is `no-store`, and a keystroke would be an
 * uncached round trip to the CMS.
 */
export function SearchForm({ action, defaultValue = '' }: { action: string; defaultValue?: string }) {
  return (
    <form role="search" action={action} method="get" className="flex flex-col gap-8">
      <label htmlFor="busca-q" className="text-12 font-semibold">
        Buscar no Máquina Nerd
      </label>
      <div className="flex gap-8">
        <input
          id="busca-q"
          name="q"
          type="search"
          defaultValue={defaultValue}
          maxLength={120}
          placeholder="Filmes, séries, quadrinhos…"
          className="h-44 min-w-0 flex-1 border border-control bg-white px-14 text-14 text-ink placeholder:text-muted"
        />
        <button
          type="submit"
          className="inline-flex h-44 cursor-pointer items-center gap-8 border border-mn-red bg-mn-red px-20 text-13 font-bold text-white"
        >
          <SearchIcon size={14} />
          Buscar
        </button>
      </div>
    </form>
  );
}
