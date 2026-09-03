#!/usr/bin/env tsx
/**
 * Blocks until a URL answers, or gives up loudly.
 *
 * Exists because `next build` prerenders pages that read from the CMS: when the Kal El
 * delivery gate brings up its stand-in and its build at the same time, a build that wins
 * the race dies on `ECONNREFUSED` and Playwright reports only "webServer was not able to
 * start" — a message that names neither the port nor the reason.
 *
 *   pnpm exec tsx scripts/wait-for.ts http://127.0.0.1:4010/health [timeoutMs]
 */

const [urlArg, timeoutRaw] = process.argv.slice(2);

if (!urlArg) {
  console.error('usage: wait-for.ts <url> [timeoutMs]');
  process.exit(2);
}

const url: string = urlArg;
const timeoutMs = Number(timeoutRaw ?? 30_000);
const deadline = Date.now() + timeoutMs;

async function reachable(): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2_000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  while (Date.now() < deadline) {
    if (await reachable()) {
      console.warn(`wait-for: ${url} is up`);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  console.error(`wait-for: ${url} did not answer within ${timeoutMs}ms`);
  process.exit(1);
}

void main();
