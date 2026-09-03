import { defineConfig, devices } from '@playwright/test';

/**
 * The Kal El delivery gate.
 *
 * Everything else in this repository runs on the fixture provider, which hands the routes
 * finished domain objects. That is right for the visual audit — same corpus everywhere —
 * but it means the DTO schemas, the mapper, the taxonomy hydration, the cursor/offset
 * pagination split and the authenticated media proxy are never exercised by a real page
 * render. Until they are, "the Kal El integration works" is a claim about the design.
 *
 * This config boots two servers: a contract-faithful stand-in CMS
 * (`tests/fake-kalel/`), and the application in `CONTENT_SOURCE=kalel` pointed at it with
 * a bearer token. One viewport, no screenshots — this gate is about whether the content
 * path works at all, not about how it looks.
 */

const CMS_PORT = Number(process.env.FAKE_KALEL_PORT ?? 4010);
const APP_PORT = Number(process.env.PLAYWRIGHT_KALEL_PORT ?? 3101);
const baseURL = `http://127.0.0.1:${APP_PORT}`;

export default defineConfig({
  testDir: './tests/kalel',
  outputDir: './artifacts/playwright-kalel',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: { baseURL, trace: 'retain-on-failure', locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' },
  projects: [{ name: 'kalel', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } }],
  webServer: [
    {
      // `node --import tsx` rather than `pnpm exec tsx`: the pnpm shim is an extra
      // process between Playwright and the server, and on Windows Playwright loses track
      // of the real one — it reports the CMS as up, then the build a minute later dies on
      // ECONNREFUSED against a port nothing is listening on any more.
      command: `node --import tsx tests/fake-kalel/main.ts`,
      url: `http://127.0.0.1:${CMS_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: { FAKE_KALEL_PORT: String(CMS_PORT) },
    },
    {
      /*
       * Waits for the stand-in CMS before building.
       *
       * Playwright brings both entries up together, and `next build` prerenders article
       * pages — so a build that starts a second too early fails on `ECONNREFUSED` and the
       * whole gate reports "webServer was not able to start", which says nothing about
       * the cause. The poll makes the dependency explicit instead of hoping for ordering.
       */
      command: `pnpm exec tsx scripts/wait-for.ts http://127.0.0.1:${CMS_PORT}/health && pnpm build && pnpm start --port ${APP_PORT}`,
      url: `${baseURL}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
      env: {
        APP_ENV: 'test',
        // The whole point of this configuration.
        CONTENT_SOURCE: 'kalel',
        KAL_EL_BASE_URL: `http://127.0.0.1:${CMS_PORT}`,
        KAL_EL_SITE_ID: '11111111-2222-4333-8444-555566667777',
        KAL_EL_SERVICE_TOKEN: 'ke_st.fake0000000000000000000000000000',
        KAL_EL_PREVIEW_SECRET: 'playwright-preview-secret-000000000000',
        KAL_EL_WEBHOOK_SECRET: 'playwright-webhook-secret-000000000000',
        // The URL this gate actually serves from, not a production-looking stand-in.
        // The preview grant cookie is `Secure`, derived from this value: declare https
        // while serving http and the browser silently drops the cookie, every preview
        // 404s, and the failure looks like a broken redemption rather than a mismatched
        // scheme. The fixture suite declares a production host because it asserts
        // canonicals and robots; this one asserts the content path instead.
        NEXT_PUBLIC_SITE_URL: baseURL,
        LOG_LEVEL: 'warn',
      },
    },
  ],
});
