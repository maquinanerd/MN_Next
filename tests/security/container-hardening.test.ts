import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The restrictions the portal's production container runs under, added after the
 * November 2026 intrusion (docs/migration/INCIDENTE-2026-11.md). A compose edit that drops
 * one of them would deploy silently: Coolify accepts the file either way. The CI image job
 * proves they hold at run time; this proves they are still asked for.
 */

const compose = readFileSync(path.join(process.cwd(), 'docker-compose.coolify.yml'), 'utf8');
const portal = compose.slice(compose.indexOf('\n  portal:'), compose.indexOf('\nvolumes:'));

describe('the Coolify container of the portal', () => {
  it('runs on a read-only root, with nowhere to execute a dropped binary', () => {
    expect(portal).toMatch(/^ {4}read_only: true$/m);
    expect(portal).toMatch(/^ {6}- \/tmp:rw,noexec,nosuid,nodev,size=\d+m,mode=1777$/m);
    expect(portal).toMatch(/^ {6}- \/var\/tmp:rw,noexec,nosuid,nodev,size=\d+m,mode=1777$/m);
  });

  it('holds no capability and cannot gain privileges', () => {
    expect(portal).toMatch(/^ {4}cap_drop:\n {6}- ALL$/m);
    expect(portal).toMatch(/^ {6}- no-new-privileges:true$/m);
  });

  it('reaps orphans and caps processes, CPU and memory in one place', () => {
    expect(portal).toMatch(/^ {4}init: true$/m);
    // Compose refuses `pids_limit` beside `deploy.resources.limits` ("can't set distinct
    // values"): the first deploy of this hardening failed on exactly that.
    expect(portal).not.toMatch(/^ {4}pids_limit:/m);
    expect(portal).toMatch(
      /^ {4}deploy:\n {6}resources:\n {8}limits:\n {10}cpus: '[\d.]+'\n {10}memory: \d+M\n {10}pids: \d+$/m,
    );
  });

  it('keeps the heap inside the memory limit, with room for sharp', () => {
    const heap = Number(/--max-old-space-size=(\d+)/.exec(portal)?.[1]);
    const memory = Number(/^ {10}memory: (\d+)M$/m.exec(portal)?.[1]);
    expect(heap).toBeGreaterThanOrEqual(512);
    expect(heap).toBeLessThanOrEqual(memory / 2);
  });
});
