import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));

/**
 * Vitest.
 *
 * `server-only` is aliased to an empty module: the guard exists to fail a *client*
 * bundle, and every test here runs on the server side by definition.
 *
 * The workspace aliases come in pairs — the bare package name and the subpath prefix —
 * because the application imports both forms (`@mn/content` and `@mn/content/env`) and
 * an exact-match-only alias silently fails to resolve the second. That is not a
 * cosmetic gap: a test file that reaches a deep import throws at collection time, so the
 * whole file reports "no tests" instead of failing, and a suite can quietly stop running
 * while the summary still looks green.
 */
const workspace = ['tokens', 'content', 'seo', 'ui'] as const;

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/**/*.test.ts'],
    reporters: ['default'],
    env: {
      NODE_ENV: 'test',
      APP_ENV: 'test',
      CONTENT_SOURCE: 'fixture',
      NEXT_PUBLIC_SITE_URL: 'https://www.maquinanerd.com.br',
      LOG_LEVEL: 'silent',
    },
  },
  resolve: {
    alias: [
      { find: 'server-only', replacement: path.join(root, 'tests/stubs/server-only.ts') },
      ...workspace.flatMap((name) => [
        { find: `@mn/${name}/`, replacement: path.join(root, 'packages', name, 'src') + '/' },
        { find: `@mn/${name}`, replacement: path.join(root, 'packages', name, 'src/index.ts') },
      ]),
    ],
  },
});
