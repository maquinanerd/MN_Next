'use client';

import { useState } from 'react';
import type { Poll } from '@mn/content';

import { MnImage, SIZES } from '../primitives/MnImage';

/**
 * The VS poll.
 *
 * Percentages are computed from counts on read - the store keeps votes, never a
 * percentage - and every percentage is printed as text next to its bar, because a bar
 * alone carries no information for a screen reader (docs/05, docs/09).
 *
 * The optimistic local increment is presentation only: the authoritative count comes
 * back from `onVote`. Without a vote endpoint the control renders as results-only rather
 * than pretending to accept input.
 */
export function PollVS({ poll, onVote }: { poll: Poll; onVote?: (optionId: string) => Promise<Poll | void> }) {
  const [current, setCurrent] = useState(poll);
  const [voted, setVoted] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  const total = Math.max(1, current.totalVotes);
  const readOnly = !onVote || current.status === 'closed';

  async function vote(optionId: string) {
    if (readOnly || voted) return;
    setVoted(optionId);
    const optimistic: Poll = {
      ...current,
      totalVotes: current.totalVotes + 1,
      options: current.options.map((o) => (o.id === optionId ? { ...o, votes: o.votes + 1 } : o)),
    };
    setCurrent(optimistic);
    const label = current.options.find((o) => o.id === optionId)?.label ?? '';
    setStatus(`Voto registrado em ${label}.`);
    try {
      const updated = await onVote?.(optionId);
      if (updated) setCurrent(updated);
    } catch {
      setCurrent(current);
      setVoted(null);
      setStatus('Não foi possível registrar o voto. Tente novamente.');
    }
  }

  const [left, right] = current.options;

  return (
    <section className="mn-poll" aria-label="Enquete">
      <div className="mn-poll__images">
        {left?.image ? (
          <span style={{ position: 'relative', display: 'block' }}>
            <MnImage image={left.image} alt="" sizes={SIZES.card} />
          </span>
        ) : (
          <span />
        )}
        {right?.image ? (
          <span style={{ position: 'relative', display: 'block' }}>
            <MnImage image={right.image} alt="" sizes={SIZES.card} />
          </span>
        ) : (
          <span />
        )}
        <span className="mn-poll__vs" aria-hidden="true">
          VS
        </span>
      </div>

      <div className="mn-poll__body">
        <fieldset className="mn-poll__fieldset">
          <legend className="mn-newsletter__title" style={{ fontSize: 'var(--fs-h4)' }}>
            {current.question}
          </legend>

          {current.options.map((option) => {
            const percent = Math.round((option.votes / total) * 100);
            return (
              <button
                key={option.id}
                type="button"
                className="mn-poll__option"
                onClick={() => vote(option.id)}
                disabled={readOnly || voted !== null}
                aria-pressed={voted === option.id}
              >
                <span className="mn-poll__optionhead">
                  <span>{option.label}</span>
                  <span>
                    {percent}% · {option.votes.toLocaleString('pt-BR')} votos
                  </span>
                </span>
                <span className="mn-meter" aria-hidden="true">
                  <span className="mn-meter__fill" style={{ width: `${percent}%` }} />
                </span>
              </button>
            );
          })}
        </fieldset>

        <p className="mn-state__text" aria-live="polite">
          {status || `${current.totalVotes.toLocaleString('pt-BR')} votos${readOnly ? ' · votação encerrada' : ''}`}
        </p>
        {current.source === 'cinerie' ? (
          <p className="mn-state__code">
            Enquete servida pelo{' '}
            <a href="https://cinerie.com/" rel="noopener">
              Cinerie
            </a>
            .
          </p>
        ) : null}
      </div>
    </section>
  );
}
