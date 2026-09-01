import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Shared CLI plumbing for the WordPress migration tools.
 *
 * Three rules every tool here obeys:
 *   1. `--help` always works and always exits 0;
 *   2. nothing writes to Kal El without `--apply` - the default is a dry run;
 *   3. a failure exits non-zero with a structured summary, so CI can gate on it.
 */

export interface FlagSpec {
  name: string;
  description: string;
  type: 'string' | 'number' | 'boolean';
  default?: string | number | boolean;
}

export interface ParsedArgs {
  values: Record<string, string | number | boolean | undefined>;
  positionals: string[];
}

export function parseArgs(argv: string[], specs: FlagSpec[]): ParsedArgs {
  const byName = new Map(specs.map((s) => [s.name, s]));
  const values: Record<string, string | number | boolean | undefined> = {};
  for (const spec of specs) if (spec.default !== undefined) values[spec.name] = spec.default;
  const positionals: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] as string;
    if (!arg.startsWith('--')) {
      positionals.push(arg);
      continue;
    }
    const [rawName, inlineValue] = arg.slice(2).split('=');
    const name = rawName as string;
    const spec = byName.get(name);
    if (!spec) throw new CliError(`unknown flag --${name}`);
    if (spec.type === 'boolean') {
      values[name] = inlineValue === undefined ? true : inlineValue === 'true';
      continue;
    }
    const value = inlineValue ?? argv[++i];
    if (value === undefined) throw new CliError(`--${name} requires a value`);
    values[name] = spec.type === 'number' ? Number(value) : value;
  }
  return { values, positionals };
}

export class CliError extends Error {}

export function printHelp(command: string, summary: string, specs: FlagSpec[]): void {
  const lines = [
    `${command} — ${summary}`,
    '',
    'Flags:',
    ...specs.map((s) => {
      const def = s.default === undefined ? '' : `  (default: ${String(s.default)})`;
      return `  --${s.name.padEnd(20)} ${s.description}${def}`;
    }),
    '  --help                 show this message',
    '',
    'Nothing is written to Kal El unless --apply is passed.',
  ];
  console.log(lines.join('\n'));
}

export const COMMON_FLAGS: FlagSpec[] = [
  { name: 'apply', description: 'perform writes; without it the run is a dry run', type: 'boolean', default: false },
  { name: 'limit', description: 'maximum records to process', type: 'number', default: 0 },
  { name: 'since', description: 'ISO date; only records modified after it', type: 'string' },
  { name: 'resume', description: 'resume from the checkpoint in the state file', type: 'boolean', default: false },
  {
    name: 'state',
    description: 'path to the run state file',
    type: 'string',
    default: 'artifacts/migration/state.json',
  },
  { name: 'out', description: 'directory for reports and artefacts', type: 'string', default: 'artifacts/migration' },
  { name: 'rate', description: 'requests per second against the source', type: 'number', default: 4 },
  { name: 'help', description: 'show this message', type: 'boolean', default: false },
];

/**
 * Tallies for the run summary.
 *
 * A plain `Record<string, number>` reads as `number | undefined` at every index under
 * `noUncheckedIndexedAccess`, which turns each increment into a nullish dance that
 * obscures what is being counted.
 */
export class Counter {
  private readonly values = new Map<string, number>();

  constructor(keys: string[] = []) {
    for (const key of keys) this.values.set(key, 0);
  }

  inc(key: string, by = 1): void {
    this.values.set(key, (this.values.get(key) ?? 0) + by);
  }

  get(key: string): number {
    return this.values.get(key) ?? 0;
  }

  toJSON(): Record<string, number> {
    return Object.fromEntries(this.values);
  }
}

/** Structured summary every tool prints as its final line, for CI to parse. */
export interface RunSummary {
  tool: string;
  runId: string;
  applied: boolean;
  counts: Counter;
  failures: { id: string; reason: string }[];
  artefacts: string[];
}

export function printSummary(summary: RunSummary): void {
  console.log(JSON.stringify({ summary: { ...summary, counts: summary.counts.toJSON() } }, null, 2));
}

export function fail(message: string): never {
  console.error(JSON.stringify({ error: message }));
  process.exit(1);
}

/** Simple token-bucket pacing, so a migration never hammers the legacy host. */
export function rateLimiter(perSecond: number): () => Promise<void> {
  const interval = perSecond > 0 ? 1000 / perSecond : 0;
  let next = 0;
  return async () => {
    if (interval === 0) return;
    const now = Date.now();
    const wait = Math.max(0, next - now);
    next = Math.max(now, next) + interval;
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  };
}

/**
 * Runs `main` only when this module is the command actually being run.
 *
 * Without it, importing a script to exercise one of its functions runs the whole
 * pipeline against whatever argv the test runner happens to carry — which for an
 * importer means a real run with default flags.
 */
export function runAsScript(moduleUrl: string, main: () => Promise<void>): void {
  const entry = process.argv[1];
  if (!entry) return;
  const normalise = (p: string): string => {
    const abs = path.resolve(p);
    return process.platform === 'win32' ? abs.toLowerCase() : abs;
  };
  if (normalise(entry) !== normalise(fileURLToPath(moduleUrl))) return;
  main().catch((err) => {
    console.error(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
    process.exit(1);
  });
}
