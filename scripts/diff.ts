/**
 * Snapshot diff between two built dist/ directories (added / removed / renamed codes,
 * alias remaps and field changes). CI builds the PR base into another directory and
 * appends this output to the job summary.
 *
 *   pnpm diff <baseDist> [headDist=dist]
 *
 * A missing base directory (first build, or base failed to build) is reported, not fatal.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { diffTables, formatDiff } from '../src/diff.ts';
import { FILES } from '../src/emit.ts';

function readTable(dir: string, file: string): Record<string, unknown> | null {
  const path = join(dir, file);
  if (!existsSync(path)) {
    return null;
  }
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

const [baseArg, headArg = 'dist'] = process.argv.slice(2);
if (!baseArg) {
  console.error('usage: pnpm diff <baseDist> [headDist]');
  process.exit(2);
}
const base = resolve(baseArg);
const head = resolve(headArg);
if (!existsSync(join(head, FILES.countriesByCode))) {
  console.error(`no build found in ${head}; run pnpm build first`);
  process.exit(2);
}
const baseVersion = (readTable(base, FILES.manifest)?.version as string | undefined) ?? null;
if (!existsSync(join(base, FILES.countriesByCode))) {
  console.log(`## Vocabulary snapshot diff\n\nNo baseline build at \`${baseArg}\`; every code is new.\n`);
  process.exit(0);
}
console.log(
  formatDiff(
    [
      { title: 'Countries', diff: diffTables(readTable(base, FILES.countriesByCode), readTable(head, FILES.countriesByCode)) },
      { title: 'Launch sites', diff: diffTables(readTable(base, FILES.sitesByCode), readTable(head, FILES.sitesByCode)) },
    ],
    baseVersion ? `base build ${baseVersion}` : baseArg
  )
);
