/**
 * Validate source/ and emit dist/.
 *
 *   pnpm build                      validate, then write dist/ (version from VOCAB_VERSION or today's -1)
 *   pnpm build --version 2026.10.11-2
 *   pnpm validate                   validate only (same as --check), writes nothing
 *
 * Exits 1 and prints a report grouped by file and line when any rule fails.
 */
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { SCHEMA } from '../src/constants.ts';
import { type Emitted, emit, serialize, withManifest } from '../src/emit.ts';
import { loadFlagIconCodes } from '../src/flags.ts';
import { formatReport } from '../src/issues.ts';
import { loadSource } from '../src/load.ts';
import type { Meta, SourceBundle } from '../src/types.ts';
import { validate } from '../src/validate.ts';
import { datePart, isValidVersion } from '../src/version.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export interface BuildResult {
  ok: boolean;
  report: string;
  bundle: SourceBundle;
  files?: Emitted;
}

export function counts(bundle: SourceBundle): Record<string, number> {
  const countryAliases = bundle.countries.reduce((n, r) => n + (Array.isArray(r.value.aliases) ? r.value.aliases.length : 0), 0);
  const siteAliases = bundle.sites.reduce((n, r) => n + (Array.isArray(r.value.aliases) ? r.value.aliases.length : 0), 0);
  return {
    countries: bundle.countries.length,
    countryAliases,
    countryCodes: bundle.countries.length + countryAliases,
    groups: new Set(bundle.countries.map((r) => r.value.group).filter((g) => typeof g === 'string')).size,
    sites: bundle.sites.length,
    siteAliases,
    siteCodes: bundle.sites.length + siteAliases,
  };
}

/** Load + validate + emit in memory. Pure apart from reading source/. */
export function build(sourceDir: string, meta: Meta): BuildResult {
  const { bundle, issues } = loadSource(sourceDir, ROOT);
  issues.push(...validate(bundle, { flagCodes: loadFlagIconCodes() }));
  if (!isValidVersion(meta.version)) {
    issues.push({ file: '(version)', line: 0, message: `version "${meta.version}" is not YYYY.MM.DD-N with N in 1..9` });
  }
  if (issues.length > 0) {
    return { ok: false, report: formatReport(issues), bundle };
  }
  const files = withManifest(emit(bundle, meta), meta, counts(bundle));
  return { ok: true, report: formatReport([]), bundle, files };
}

function main(): void {
  const { values } = parseArgs({ options: { check: { type: 'boolean', default: false }, version: { type: 'string' }, out: { type: 'string', default: 'dist' } } });
  const version = values.version ?? process.env.VOCAB_VERSION ?? `${datePart(new Date())}-1`;
  const meta: Meta = { schema: SCHEMA, version, generatedAt: new Date().toISOString() };
  const result = build(join(ROOT, 'source'), meta);

  if (!result.ok || !result.files) {
    console.error(result.report);
    process.exit(1);
  }
  const c = counts(result.bundle);
  console.log(
    `${result.report}\n  countries: ${c.countries} entries, ${c.countryAliases} aliases (${c.countryCodes} codes), ${c.groups} groups\n  sites:     ${c.sites} entries, ${c.siteAliases} aliases (${c.siteCodes} codes)`
  );
  if (values.check) {
    return;
  }

  const outDir = resolve(ROOT, values.out);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  for (const [name, value] of Object.entries(result.files)) {
    writeFileSync(join(outDir, name), serialize(value));
  }
  copyFileSync(join(ROOT, 'src', 'public-types.d.ts'), join(outDir, 'types.d.ts'));
  console.log(`Wrote ${Object.keys(result.files).length + 1} files to ${outDir} (version ${version})`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
