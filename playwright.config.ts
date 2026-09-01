import { defineConfig, devices } from '@playwright/test';

/**
 * Browser gates.
 *
 * Runs against a real production build in fixture mode, which is the only way the visual
 * audit is reproducible: the same corpus, the same images, the same ordering on every
 * machine. `APP_ENV=test` is what permits the fixture provider — production refuses it.
 *
 * The four projects are the four viewports the Definition of Done names (390 / 768 /
 * 1024 / 1440). Tests tagged `@visual` compare screenshots; everything else asserts
 * behaviour and accessibility, and runs on desktop only unless it is tagged `@responsive`.
 */

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './artifacts/playwright',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [['github'], ['html', { outputFolder: 'artifacts/playwright-report', open: 'never' }]]
    : [['list']],
  timeout: 30_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      // Font rasterisation differs between machines; this tolerance catches layout
      // regressions without failing on sub-pixel text rendering.
      maxDiffPixelRatio: 0.02,
      animations: 'disabled',
    },
  },
  snapshotPathTemplate: 'tests/e2e/__screenshots__/{testFilePath}/{arg}-{projectName}{ext}',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  },
  projects: [
    { name: 'desktop-1440', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'laptop-1024', use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 900 } } },
    { name: 'tablet-768', use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } } },
    {
      name: 'mobile-390',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: false },
    },
  ],
  webServer: {
    command: `pnpm build && pnpm start --port ${PORT}`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      APP_ENV: 'test',
      CONTENT_SOURCE: 'fixture',
      // A production-like canonical host, so robots.txt, canonicals and the sitemaps
      // render the shape they will have in production. The server still listens on
      // 127.0.0.1; only the declared site URL differs.
      NEXT_PUBLIC_SITE_URL: 'https://www.maquinanerd.test',
      LOG_LEVEL: 'warn',
      KAL_EL_PREVIEW_SECRET: 'playwright-preview-secret-000000000000',
      KAL_EL_WEBHOOK_SECRET: 'playwright-webhook-secret-000000000000',
    },
  },
});
