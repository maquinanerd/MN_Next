#!/usr/bin/env tsx
import { SERVICE_TOKEN, SITE_ID } from './corpus';
import { startFakeKalEl } from './server';

/**
 * Runs the stand-in CMS as a process, so Playwright can boot the application against it
 * exactly as it would boot against the real one — same base URL shape, same bearer
 * token, same two pagination models.
 *
 * This is the only way to exercise `CONTENT_SOURCE=kalel` without credentials. Every
 * other suite runs on the fixture provider, which returns domain objects and therefore
 * never touches the DTO schemas, the mapper, the taxonomy hydration or the media proxy.
 */

const port = Number(process.env.FAKE_KALEL_PORT ?? 4010);

startFakeKalEl(port)
  .then((fake) => {
    console.log(JSON.stringify({ event: 'fake-kalel.listening', url: fake.url, siteId: SITE_ID }));
    // Printed so an operator running this by hand can copy the two values it needs.
    if (process.env.FAKE_KALEL_PRINT_ENV === '1') {
      console.log(`KAL_EL_BASE_URL=${fake.url}`);
      console.log(`KAL_EL_SITE_ID=${SITE_ID}`);
      console.log(`KAL_EL_SERVICE_TOKEN=${SERVICE_TOKEN}`);
    }
  })
  .catch((err: unknown) => {
    console.error(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
    process.exit(1);
  });
