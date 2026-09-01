'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Chapter, LiveEntry } from '@mn/content';

/**
 * Chapter navigation with scroll spy.
 *
 * Keyboard reachable, `aria-current` on the visible chapter, and the observer is torn
 * down on unmount so a client transition does not leak listeners.
 */
export function ChapterNav({ chapters, activeId }: { chapters: Chapter[]; activeId?: string }) {
  const [active, setActive] = useState(activeId ?? chapters[0]?.id ?? '');

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const first = visible[0];
        if (first?.target.id) setActive(first.target.id);
      },
      { rootMargin: '-96px 0px -60% 0px', threshold: 0 },
    );
    for (const chapter of chapters) {
      const el = document.getElementById(chapter.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [chapters]);

  return (
    <nav className="mn-chapternav" aria-label="Capítulos">
      {chapters.map((chapter) => (
        <a key={chapter.id} href={`#${chapter.id}`} aria-current={active === chapter.id ? 'true' : undefined}>
          {chapter.title}
        </a>
      ))}
    </nav>
  );
}

/**
 * Live coverage.
 *
 * Polls a route handler rather than shortening the whole page's revalidate window - a
 * 15-second ISR on a full article route would rebuild everything on it. `aria-live` is
 * `polite`, never `assertive`: a live blog that interrupts a screen reader mid-sentence
 * every thirty seconds is unusable.
 */
export function LiveCoverage({
  slug,
  initialEntries,
  pollInterval = 30_000,
}: {
  slug: string;
  initialEntries: LiveEntry[];
  pollInterval?: number;
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function tick() {
      try {
        const res = await fetch(`/api/live/${encodeURIComponent(slug)}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(String(res.status));
        const json: unknown = await res.json();
        const next = (json as { entries?: LiveEntry[] }).entries;
        if (!cancelled && Array.isArray(next)) {
          setEntries(next);
          setFailed(false);
        }
      } catch {
        // A polling failure is not a page failure: keep the last good entries visible
        // and say so, rather than blanking the coverage.
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) timer = setTimeout(tick, pollInterval);
      }
    }

    timer = setTimeout(tick, pollInterval);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [slug, pollInterval]);

  return (
    <div aria-live="polite" aria-atomic="false">
      <ol className="mn-timeline" style={{ listStyle: 'none', margin: 0, padding: 0, paddingLeft: 24 }}>
        {entries.map((entry, index) => (
          <li
            className={index === 0 ? 'mn-timeline__item mn-timeline__item--latest' : 'mn-timeline__item'}
            key={entry.id}
          >
            <p className="mn-timeline__time">
              <time dateTime={entry.time}>
                {new Intl.DateTimeFormat('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'America/Sao_Paulo',
                }).format(new Date(entry.time))}
              </time>
              {index === 0 ? <span> · atualização mais recente</span> : null}
            </p>
            {entry.title ? <p className="mn-timeline__title">{entry.title}</p> : null}
            <p className="mn-timeline__text">{entry.text}</p>
          </li>
        ))}
      </ol>
      {failed ? (
        <p className="mn-state__code" role="status">
          Atualização automática indisponível no momento. Recarregue a página para ver as últimas notas.
        </p>
      ) : null}
    </div>
  );
}

export function ChapterLinks({
  chapters,
  basePath,
}: {
  chapters: { slug: string; title: string }[];
  basePath: string;
}) {
  return (
    <nav className="mn-chapternav" aria-label="Dossiês">
      {chapters.map((chapter) => (
        <Link key={chapter.slug} href={`${basePath}/${chapter.slug}`}>
          {chapter.title}
        </Link>
      ))}
    </nav>
  );
}
