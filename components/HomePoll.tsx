'use client';

import type { Poll } from '@mn/content';
import { PollVS } from '@mn/ui';

/**
 * Client boundary for the home poll.
 *
 * Voting is intentionally not wired: there is no vote endpoint in Kal El or Cinerie yet
 * (docs/10, open question 3), so the control renders results-only rather than accepting
 * input it would silently discard. Passing `onVote` here is the single change needed
 * once the endpoint exists.
 */
export function HomePoll({ poll }: { poll: Poll }) {
  return <PollVS poll={poll} />;
}
