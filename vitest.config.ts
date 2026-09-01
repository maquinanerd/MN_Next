import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));

/**
 * Vitest.
 *
 * `server-only` is aliased to an empty module: the guard exists to fail a *client*
 * bundle, and every test here runs on the server side by definition.
 */
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
    alias: {
      'server-only': path.join(root, 'tests/stubs/server-only.ts'),
      '@mn/tokens': path.join(root, 'packages/tokens/src/index.ts'),
      '@mn/content': path.join(root, 'packages/content/src/index.ts'),
      '@mn/seo': path.join(root, 'packages/seo/src/index.ts'),
      '@mn/ui': path.join(root, 'packages/ui/src/index.ts'),
    },
  },
});
