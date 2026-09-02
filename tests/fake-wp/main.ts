#!/usr/bin/env tsx
import { SERVICE_TOKEN, SITE_ID } from '../fake-kalel/corpus';
import { startFakeKalEl } from '../fake-kalel/server';
import { startFakeWordPress } from './server';

/**
 * An import sandbox: a WordPress to read from and an empty Kal El to write to.
 *
 * `pnpm import:sandbox` brings both up and prints the environment the importer needs, so
 * a rehearsal can be run by hand — against something that enforces `externalKey`,
 * `Idempotency-Key` and `If-Match` — without touching the real archive or the real CMS.
 *
 * The automated version of the same thing is
 * `tests/integration/wp-import-end-to-end.test.ts`.
 */

const WP_PORT = Number(process.env.FAKE_WP_PORT ?? 4020);
const CMS_PORT = Number(process.env.FAKE_KALEL_PORT ?? 4021);

async function main(): Promise<void> {
  const wp = await startFakeWordPress(WP_PORT);
  const cms = await startFakeKalEl(CMS_PORT, { writable: true, empty: true });

  console.log('# import sandbox up. Export these, then run: pnpm wp:import --apply --rate 0');
  console.log(`export WP_BASE_URL=${wp.url}`);
  console.log(`export WP_ASSET_HOSTS=127.0.0.1`);
  console.log(`export KAL_EL_BASE_URL=${cms.url}`);
  console.log(`export KAL_EL_SITE_ID=${SITE_ID}`);
  console.log(`export KAL_EL_SERVICE_TOKEN=${SERVICE_TOKEN}`);
}

void main().catch((err: unknown) => {
  console.error(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
  process.exit(1);
});
